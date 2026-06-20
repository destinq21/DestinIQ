import { NextRequest } from "next/server";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

const VALID_MODELS = [
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-6",
  "claude-opus-4-6",
  "claude-opus-4-7",
  "claude-opus-4-8",
];

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const system = body.system as string | undefined;
    const messages = body.messages as unknown[];
    const max_tokens = (body.max_tokens as number) || 1800;
    const model = body.model as string | undefined;
    const tools = body.tools as unknown[] | undefined;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "messages array is required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || !apiKey.startsWith("sk-")) {
      return Response.json(
        { error: "ANTHROPIC_API_KEY not set in Vercel environment variables." },
        { status: 500 }
      );
    }

    const chosenModel = model && VALID_MODELS.includes(model) ? model : DEFAULT_MODEL;

    const payload: Record<string, unknown> = {
      model: chosenModel,
      max_tokens: Math.min(Number(max_tokens) || 1800, 8192),
      messages,
    };
    if (system) payload.system = system;
    if (tools) payload.tools = tools;

    const anthropicRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    if (!anthropicRes.ok) {
      let errMsg = `Anthropic error ${anthropicRes.status}`;
      try {
        const errData = await anthropicRes.json() as { error?: { message?: string } };
        if (errData?.error?.message) errMsg = errData.error.message;
      } catch { /* ignore */ }
      return Response.json({ error: errMsg }, { status: 502 });
    }

    const data = await anthropicRes.json() as {
      content?: Array<{ type: string; text?: string }>;
      model?: string;
      usage?: unknown;
    };

    if (!data.content || !Array.isArray(data.content)) {
      return Response.json({ error: "Unexpected response from Anthropic" }, { status: 502 });
    }

    const text = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");

    const hasToolBlocks = data.content.some(
      (b) => b.type === "tool_use" || b.type === "tool_result"
    );

    if (!text && !hasToolBlocks) {
      return Response.json({ error: "Empty response from AI" }, { status: 502 });
    }

    return Response.json({ text, content: data.content, model: data.model, usage: data.usage });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: msg }, { status: 500 });
  }
}