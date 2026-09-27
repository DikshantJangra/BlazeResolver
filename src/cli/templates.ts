/**
 * Third-party actions, pinned to the commit a tag pointed at when this was written, not to the tag: a tag can be moved
 * to malicious code after you have reviewed it, a commit cannot. Refresh with `git ls-remote --tags <repo>`; the
 * comment beside each pin says which release it is.
 */
export const ACTIONS = {
  checkout: 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0',
  setupNode: 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0',
  appToken: 'actions/create-github-app-token@fee1f7d63c2ff003460e3d139729b119787bc349 # v2.2.2'
} as const;

export interface WorkflowOptions {
  /** Run this exact blazeresolver version instead of `latest`. Trades automatic updates for a supply chain you control. */
  pin?: string;
  /** The fix job gets a short-lived, repo-scoped GitHub App token instead of the workflow's built-in token. */
  app?: boolean;
}

/**
 * The workflow `init` writes. The fix job runs on GitHub's throwaway runner, which is the sandbox; the repo's tests then
 * run offline in a container inside it. Permissions are per job and least-privilege: with a GitHub App the built-in
 * token can only read, and the App token (scoped to this repo, minutes-long) is the only thing that can write.
 */
export const workflow = ({ pin, app }: WorkflowOptions = {}) => {
  const version = pin ?? 'latest';
  const fixPermissions = app
    ? '      contents: read'
    : '      contents: write\n      pull-requests: write\n      issues: write';
  const appStep = app
    ? `      - name: GitHub App token
        id: app
        uses: ${ACTIONS.appToken}
        with:
          app-id: \${{ secrets.BLAZE_APP_ID }}
          private-key: \${{ secrets.BLAZE_APP_PRIVATE_KEY }}
          permission-contents: write
          permission-pull-requests: write
          permission-issues: write
`
    : '';
  const token = app
    ? '\${{ steps.app.outputs.token }}'
    : '\${{ secrets.BLAZE_GITHUB_TOKEN || secrets.GITHUB_TOKEN }}';
  const tokenNote = app
    ? '          # Short-lived token from your GitHub App: scoped to this repo, so PRs it opens also trigger your CI.'
    : '          # Use a personal access token here (secret BLAZE_GITHUB_TOKEN) if you want CI to run on the PRs it opens,\n          # or run `npx blazeresolver app` to use a GitHub App instead.';

  return `name: BlazeResolver
on:
  issues:
    types: [opened, labeled]
  pull_request:
    types: [closed]

permissions:
  contents: read

concurrency:
  group: blazeresolver-\${{ github.event.issue.number || github.event.pull_request.number }}
  cancel-in-progress: false

jobs:
  fix:
    # Only issues the BlazeResolver handler filed (label) and that someone with write access opened.
    # Reacts to a new issue or the blazeresolver label only. Labels the job itself adds (fixing, pr-opened, ...)
    # are skipped here, before a runner starts, so they cost no Actions minutes.
    if: >-
      github.event_name == 'issues' &&
      (github.event.action == 'opened' || github.event.label.name == 'blazeresolver') &&
      contains(github.event.issue.labels.*.name, 'blazeresolver') &&
      contains(fromJSON('["OWNER","MEMBER","COLLABORATOR"]'), github.event.issue.author_association)
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
${fixPermissions}
    steps:
${appStep}      - uses: ${ACTIONS.checkout}
        with:
          persist-credentials: false
      - uses: ${ACTIONS.setupNode}
        with:
          node-version: 22
      - run: corepack enable
      - run: npx --yes blazeresolver@${version} fix
        env:
          # Any provider's key(s), comma-separated; each key's provider is recognized from the key itself,
          # and several give automatic failover. \`gh secret set API_KEYS\`
          API_KEYS: \${{ secrets.API_KEYS }}
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          BLAZE_PROVIDER: \${{ vars.BLAZE_PROVIDER }}
          BLAZE_MODEL: \${{ vars.BLAZE_MODEL }}
${tokenNote}
          GITHUB_TOKEN: ${token}

  notify:
    if: >-
      github.event_name == 'pull_request' &&
      github.event.pull_request.merged == true &&
      startsWith(github.event.pull_request.head.ref, 'blazeresolver/fix-')
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: write
      pull-requests: read
    steps:
      - uses: ${ACTIONS.checkout}
        with:
          persist-credentials: false
      - uses: ${ACTIONS.setupNode}
        with:
          node-version: 22
      - run: npx --yes blazeresolver@${version} notify
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          RESEND_API_KEY: \${{ secrets.RESEND_API_KEY }}
          BLAZE_FROM_EMAIL: \${{ secrets.BLAZE_FROM_EMAIL }}
`;
};

/** The default workflow, kept for callers that want the plain text. */
export const WORKFLOW = workflow();

/** Next.js App Router route handler. Same origin as the page, so no CORS. */
export const routeFile = (repo: string) => `import { createHandler } from 'blazeresolver/handler';

// Files customer bug reports as GitHub issues. Needs BLAZE_GITHUB_TOKEN (Issues: write on this repo only).
// Added by \`npx blazeresolver init\`; remove with \`npx blazeresolver remove\`.
const handler = createHandler({ repo: '${repo}' });

// Triage and filing take a few seconds; room for a slow AI provider on serverless hosts (Vercel reads this).
export const maxDuration = 60;

export const POST = handler;
export const OPTIONS = handler;
`;

/** Next.js Pages Router API route (Node req/res). */
export const pagesFile = (repo: string) => `import { createHandler, nodeHandler } from 'blazeresolver/handler';

// Files customer bug reports as GitHub issues. Needs BLAZE_GITHUB_TOKEN (Issues: write on this repo only).
// Added by \`npx blazeresolver init\`; remove with \`npx blazeresolver remove\`.
export default nodeHandler(createHandler({ repo: '${repo}' }));
`;

export type ModuleStyle = 'esm' | 'cjs';

/**
 * A plain (req, res) function for an Express app, in the module system the backend already uses.
 * The frontend may live on another origin, so it answers CORS (any origin: it takes no cookies, only a report).
 */
export const expressRouterFile = (repo: string, style: ModuleStyle) => {
  const config = `createHandler({ repo: '${repo}', allowOrigin: process.env.BLAZE_ALLOW_ORIGIN || '*' })`;
  const head = `// Files customer bug reports as GitHub issues. Needs BLAZE_GITHUB_TOKEN (Issues: write on this repo only).
// Added by \`npx blazeresolver init\`; remove with \`npx blazeresolver remove\`.
`;
  return style === 'esm'
    ? `${head}import { createHandler, nodeHandler } from 'blazeresolver/handler';

export default nodeHandler(${config});
`
    : `${head}const { createHandler, nodeHandler } = require('blazeresolver/handler');

module.exports = nodeHandler(${config});
`;
};

export const widgetTag = (endpoint: string, pin?: string) =>
  `<script src="https://cdn.jsdelivr.net/npm/blazeresolver@${pin ?? 'latest'}/widget/widget.js" data-endpoint="${endpoint}"></script>`;
