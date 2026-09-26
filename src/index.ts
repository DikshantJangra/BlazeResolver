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
