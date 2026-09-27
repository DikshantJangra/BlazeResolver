import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

// Full-text search over the docs (Orama, in process). Built from the same pages the sidebar shows.
export const { GET } = createFromSource(source, {
  language: "english",
});
