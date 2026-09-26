import type { BuildResult, ExploreResult, FileContent, TestResult, Workspace } from '../codebase/contracts.js';

// ============================================================
// INCIDENT
// ============================================================

/** A bug report handed to the resolver: what went wrong, as observed from outside the code. */
export interface Incident {
  id: string;
  title: string;
  description: string;
  /** Raw stack trace or error output, if any. File references in it are read as investigation context. */
  stackTrace?: string;
  /** Any other observations (logs, request ids, reproduction steps). */
  logs?: string[];
}

// ============================================================
// INVESTIGATION
// ============================================================

/** What the resolver gathered from the codebase before asking the AI provider to investigate. */
export interface CodeContext {
  /** CodeGraph exploration of the incident text. */
  exploration?: ExploreResult;
  /** Contents of the files exploration and the stack trace pointed at. */
  files: FileContent[];
  /** Codebase lookups that failed; investigation continues without them. */
  notes: string[];
}

export type Confidence = 'low' | 'medium' | 'high';

export interface Investigation {
  /** One-paragraph description of what is happening. */
  summary: string;
  /** Why it happens, in terms of the code. */
  rootCause: string;
  /** Repository-relative files the fix most likely touches. */
  suspectedFiles: string[];
  confidence: Confidence;
  /** Findings that support the root cause (file:line references, observed values). */
  evidence?: string[];
}

// ============================================================
// FIX
// ============================================================

/**
 * One change to one file. `replace` swaps text that must occur exactly once in the file;
 * `create` adds a file that must not exist yet.
 */
export type FileEdit =
  | { kind: 'replace'; path: string; search: string; replace: string }
  | { kind: 'create'; path: string; content: string };

export interface FixProposal {
  /** What the fix changes and why; becomes the review description. */
  summary: string;
  edits: FileEdit[];
}

export type AttemptStage = 'patch' | 'test' | 'build';

export interface FixAttempt {
  /** 1-based. */
  number: number;
  workspace: Workspace;
  proposal: FixProposal;
  /** The unified diff generated from the proposal, when its edits could be rendered. */
  patch?: string;
  tests?: TestResult;
  build?: BuildResult;
  /** Absent when the attempt passed patch, tests and build. */
  failure?: { stage: AttemptStage; output: string };
}

// ============================================================
// RESULT
// ============================================================

export type ResolutionStatus = 'READY_FOR_REVIEW' | 'FAILED';

export interface ResolutionResult {
  status: ResolutionStatus;
  incident: Incident;
  investigation?: Investigation;
  /** Test run on the untouched workspace; a failure here means the tests reproduce the bug. */
  baseline?: TestResult;
  attempts: FixAttempt[];
  /** READY_FOR_REVIEW only: the workspace holding the fix, and its diff against the base. */
  workspace?: Workspace;
  diff?: string;
  /** READY_FOR_REVIEW only: the proposal summary of the passing attempt. */
  summary?: string;
  /** FAILED only. */
  failureReason?: string;
}
