// app/api/future-letters/route.ts
// Daily cron: finds sealed letters due today and emails them via Resend.
// Secured by CRON_SECRET so only Vercel Cron can trigger it.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  // Verify this is Vercel Cron (or you, with the secret)
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!   // service role — server only
  );

  const today = new Date().toISOString().slice(0, 10);

  const { data: due, error } = await supabase
    .from("future_letters")
    .select("*")
    .lte("open_at", today)
    .eq("sent", false)
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!due?.length) return NextResponse.json({ sent: 0 });

  let sent = 0;
  for (const letter of due) {
    if (letter.email) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "DestinIQ <hello@destiniq.app>",
            to: letter.email,
            subject: "📬 You have a message from your past self",
            html: `
              <div style="background:#0a0800;padding:40px 24px;font-family:Arial,sans-serif;border-radius:16px">
                <div style="text-align:center;margin-bottom:28px">
                  <div style="font-size:40px">📬</div>
                  <h1 style="color:#e8dcc8;font-size:22px;margin:10px 0 4px">
                    ${letter.name || "Hey"}, past you left something for today
                  </h1>
                  <p style="color:rgba(232,220,200,0.5);font-size:13px;margin:0">
                    Written on ${new Date(letter.written_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    ${letter.mood ? ` · you were feeling ${letter.mood}` : ""}
                  </p>
                </div>
                <div style="background:rgba(240,180,41,0.06);border:1px solid rgba(240,180,41,0.25);border-radius:14px;padding:24px;margin-bottom:24px">
                  <p style="color:#f0b429;font-size:11px;letter-spacing:2px;margin:0 0 12px">DEAR FUTURE ${(letter.name || "ME").toUpperCase()},</p>
                  <p style="color:#e8dcc8;font-size:15px;line-height:1.9;margin:0;white-space:pre-wrap">${(letter.letter || "").replace(/</g, "&lt;")}</p>
                </div>
                <p style="color:rgba(232,220,200,0.6);font-size:14px;line-height:1.7;text-align:center">
                  Did you achieve what you hoped for?<br/>What's changed since you wrote this?
                </p>
                <div style="text-align:center;margin-top:24px">
                  <a href="https://destiniq.app" style="background:#f0b429;color:#000;text-decoration:none;padding:13px 30px;border-radius:10px;font-weight:bold;font-size:14px">
                    Reflect on the journey →
                  </a>
                </div>
              </div>`,
          }),
        });
        sent++;
      } catch (_e) { /* keep going — mark unsent letters for retry tomorrow */ continue; }
    }
    await supabase.from("future_letters").update({ sent: true }).eq("id", letter.id);
  }

  return NextResponse.json({ sent, checked: due.length });
}
