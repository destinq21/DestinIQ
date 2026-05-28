# Terminal commands:
cd destiniq   # or wherever your project is

# Remove old route if it exists
rm -rf app/api/destiniq

# Create the correct path
mkdir -p app/api/analyze
cat > app/api/analyze/route.ts << 'EOF'
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const message = body.message?.trim();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Valid message is required" }),
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Missing ANTHROPIC_API_KEY environment variable");
    }

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
        temperature: 0.85,
        top_p: 0.95,

        system: `
You are DestinIQ — a highly intelligent, adaptive life strategist.

Behavior rules:
- Never repeat the same structure twice
- Avoid generic or copy-paste advice
- Adapt tone based on user input
- Be practical, specific, and insight-driven
- Every response must feel fresh and uniquely generated
        `,

        messages: [{ role: "user", content: message }],
      }),
    });

    if (!response.ok) {
      let errorMsg = "Unknown error";
      try {
        const err = await response.json();
        errorMsg = err?.error?.message || JSON.stringify(err);
      } catch {}
      throw new Error(`Anthropic API error: ${errorMsg}`);
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text || "No response generated";

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("DestinIQ API error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
EOF