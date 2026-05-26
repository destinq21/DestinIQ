import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = body.input;

    if (!input) {
      return NextResponse.json(
        { error: "Input is required" },
        { status: 400 }
      );
    }

    const result = `DestiniQ analysis for: "${input}"

Here’s what I see:
- You are exploring your future path
- You are trying to make better decisions
- You need clarity and direction

Advice:
Focus on one skill and build consistency.`;

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
} 