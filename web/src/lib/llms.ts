import { readFileSync } from "node:fs";
import { join } from "node:path";
import { source } from "./source";
import { siteUrl } from "./site";

/**
 * The docs as plain Markdown, for AI agents and LLM tools: /llms.txt (an index), /llms-full.txt (everything) and
 * /md/<page>.md (one page). Built from the same MDX files as the site, at build time, so they're static files.
 */

type DocPage = ReturnType<typeof source.getPages>[number];

type TreeNode = ReturnType<typeof source.getPageTree>["children"][number];

/** The docs in sidebar order, grouped under the sidebar's section headings. */
export function sections(): { title: string; pages: DocPage[] }[] {
  const byUrl = new Map(source.getPages().map((page) => [page.url, page]));
  const out = [{ title: "Getting started", pages: [] as DocPage[] }];
  const visit = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.type === "separator") out.push({ title: String(node.name ?? ""), pages: [] });
      else if (node.type === "page") {
        const page = byUrl.get(node.url);
        if (page) out[out.length - 1].pages.push(page);
      } else if (node.type === "folder") {
        if (node.index) visit([node.index]);
        visit(node.children);
      }
    }
  };
  visit(source.getPageTree().children);
  return out.filter((section) => section.pages.length);
}

export const pages = (): DocPage[] => sections().flatMap((section) => section.pages);

/** /md/index.md for the introduction, /md/setup/init.md for /docs/setup/init. */
export const markdownPath = (page: DocPage) => `/md/${page.slugs.length ? page.slugs.join("/") : "index"}.md`;

export const markdownUrl = (page: DocPage) => `${siteUrl}${markdownPath(page)}`;

/** MDX components rewritten as the plain Markdown they stand for; the prose is untouched. */
function toMarkdown(mdx: string): string {
  return mdx
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/<Callout(?:\s+type="(\w+)")?(?:\s+title="([^"]*)")?\s*>/g, (_, type, title) => `> **${title || (type === "warn" ? "Warning" : "Note")}:**`)
    .replace(/<\/Callout>/g, "")
    .replace(/<Card\s+title="([^"]*)"\s+href="([^"]*)"\s*>/g, (_, title, href) => `- [${title}](${href.startsWith("/") ? siteUrl + href : href}):`)
    .replace(/<\/?(Cards|Card|Steps|Step|Tabs|Accordions)\b[^>]*>/g, "")
    .replace(/<Tab\s+value="([^"]*)"\s*>/g, "**$1**")
    .replace(/<\/Tab>/g, "")
    .replace(/<Accordion\s+title="([^"]*)"\s*>/g, "**$1**\n")
    .replace(/<\/Accordion>/g, "")
    // Links between pages point at their Markdown versions, so an agent can follow them.
    .replace(/\]\(\/docs(\/[^)#\s]*)?(#[^)\s]*)?\)/g, (_, path = "", hash = "") => `](${siteUrl}/md${path.replace(/\/$/, "") || "/index"}.md${hash})`)
    // Other links into the site (/llms.txt, /md/…) become absolute too.
    .replace(/\]\((\/(?!\/)[^)\s]*)\)/g, (_, path) => `](${siteUrl}${path})`)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function pageMarkdown(page: DocPage): string {
  const raw = readFileSync(join(process.cwd(), "content/docs", page.path), "utf8");
  const header = [`# ${page.data.title}`, page.data.description && `> ${page.data.description}`, `Source: ${siteUrl}${page.url}`]
    .filter(Boolean)
    .join("\n\n");
  return `${header}\n\n${toMarkdown(raw)}\n`;
}

export const markdownResponse = (text: string) =>
  new Response(text, { headers: { "content-type": "text/markdown; charset=utf-8" } });
