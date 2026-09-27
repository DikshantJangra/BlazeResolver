import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
};

// Compiles the MDX under content/docs for the /docs pages (see src/lib/source.ts).
const withMDX = createMDX();

export default withMDX(nextConfig);
