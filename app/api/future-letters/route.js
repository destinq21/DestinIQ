// ============================================================================
// DestinIQ — Future Me letter delivery cron
// Place at:  app/api/future-letters-cron/route.js
// ----------------------------------------------------------------------------
// Runs daily (see vercel.json). Finds sealed letters whose open day has
// arrived, emails each one as "A message from your past self", marks it sent.
//
// SETUP (one time):
//  1. Run future_letters.sql in Supabase → SQL Editor (creates the table).
//  2. Sign up at https://resend.com (free: 3,000 emails/month) → get API key.
//  3. Vercel → Settings → Environment Variables, add:
//       RESEND_API_KEY            = re_...           (from Resend)
//       SUPABASE_SERVICE_ROLE_KEY = eyJ...           (Supabase → Settings → API
//                                                     → service_role secret.
//                                                     NEVER expose in frontend.)
//       CRON_SECRET               = any-long-random-string
//     (NEXT_PUBLIC_SUPABASE_URL you already have.)
//  4. Add vercel.json (see vercel-cron.json) to the project root → deploy.
//
// SENDER ADDRESS: starts as onboarding@resend.dev (works instantly for
// testing). For "DestinIQ <hello@destiniq.app>", verify destiniq.app in
// Resend → Domains (it gives 3 DNS records to add in Cloudflare — 5 minutes),
// then change FROM below.
// ============================================================================

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FROM = "DestinIQ <onboarding@resend.dev>"; // after domain verify: "DestinIQ <hello@destiniq.app>"
const APP_URL = "https://destiniq.app";

function esc(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br/>"); }

function letterEmailHTML({ name, letter, written_at }){
  const written = new Date(written_at + "T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
  return `
  <div style="background:#0a0800;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#111008;border:1px solid rgba(240,180,41,0.25);border-radius:16px;padding:32px">
      <div style="font-size:11px;letter-spacing:.14em;color:#f0b429;font-family:monospace;margin-bottom:14px">DESTINIQ · FUTURE ME</div>
      <h1 style="color:#e8dcc8;font-size:22px;margin:0 0 6px">💌 A message from your past self</h1>
      <p style="color:rgba(232,220,200,0.6);font-size:14px;margin:0 0 22px">
        ${esc(name)||"You"} wrote this on ${written} and sealed it until today.
      </p>
      <div style="background:rgba(240,180,41,0.06);border:1px solid rgba(240,180,41,0.18);border-radius:12px;padding:20px;color:#e8dcc8;font-size:15px;line-height:1.75;font-style:italic">
        ${esc(letter)}
      </div>
      <p style="color:rgba(232,220,200,0.6);font-size:13px;line-height:1.6;margin:22px 0 26px">
        Take a breath. How much of this still rings true — and how far have you come since?
      </p>
      <a href="${APP_URL}" style="display:inline-block;background:#f0b429;color:#000;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px">
        Reflect on it in DestinIQ →
      </a>
      <p style="color:rgba(232,220,200,0.35);font-size:11px;margin:26px 0 0">
        You received this because you sealed a Future Me letter in DestinIQ.
      </p>
    </div>
  </div>`;
}

export async function GET(req){
  // Auth: only Vercel Cron (or you, with the secret) may trigger this.
  const auth = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const RESEND_KEY = process.env.RESEND_API_KEY;
  const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!RESEND_KEY || !SB_URL || !SB_SVC) {
    return new Response(JSON.stringify({ error: "Missing env vars" }), { status: 500 });
  }

  const sb = createClient(SB_URL, SB_SVC); // service role: bypasses RLS, server-only
  const today = new Date().toISOString().slice(0, 10);

  const { data: due, error } = await sb
    .from("future_letters")
    .select("id,email,name,letter,written_at")
    .eq("sent", false)
    .not("email", "is", null)
    .lte("open_at", today)
    .limit(80); // stay under Resend's 100/day free tier

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!due || due.length === 0) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });

  let sent = 0, failed = 0;
  for (const row of due) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [row.email],
          subject: "💌 A message from your past self",
          html: letterEmailHTML(row),
        }),
      });
      if (r.ok) {
        await sb.from("future_letters").update({ sent: true, sent_at: new Date().toISOString() }).eq("id", row.id);
        sent++;
      } else { failed++; }
    } catch { failed++; }
  }
  return new Response(JSON.stringify({ ok: true, sent, failed }), { status: 200 });
}