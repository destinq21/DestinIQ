/**
 * DestinIQ — Paystack Webhook Handler
 * File: src/app/api/paystack-webhook/route.js
 *
 * PURPOSE:
 * When a user pays via Paystack, this endpoint receives a server-to-server
 * notification from Paystack and writes is_paid=true to Supabase.
 * This is the AUTHORITATIVE source of truth for subscription status —
 * the client-side write in Paywall is a best-effort optimistic update;
 * this webhook is the guaranteed fallback.
 *
 * SETUP:
 * 1. Add to Vercel env vars:
 *    PAYSTACK_SECRET_KEY=sk_live_xxxx          (your Paystack secret key)
 *    PAYSTACK_WEBHOOK_SECRET=whsec_xxxx        (from Paystack Dashboard → Settings → Webhooks)
 *    SUPABASE_URL=https://xxx.supabase.co      (same as NEXT_PUBLIC_SUPABASE_URL)
 *    SUPABASE_SERVICE_ROLE_KEY=eyJxxx          (from Supabase → Settings → API → service_role key)
 *
 * 2. In Paystack Dashboard → Settings → Webhooks:
 *    Add URL: https://your-domain.vercel.app/api/paystack-webhook
 *    Select events: charge.success, subscription.disable
 *
 * 3. Deploy — Vercel will handle the rest.
 */

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Supabase admin client — bypasses RLS so we can write any user's profile
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Verify the webhook signature from Paystack.
 * Paystack signs requests with HMAC-SHA512 using your secret key.
 */
function verifyPaystackSignature(rawBody, signature) {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.warn("PAYSTACK_WEBHOOK_SECRET not set — skipping signature verification");
    return true; // Allow in dev; require in prod
  }
  const hash = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");
  return hash === signature;
}

/**
 * Find a user by email in Supabase auth.
 * Paystack sends us the customer email, not the user_id.
 */
async function findUserByEmail(email) {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;
    return data.users.find(u => u.email?.toLowerCase() === email?.toLowerCase()) || null;
  } catch (e) {
    console.error("findUserByEmail:", e.message);
    return null;
  }
}

export async function POST(request) {
  // ── 1. Read raw body (needed for signature verification) ──────────────────
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature") || "";

  // ── 2. Verify signature ───────────────────────────────────────────────────
  if (!verifyPaystackSignature(rawBody, signature)) {
    console.error("Paystack webhook: invalid signature");
    return new Response("Invalid signature", { status: 401 });
  }

  // ── 3. Parse event ────────────────────────────────────────────────────────
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { event: eventType, data } = event;
  console.log("Paystack webhook received:", eventType, data?.reference);

  // ── 4. Handle events ──────────────────────────────────────────────────────

  // charge.success — a one-time payment or subscription charge succeeded
  if (eventType === "charge.success") {
    const email = data?.customer?.email;
    const reference = data?.reference;
    const plan = data?.metadata?.plan || "pro";
    const amount = data?.amount; // in smallest currency unit

    if (!email) {
      console.warn("charge.success: no customer email in event");
      return new Response("OK", { status: 200 }); // still 200 so Paystack doesn't retry
    }

    // Find the user in Supabase
    const user = await findUserByEmail(email);
    if (!user) {
      console.warn(`charge.success: no user found for email ${email}`);
      // Could be a new user who paid before confirming email — log and continue
      return new Response("OK", { status: 200 });
    }

    // Write is_paid=true to user_profiles
    const { error } = await supabaseAdmin
      .from("user_profiles")
      .upsert({
        user_id: user.id,
        is_paid: true,
        paystack_ref: reference,
        paid_plan: plan,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (error) {
      console.error("charge.success DB write error:", error.message);
      return new Response("DB error", { status: 500 });
    }

    console.log(`✓ is_paid=true written for user ${user.id} (ref: ${reference})`);
  }

  // subscription.disable — subscription was cancelled or expired
  if (eventType === "subscription.disable") {
    const email = data?.customer?.email;

    if (email) {
      const user = await findUserByEmail(email);
      if (user) {
        await supabaseAdmin
          .from("user_profiles")
          .upsert({
            user_id: user.id,
            is_paid: false,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

        console.log(`✓ is_paid=false written for user ${user.id} (subscription disabled)`);
      }
    }
  }

  // Always return 200 so Paystack doesn't keep retrying
  return new Response("OK", { status: 200 });
}

// Paystack sends POST only
export async function GET() {
  return new Response("DestinIQ Paystack webhook endpoint", { status: 200 });
}
