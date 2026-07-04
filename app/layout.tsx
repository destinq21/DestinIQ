import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DestinIQ — Personal Intelligence Platform",
  description: "AI-powered personal intelligence. Know your strengths, blind spots, and next move.",
  icons: {
    icon: "/favicon-32.png?v=2",
    shortcut: "/favicon.ico?v=2",
    apple: "/apple-touch-icon.png?v=2",
  },
  manifest: "/manifest.json?v=2",
  openGraph: {
    title: "DestinIQ — Personal Intelligence Platform",
    description: "AI that knows your next move before you do.",
    url: "https://destiniq.vercel.app",
    siteName: "DestinIQ",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DestinIQ — Personal Intelligence",
    description: "AI-powered personal intelligence. Free report in 5 minutes.",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#f0b429",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}