import type { CodebaseInterface, FileContent, TestResult, Workspace, WorkspaceInterface } from '../codebase/contracts.js';
import type { AIProvider } from './ai-provider.js';
import { renderPatch } from './patch.js';
import type { CodeContext, FixAttempt, Incident, Investigation, ResolutionResult } from './types.js';

export interface BugResolverOptions {
  /** Read-only view of the repository, used for investigation. Should index the same commit the workspaces start from. */
  codebase: CodebaseInterface;
  /** The only way the resolver changes code: each attempt gets its own isolated workspace. */
  workspaces: WorkspaceInterface;
  ai: AIProvider;
  /** Fix attempts before giving up. Defaults to 3; at most HARD_MAX_ATTEMPTS. */
  maxAttempts?: number;
  /** Edits to matching paths are refused, so a human has to make them. Defaults to DEFAULT_FORBIDDEN_PATHS. */
  forbiddenPaths?: RegExp[];
}

/** CI config, secrets, lockfiles, and the code where a wrong fix costs the most: auth, payments, migrations. */
export const DEFAULT_FORBIDDEN_PATHS: RegExp[] = [
  /^\.github\//,
  /(^|\/)\.env(\.|$)/,
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/,
  /(^|\/)(migrations?|auth|payments?|billing|secrets?)(\/|$)/i
];

/** A fix bigger than this is a redesign, not a bug fix; it goes to a human. */
const MAX_PATCH_LINES = 400;

/** No configuration can make the resolver try more fixes than this for one incident. */
export const HARD_MAX_ATTEMPTS = 5;
const DEFAULT_MAX_ATTEMPTS = 3;

/** Files read into the investigation and fix context. */
const MAX_CONTEXT_FILES = 8;
/** Test and build output handed to the AI is kept to its tail, where runners report failures. */
const AI_OUTPUT_TAIL_CHARS = 8000;
/** Suffixes tried when mapping an absolute stack-trace path onto the repository. */
const MAX_PATH_SUFFIXES = 6;

/**
 * Takes one incident from bug report to a reviewable fix:
 * reproduce → investigate → propose fix → patch → test → build, retrying with the failure until a
 * fix passes or the attempt budget runs out.
 *
 * Every attempt starts from a fresh workspace, so a failed patch never leaks into the next one.
 * The resolver never commits, merges, pushes or deploys: a passing fix ends as READY_FOR_REVIEW,
 * with its diff and the workspace that holds it.
 */
export class BugResolver {
  private readonly maxAttempts: number;

  constructor(private options: BugResolverOptions) {
    const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > HARD_MAX_ATTEMPTS) {
      throw new RangeError(`maxAttempts must be an integer from 1 to ${HARD_MAX_ATTEMPTS}, got ${maxAttempts}`);
    }
    this.maxAttempts = maxAttempts;
  }

  public async resolve(incident: Incident): Promise<ResolutionResult> {
    const { codebase, workspaces, ai } = this.options;
    const result: ResolutionResult = { status: 'FAILED', incident, attempts: [] };

    try {
      // Reproduce: run the tests on an untouched workspace.
      const baselineWorkspace = await workspaces.createWorkspace();
      result.baseline = await workspaces.runTests(baselineWorkspace);

      // Understand.
      const context = await this.gatherContext(incident);
      result.investigation = await withPrefix('investigation failed', () =>
        ai.investigate({
          incident,
          baselineFailure: result.baseline!.success ? undefined : tail(result.baseline!),
          context,
          codebase
        })
      );

      // Fix, test, build; retry with the failure.
      for (let number = 1; number <= this.maxAttempts; number++) {
        const attempt = await this.attempt(number, incident, result.investigation, result.attempts);
        result.attempts.push(attempt);
        if (!attempt.failure) {
          result.status = 'READY_FOR_REVIEW';
          result.workspace = attempt.workspace;
          result.diff = await workspaces.gitDiff(attempt.workspace);
          result.summary = attempt.proposal.summary;
          return result;
        }
      }

      const last = result.attempts[result.attempts.length - 1].failure!;
      result.failureReason = `no fix passed within ${this.maxAttempts} attempt(s); the last one failed at ${last.stage}`;
    } catch (err) {
      result.failureReason = err instanceof Error ? err.message : String(err);
    }
    return result;
  }

  private async attempt(
    number: number,
    incident: Incident,
    investigation: Investigation,
    previousAttempts: FixAttempt[]
  ): Promise<FixAttempt> {
    const { codebase, workspaces, ai } = this.options;
    const workspace = await workspaces.createWorkspace();

    // The AI sees the files it suspects plus any it edited before, exactly as the patch will be applied to them.
    const paths = [
      ...investigation.suspectedFiles,
      ...previousAttempts.flatMap((a) => a.proposal.edits.map((e) => e.path))
    ];
    const proposal = await withPrefix(`fix proposal ${number} failed`, async () =>
      ai.proposeFix({
        incident,
        investigation,
        files: await this.readWorkspaceFiles(workspace, paths),
        previousAttempts: previousAttempts.map(forAI),
        codebase
      })
    );

    const attempt: FixAttempt = { number, workspace, proposal };

    const forbidden = this.options.forbiddenPaths ?? DEFAULT_FORBIDDEN_PATHS;
    const blocked = proposal.edits.find((e) => forbidden.some((re) => re.test(e.path.replace(/^\.\//, ''))));
    if (blocked) {
      attempt.failure = { stage: 'patch', output: `${blocked.path} is a forbidden path: a human must change it. Fix this some other way.` };
      return attempt;
    }

    try {
      attempt.patch = await renderPatch(proposal.edits, (path) => workspaces.readFile(workspace, path));
      if (attempt.patch.split('\n').length > MAX_PATCH_LINES) {
        throw new Error(`the patch is over ${MAX_PATCH_LINES} lines; make the smallest change that fixes the bug`);
      }
      await workspaces.applyPatch(workspace, attempt.patch);
    } catch (err) {
      attempt.failure = { stage: 'patch', output: err instanceof Error ? err.message : String(err) };
      return attempt;
    }

    attempt.tests = await workspaces.runTests(workspace);
    if (!attempt.tests.success) {
      attempt.failure = { stage: 'test', output: attempt.tests.output };
      return attempt;
    }

    attempt.build = await workspaces.runBuild(workspace);
    if (!attempt.build.success) {
      attempt.failure = { stage: 'build', output: attempt.build.output };
    }
    return attempt;
  }

  /** Explores the codebase for the incident and reads the files it and the stack trace point at. Never throws. */
  private async gatherContext(incident: Incident): Promise<CodeContext> {
    const { codebase } = this.options;
    const context: CodeContext = { files: [], notes: [] };

    try {
      context.exploration = await codebase.explore(`${incident.title}\n${incident.description}`);
    } catch (err) {
      context.notes.push(`explore failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Stack-trace frames are the strongest signal, so their files come first.
    const candidates = [...stackTracePaths(incident.stackTrace ?? ''), ...(context.exploration?.files ?? [])];
    const read = new Set<string>();

    for (const candidate of candidates) {
      if (context.files.length >= MAX_CONTEXT_FILES) break;
      for (const path of repositoryPathCandidates(candidate)) {
        if (read.has(path)) break;
        try {
          context.files.push(await codebase.readFile(path));
          read.add(path);
          break;
        } catch {
          // not in the repository under this name; try a shorter suffix
        }
      }
    }
    return context;
  }

  private async readWorkspaceFiles(workspace: Workspace, paths: string[]): Promise<FileContent[]> {
    const files: FileContent[] = [];
    for (const path of new Set(paths)) {
      if (files.length >= MAX_CONTEXT_FILES) break;
      try {
        const content = await this.options.workspaces.readFile(workspace, path);
        if (content !== null) files.push({ path, content });
      } catch {
        // an unreadable suspect is left out; the AI can still read through the codebase
      }
    }
    return files;
  }
}

async function withPrefix<T>(prefix: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new Error(`${prefix}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function tail(result: TestResult): TestResult {
  return { success: result.success, output: result.output.slice(-AI_OUTPUT_TAIL_CHARS) };
}

/** A copy of an attempt with its outputs cut to what's worth sending to a model. */
function forAI(attempt: FixAttempt): FixAttempt {
  return {
    ...attempt,
    tests: attempt.tests && tail(attempt.tests),
    build: attempt.build && tail(attempt.build),
    failure: attempt.failure && { ...attempt.failure, output: attempt.failure.output.slice(-AI_OUTPUT_TAIL_CHARS) }
  };
}

/** Source file paths named by `path:line` references, in order of appearance. */
function stackTracePaths(trace: string): string[] {
  const paths: string[] = [];
  for (const match of trace.matchAll(/(?:file:\/\/)?((?:[A-Za-z]:)?[\w@.\-\/\\]+\.[A-Za-z]{1,5}):\d+/g)) {
    const path = match[1].replace(/\\/g, '/');
    if (path.includes('node_modules/') || path.startsWith('node:') || paths.includes(path)) continue;
    paths.push(path);
  }
  return paths;
}

/** Suffixes of the path, longest first, so /srv/app/src/x.ts can match src/x.ts in the repository. */
function repositoryPathCandidates(path: string): string[] {
  const segments = path.split('/').filter((s) => s && s !== '.').slice(-MAX_PATH_SUFFIXES);
  return segments.map((_, i) => segments.slice(i).join('/'));
}
