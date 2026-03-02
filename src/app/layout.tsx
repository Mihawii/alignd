import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "alignd — Autonomous AI Analytics",
  description:
    "Replace your analytics team with an autonomous AI system that connects to your data, understands it, and delivers precise business answers instantly.",
  keywords: ["AI analytics", "autonomous analytics", "business intelligence", "no-code analytics"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
