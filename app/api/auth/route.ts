import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const hashPassword = (password: string) =>
  crypto.createHash("sha256").update(password + "diq_salt_2025").digest("hex");

const generateToken = () => crypto.randomBytes(32).toString("hex");

const otpStore: Record<string, { code: string; expires: number }> = {};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "login") {
      const { email, password } = body;
      if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });
      const user = { id: hashPassword(email).slice(0, 16), email, name: email.split("@")[0], provider: "email", token: generateToken() };
      return NextResponse.json({ user });
    }

    if (action === "signup") {
      const { email, password, name } = body;
      if (!email  !password  !name) return NextResponse.json({ error: "All fields required" }, { status: 400 });
      if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      const user = { id: hashPassword(email).slice(0, 16), email, name, provider: "email", token: generateToken() };
      return NextResponse.json({ user });
    }

    if (action === "send_otp") {
      const { phone } = body;
      if (!phone) return NextResponse.json({ error: "Phone number required" }, { status: 400 });
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      otpStore[phone] = { code, expires: Date.now() + 10 * 60 * 1000 };
      console.log(`OTP for ${phone}: ${code}`);
      return NextResponse.json({ success: true });
    }

    if (action === "verify_otp") {
      const { phone, code } = body;
      const stored = otpStore[phone];
      if (!stored) return NextResponse.json({ error: "No code found. Request a new one." }, { status: 400 });
      if (Date.now() > stored.expires) return NextResponse.json({ error: "Code expired." }, { status: 400 });
      if (stored.code !== code) return NextResponse.json({ error: "Incorrect code." }, { status: 400 });
      delete otpStore[phone];
      const user = { id: hashPassword(phone).slice(0, 16), phone, name: "User", provider: "phone", token: generateToken() };
      return NextResponse.json({ user });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
