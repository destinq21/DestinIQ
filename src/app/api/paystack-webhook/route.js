// app/api/paystack-webhook/route.ts
// Receives Paystack payment events and updates Supabase accordingly.
// Add PAYSTACK_SECRET_KEY to your .env.local and Vercel environment variables.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Service role key bypasses RLS — only used server-side in webhooks
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Add this to .env.local
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-paystack-signature") || "";

  // 1. Verify the request is genuinely from Paystack
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY || "")
    .update(body)
    .digest("hex");

  if (hash !== signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(body);

  // 2. Handle charge success
  if (event.event === "charge.success") {
    const { customer, metadata, amount, plan } = event.data;
    const email = customer?.email;
    const userId = metadata?.userId; // Pass userId in Paystack metadata when initiating payment

    if (!email && !userId) {
      return NextResponse.json({ error: "No user identifier" }, { status: 400 });
    }

    // Determine plan type from amount (in kobo/pesewas)
    const amountInMain = amount / 100;
    const isPremium = amountInMain >= 15; // GHS 15+ = Premium
    const isAnnual = amountInMain >= 99;  // GHS 99+ = Annual

    // Find user by email if no userId in metadata
    let targetUserId = userId;
    if (!targetUserId && email) {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      const match = users?.users?.find(u => u.email === email);
      targetUserId = match?.id;
    }

    if (!targetUserId) {
      console.error("Paystack webhook: user not found for email", email);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update user profile in Supabase
    const { error } = await supabaseAdmin
      .from("user_profiles")
      .upsert({
        user_id: targetUserId,
        is_paid: true,
        is_premium: isPremium,
        subscription_plan: isAnnual ? "annual" : isPremium ? "pro" : "basic",
        subscription_start: new Date().toISOString(),
        subscription_end: isAnnual
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json({ error: "DB update failed" }, { status: 500 });
    }

    console.log(`✓ Payment confirmed for user ${targetUserId} — plan: ${isPremium ? "premium" : "basic"}`);
  }

  // 3. Handle subscription cancellation / charge failure
  if (event.event === "subscription.disable" || event.event === "charge.failed") {
    const email = event.data?.customer?.email;
    const userId = event.data?.metadata?.userId;

    let targetUserId = userId;
    if (!targetUserId && email) {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      const match = users?.users?.find(u => u.email === email);
      targetUserId = match?.id;
    }

    if (targetUserId) {
      await supabaseAdmin.from("user_profiles").update({
        is_paid: false,
        is_premium: false,
        subscription_plan: null,
        updated_at: new Date().toISOString(),
      }).eq("user_id", targetUserId);

      console.log(`Subscription disabled for user ${targetUserId}`);
    }
  }

  return NextResponse.json({ received: true });
}
