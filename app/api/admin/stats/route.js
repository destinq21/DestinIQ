// src/app/api/admin/stats/route.js
// ─────────────────────────────────────────────────────────────────────────────
// The admin control panel's backend.
//
// WHY THIS IS SERVER-SIDE:
// Supabase Row Level Security only lets a signed-in user touch their OWN row.
// The old dashboard queried user_profiles straight from the browser, so it could
// never see other users (→ five zeros) and could never APPROVE a testimonial
// (the UPDATE was silently rejected while the UI optimistically flipped the
// toggle anyway — so approvals appeared to work and never did).
//
// Everything here runs with the service-role key, which bypasses RLS, and every
// request verifies the caller is a real admin first.
//
//   GET  /api/admin/stats  → full dashboard payload
//   POST /api/admin/stats  → approve / unapprove / delete a testimonial
//
// Env (already set for /api/email):
//   SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAILS = ["destiniq21@gmail.com", "support@destiniq.app"];

// Keep roughly in sync with PLANS. Used only for an MRR estimate.
const MRR = { pro: 9.99, promax: 24.99 };

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const json = (b, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

async function requireAdmin(req) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { err: json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set on the server" }, 500) };
  }
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { err: json({ error: "Not authenticated" }, 401) };

  const { data, error } = await admin.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return { err: json({ error: "Invalid session" }, 401) };
  if (!ADMIN_EMAILS.includes((user.email || "").toLowerCase())) {
    return { err: json({ error: "Not authorized" }, 403) };
  }
  return { user };
}

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

export async function GET(req) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    const count = (q) => q.select("user_id", { count: "exact", head: true });

    const [total, paid, promax, new1, new7, new30, testimonials, referrals, recent, allProfiles] =
      await Promise.all([
        count(admin.from("user_profiles")),
        count(admin.from("user_profiles")).eq("is_paid", true),
        count(admin.from("user_profiles")).eq("is_premium", true),
        count(admin.from("user_profiles")).gte("created_at", daysAgo(1)),
        count(admin.from("user_profiles")).gte("created_at", daysAgo(7)),
        count(admin.from("user_profiles")).gte("created_at", daysAgo(30)),
        admin.from("testimonials").select("*").order("created_at", { ascending: false }).limit(50),
        admin.from("referrals").select("id", { count: "exact", head: true }),
        admin
          .from("user_profiles")
          .select("user_id,name,is_paid,is_premium,streak,created_at,last_checkin_date,country")
          .order("created_at", { ascending: false })
          .limit(25),
        admin
          .from("user_profiles")
          .select("streak,last_checkin_date,country,is_paid,created_at")
          .limit(2000),
      ]);

    // Surface real errors instead of quietly reporting zeros.
    const bad = [total, paid, testimonials, recent, allProfiles].find((r) => r?.error);
    if (bad?.error) return json({ error: bad.error.message || "Query failed" }, 500);

    const rows = allProfiles.data || [];
    const today = new Date().toISOString().slice(0, 10);
    const d7 = daysAgo(7).slice(0, 10);

    const activeToday = rows.filter((r) => r.last_checkin_date === today).length;
    const active7d = rows.filter((r) => r.last_checkin_date && r.last_checkin_date >= d7).length;
    const onStreak = rows.filter((r) => (r.streak || 0) >= 7).length;

    // Where your users actually are — this is what should drive regional pricing.
    const byCountry = {};
    rows.forEach((r) => {
      const c = (r.country || "Unknown").trim() || "Unknown";
      byCountry[c] = (byCountry[c] || 0) + 1;
    });
    const topCountries = Object.entries(byCountry)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([country, users]) => ({ country, users }));

    const totalUsers = total.count || 0;
    const paidUsers = paid.count || 0;
    const promaxUsers = promax.count || 0;
    const proOnly = Math.max(0, paidUsers - promaxUsers);

    return json({
      stats: {
        totalUsers,
        paidUsers,
        promaxUsers,
        freeUsers: Math.max(0, totalUsers - paidUsers),
        testimonialsPending: (testimonials.data || []).filter((t) => !t.approved).length,
        totalReferrals: referrals.count || 0,

        // Growth
        newToday: new1.count || 0,
        new7d: new7.count || 0,
        new30d: new30.count || 0,

        // Engagement — the numbers that actually predict revenue
        activeToday,
        active7d,
        onStreak,

        // Money (estimate — a true figure needs Paystack reconciliation)
        estMRR: Math.round((proOnly * MRR.pro + promaxUsers * MRR.promax) * 100) / 100,
        conversionRate: totalUsers ? Math.round((paidUsers / totalUsers) * 1000) / 10 : 0,
      },
      topCountries,
      testimonials: testimonials.data || [],
      users: recent.data || [],
    });
  } catch (e) {
    return json({ error: e?.message || "Failed to load admin stats" }, 500);
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────
// These MUST run server-side. From the browser, RLS silently rejected the UPDATE
// while the UI flipped the toggle anyway, so approvals never persisted.
export async function POST(req) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    const { action, id } = await req.json();
    if (!id) return json({ error: "Missing testimonial id" }, 400);

    if (action === "approve" || action === "unapprove") {
      const { error } = await admin
        .from("testimonials")
        .update({ approved: action === "approve" })
        .eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, id, approved: action === "approve" });
    }

    if (action === "delete") {
      const { error } = await admin.from("testimonials").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, id, deleted: true });
    }

    return json({ error: "Unknown action: " + action }, 400);
  } catch (e) {
    return json({ error: e?.message || "Action failed" }, 500);
  }
}