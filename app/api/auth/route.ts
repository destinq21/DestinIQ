import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const hashPassword = (p: string) => crypto.createHash("sha256").update(p + "diq2025").digest("hex");
const generateToken = () => crypto.randomBytes(32).toString("hex");
const otpStore: Record<string, { code: string; expires: number }> = {};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action;

    if (action === "login") {
      if (!body.email || !body.password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });
      const user = { id: hashPassword(body.email).slice(0, 16), email: body.email, name: body.email.split("@")[0], provider: "email", token: generateToken() };
      return NextResponse.json({ user });
    }

    if (action === "signup") {
      if (!body.email  !body.password  !body.name) return NextResponse.json({ error: "All fields required" }, { status: 400 });
      const user = { id: hashPassword(body.email).slice(0, 16), email: body.email, name: body.name, provider: "email", token: generateToken() };
      return NextResponse.json({ user });
    }

    if (action === "send_otp") {
      if (!body.phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      otpStore[body.phone] = { code, expires: Date.now() + 600000 };
      console.log("OTP for " + body.phone + ": " + code);
      return NextResponse.json({ success: true });
    }

    if (action === "verify_otp") {
      const stored = otpStore[body.phone];
      if (!stored) return NextResponse.json({ error: "No code found" }, { status: 400 });
      if (Date.now() > stored.expires) return NextResponse.json({ error: "Code expired" }, { status: 400 });
      if (stored.code !== body.code) return NextResponse.json({ error: "Wrong code" }, { status: 400 });
      delete otpStore[body.phone];
      const user = { id: hashPassword(body.phone).slice(0, 16), phone: body.phone, name: "User", provider: "phone", token: generateToken() };
      return NextResponse.json({ user });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}