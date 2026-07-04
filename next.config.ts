import type { NextConfig } from "next";

// Security headers — fixes all 5 missing headers from securityheaders.com scan
const securityHeaders = [
  {
    // Prevent your site being embedded in iframes (clickjacking protection)
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    // Stop browsers MIME-sniffing content types
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Control how much referrer info leaves your site
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Restrict browser features the page can use
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self)",
  },
  {
    // Content Security Policy — allows your app's known resources
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Scripts: self, inline (required by Next.js), Paystack checkout
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co https://checkout.paystack.com",
      // Styles: self + inline + Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fonts
      "font-src 'self' https://fonts.gstatic.com",
      // Images: self, data URIs, Supabase storage, any https (avatars etc.)
      "img-src 'self' data: blob: https:",
      // Connections: self, Supabase, Paystack, IP lookup services
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.paystack.co https://checkout.paystack.com https://api.ipify.org https://ipapi.co",
      // Frames: Paystack checkout iframe
      "frame-src https://checkout.paystack.com https://js.paystack.co",
      // No plugins/objects
      "object-src 'none'",
      // Upgrade any http requests to https
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Your existing dev origins setting — kept as-is
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  // Security headers applied to every route
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;