import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:
    "BlazeResolver — Open-Source Autonomous Customer Support Resolution Harness",
  description:
    "Self-hostable, adapter-driven AI customer support resolution harness. Triage customer complaints, correlate operational telemetry, enforce policy-gated money limits, and resolve over voice & chat end-to-end.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/blazyy.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/blazyy.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/blazyy.png" />
      </head>
      <body className="bg-[#0a0b0e] text-[#e6e8ea] antialiased selection:bg-[#FF6B00] selection:text-white">
        {children}
      </body>
    </html>
  );
}
