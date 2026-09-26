import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeepSeek Harness developer preview: Everything is a plugin",
  description:
    "DeepSeek Harness is now available in developer preview to developers building agent harnesses worldwide, with the source code released at the same time. Every agent capability is implemented as a plugin that can be swapped or recomposed.",
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
      <body className="bg-ds-page text-ds-primary antialiased">
        {children}
      </body>
    </html>
  );
}
