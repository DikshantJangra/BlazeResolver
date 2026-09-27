import type { Metadata } from "next";
import "../globals.css";
import Script from 'next/script'; // blazeresolver:managed
import { THEME_SCRIPT } from "@/components/theme";

export const metadata: Metadata = {
  title: "BlazeResolver: customer bug reports in, reviewed pull requests out",
  description:
    "Open-source and GitHub-native. A widget in your app files customer bug reports as GitHub issues, and a workflow in your repo finds the cause, writes the fix, runs your tests and opens a pull request for your review. No server to host, any AI provider.",
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
    // Dark until the head script applies the saved or OS theme; it runs before paint, so nothing flashes.
    <html lang="en" data-theme="dark" className="dark" style={{ colorScheme: "dark" }} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/blazyy.png" />
      </head>
      <body className="bg-page text-body antialiased selection:bg-[#FF6B00] selection:text-white">
        {children}
        <Script src="/widget.js" data-endpoint="/api/blaze" strategy="afterInteractive" /> {/* blazeresolver:managed */}
      </body>
    </html>
  );
}
