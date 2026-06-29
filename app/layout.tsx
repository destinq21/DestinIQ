import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DestinIQ — Personal Intelligence Platform",
  description: "AI-powered personal intelligence. Know your strengths, blind spots and next move.",
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
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="theme-color" content="#f0b429" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>{children}</body>
    </html>
  );
}
