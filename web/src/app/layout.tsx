import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BlazeResolver — Open-Source Autonomous Customer Support Resolution Harness",
  description:
    "Self-hostable, adapter-driven AI customer support resolution harness. Triage, correlate operational telemetry, enforce policy-gated resolutions, and resolve over voice & chat end-to-end.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
      <body className="bg-ds-page text-ds-primary antialiased selection:bg-[#4d6bfe] selection:text-white">
        {children}
      </body>
    </html>
  );
}
