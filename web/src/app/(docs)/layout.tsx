import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { RootProvider } from "fumadocs-ui/provider/next";
import "./docs.css";

export const metadata: Metadata = {
  title: {
    template: "%s | BlazeResolver Docs",
    default: "BlazeResolver Docs",
  },
  description:
    "Set up BlazeResolver: a widget files customer bug reports as GitHub issues, and a workflow in your repo writes the fix, runs your tests and opens a pull request for review.",
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/blazyy.png",
  },
};

export default function DocsRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col antialiased">
        <RootProvider theme={{ defaultTheme: "dark" }}>{children}</RootProvider>
        {/* Dogfooding: readers can report a problem with the docs through BlazeResolver itself. */}
        <Script src="/widget.js" data-endpoint="/api/blaze" data-title="Report a problem with the docs" strategy="afterInteractive" />
      </body>
    </html>
  );
}
