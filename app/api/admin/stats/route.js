// app/api/admin/stats/route.js
// ─────────────────────────────────────────────────────────────────────────────
// Admin dashboard backend.
//
// SERVER-SIDE because Supabase RLS only lets a signed-in user read their OWN
// row — the browser could never count other users (→ five zeros) nor approve a
// testimonial (the UPDATE was silently rejected while the UI flipped anyway).
//
// SCHEMA-AGNOSTIC by design. The live user_profiles table does NOT have `name`,
// `country`, `created_at` or `is_premium` as columns — name and country live
// inside the `form_data` JSON blob. So we never name columns we're not certain
// of: we `select("*")`, take whatever the table actually has, and read the rest
// out of form_data. A schema change can no longer blank the dashboard.
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
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { err: json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set on the server" }, 500) };
  }
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { err: json({ error: "Not authenticated" }, 401) };
  const { data, error } = await admin.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return { err: json({ error: "Invalid session" }, 401) };
  if (!ADMIN_EMAILS.includes((user.email || "").toLowerCase())) {
    return { err: json({ error: `Not authorized (${user.email})` }, 403) };
  }
  return { user };
}

async function safe(label, fn) {
  try {
    const res = await fn();
    if (res?.error) return { ok: false, error: `${label}: ${res.error.message}` };
    return { ok: true, value: res, error: null };
  } catch (e) {
    return { ok: false, error: `${label}: ${e?.message || "failed"}` };
  }
}

// form_data may arrive as an object or as a JSON string. Handle both.
function fd(row) {
  const raw = row?.form_data;
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}
const pick = (row, ...keys) => {
  const f = fd(row);
  for (const k of keys) {
    if (row?.[k] != null && row[k] !== "") return row[k];
    if (f?.[k] != null && f[k] !== "") return f[k];
  }
  return "";
};

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

export async function GET(req) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const warnings = [];

  // Only two things we KNOW exist: the table, and is_paid. Everything else is
  // read from the rows themselves rather than named in a select.
  const [rTotal, rPaid, rRows, rTestimonials, rReferrals] = await Promise.all([
    safe("total", () => admin.from("user_profiles").select("user_id", { count: "exact", head: true })),
    safe("paid",  () => admin.from("user_profiles").select("user_id", { count: "exact", head: true }).eq("is_paid", true)),
    safe("rows",  () => admin.from("user_profiles").select("*").limit(2000)),
    safe("testimonials", () => admin.from("testimonials").select("*").order("created_at", { ascending: false }).limit(50)),
    safe("referrals",    () => admin.from("referrals").select("id", { count: "exact", head: true })),
  ]);

  [rTotal, rPaid, rRows, rTestimonials, rReferrals].forEach(r => { if (r.error) warnings.push(r.error); });
  if (!rTotal.ok) return json({ error: rTotal.error, warnings }, 500);

  const rows = rRows.ok ? (rRows.value.data || []) : [];
  const today = new Date().toISOString().slice(0, 10);
  const d7 = daysAgo(7).slice(0, 10);
  const d1 = daysAgo(1), d7f = daysAgo(7), d30f = daysAgo(30);

  // Derive everything from the rows we actually got back.
  const createdOf = (r) => r.created_at || r.updated_at || null;
  const newSince = (iso) => rows.filter(r => { const c = createdOf(r); return c && c >= iso; }).length;

  const promaxUsers = rows.filter(r => r.is_premium === true).length;
  const activeToday = rows.filter(r => r.last_checkin_date === today).length;
  const active7d    = rows.filter(r => r.last_checkin_date && r.last_checkin_date >= d7).length;
  const onStreak    = rows.filter(r => (r.streak || 0) >= 7).length;

  // country lives in form_data, not as a column
  const byCountry = {};
  rows.forEach(r => {
    const c = String(pick(r, "country")).trim();
    if (c) byCountry[c] = (byCountry[c] || 0) + 1;
  });
  const topCountries = Object.entries(byCountry)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([country, users]) => ({ country, users }));

  // Recent users — name comes out of form_data
  const recent = rows
    .slice()
    .sort((a, b) => String(createdOf(b) || "").localeCompare(String(createdOf(a) || "")))
    .slice(0, 25)
    .map(r => ({
      user_id: r.user_id,
      name: pick(r, "name") || "—",
      country: pick(r, "country") || "",
      is_paid: !!r.is_paid,
      is_premium: !!r.is_premium,
      streak: r.streak || 0,
      created_at: createdOf(r),
    }));

  const totalUsers = rTotal.value.count || 0;
  const paidUsers  = rPaid.ok ? (rPaid.value.count || 0) : 0;
  const proOnly    = Math.max(0, paidUsers - promaxUsers);
  const testimonials = rTestimonials.ok ? (rTestimonials.value.data || []) : [];

  return json({
    stats: {
      totalUsers,
      paidUsers,
      promaxUsers,
      freeUsers: Math.max(0, totalUsers - paidUsers),
      testimonialsPending: testimonials.filter(t => !t.approved).length,
      totalReferrals: rReferrals.ok ? (rReferrals.value.count || 0) : 0,

      newToday: newSince(d1),
      new7d:    newSince(d7f),
      new30d:   newSince(d30f),

      activeToday,
      active7d,
      onStreak,

      estMRR: Math.round((proOnly * MRR.pro + promaxUsers * MRR.promax) * 100) / 100,
      conversionRate: totalUsers ? Math.round((paidUsers / totalUsers) * 1000) / 10 : 0,
    },
    topCountries,
    testimonials,
    users: recent,
    warnings,
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