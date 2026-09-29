# BlazeResolver roadmap

_Reviewed 2026-09-29 · source version 0.8.0_

## Product scope

BlazeResolver turns customer bug reports into reviewed GitHub pull requests. The product runs its report endpoint in the customer's backend and uses GitHub Issues and Actions as its operational store, with optional React Support Desk UI components, RAG help-doc answers, and real-time voice bridges.

## Implemented

- **Core CLI:** `init`, `app`, `harden`, `doctor`, `providers`, `index`, and `remove` commands.
- **Embeddable Widget:** Customizable issue intake widget with page URL, user context, recent console errors, screenshot capture, and customer email.
- **Triage & Safety:** Prompt-injection detection, multi-provider triage with rules fallback, README/help RAG answers, and incident grouping.
- **GitHub Fix Engine:** Actions fix workflow, bounded multi-file edits, path/secret guards, isolated test/build runs in Docker, pull requests with audit logs, and human merge enforcement.
- **Support Desk & React Components:** Full React support desk UI (`@blazeresolver/react`), customer tickets, canned responses, timeline view, and order/refund tools.
- **Voice Bridge:** Low-latency real-time voice bridge over WebSockets (`/ws/voice`) supporting Gemini Multimodal Live API with tool calls (refunds, order lookup, escalation).
- **RAG & Hybrid Search:** Hybrid semantic + keyword retrieval over repository READMEs and help docs using vector embeddings (OpenAI, Gemini, Voyage, Cohere, Mistral).
- **Automated Notifications:** Customer email notifications via Resend upon fix PR merge.
- **Hermetic Testing & CI:** 300+ unit and integration tests across Node 22.16+ and Node 24, multi-target typechecks, and package builds.

## MVP Implementation & Production Readiness

1. **Live Acceptance Validation:** Dedicated E2E acceptance test harness validating against real GitHub or mock API environments.
2. **Shared Coordination:** Pluggable and built-in shared rate limiting and issue deduplication locks (Redis, Upstash, or distributed store) for serverless/multi-instance deployments.
3. **Resilient Widget Diagnostics:** User-visible diagnostics for CORS, 404, or non-JSON API errors when `data-endpoint` is misconfigured.
4. **Token Operations & Health:** Startup token validity checks and `/health` status endpoint reporting GitHub token, AI providers, and system readiness.
5. **Support Desk Auth & Persistence:** Mandatory authentication for admin/support APIs and persistent storage adapter for ticket/customer state.
6. **Optimized Dependency Footprint:** Lazy-loaded fix-engine dependencies (CodeGraph, MCP client) ensuring consumer endpoint packages remain lightweight.
7. **Triage Accuracy Benchmarking:** Automated triage accuracy evaluation test suite tracking injection block rates and bug classification accuracy.
8. **Architecture Boundaries:** Clear documentation distinguishing TypeScript real-time fix engine and voice bridge from Python agent reference pipelines.

## Later, if product scope calls for it

- Sentry events and release correlation; post-deploy error checks.
- Email, Zendesk, Intercom, GitLab, Bitbucket, and Datadog integrations.
- Multi-project hosting, per-project quotas, and team permission controls.

## MVP Exit Criteria

A fresh TypeScript/JavaScript repository can install BlazeResolver, safely accept a customer report, open a passing fix PR, require a human approval, merge and deploy it, and notify opted-in reporters. CI is green on every supported Node version, and the live acceptance run is repeatable.
