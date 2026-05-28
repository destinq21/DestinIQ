export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Validate input
    const message = body.message?.trim();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Valid message is required" }),
        { status: 400 }
      );
    }

    // 2. Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Missing ANTHROPIC_API_KEY environment variable");
    }

    // 3. Call Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        temperature: 0.85,   // Slightly reduced from 0.9 for better control
        top_p: 0.95,

        system: `
You are DestinIQ — a highly intelligent, adaptive life strategist.

Behavior rules:
- Never repeat the same structure twice
- Avoid generic or copy-paste advice
- Adapt tone based on user input (serious, analytical, motivational, strategic)
- Be practical, specific, and insight-driven
- Focus on real-world decisions, growth, and clarity
- Every response must feel fresh and uniquely generated
        `,

        messages: [
          {
            role: "user",
            content: message,   // Clean user input only
          },
        ],
      }),
    });

    // 4. Handle API errors
    if (!response.ok) {
      let errorMsg = "Unknown error";
      try {
        const err = await response.json();
        errorMsg = err?.error?.message || JSON.stringify(err);
      } catch {}
      throw new Error(`Anthropic API error: ${errorMsg}`);
    }

    // 5. Extract response safely
    const data = await response.json();
    const text = data?.content?.[0]?.text || "No response generated";

    // 6. Return clean output
    return new Response(
      JSON.stringify({ text }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("DestinIQ API error:", error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}