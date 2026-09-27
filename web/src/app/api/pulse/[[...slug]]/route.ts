import { createTimelineHandler } from "blazeresolver/timeline";

export const dynamic = "force-dynamic";

const handler = createTimelineHandler({
  repo: process.env.BLAZE_REPO || "DikshantJangra/BlazeResolver",
  githubToken: process.env.BLAZE_GITHUB_TOKEN,
});

export async function GET(req: Request) {
  return handler(req);
}

export async function POST(req: Request) {
  return handler(req);
}

export async function OPTIONS(req: Request) {
  return handler(req);
}
