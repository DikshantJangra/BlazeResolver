import { markdownResponse, pageMarkdown, pages } from "@/lib/llms";

// Every docs page as Markdown, in sidebar order, in one file for AI agents and LLM context windows.
export const revalidate = false;

export function GET() {
  return markdownResponse(pages().map(pageMarkdown).join("\n---\n\n"));
}
