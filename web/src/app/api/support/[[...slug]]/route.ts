import { createSupportHandler } from "blazeresolver/support";

export const dynamic = "force-dynamic";

const repo = process.env.BLAZE_REPO || process.env.GITHUB_REPOSITORY || "DikshantJangra/BlazeResolver";
const githubToken = process.env.BLAZE_GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

const handler = createSupportHandler({
  repo,
  githubToken,
  product: process.env.BLAZE_PRODUCT_NAME || "BlazeResolver",
});

export async function GET(req: Request) {
  return handler(req);
}

export async function POST(req: Request) {
  return handler(req);
}

export async function PATCH(req: Request) {
  return handler(req);
}

export async function DELETE(req: Request) {
  return handler(req);
}

export async function OPTIONS(req: Request) {
  return handler(req);
}
