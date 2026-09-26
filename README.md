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
npx blazeresolver init
```

`init` reads your repo from git and adds three things:

| File | What it does |
| :--- | :--- |
| `src/app/api/blaze/route.ts` (Next.js; other backends get a 2-line snippet) | Receives reports from the widget, triages them, files a GitHub issue. Same bug reported again = a comment, not a new issue. |
| `.github/workflows/blazeresolver.yml` | On a `blazeresolver` issue, runs the fix engine on GitHub's runner, opens a PR that closes the issue. On merge, emails customers who opted in. |
| `blazeresolver.config.json` | Repo, default branch, test and build commands. |

Then: give your backend `BLAZE_GITHUB_TOKEN` (Issues write, one repo) and `ANTHROPIC_API_KEY`, run `gh secret set ANTHROPIC_API_KEY`, allow Actions to create pull requests, protect your default branch, and paste the widget tag `init` prints. A human always reviews and merges the PR.

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
