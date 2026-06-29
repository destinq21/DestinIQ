// app/layout.tsx

export const metadata = {
  title: "DestinIQ — Personal Intelligence Platform",
  description:
    "DestinIQ analyses your life profile and delivers a daily intelligence layer — covering direction, money, mindset, and relationships.",
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
      "Get a personalised life intelligence report in 60 seconds. Career, mindset, finances, relationships — all in one place.",
    url: "https://destiniq.vercel.app",
    siteName: "DestinIQ",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DestinIQ — Personal Intelligence Platform",
    description:
      "Get a personalised life intelligence report in 60 seconds.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
