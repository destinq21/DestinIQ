import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DestinIQ — Personal Intelligence Platform",
  description: "AI-powered personal intelligence. Know your strengths, blind spots and next move.",
  metadataBase: new URL("https://destiniq.app"),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "DestinIQ — Personal Intelligence Platform",
    description: "AI that knows your next move before you do.",
    url: "https://destiniq.app",
    siteName: "DestinIQ",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DestinIQ — Personal Intelligence",
    description: "AI-powered personal intelligence. Free report in 5 minutes.",
    images: ["/og-image.png"],
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
      <body>{children}</body>
    </html>
  );
}
