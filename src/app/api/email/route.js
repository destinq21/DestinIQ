// app/api/email/route.js
// ─────────────────────────────────────────────────────────────────────────────
// Sends email as support@destiniq.app via Resend.
//
// Auth model (prevents this from being an open relay):
//   • An ADMIN (support@destiniq.app) may email ANY recipient — used by the
//     admin dashboard "Compose / reply" feature.
//   • Any other signed-in user may ONLY email their OWN address — used by the
//     welcome email that fires on signup.
//
// Replies from recipients go to support@destiniq.app (reply_to), so they land
// in whatever inbox you already receive support@ mail on — no change to your
// inbound setup.
//
// Required env vars (set in your host + .env.local — server-only, never NEXT_PUBLIC):
//   RESEND_API_KEY=re_xxxxxxxx
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...        (Supabase → Settings → API → service_role)
//   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co   (already set for the app)
//
// Install: npm install resend
// ─────────────────────────────────────────────────────────────────────────────

import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // Resend SDK needs the Node runtime, not edge.

const ADMIN_EMAILS = ["support@destiniq.app"];
const FROM = "DestinIQ Support <support@destiniq.app>";
const REPLY_TO = "support@destiniq.app";

const resend = new Resend(process.env.RESEND_API_KEY);

// Service-role client — server-only. Used to verify the caller's JWT and to
// look up a user's email by id. NEVER expose the service role key to the client.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req) {
  try {
    if (!process.env.RESEND_API_KEY) return json({ error: "Email not configured (RESEND_API_KEY missing)" }, 500);

    // 1) Verify the caller's Supabase session from the Authorization header.
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Not authenticated" }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const caller = userData?.user;
    if (userErr || !caller) return json({ error: "Invalid session" }, 401);

    const isAdmin = ADMIN_EMAILS.includes(caller.email);

    // 2) Parse the request.
    const { to, userId, subject, html, text, replyTo } = await req.json();
    const cleanSubject = (subject || "").toString().trim();
    if (!cleanSubject) return json({ error: "Subject is required" }, 400);
    if (!html && !text) return json({ error: "Message body is required" }, 400);

    // 3) Resolve the recipient address.
    let recipient = (to || "").toString().trim();
    if (userId) {
      // Looking a user up by id is an admin-only action.
      if (!isAdmin) return json({ error: "Not authorized" }, 403);
      const { data: target, error: lookupErr } = await admin.auth.admin.getUserById(userId);
      if (lookupErr || !target?.user?.email) return json({ error: "User not found" }, 404);
      recipient = target.user.email;
    }
    if (!recipient) return json({ error: "No recipient" }, 400);

    // 4) Authorize: admins can email anyone; everyone else only themselves.
    if (!isAdmin && recipient.toLowerCase() !== (caller.email || "").toLowerCase()) {
      return json({ error: "Not authorized to email this recipient" }, 403);
    }

    // 5) Send via Resend.
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [recipient],
      subject: cleanSubject,
      html: html || undefined,
      text: text || undefined,
      replyTo: replyTo || REPLY_TO, // SDK also accepts "reply_to"
    });

    if (error) return json({ error: error.message || "Resend rejected the message" }, 502);
    return json({ ok: true, id: data?.id });
  } catch (e) {
    return json({ error: e?.message || "Send failed" }, 500);
  }
}