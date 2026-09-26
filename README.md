# 🔥 BlazeResolver

> **Open-Source, Business-Agnostic AI Harness for Customer Service**
> *It doesn't just chat — it closes the loop with operational intelligence and policy-gated action.*

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-purple.svg)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-5%20Passing-brightgreen.svg)]()

---

## ⚡ 1. Vision & Core Architecture

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

## 🔌 2. The 4-Adapter Architecture (Business-Agnostic Core)

The core engine knows nothing about restaurants or food. It only knows 4 typed interface contracts in [`src/adapters/contracts.ts`](file:///Users/dikshantjangra/Documents/projects/BlazeResolver/src/adapters/contracts.ts):

| Adapter Contract | Responsibility | Reference Implementation (`examples/blazeeats`) |
| :--- | :--- | :--- |
| **`OrderSource`** | Fetch orders, customer histories, and real KDS prep timestamps | Reads orders & kitchen station ticket logs |
| **`RefundGateway`** | Issue idempotent refunds & wallet credits | Wraps Razorpay / UPI / Wallet with idempotency keys |
| **`TicketSink`** | File tickets & consolidate cluster incidents | Escalates single systemic incidents to branch managers |
| **`MenuControl`** | Temporarily suspend defective dishes (86ing) | Flips branch-level dish availability flags |

*To run BlazeResolver for SaaS or E-commerce: Swap `RefundGateway` for Stripe, `MenuControl` for a feature toggle or no-op, and the entire core pipeline runs unmodified.*

---

## 🧠 3. The Correlate Engine — The Novel Feature

1. **Sliding Buffer Window**: Ingests triaged complaints into a sliding 24-48h buffer.
2. **Multi-Dimensional Clustering**: Groups complaints sharing $\ge 2$ dimensions of `{category, dishId, branchId}`.
3. **KDS Operational Verification**: Pulls real KDS prep timestamps via `OrderSource.getKitchenTiming()`. If average preparation duration is anomalously high (e.g. **12.4 mins vs 4.0 min baseline** $\rightarrow$ **3.1x delay**), the engine identifies a **systemic kitchen bottleneck**.
4. **Single Incident Emission**: Emits **ONE** consolidated Incident ticket assigned to the shift manager with root-cause telemetry, while automatically executing customer refunds per policy.

---

## 🛡️ 4. Guardrails & Money-Gate Policy

- **Prompt Injection Defense**: Intercepts adversarial jailbreaks, system prompt overrides, and unauthorized administrative commands.
- **Tool Execution Guard**: Validates that refund amounts never exceed the original order total and only target valid orders.
- **Money-Gate (HITL)**:
  - **Auto-Resolve**: Claims $\le ₹300$ are automatically approved and executed instantly with unique transaction receipts.
  - **Human-In-The-Loop**: High-value claims ($> ₹300$) or suspicious customer velocities are placed in the supervisor approval queue for 1-click review.
- **Idempotency**: Replaying the same request returns the existing receipt instead of double-refunding.

---

## 🤖 5. Bring Your Own Agent (BYO-Agent)

BlazeResolver exposes its 4 pipeline stages as standardized JSON tools in [`src/channels/byo-agent.ts`](file:///Users/dikshantjangra/Documents/projects/BlazeResolver/src/channels/byo-agent.ts). Compatible with:
- **LangGraph**
- **OpenAI Agents SDK / Function Calling**
- **Anthropic Claude Tool Use**
- **CrewAI**

---

## 🚀 6. Quick Start Guide

### Prerequisites
- Node.js $\ge 18$
- npm or pnpm

### Installation
```bash
git clone https://github.com/DikshantJangra/BlazeResolver.git
cd BlazeResolver
npm install
```

### Run All 5 Unit & Integration Tests
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
- **Web Dashboard**: [http://localhost:5173](http://localhost:5173)
- **REST API & Voice WebSocket**: [http://localhost:3001](http://localhost:3001)

---

## 🎭 7. Demo Script for Judges

1. **Ingest 20-Messy Claims**: Click **"Run 20-Demo Script"** on the dashboard.
2. **The Correlate Moment**: Watch the system cluster 5 separate cold biryani complaints at Branch 2, query real KDS prep times (12.4m vs 4.0m baseline), and emit **1 unified Incident card** routed to the Branch Manager!
3. **Money-Gate in Action**: Auto-refunds $\le ₹300$ are executed instantly with idempotency receipts; the high-value ₹1,450 claim sits in the **HITL Queue** ready for 1-click supervisor sign-off.
4. **Security Check**: Watch the prompt injection attack get defended and neutralized.
5. **Voice Channel**: Click **"Voice Mic"** to process speech audio in real-time.

---

## 📄 License
Licensed under the [Apache-2.0 License](file:///Users/dikshantjangra/Documents/projects/BlazeResolver/LICENSE).
