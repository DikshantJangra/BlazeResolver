import { createHandler } from 'blazeresolver/handler';

// Files customer bug reports as GitHub issues. Needs BLAZE_GITHUB_TOKEN (Issues: write on this repo only;
// a private repo also needs Contents: read-only, so questions can be answered from its README).
// Added by `npx blazeresolver init`; remove with `npx blazeresolver remove`.
const handler = createHandler({ repo: 'DikshantJangra/BlazeResolver' });

// Triage and filing take a few seconds; room for a slow AI provider on serverless hosts (Vercel reads this).
export const maxDuration = 60;

export const POST = handler;
export const OPTIONS = handler;
