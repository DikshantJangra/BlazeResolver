/**
 * BlazeResolver public API.
 * Implement the adapter contracts for your systems, describe your business with a DomainProfile,
 * and pass both to BlazeResolverPipeline.
 */
export { BlazeResolverPipeline } from './core/pipeline/index.js';
export type { BlazeResolverConfig } from './core/pipeline/index.js';
export * from './core/types.js';
export * from './core/domain.js';
export * from './adapters/contracts.js';
export * from './adapters/memory.js';
export { PromptInjectionGuard, ToolExecutionGuard, MoneyGate } from './core/guardrails/index.js';
export { EXAMPLES, loadExample } from './examples/index.js';
export type { ExampleDefinition, ExampleDemoContent } from './examples/index.js';

// Bug resolution: investigate an incident, patch it in an isolated workspace, test, build, hand off for review.
export * from './resolver/index.js';
export * from './codebase/contracts.js';
export { GitWorkspace, GitWorkspaceError } from './codebase/git-workspace.js';
export type { GitWorkspaceOptions } from './codebase/git-workspace.js';
export { CodeGraphAdapter } from './codebase/codegraph-adapter.js';
export type { CodeGraphAdapterOptions } from './codebase/codegraph-adapter.js';
export { isSoftwareDefect, toBugIncident } from './core/code-fix/index.js';
export type { CodeFixer, CodeFixHandoff } from './core/code-fix/index.js';
