import { createHandler } from 'blazeresolver/handler';

// Files customer bug reports as GitHub issues. Needs BLAZE_GITHUB_TOKEN (Issues: write on this repo only).
// Added by `npx blazeresolver init`; remove with `npx blazeresolver remove`.
const handler = createHandler({ repo: 'DikshantJangra/BlazeResolver' });

export const POST = handler;
export const OPTIONS = handler;
