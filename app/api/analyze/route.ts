export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", // The ACTUAL model name
        max_tokens: 1000,
        system: body.system || "",
        // Anthropic crashes if 'messages' isn't formatted perfectly. This forces it to work.
        messages: Array.isArray(body.messages) 
          ? body.messages 
          : [{ role: "user", content: String(body.messages || body.decision || "Help me make a decision") }]
      }),
    });

    const data = await response.json();
const text = data.content?.find((b: any) => b.type === "text")?.text || "";
return new Response(JSON.stringify({ text }), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Server crashed" }), { status: 500 });
  }
}