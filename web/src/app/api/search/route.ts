import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

// Full-text search over the docs. Built once at build time into a static index the browser searches (Orama),
// so it works on static hosting such as GitHub Pages too.
export const revalidate = false;

export const { staticGET: GET } = createFromSource(source, {
  language: "english",
});
