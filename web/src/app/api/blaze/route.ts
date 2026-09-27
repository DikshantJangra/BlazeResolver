import { createHandler } from "blazeresolver/handler";

export const dynamic = "force-dynamic";

const repo = process.env.BLAZE_REPO || process.env.GITHUB_REPOSITORY || "DikshantJangra/BlazeResolver";
const githubToken = process.env.BLAZE_GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

const handler = createHandler({
  repo,
  githubToken,
  product: process.env.BLAZE_PRODUCT_NAME || "BlazeResolver",
});

export async function POST(req: Request) {
  return handler(req);
}

export async function OPTIONS(req: Request) {
  return handler(req);
}
