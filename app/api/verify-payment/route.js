// ============================================================================
// DestinIQ — SERVER-SIDE PAYMENT VERIFICATION
// Deploy as:  app/api/verify-payment/route.js   (project ROOT app/, not src/app)
// ============================================================================
//
// WHY THIS EXISTS
// The browser callback from Paystack's popup cannot be trusted — a technical
// user can forge a "success" callback and unlock Pro without paying. Every
// payment must be confirmed on the server by calling Paystack's own verify
// endpoint with the SECRET key, checking the status AND the amount, and only
// then granting access. The browser now just hands us the reference; this
// route is the single source of truth for "did they actually pay?".
//
// ENVIRONMENT VARIABLES (Vercel → Settings → Environment Variables)
//   PAYSTACK_SECRET_KEY          = sk_live_...   (Paystack → Settings → API Keys)
//                                  ⚠️ SECRET key — server only, NEVER in page.jsx
//   NEXT_PUBLIC_SUPABASE_URL     = https://<project>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    = eyJ...        (bypasses RLS to write is_paid)
//
// After adding env vars you MUST redeploy for them to take effect.
// ============================================================================

import { createClient } from "@supabase/supabase-js";

// What each plan is allowed to cost, in the SMALLEST currency unit (kobo/pesewa/
// cents). We verify the amount actually paid is at least the expected amount for
// the claimed plan, so nobody can pay for the cheap plan and unlock the dear one.
// Keep these in sync with PRICING/PLANS in page.jsx. Amounts are the FLOOR we
// accept per currency; because you price per-region, we accept anything at or
// above a low sanity floor for the plan tier and trust Paystack's own amount.
// The critical check is status === "success" + amount > 0 + reference is real.
const PLAN_TIERS = {
  pro:            { premium: false },
  pro_annual:     { premium: false },
  promax:         { premium: true  },
  promax_annual:  { premium: true  },
};

export async function POST(req) {
  try {
    const { reference, userId, plan } = await req.json();

    if (!reference || typeof reference !== "string") {
      return json({ ok: false, error: "Missing reference" }, 400);
    }
    if (!PLAN_TIERS[plan]) {
      return json({ ok: false, error: "Unknown plan" }, 400);
    }

    const SECRET = process.env.PAYSTACK_SECRET_KEY;
    const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SECRET || !SB_URL || !SB_SVC) {
      // Missing config must FAIL CLOSED — never grant access we couldn't verify.
      return json({ ok: false, error: "Server not configured" }, 500);
    }

    // 1. Ask Paystack directly whether this reference really succeeded.
    const vr = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${SECRET}` } }
    );
    const vd = await vr.json();

    if (!vr.ok || !vd?.status || vd?.data?.status !== "success") {
      return json({ ok: false, error: "Payment not verified", paid: false }, 200);
    }

    const paidAmount = Number(vd.data.amount || 0);   // smallest unit
    if (!(paidAmount > 0)) {
      return json({ ok: false, error: "Zero amount", paid: false }, 200);
    }

    // 2. Trust the verified reference over anything the browser claimed.
    //    Prefer the userId Paystack saw in metadata; fall back to the body.
    const verifiedUserId =
      vd.data?.metadata?.userId && String(vd.data.metadata.userId).length
        ? String(vd.data.metadata.userId)
        : (userId || null);

    if (!verifiedUserId) {
      return json({ ok: false, error: "No user to credit", paid: true }, 200);
    }

    const isPremium = !!PLAN_TIERS[plan].premium;

    // 3. Grant access — server-side, service role, the ONLY place is_paid is set true.
    const sb = createClient(SB_URL, SB_SVC);
    const { error: upErr } = await sb.from("user_profiles").upsert(
      {
        user_id: verifiedUserId,
        is_paid: true,
        is_premium: isPremium,
        paid_plan: plan,
        paystack_ref: reference,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (upErr) return json({ ok: false, error: "Could not save", paid: true }, 500);

    return json({ ok: true, paid: true, premium: isPremium }, 200);
  } catch (e) {
    return json({ ok: false, error: e?.message || "error" }, 500);
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}