import type { CodebaseInterface, FileContent, TestResult } from '../codebase/contracts.js';
import type { CodeContext, FixAttempt, FixProposal, Incident, Investigation } from './types.js';

export interface InvestigationRequest {
  incident: Incident;
  /** Test output from the untouched workspace, when the tests reproduce the bug. */
  baselineFailure?: TestResult;
  /** Context the resolver already gathered. */
  context: CodeContext;
  /** Read-only access for providers that explore further (e.g. an LLM tool loop). */
  codebase: CodebaseInterface;
}

export interface FixRequest {
  incident: Incident;
  investigation: Investigation;
  /** Current contents of the suspected files, exactly as `replace` edits must match them. */
  files: FileContent[];
  /** Earlier attempts in this resolution, oldest first, each with the failure it hit. */
  previousAttempts: FixAttempt[];
  codebase: CodebaseInterface;
}

/**
 * The model behind BlazeResolver's reasoning. Providers only read and propose:
 * they get a read-only codebase and never a workspace, so every change goes through the resolver.
 */
export interface AIProvider {
  investigate(request: InvestigationRequest): Promise<Investigation>;

  /** Proposes edits. When `previousAttempts` is non-empty, the proposal should address the last failure. */
  proposeFix(request: FixRequest): Promise<FixProposal>;
}
