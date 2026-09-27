import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsBody, DocsDescription, DocsPage, DocsTitle, EditOnGitHub } from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { source } from "@/lib/source";
import { getMDXComponents } from "@/components/mdx";
import { markdownPath } from "@/lib/llms";
import { asset } from "@/lib/site";

export default async function Page(props: PageProps<"/docs/[[...slug]]">) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      tableOfContent={{ style: "clerk" }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
      </DocsBody>
      <div className="flex flex-wrap items-center gap-3">
        <EditOnGitHub href={`https://github.com/DikshantJangra/BlazeResolver/blob/main/web/content/docs/${page.path}`} />
        {/* The same page as plain Markdown, for AI agents and LLM tools; /llms.txt lists them all. */}
        <a
          href={asset(markdownPath(page))}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
        >
          View as Markdown
        </a>
      </div>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<"/docs/[[...slug]]">): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { types: { "text/markdown": asset(markdownPath(page)) } },
  };
}
