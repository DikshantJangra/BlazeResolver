import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export const GITHUB_URL = "https://github.com/DikshantJangra/BlazeResolver";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="inline-flex items-center gap-2 font-semibold">
          <img src="/blazyy.png" alt="" width={24} height={24} className="rounded-md" />
          <span>
            Blaze<span className="text-fd-primary">Resolver</span>
          </span>
        </span>
      ),
      url: "/",
    },
    githubUrl: GITHUB_URL,
    links: [
      { text: "npm", url: "https://www.npmjs.com/package/blazeresolver", external: true },
      { text: "Community", url: `${GITHUB_URL}/discussions`, external: true },
    ],
  };
}
