// ============================================================================
// DestinIQ — Cloud TTS route  →  place at:  app/api/tts/route.js
// ----------------------------------------------------------------------------
// Generates natural, human-sounding speech server-side (OpenAI tts-1) and
// returns an MP3. Mirrors your /api/analyze pattern: the API key stays on the
// server, and the caller must be a logged-in Supabase user.
//
// SETUP (one time):
//   1. Get an API key from https://platform.openai.com  (new accounts get $5 free)
//   2. In Vercel → Project → Settings → Environment Variables, add:
//        OPENAI_API_KEY = sk-...
//      (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY you already have)
//   3. Deploy. That's it — the read-aloud buttons switch to the natural voice
//      automatically. Until this is live, the app falls back to the old
//      browser voice, so nothing breaks in the meantime.
//
// COST: ~US$15 per 1,000,000 characters (tts-1). A ~3,000-char report read is
// about 4–5 US cents. Reads are user-initiated, and text is capped at 4,000
// chars/request below. To hold spend down further, gate this to paid tiers
// (see the note near the auth check) and/or cache audio by text hash.
//
// DISCLOSURE: OpenAI's usage policy requires telling users the voice is
// AI-generated (not a real human). The player shows a small "AI voice" label —
// keep that.
// ============================================================================

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";        // buffering audio bytes; nodejs is safe
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// tts-1 voices. Keep in sync with DQ_CLOUD_VOICE in page.jsx.
const ALLOWED_VOICES = ["alloy","ash","coral","echo","fable","nova","onyx","sage","shimmer"];
const MAX_CHARS = 4000;                  // tts-1 hard limit is 4096

function json(obj, status){
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req){
  try{
    if(!OPENAI_API_KEY) return json({ error: "TTS not configured" }, 500);

    // --- Auth: require a real logged-in user (same gate as /api/analyze) ---
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if(!token) return json({ error: "Unauthorized" }, 401);

    if(SUPABASE_URL && SUPABASE_ANON){
      try{
        const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
        const { data, error } = await sb.auth.getUser(token);
        if(error || !data?.user) return json({ error: "Unauthorized" }, 401);
        // To gate to paid tiers, look up the user's plan here (e.g. from your
        // user_profiles table) and return 402 if they're on Free.
      }catch{
        return json({ error: "Unauthorized" }, 401);
      }
    }

    // --- Input ---
    const body = await req.json().catch(() => ({}));
    const rawText = (body?.text || "").toString();
    if(!rawText.trim()) return json({ error: "No text" }, 400);
    const input = rawText.slice(0, MAX_CHARS);
    const voice = ALLOWED_VOICES.includes(body?.voice) ? body.voice : "sage";

    // --- Generate speech ---
    const r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",          // natural + cheap. "tts-1-hd" = higher fidelity, 2x cost.
        voice,
        input,
        response_format: "mp3",
      }),
    });

    if(!r.ok){
      const detail = await r.text().catch(() => "");
      return json({ error: "TTS provider failed", detail: detail.slice(0, 300) }, 502);
    }

    const audio = Buffer.from(await r.arrayBuffer());
    return new Response(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=86400",
      },
    });
  }catch(e){
    return json({ error: "Server error" }, 500);
  }
}