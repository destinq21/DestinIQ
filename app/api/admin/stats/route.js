// app/api/admin/stats/route.js
// ─────────────────────────────────────────────────────────────────────────────
// Admin dashboard backend.
//
// WHY SERVER-SIDE: Supabase Row Level Security only lets a signed-in user touch
// their OWN row. The old dashboard queried user_profiles from the BROWSER, so it
// could never count other users (→ five zeros) and could never approve a
// testimonial (the UPDATE was silently rejected while the UI flipped the toggle
// anyway). Service role bypasses RLS. Admin identity is verified first.
//
// FAULT TOLERANCE: every query is isolated. If a column or table doesn't exist
// in your schema (e.g. `country`, `referrals`), that ONE number degrades to null
// and reports why — the rest of the dashboard still loads. A missing column must
// never blank the whole page.
//
//   GET  /api/admin/stats  → dashboard payload
//   POST /api/admin/stats  → approve / unapprove / delete a testimonial
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAILS = ["destiniq21@gmail.com", "support@destiniq.app"];
const MRR = { pro: 9.99, promax: 24.99 };

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const json = (b, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

async function requireAdmin(req) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { err: json({ error: "NEXT_PUBLIC_SUPABASE_URL is not set on the server" }, 500) };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { err: json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set on the server" }, 500) };
  }
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { err: json({ error: "Not authenticated" }, 401) };

  const { data, error } = await admin.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return { err: json({ error: "Invalid session: " + (error?.message || "no user") }, 401) };
  if (!ADMIN_EMAILS.includes((user.email || "").toLowerCase())) {
    return { err: json({ error: `Not authorized (${user.email})` }, 403) };
  }
  return { user };
}

// Run a query in isolation. Never throws. Returns {ok, value, error}.
async function safe(label, fn, fallback = null) {
  try {
    const res = await fn();
    if (res?.error) return { ok: false, value: fallback, error: `${label}: ${res.error.message}` };
    return { ok: true, value: res, error: null };
  } catch (e) {
    return { ok: false, value: fallback, error: `${label}: ${e?.message || "failed"}` };
  }
}

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

export async function GET(req) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const warnings = [];
  const T = admin.from("user_profiles");
  const cnt = (q) => q.select("user_id", { count: "exact", head: true });

  // Each of these is independent. One failing cannot blank the dashboard.
  const [
    rTotal, rPaid, rPromax, rNew1, rNew7, rNew30,
    rTestimonials, rReferrals, rRecent, rAll,
  ] = await Promise.all([
    safe("total",        () => cnt(admin.from("user_profiles"))),
    safe("paid",         () => cnt(admin.from("user_profiles")).eq("is_paid", true)),
    safe("promax",       () => cnt(admin.from("user_profiles")).eq("is_premium", true)),
    safe("new today",    () => cnt(admin.from("user_profiles")).gte("created_at", daysAgo(1))),
    safe("new 7d",       () => cnt(admin.from("user_profiles")).gte("created_at", daysAgo(7))),
    safe("new 30d",      () => cnt(admin.from("user_profiles")).gte("created_at", daysAgo(30))),
    safe("testimonials", () => admin.from("testimonials").select("*").order("created_at", { ascending: false }).limit(50)),
    safe("referrals",    () => admin.from("referrals").select("id", { count: "exact", head: true })),
    safe("recent users", () => admin.from("user_profiles")
        .select("user_id,name,is_paid,is_premium,streak,created_at")
        .order("created_at", { ascending: false }).limit(25)),
    // `country` / `last_checkin_date` may not exist in your schema — isolated on purpose.
    safe("engagement",   () => admin.from("user_profiles")
        .select("streak,last_checkin_date,country,is_paid").limit(2000)),
  ]);

  [rTotal, rPaid, rPromax, rNew1, rNew7, rNew30, rTestimonials, rReferrals, rRecent, rAll]
    .forEach((r) => { if (r.error) warnings.push(r.error); });

  // If we can't even count users, something is genuinely wrong — say so loudly.
  if (!rTotal.ok) {
    return json({ error: rTotal.error, warnings }, 500);
  }

  const rows = rAll.ok ? (rAll.value.data || []) : [];
  const today = new Date().toISOString().slice(0, 10);
  const d7 = daysAgo(7).slice(0, 10);

  const activeToday = rows.filter((r) => r.last_checkin_date === today).length;
  const active7d = rows.filter((r) => r.last_checkin_date && r.last_checkin_date >= d7).length;
  const onStreak = rows.filter((r) => (r.streak || 0) >= 7).length;

  const byCountry = {};
  rows.forEach((r) => {
    const c = (r.country || "").trim();
    if (c) byCountry[c] = (byCountry[c] || 0) + 1;
  });
  const topCountries = Object.entries(byCountry)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([country, users]) => ({ country, users }));

  const totalUsers = rTotal.value.count || 0;
  const paidUsers = rPaid.ok ? (rPaid.value.count || 0) : 0;
  const promaxUsers = rPromax.ok ? (rPromax.value.count || 0) : 0;
  const proOnly = Math.max(0, paidUsers - promaxUsers);
  const testimonials = rTestimonials.ok ? (rTestimonials.value.data || []) : [];

  return json({
    stats: {
      totalUsers,
      paidUsers,
      promaxUsers,
      freeUsers: Math.max(0, totalUsers - paidUsers),
      testimonialsPending: testimonials.filter((t) => !t.approved).length,
      totalReferrals: rReferrals.ok ? (rReferrals.value.count || 0) : 0,

      newToday: rNew1.ok ? (rNew1.value.count || 0) : 0,
      new7d:    rNew7.ok ? (rNew7.value.count || 0) : 0,
      new30d:   rNew30.ok ? (rNew30.value.count || 0) : 0,

      activeToday,
      active7d,
      onStreak,

      estMRR: Math.round((proOnly * MRR.pro + promaxUsers * MRR.promax) * 100) / 100,
      conversionRate: totalUsers ? Math.round((paidUsers / totalUsers) * 1000) / 10 : 0,
    },
    topCountries,
    testimonials,
    users: rRecent.ok ? (rRecent.value.data || []) : [],
    warnings,   // shown in the UI so a missing column is visible, not invisible
  });
}

export async function POST(req) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    const { action, id } = await req.json();
    if (!id) return json({ error: "Missing testimonial id" }, 400);

    if (action === "approve" || action === "unapprove") {
      const { error } = await admin.from("testimonials")
        .update({ approved: action === "approve" }).eq("id", id);
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