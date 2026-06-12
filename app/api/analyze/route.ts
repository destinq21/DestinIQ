import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge"; // faster cold starts on Vercel

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";

// Input validation
function isValidMessages(msgs: unknown): msgs is {role:string;content:string}[] {
  if (!Array.isArray(msgs) || msgs.length === 0) return false;
  return msgs.every(
    (m) =>
      m &&
      typeof m === "object" &&
      typeof (m as any).role === "string" &&
      typeof (m as any).content === "string" &&
      ["user","assistant"].includes((m as any).role) &&
      (m as any).content.length > 0 &&
      (m as any).content.length <= 8000
  );
}

export async function POST(req: NextRequest) {
  // ── 1. Parse + validate body ────────────────────────────────────────────────
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { system, messages, max_tokens } = body ?? {};

  if (!system || typeof system !== "string" || system.length < 10) {
    return NextResponse.json({ error: "Missing or invalid system prompt" }, { status: 400 });
  }
  if (!isValidMessages(messages)) {
    return NextResponse.json({ error: "Invalid messages array" }, { status: 400 });
  }

  // Clamp max_tokens: free=1800, premium=4000, hard ceiling=4096
  const tokensRaw = typeof max_tokens === "number" ? max_tokens : 1800;
  const tokens = Math.min(Math.max(tokensRaw, 100), 4096);

  // ── 2. Check API key ─────────────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set");
    return NextResponse.json(
      { error: "API key not configured. Add ANTHROPIC_API_KEY to your environment variables." },
      { status: 500 }
    );
  }

  // ── 3. Call Anthropic ────────────────────────────────────────────────────────
  try {
    const anthropicRes = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: tokens,
        system: system.slice(0, 10000), // safety cap on system prompt
        messages: messages.map((m) => ({
          role: m.role,
          content: String(m.content).slice(0, 8000), // safety cap per message
        })),
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.json().catch(() => ({}));
      const msg = (err as any)?.error?.message ?? `Anthropic API error ${anthropicRes.status}`;
      console.error("Anthropic error:", msg);

      // Specific status codes the client cares about
      if (anthropicRes.status === 401) {
        return NextResponse.json({ error: "API_KEY_INVALID" }, { status: 401 });
      }
      if (anthropicRes.status === 429) {
        return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
      }
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const data = await anthropicRes.json();
    const text: string =
      (data.content ?? [])
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text as string)
        .join("") ?? "";

    if (!text) {
      return NextResponse.json({ error: "Empty response from model" }, { status: 502 });
    }

    // ── 4. Return clean response ───────────────────────────────────────────────
    return NextResponse.json({ text });

  } catch (err: any) {
    console.error("Analyze route error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

// Block every method except POST
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
