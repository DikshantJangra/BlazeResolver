/**
 * BlazeResolver public API: customer bug reports in, reviewed GitHub pull requests out.
 * Most projects only need `npx blazeresolver init` and `blazeresolver/handler`; these are the building blocks underneath.
 */

// The report endpoint: triage a widget report and file it as a GitHub issue.
export { createHandler, nodeHandler } from './handler/index.js';
export type { HandlerOptions } from './handler/index.js';

// Triage and the AI providers it runs on (recognized from the key itself, with failover).
export { triage, ReportSchema, KINDS } from './triage/index.js';
export type { Report, Triage, Kind } from './triage/index.js';
export { resolveComplete, describeProviders, identifyKey, listProviders, ProviderError } from './triage/providers.js';
export type { Complete } from './triage/providers.js';

// The fix engine: investigate an incident, patch it in an isolated workspace, run the tests and build, open a PR.
export { runFix } from './jobs/fix.js';
export type { FixJobOptions, FixOutcome } from './jobs/fix.js';
export * from './resolver/index.js';
export * from './codebase/contracts.js';
export { GitWorkspace, GitWorkspaceError } from './codebase/git-workspace.js';
export type { GitWorkspaceOptions } from './codebase/git-workspace.js';
export { CodeGraphAdapter } from './codebase/codegraph-adapter.js';
export type { CodeGraphAdapterOptions } from './codebase/codegraph-adapter.js';
export { PromptInjectionGuard } from './core/guardrails/index.js';
export * from './support/index.js';
