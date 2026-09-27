import { defineDocs } from "fumadocs-mdx/macro";
import { loader } from "fumadocs-core/source";

// Every page under content/docs becomes /docs/<path>; meta.json files set the sidebar order.
const docs = defineDocs({
  dir: "content/docs",
});

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});
