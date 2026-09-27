import { notFound } from "next/navigation";
import { markdownResponse, pageMarkdown, pages } from "@/lib/llms";
import { source } from "@/lib/source";

// One docs page as Markdown: /md/quickstart.md, /md/setup/init.md, /md/index.md for the introduction.
export const revalidate = false;
export const dynamicParams = false;

export function generateStaticParams() {
  return pages().map((page) => {
    const slugs = page.slugs.length ? [...page.slugs] : ["index"];
    slugs[slugs.length - 1] += ".md";
    return { slug: slugs };
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const slug = [...(await params).slug];
  slug[slug.length - 1] = slug[slug.length - 1].replace(/\.md$/, "");
  const page = source.getPage(slug.length === 1 && slug[0] === "index" ? [] : slug);
  if (!page) notFound();
  return markdownResponse(pageMarkdown(page));
}
