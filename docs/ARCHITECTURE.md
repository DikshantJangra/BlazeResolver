# BlazeResolver Architecture & Subsystem Boundaries

> Architectural specification and system boundary documentation for BlazeResolver v0.8.0.

---

## 1. System Overview & Data Flow

BlazeResolver is an autonomous software triage and repair platform that converts customer bug reports into reviewed GitHub Pull Requests with automated tests and audit trails.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          INSPECTION & INTAKE                           │
│                                                                        │
│  [ Web Widget ]        [ Custom API ]        [ Voice Bridge ]          │
│  (shadow DOM)          (REST / JSON)          (WebSocket /ws/voice)    │
└───────────────┬──────────────────────┬──────────────────────┬──────────┘
                │                      │                      │
                ▼                      ▼                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        TRIAGE & SAFETY BARRIER                         │
│                                                                        │
│  1. Sanitization & Normalization (invisible characters, unicode NFKC)  │
│  2. Prompt Injection Defense (zero-tolerance regex & heuristic filter) │
│  3. Dual Classification Engine (Rules engine + Multi-Provider LLMs)    │
│  4. Distributed Deduplication & Rate Limiting (Redis / Upstash / Local)│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        DISPATCH & PERSISTENCE                          │
│                                                                        │
│  • Customer Questions  ──► Instant RAG Search (README + Embeddings)   │
│  • Support Desk        ──► Persistent Store (JSON Disk / Admin Auth)   │
│  • Software Bugs       ──► GitHub Issue Creation (labeled 'blazeresolver')
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   CANONICAL FIX ENGINE (CI / ACTIONS)                  │
│                                                                        │
│  1. Fresh GitHub Actions VM Runner                                     │
│  2. AST CodeGraph Semantic Search & Failure Localization              │
│  3. Offline Docker Sandbox (--network none, unprivileged non-root)     │
│  4. 3-Attempt Fix Loop (Patch -> Test -> Typecheck -> Build)           │
│  5. Security Diff Guard (Blocks lockfiles, CI configs, auth, >400 loc) │
│  6. Secret Scanner (Ensures zero leaked tokens/keys)                   │
│  7. Verified Pull Request opened with comprehensive audit comment      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Architectural Boundaries & Canonical Implementations

### A. Fix Engine: TypeScript (Canonical) vs Python (`agents/`)

| Dimension | TypeScript Fix Engine (`src/`) | Python Prototype (`agents/`) |
| :--- | :--- | :--- |
| **Status** | **Canonical Production Engine** | **Experimental Research Prototype** |
| **Primary Files** | `src/workspace.ts`, `src/jobs/fix.ts`, `src/cli/index.ts`, `src/codebase/` | `agents/blaze_resolver_agent.py`, `agents/blaze_triage_agent.py` |
| **Execution Context** | GitHub Actions (`blazeresolver.yml`), Local CLI (`blazeresolver fix`) | Standalone Python process (LangGraph / LangChain) |
| **Sandboxing** | Strict Docker container isolation (`--network none`, read-only mounts, non-root user) | Host-level execution (no container network isolation) |
| **Safety Guards** | Hard constraints: forbidden files (CI, auth, payments, migrations), <=400 lines changed, automated secret scan | Advisory prompting |
| **CI Policy** | **Only this engine runs in production CI workflows.** | **Never execute concurrently in `.github/workflows/blazeresolver.yml`.** |

> **Warning for Contributors:** Do not configure GitHub Actions to trigger `agents/blaze_resolver_agent.py` alongside `blazeresolver fix`. The Python agent executes with uncontained network access and can push unvalidated branches without passing the offline sandbox checks.

---

### B. Voice Subsystem: TypeScript Bridge (Canonical) vs Python Telephony (`blazeresolver-voice/`)

| Dimension | TypeScript Voice Bridge (`src/channels/voice/`) | Python Telephony Service (`blazeresolver-voice/`) |
| :--- | :--- | :--- |
| **Status** | **Canonical Core Service** | **Standalone Telephony Microservice** |
| **Primary Files** | `src/channels/voice.ts`, `src/channels/voice/tools.ts`, `src/channels/voice/pcm.ts` | `blazeresolver-voice/main.py`, `blazeresolver-voice/telephony_bridge.py` |
| **Transport** | Native WebSocket (`/ws/voice` or `/ws`) on BlazeResolver server | FastAPI WebSocket & Twilio Media Streams webhook |
| **Target Clients** | Web browsers, React dashboard voice console, web widget | Inbound phone calls via Twilio / SIP telephony |
| **AI Integration** | Gemini Multimodal Live API (bidi WebSockets) & PCM audio framing | Twilio bi-directional audio stream bridge |
| **Tool Execution** | In-process execution with MoneyGate HITL thresholds (<= ₹300 auto-approve) | HTTP webhook dispatch |

---

## 3. Storage & Multi-Instance Coordination

### Support Desk Persistence
- **Local / Single Instance**: `SupportStore` (`src/support/index.ts`) writes state atomically to `.blazeresolver/support-desk.json` on disk across all mutating actions (ticket creation, message insertion, status changes, takeover, escalation).
- **Security & Authorization**: All administrative endpoints (`/api/pipeline/reset`, `/api/hitl/action`, ticket administration, customer PII) require a valid `BLAZE_ADMIN_TOKEN` via `Bearer` authorization or `x-admin-token` header.

### Distributed Rate Limiting & Locking
- **Local Mode**: Uses in-memory Map caches for IP rate limiting and concurrent issue creation mutexes.
- **Serverless / Multi-Instance Mode**: `src/handler/coordination.ts` provides pre-built shared coordination primitives:
  - `createRedisCoordination(client)`: High-performance atomic Redis Lua scripts (`INCR` + `EXPIRE`) and distributed `SET NX PX` locks.
  - `createUpstashRestCoordination({ url, token })`: Zero-dependency HTTP REST coordination for edge platforms (Vercel, Cloudflare Workers).

---

## 4. Security Invariants

1. **Untrusted Input Is Data, Not Instructions**: Customer messages, URLs, versions, and console errors are parsed as strictly bounded strings and evaluated through injection sanitizers before model exposure.
2. **Offline Verification**: All AI-generated candidate code must pass existing project test suites inside an isolated container with zero internet connectivity.
3. **Immutability of Critical Paths**: The fix engine refuses to modify authentication, payment gateways, database migrations, CI workflows, or security scanners.
4. **Human Final Authority**: No fix is merged autonomously. All resolutions result in branch pull requests requiring human review and code ownership approval.
