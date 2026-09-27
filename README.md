<p align="center">
  <img src="assets/blazyy.png" alt="BlazeResolver — Blazyy" width="220" style="border-radius: 24px; box-shadow: 0 8px 30px rgba(0,0,0,0.3);" />
</p>

<h1 align="center">BlazeResolver</h1>

<p align="center">
  <strong>Customer bug reports in. Reviewed pull requests out.</strong><br />
  <em>Open source and GitHub-native: it runs in your repo, on your GitHub Actions. No server to host.</em>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License" /></a>
  <a href="https://www.npmjs.com/package/blazeresolver"><img src="https://img.shields.io/npm/v/blazeresolver.svg" alt="npm" /></a>
  <a href="https://github.com/DikshantJangra/BlazeResolver/actions/workflows/ci.yml"><img src="https://github.com/DikshantJangra/BlazeResolver/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
</p>

<p align="center">
  <a href="https://dikshantjangra.github.io/BlazeResolver/docs/"><strong>Documentation</strong></a> ·
  <a href="https://dikshantjangra.github.io/BlazeResolver/llms.txt">llms.txt for AI agents</a> ·
  <code>npx blazeresolver --help</code>
</p>

---

## How it works

```
 Your app                     Your backend                  Your GitHub repo
 ┌──────────────┐  report   ┌──────────────────┐  issue   ┌────────────────────────────────┐
 │ widget.js    │ ────────► │ /api/blaze        │ ───────► │ GitHub Actions: BlazeResolver  │
 │ "checkout is │           │ triage, dedupe,   │          │ find the cause, patch, run     │
 │  broken"     │           │ file the issue    │          │ your tests & build             │
 └──────────────┘           └──────────────────┘          └───────────────┬────────────────┘
                                                                          │ pull request
                                                                          ▼
                                                               You review and merge.
                                                               Customers hear it's fixed.
```

1. **Report.** A small widget in your app. The customer says what broke; the page address and recent JavaScript errors come along.
2. **Triage.** One route in your own backend screens for attempts to instruct the AI, has AI triage the report, and files real bugs as GitHub issues. Reports of the same symptom become comments on the existing issue, not new ones. How-to questions are answered from your README and help docs, right in the widget.
3. **Fix.** The issue starts a workflow in your repo. On GitHub's runner the fix engine maps your codebase, finds the root cause, patches it, and runs your tests and build, up to three attempts.
4. **Review.** A pull request with the root cause, the evidence and the test output, closing the issue. Nothing merges without a human. When no fix passes, the findings go on the issue for a person instead.

## Get started

No server to host. Everything runs in your repo and on GitHub.

```bash
npx blazeresolver init      # set it up
npx blazeresolver app       # optional: a GitHub App for the fix job (short-lived, one-repo tokens; PRs trigger your CI)
npx blazeresolver harden    # protect the default branch before enabling automated fixes
npx blazeresolver doctor    # check credentials, workflow, sandbox and review rules
npx blazeresolver remove    # take it all back out
```

`init` finds your frontend and backend by what they depend on, not by what the folders are called (`client`/`server`, `web`/`api`, `frontend`/`backend`, `apps/*`, a single Next.js app, and so on), and runs from anywhere inside the repo. It asks you to confirm what it found, or you can pass `--backend <folder> --frontend <folder> --yes`.

| It adds | Where |
| :--- | :--- |
| `.github/workflows/blazeresolver.yml` | The repo root, the only place GitHub reads workflows from. On a `blazeresolver` issue it runs the fix engine on GitHub's runner and opens a PR that closes the issue. On merge it emails customers who opted in. |
| The report endpoint | Next.js (App or Pages Router): an API route in that app. Express: a small `blazeresolver.js/.ts` next to the file that creates your app, plus one `app.all('/api/blaze', ...)` line there, in your module system (ESM, CommonJS or TypeScript). Any other framework: a printed snippet, and no guesses. |
| The widget | One `<script>` in your `index.html` or Next.js `layout`. It points at your backend, or at `/api/blaze` when both share an origin or your dev server proxies `/api`. |
| `blazeresolver.config.json` | Repo, default branch, and the test and build commands for each package that has tests. Also records exactly what `init` changed. |
| `.env` | Created if missing, or appended to (never overwritten) in the folder that hosts the endpoint: `API_KEYS` and `BLAZE_GITHUB_TOKEN`. `remove` deletes it only if you never filled it in. |
| The `blazeresolver` package | Installed in the package that hosts the endpoint (npm, pnpm, yarn and npm workspaces). |

`remove` undoes exactly that: it deletes the files `init` created (a file you have since rewritten is kept), takes its marked lines back out of the files it edited, uninstalls the package, and removes the config. Values you typed into `.env` are never deleted. Your other code is never touched.

Then: give your backend `BLAZE_GITHUB_TOKEN` (Issues write, one repo; plus Contents read-only if the repo is private, so questions are answered from its README), paste any AI key into `.env` as `API_KEYS`, run `gh secret set API_KEYS`, allow Actions to create pull requests, and run `npx blazeresolver harden`. Run `npx blazeresolver doctor` to check setup. A human reviews and merges every PR.

The endpoint defaults to per-process rate limits and issue locks. For a serverless deployment with multiple instances, pass `rateLimit.check` and `withIssueLock` callbacks backed by shared atomic storage. Store errors fail closed.

### The widget

A sleek support chat launcher and panel in an isolated shadow DOM, so it never clashes with your styles. The floating trigger is an icon button rendering the Blazyy mascot SVG (`assets/blazyy.svg`) that opens the support chat panel. On phones it adapts as a bottom sheet, keeping unsent drafts. It attaches the page address and recent JavaScript errors (the reporter can untick that). Script-tag attributes: `data-accent="#6d28d9"`, `data-position="left"`, `data-title`, `data-user-id`, `data-user-email`, `data-ask-email="true"` (with `BLAZE_NOTIFY_CUSTOMERS=true`), and `data-launcher="false"` to hide the floating button. Open it from your own UI with `<a href="#" data-blazeresolver-open>Report a bug</a>` or `BlazeResolver.open('optional text')`.

### React components (`blazeresolver/react`)

Drop the support desk or customer portal directly into your React 18+ application:

```tsx
import { AdminSupportDesk, CustomerSupportPortal } from 'blazeresolver/react';

// Live admin support desk with real-time WebSocket telemetry:
<AdminSupportDesk apiBase="http://localhost:3001" wsUrl="ws://localhost:3001" />

// Customer self-service portal:
<CustomerSupportPortal apiBase="http://localhost:3001" currentCustomerId="cust_123" />
```


### AI providers

Paste keys; most need no naming. Each key's provider is recognized from the key itself, so one line works across providers, several at once:

```bash
API_KEYS=sk-ant-...,gsk_...,nvapi-...     # Anthropic, Groq and NVIDIA NIM, in one line
```

- **Recognized by format**: Anthropic (`sk-ant-`), OpenAI (`sk-proj-`, ...), Gemini (`AIza`), Groq (`gsk_`), NVIDIA NIM (`nvapi-`), DeepSeek, xAI (`xai-`), Cerebras (`csk-`), Fireworks (`fw_`), Perplexity (`pplx-`), OpenRouter (`sk-or-`), Hugging Face (`hf_`), Zhipu / GLM, and GitHub Models (a GitHub token).
- **Keys whose format says nothing** (Mistral, Together AI, DeepInfra, SambaNova, Hyperbolic, Novita, Moonshot / Kimi, Cohere) go in their named variable, e.g. `MISTRAL_API_KEY=...`; in `API_KEYS` they're skipped with a warning. Opt in with `BLAZE_KEY_PROBE=on` to have them identified on first use instead: the likely providers are asked once whether the key is theirs (a model-list request, no tokens spent) and the answer is cached. It's off by default because it shows the key to providers it may not belong to.
- **Picked up from their settings**: Azure OpenAI once `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_DEPLOYMENT` are set (its key goes in `API_KEYS`), and a local Ollama once `OLLAMA_BASE_URL` or `OLLAMA_MODEL` is set.
- **Named variables work too**: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` / `GOOGLE_API_KEY`, `HF_TOKEN`, ..., and the few that can't be detected at all (`AI21_API_KEY`, `BASETEN_API_KEY`). Each also takes `{NAME}_API_KEYS=a,b` or `{NAME}_API_KEY_1`, `_2`, ...

With several keys, the first provider in priority order answers and the others take over automatically when it fails (outage, rate limit, bad key); a provider that just failed sits out for a minute. Several keys for one provider rotate round-robin. `BLAZE_MODEL` goes only to providers that serve that model (a Claude model name never reaches Groq), and the provider that owns it goes first. `BLAZE_PROVIDER` pins a single provider.

See what was recognized, in failover order, keys masked: `npx blazeresolver providers`. Without any key, triage falls back to keyword rules and the fix engine stays off.

### How the fix runs safely

**The AI proposes, the harness executes.** The model is never given a shell, a token or a clone. It returns JSON (a root cause, then file edits); BlazeResolver's own code applies the edits, runs your tests, commits, pushes and opens the PR. A crafted customer report can steer what the model *writes*, never what it is *allowed to do*.

| Layer | What it does |
| :--- | :--- |
| Your own runner | The fix job runs on a fresh GitHub-hosted VM, destroyed afterwards. Your keys live in your repo's secrets; nobody else holds them. |
| Offline tests | Dependencies install from your lockfile (with network), then tests and build run in a container with `--network none`, no capabilities, no privilege escalation, a non-root user, and none of the runner's environment. AI-written test code cannot phone home. Needs Docker (GitHub's runners have it); fails closed without it. Opt out with `--no-sandbox`. |
| Edit guards | A fix is refused if it touches CI config, secrets, lockfiles, `auth`/`payments`/`billing`/`migrations`, install config (`.npmrc`...) or test-runner config; changes `dependencies`, `scripts` or any install-time field of `package.json`; removes assertions from an existing test; or exceeds 400 lines. It goes to a human instead. |
| Secret scan | Every added line is checked for credential formats and for the exact value of this job's own keys, before the tests and again on the final diff. Nothing is pushed if one is found. |
| Least privilege | Per-job workflow permissions, read-only by default. With `npx blazeresolver app`, the built-in token can only read and a repo-scoped App token that lives minutes does the writing. Third-party actions are pinned to full commit SHAs. |
| Human in the loop | The bot opens PRs and never merges. `npx blazeresolver harden` makes GitHub enforce that: PRs need an approval and a code owner's review, no force pushes, no branch deletion. |
| Audit trail | Every PR gets a comment written by the harness: engine version, providers, attempts, files changed, tests before and after, how isolated the tests were, which checks passed. |

`--pin <version>` locks the workflow and widget to one release instead of `latest`: you trade automatic updates for a supply chain you control.

What no sandbox can catch, and stays yours: a fix that is wrong but passes weak tests. Review the diff, and write tests worth passing.

Updates are automatic: the widget loads from a CDN and the workflow runs `blazeresolver@latest`.

Safety: customer text is data, never instructions. Fixes never touch CI config, secrets, lockfiles, auth, payments or migrations. Tests run on a throwaway GitHub runner with a minimal environment. Customer emails are stored only if you set `BLAZE_NOTIFY_CUSTOMERS=true` (use a private repo).

---

## Contributing

```bash
npm install
npm test            # unit and end-to-end tests
npm run typecheck
npm run demo:fix    # the fix engine on a sample repo, end to end
npm run dev         # the support desk preview: API on :3001, dashboard on http://127.0.0.1:5173
```

The repository also contains an early local support desk preview, separate from the GitHub-native flow: no authentication, in-memory demo data. Don't deploy it. See the [docs](https://github.com/DikshantJangra/BlazeResolver/tree/main/web/content/docs/support-desk.mdx).

## License

Licensed under the [Apache-2.0 License](LICENSE).
