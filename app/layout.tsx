// app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DestinIQ — Personal Intelligence Platform",
  description:
    "DestinIQ analyses your life profile and delivers a daily intelligence layer — covering direction, finances, mindset, career, and your global options. Free to start. Results in 60 seconds.",
  keywords: [
    "personal development",
    "life intelligence",
    "career advice",
    "mindset coaching",
    "relocation guide",
    "AI life coach",
  ],
  authors: [{ name: "DestinIQ" }],
  creator: "DestinIQ",
  metadataBase: new URL("https://destiniq.vercel.app"),
  openGraph: {
    title: "DestinIQ — The system that knows your next move",
    description:
      "Get a personalised life intelligence report in 60 seconds. Career, mindset, finances, relocation — all specific to you.",
    url: "https://destiniq.vercel.app",
    siteName: "DestinIQ",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DestinIQ — Personal Intelligence Platform",
    description:
      "Get a personalised life intelligence report in 60 seconds. Free to start.",
  },
  icons: {
    icon: "/favicon.ico",
  },
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
