/**
 * /app/api/analyze/route.js
 *
 * Next.js App Router API route — handles all AI calls for DestinIQ.
 * Place this file at:  app/api/analyze/route.js
 *
 * Required environment variable (set in Vercel → Settings → Environment Variables):
 *   ANTHROPIC_API_KEY=sk-ant-...
 */

export const runtime = "edge"; // runs on Vercel Edge for lowest latency

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";

export async function POST(request: Request) {
  try {
    // ── Parse request body ──────────────────────────────────────────────────
    const body = await request.json().catch(() => null);
    if (!body) {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { system, messages, max_tokens = 1800, model, tools } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "messages array is required" }, { status: 400 });
    }

    // ── Build the Anthropic request ─────────────────────────────────────────
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      console.error("ANTHROPIC_API_KEY is not set");
      return Response.json(
        { error: "API key not configured. Please set ANTHROPIC_API_KEY in Vercel environment variables." },
        { status: 500 }
      );
    }

    const anthropicBody = {
      model: model || MODEL,
      max_tokens: Math.min(max_tokens, 8000), // cap at 8000
      messages,
      ...(system ? { system } : {}),
      ...(tools ? { tools } : {}),
    };

    // ── Call Anthropic ──────────────────────────────────────────────────────
    const anthropicRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "interleaved-thinking-2025-05-14",
      },
      body: JSON.stringify(anthropicBody),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text().catch(() => "unknown error");
      console.error("Anthropic error:", anthropicRes.status, errText);
      return Response.json(
        { error: `Anthropic API error: ${anthropicRes.status}` },
        { status: 502 }
      );
    }

    const data = await anthropicRes.json();

    // ── Extract text from content blocks ────────────────────────────────────
    // Handle both simple text responses and tool_use responses
    if (data.content && Array.isArray(data.content)) {
      type ContentBlock = { type?: string; text?: string };
      const content = data.content as ContentBlock[];

      // For tool-use responses (like web search), return the full content array
      const hasToolUse = content.some((b) => b.type === "tool_use" || b.type === "tool_result");
      if (hasToolUse || tools) {
        return Response.json({ content, text: content.filter((b) => b.type === "text").map((b) => b.text).join("\n") });
      }

      // For regular text responses, extract and join text blocks
      const text = content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");

      if (!text) {
        return Response.json({ error: "Empty response from AI" }, { status: 502 });
      }

      return Response.json({ text, content });
    }

    return Response.json({ error: "Unexpected response format" }, { status: 502 });

  } catch (err: unknown) {
    console.error("API route error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: message || "Internal server error" },
      { status: 500 }
    );
  }
}
