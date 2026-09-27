import { markdownResponse, markdownUrl, sections } from "@/lib/llms";
import { siteUrl } from "@/lib/site";

// The llms.txt index (https://llmstxt.org): what BlazeResolver is, and a Markdown link to every docs page.
export const revalidate = false;

export function GET() {
  return markdownResponse(
    [
      "# BlazeResolver",
      "> Customer bug reports in, reviewed pull requests out. Open source and GitHub-native: a widget in your app files reports as GitHub issues, and a workflow in your repo finds the cause, writes the fix, runs your tests and opens a pull request for a human to review. No server to host, any AI provider.",
      `Every page below is plain Markdown. All of them in one file: ${siteUrl}/llms-full.txt`,
      "Set up in a repo: `npx blazeresolver@latest init`. CLI help: `npx blazeresolver --help`, or `npx blazeresolver <command> --help`.",
      ...sections().map(
        ({ title, pages }) =>
          `## ${title}\n\n${pages.map((page) => `- [${page.data.title}](${markdownUrl(page)})${page.data.description ? `: ${page.data.description}` : ""}`).join("\n")}`
      ),
      "## Optional\n\n- [Source code](https://github.com/DikshantJangra/BlazeResolver)\n- [npm package](https://www.npmjs.com/package/blazeresolver)",
    ].join("\n\n") + "\n"
  );
}
