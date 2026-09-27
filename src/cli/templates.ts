/** The workflow `init` writes. The fix job runs on GitHub's runner, which is the sandbox; notify runs when a fix merges. */
export const WORKFLOW = `name: BlazeResolver
on:
  issues:
    types: [opened, labeled]
  pull_request:
    types: [closed]

permissions:
  contents: write
  pull-requests: write
  issues: write

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
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: corepack enable
      - run: npx --yes blazeresolver@latest fix
        env:
          # Any provider's key(s), comma-separated; each key's provider is recognized from the key itself,
          # and several give automatic failover. \`gh secret set API_KEYS\`
          API_KEYS: \${{ secrets.API_KEYS }}
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          BLAZE_PROVIDER: \${{ vars.BLAZE_PROVIDER }}
          BLAZE_MODEL: \${{ vars.BLAZE_MODEL }}
          # Use a personal access token here (secret BLAZE_GITHUB_TOKEN) if you want CI to run on the PRs it opens.
          GITHUB_TOKEN: \${{ secrets.BLAZE_GITHUB_TOKEN || secrets.GITHUB_TOKEN }}

  notify:
    if: >-
      github.event_name == 'pull_request' &&
      github.event.pull_request.merged == true &&
      startsWith(github.event.pull_request.head.ref, 'blazeresolver/fix-')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx --yes blazeresolver@latest notify
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          RESEND_API_KEY: \${{ secrets.RESEND_API_KEY }}
          BLAZE_FROM_EMAIL: \${{ secrets.BLAZE_FROM_EMAIL }}
`;

/** Works as a Next.js route handler (App Router) and any other runtime that speaks Request/Response. */
export const routeFile = (repo: string) => `import { createHandler } from 'blazeresolver/handler';

// Files customer bug reports as GitHub issues. Needs BLAZE_GITHUB_TOKEN (Issues: write on this repo only).
const handler = createHandler({ repo: '${repo}' });

// Triage and filing take a few seconds; room for a slow AI provider on serverless hosts (Vercel reads this).
export const maxDuration = 60;

export const POST = handler;
export const OPTIONS = handler;
`;

export const widgetTag = (endpoint: string) =>
  `<script src="https://cdn.jsdelivr.net/npm/blazeresolver@latest/widget/widget.js" data-endpoint="${endpoint}" data-app-version="YOUR_VERSION"></script>`;
