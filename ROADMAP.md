# BlazeResolver roadmap

_Reviewed 2026-09-28 · source version 0.6.4_

## Product scope

BlazeResolver turns customer bug reports into reviewed GitHub pull requests. The current product runs its report endpoint in the customer's backend and uses GitHub Issues and Actions as its operational store. It does not require a BlazeResolver-hosted service.

## Implemented

- `init`, `app`, `harden`, `doctor`, `providers`, and `remove` CLI commands.
- Embeddable widget with page URL, user context, recent console errors, and optional notification email.
- Prompt-injection checks, multi-provider triage with a rules fallback, README/help answers, and issue-based duplicate grouping.
- GitHub Actions fix workflow, bounded code edits, path and secret guards, isolated test/build runs, pull requests, and human merge.
- Optional customer email after merge.
- Typecheck, unit tests, local resolver end-to-end tests, package build, and package-install checks in CI.

## Remaining for a production-ready MVP

1. **Live acceptance run:** install into a separate GitHub repo; submit a widget report; verify issue creation, fix workflow, required checks, reviewed merge, and customer email. Current automated coverage uses fake GitHub APIs and local sample repos.
2. **Protect each target repo:** run `npx blazeresolver harden`; confirm the default branch requires a reviewed PR. `doctor` reports missing or unverifiable rulesets.
3. **Shared coordination:** the default rate limit and issue lock work within one process. Multi-instance/serverless deployments must supply atomic `rateLimit.check` and `withIssueLock` callbacks backed by shared storage.
4. **Triage evaluation:** build a labeled report set and track classification and injection false-negative rates before claiming an accuracy target.
5. **Dependency footprint:** the endpoint package still installs fix-engine dependencies such as CodeGraph and the MCP client.
6. **Token operations:** the endpoint detects invalid or expired tokens when GitHub rejects a request. GitHub does not expose a general expiration date for every PAT; use the GitHub App for short-lived workflow credentials and document backend token rotation.

## Later, if product scope calls for it

- Sentry events and release correlation; post-deploy error checks.
- Authenticated, persistent admin dashboard. The existing React support desk and server are local preview/demo code and are not production-ready.
- Email, Zendesk, Intercom, GitLab, Bitbucket, Datadog, Python, and Go integrations.
- Multi-project hosting, per-project quotas, API keys, and Graft-based codebase scaling.

## MVP exit criteria

A fresh TypeScript/JavaScript repository can install BlazeResolver, safely accept a customer report, open a passing fix PR, require a human approval, merge and deploy it, and notify opted-in reporters. CI is green on every supported Node version, and the live acceptance run above is repeatable.
