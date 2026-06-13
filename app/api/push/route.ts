// app/api/push/route.ts
// Sends push notifications to subscribed users via Web Push API.
// Requires VAPID keys — generate once with: npx web-push generate-vapid-keys
// Add to .env.local:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY=BK2_fbqSHPaWm5EB9tEWQuxYNBGZjhJb6XcgNt_RjdlYzT6t0RX0dhTdGjdtvk-xlWXQF_jOpSWPFOkN4kP5Afg
//   VAPID_PRIVATE_KEY=w5nyRKZz549CYg-BSfrJ9e81cgjfBJzMDR9L3VXHoJI
//   VAPID_EMAIL=mailto:destiniq21@email.com

import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || "mailto:destiniq@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || "",
);

// Random motivational nudges
const NUDGES = [
  { title: "Hey, how's today going?", body: "You haven't checked in yet. 30 seconds is all it takes." },
  { title: "Your streak is waiting 🔥", body: "Don't let it break today. Log your check-in now." },
  { title: "Quick question, {name}", body: "What's the one thing you're doing today toward your goal?" },
  { title: "DestinIQ reminder", body: "Your momentum score updates when you show up. Today counts." },
  { title: "Still thinking about your report?", body: "The advisor is ready when you are. Ask anything." },
  { title: "3-day check ✓", body: "You're building a habit. Keep the streak going — tap to log." },
  { title: "Your goal hasn't changed", body: "But today's action can. Come back and take the next step." },
  { title: "Weekly pulse is ready 📊", body: "See what patterns emerged this week. It might surprise you." },
];

export async function POST(req: NextRequest) {
  const { userId, type } = await req.json();

  // Fetch user's push subscription from Supabase
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("push_subscription, name")
    .eq("user_id", userId)
    .single();

  if (!profile?.push_subscription) {
    return NextResponse.json({ error: "No subscription" }, { status: 404 });
  }

  // Pick a random nudge
  const nudge = NUDGES[Math.floor(Math.random() * NUDGES.length)];
  const title = nudge.title.replace("{name}", profile.name || "");
  const body  = nudge.body.replace("{name}", profile.name || "");

  try {
    await webpush.sendNotification(
      profile.push_subscription,
      JSON.stringify({
        title,
        body,
        url: "https://destiniq.vercel.app",
        tag: "destiniq-nudge",
      })
    );
    return NextResponse.json({ sent: true });
  } catch (err: any) {
    // Subscription expired — remove it
    if (err.statusCode === 410) {
      await supabaseAdmin
        .from("user_profiles")
        .update({ push_subscription: null })
        .eq("user_id", userId);
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — send nudges to all users who haven't checked in today
// Call this from a Vercel Cron Job: schedule "0 10,18 * * *" (10am and 6pm daily)
export async function GET(req: NextRequest) {
  // Verify cron secret to prevent abuse
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toDateString();

  // Get all users with push subscriptions
  const { data: profiles } = await supabaseAdmin
    .from("user_profiles")
    .select("user_id, name, push_subscription")
    .not("push_subscription", "is", null);

  if (!profiles?.length) return NextResponse.json({ sent: 0 });

  // Check who hasn't logged today
  const { data: todayLogs } = await supabaseAdmin
    .from("momentum_logs")
    .select("user_id")
    .eq("date", today);

  const loggedToday = new Set(todayLogs?.map(l => l.user_id) || []);

  let sent = 0;
  for (const profile of profiles) {
    if (loggedToday.has(profile.user_id)) continue; // already checked in

    const nudge = NUDGES[Math.floor(Math.random() * NUDGES.length)];
    try {
      await webpush.sendNotification(
        profile.push_subscription,
        JSON.stringify({
          title: nudge.title.replace("{name}", profile.name || ""),
          body: nudge.body.replace("{name}", profile.name || ""),
          url: "https://destiniq.vercel.app",
          tag: "destiniq-nudge",
        })
      );
      sent++;
    } catch (err: any) {
      if (err.statusCode === 410) {
        await supabaseAdmin
          .from("user_profiles")
          .update({ push_subscription: null })
          .eq("user_id", profile.user_id);
      }
    }
  }

  return NextResponse.json({ sent, total: profiles.length });
}
