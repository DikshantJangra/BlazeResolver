<p align="center">
  <img src="assets/blazyy.png" alt="BlazeResolver — Blazyy" width="220" style="border-radius: 24px; box-shadow: 0 8px 30px rgba(0,0,0,0.3);" />
</p>

<h1 align="center">BlazeResolver</h1>

<p align="center">
  <strong>Open-Source, Business-Agnostic AI Harness for Customer Service</strong><br />
  <em>It doesn't just chat — it closes the loop with operational intelligence and policy-gated action.</em>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.8-blue.svg" alt="TypeScript" /></a>
  <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-6.2-purple.svg" alt="Vite" /></a>
  <img src="https://img.shields.io/badge/Tests-Passing-brightgreen.svg" alt="Tests" />
</p>

---

## 1. Vision & Core Architecture

Traditional customer service bots either hallucinate responses or hand off simple text templates. **BlazeResolver** introduces an end-to-end operational harness:

```
Customer Input (Text / Voice, any channel)
       │
       ▼
 ┌─────────────┐
 │ 1. TRIAGE   │  ──► Classify intent, category, urgency, extract entities (order, dish, branch)
 └──────┬──────┘      Enforces prompt injection & security guardrails
        │
        ▼
 ┌─────────────┐
 │2. CORRELATE │  ──► Query live operational data (KDS kitchen prep times, shift bottlenecks)
 └──────┬──────┘      THE DIFFERENTIATOR: Emits 1 systemic Incident instead of N tickets!
        │
        ▼
 ┌─────────────┐
 │ 3. RESOLVE  │  ──► Policy-bounded decision ──► Deterministic Tool Call (Refund / Credit / 86 Dish)
 └──────┬──────┘      Money-Gated: Auto-resolves under threshold (≤ ₹300), Gates to HITL above
        │
        ▼
 ┌─────────────┐
 │ 4. RESPOND  │  ──► Empathetic contextual reply + Quality Review pass (Text or Voice)
 └─────────────┘
```

### Core Principle

> **LLM decides intent, deterministic code executes mutations.** No hallucinated database writes, no hallucinated refunds. Every financial mutation goes through an **idempotent, policy-checked, auditable tool call**.

---

## 2. The 4-Adapter Architecture (Business-Agnostic Core)

The core engine is business-agnostic. It only knows 4 typed interface contracts in [src/adapters/contracts.ts](src/adapters/contracts.ts):

| Adapter Contract | Responsibility | Reference Implementation (`examples/restaurant`) |
| :--- | :--- | :--- |
| **`OrderSource`** | Fetch orders, customer histories, and real KDS prep timestamps | Reads orders & kitchen station ticket logs |
| **`RefundGateway`** | Issue idempotent refunds & wallet credits | Wraps payment gateway / UPI / Wallet with idempotency keys |
| **`TicketSink`** | File tickets & consolidate cluster incidents | Escalates single systemic incidents to branch managers |
| **`MenuControl`** | Temporarily suspend defective dishes (86ing) | Flips branch-level dish availability flags |

*To run BlazeResolver for SaaS or E-commerce: Swap `RefundGateway` for Stripe, `MenuControl` for a feature toggle or no-op, and the entire core pipeline runs unmodified.*

---

## 3. The Correlate Engine — The Novel Feature

1. **Sliding Buffer Window**: Ingests triaged complaints into a sliding 24-48h buffer.
2. **Multi-Dimensional Clustering**: Groups complaints sharing $\ge 2$ dimensions of `{category, dishId, branchId}`.
3. **KDS Operational Verification**: Pulls real KDS prep timestamps via `OrderSource.getKitchenTiming()`. If average preparation duration is anomalously high (e.g. **12.4 mins vs 4.0 min baseline** $\rightarrow$ **3.1x delay**), the engine identifies a **systemic kitchen bottleneck**.
4. **Single Incident Emission**: Emits **ONE** consolidated Incident ticket assigned to the shift manager with root-cause telemetry, while automatically executing customer refunds per policy.

---

## 4. Guardrails & Money-Gate Policy

- **Prompt Injection Defense**: Intercepts adversarial jailbreaks, system prompt overrides, and unauthorized administrative commands.
- **Tool Execution Guard**: Validates that refund amounts never exceed the original order total and only target valid orders.
- **Money-Gate (HITL)**:
  - **Auto-Resolve**: Claims $\le ₹300$ are automatically approved and executed instantly with unique transaction receipts.
  - **Human-In-The-Loop**: High-value claims ($> ₹300$) or suspicious customer velocities are placed in the supervisor approval queue for 1-click review.
- **Idempotency**: Replaying the same request returns the existing receipt instead of double-refunding.

---

## 5. Bring Your Own Agent (BYO-Agent)

BlazeResolver exposes its 4 pipeline stages as standardized JSON tools in [src/channels/byo-agent.ts](src/channels/byo-agent.ts). Compatible with:

- **LangGraph**
- **OpenAI Agents SDK / Function Calling**
- **Anthropic Claude Tool Use**
- **CrewAI**

---

## 6. Quick Start Guide

### Prerequisites

- Node.js $\ge 18$
- npm or pnpm

### Installation

```bash
git clone https://github.com/DikshantJangra/BlazeResolver.git
cd BlazeResolver
npm install
```

### Run All Unit & Integration Tests

```bash
npm test
```

### Run the Interactive Terminal Demo Script

```bash
npm run demo
```

### Run Full Stack (Backend API + Live UI Dashboard)

```bash
npm run dev
```

- **Web Dashboard**: http://localhost:5173
- **REST API & Voice WebSocket**: http://localhost:3001

---

## Use BlazeResolver in your own project

No server to host. Everything runs in your repo and on GitHub.

```bash
npx blazeresolver init      # set it up
npx blazeresolver app       # optional: a GitHub App for the fix job (short-lived, one-repo tokens; PRs trigger your CI)
npx blazeresolver harden    # optional: branch protection, CODEOWNERS, safe Actions defaults, secret scanning
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

Then: give your backend `BLAZE_GITHUB_TOKEN` (Issues write, one repo), paste any AI key into `.env` as `API_KEYS`, run `gh secret set API_KEYS`, allow Actions to create pull requests, protect your default branch. A human always reviews and merges the PR.

### The widget

A small light panel (about 14 KB gzipped) in a shadow DOM, so it never clashes with your styles: a text box and a Send button, a bottom sheet on phones, and unsent drafts kept. It attaches the page address and recent JavaScript errors (the reporter can untick that). Script-tag attributes: `data-accent="#6d28d9"`, `data-position="left"`, `data-title`, `data-user-id`, `data-user-email`, `data-ask-email="true"` (with `BLAZE_NOTIFY_CUSTOMERS=true`), and `data-launcher="false"` to hide the floating button. Open it from your own UI with `<a href="#" data-blazeresolver-open>Report a bug</a>` or `BlazeResolver.open('optional text')`.

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

See what was recognized, in failover order, keys masked: `npx blazeresolver providers`. The server prints the same at startup. Without any key, triage falls back to keyword rules and the fix engine stays off.

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

## 7. Demo Script for Judges

1. **Ingest 20-Messy Claims**: Click **"Run 20-Demo Script"** on the dashboard.
2. **The Correlate Moment**: Watch the system cluster 5 separate cold biryani complaints at Branch 2, query real KDS prep times (12.4m vs 4.0m baseline), and emit **1 unified Incident card** routed to the Branch Manager!
3. **Money-Gate in Action**: Auto-refunds $\le ₹300$ are executed instantly with idempotency receipts; the high-value ₹1,450 claim sits in the **HITL Queue** ready for 1-click supervisor sign-off.
4. **Security Check**: Watch the prompt injection attack get defended and neutralized.
5. **Voice Channel**: Click **"Voice Mic"** to process speech audio in real-time.

---

## License

Licensed under the [Apache-2.0 License](LICENSE).
