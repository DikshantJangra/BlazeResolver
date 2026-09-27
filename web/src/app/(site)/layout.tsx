import type { Metadata } from "next";
import "../globals.css";
import "blazeresolver/styles.css";
import { THEME_SCRIPT } from "@/components/theme";
import { asset } from "@/lib/site";
import FloatingSupportWidget from "@/components/FloatingSupportWidget";

export const metadata: Metadata = {
  title: "BlazeResolver: customer bug reports in, reviewed pull requests out",
  description:
    "Open-source and GitHub-native. A widget in your app files customer bug reports as GitHub issues, and a workflow in your repo finds the cause, writes the fix, runs your tests and opens a pull request for your review. No server to host, any AI provider.",
  icons: {
    icon: [
      { url: asset("/favicon.ico") },
      { url: asset("/favicon.png"), type: "image/png" },
      { url: asset("/favicon.svg"), type: "image/svg+xml" },
      { url: asset("/blazyy.png"), type: "image/png" },
    ],
    shortcut: asset("/favicon.ico"),
    apple: asset("/blazyy.png"),
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
        <link rel="icon" href={asset("/favicon.ico")} sizes="any" />
        <link rel="icon" href={asset("/favicon.png")} type="image/png" />
        <link rel="icon" href={asset("/favicon.svg")} type="image/svg+xml" />
        <link rel="apple-touch-icon" href={asset("/blazyy.png")} />
      </head>
      <body className="bg-page text-body antialiased selection:bg-[#FF6B00] selection:text-white">
        {children}
        <FloatingSupportWidget />
      </body>
    </html>
  );
}
