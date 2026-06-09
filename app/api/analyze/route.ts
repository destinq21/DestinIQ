import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: body.max_tokens || 1800,
        system: body.system || "",
        messages: Array.isArray(body.messages) ? body.messages : [{ role: "user", content: String(body.messages || "") }],
      }),
    });
    const data = await response.json();
    const text = data.content?.find((b: any) => b.type === "text")?.text || "";
    return NextResponse.json({ text }, { status: response.status });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}