import path from "path";
import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

// `npm run build:pages` (and the Pages workflow) builds a static site for GitHub Pages: no server, served under /<repo>.
const pages = process.env.GITHUB_PAGES === "true";
const basePath = pages ? (process.env.PAGES_BASE_PATH ?? "") : "";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  ...(pages && {
    output: "export",
    basePath,
    // /docs/quickstart/ → docs/quickstart/index.html, which GitHub Pages serves without a server.
    trailingSlash: true,
    images: { unoptimized: true },
  }),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_STATIC_EXPORT: pages ? "true" : "false",
  },
};

// Compiles the MDX under content/docs for the /docs pages (see src/lib/source.ts).
const withMDX = createMDX();

export default withMDX(nextConfig);
