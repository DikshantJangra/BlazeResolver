import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { CodeGraphAdapter } from '../codebase/codegraph-adapter.js';
import { GitWorkspace, dockerAvailable } from '../codebase/git-workspace.js';
import { resolveOffline, type FixProject } from '../jobs/fix.js';
import type { AIProvider } from '../resolver/ai-provider.js';
import { BugResolver } from '../resolver/bug-resolver.js';
import { ClaudeProvider } from '../resolver/claude-provider.js';
import { secretValuesFromEnv } from '../resolver/guards.js';
import type { Incident, ResolutionResult } from '../resolver/types.js';
import { resolveComplete } from '../triage/index.js';

export interface TryCommandOptions {
  /** Repo root: the try command clones this, so the fix runs against real code, real tests, real build. */
  root: string;
  /** Same blazeresolver.config.json the workflow reads: repo, testCommand, buildCommand, installCommand, sandbox. */
  config: FixProject;
  env: NodeJS.ProcessEnv;
  incident: Incident;
  maxAttempts?: number;
  /** Tests: whether Docker is usable. */
  dockerUp?: () => boolean;
  /** Tests inject a fake AI provider instead of a real model call. */
  ai?: AIProvider;
  /** Called at the start of each stage, so a long run isn't a silent black box. */
  onProgress?: (event: string) => void;
}

export interface TryCommandResult {
  result: ResolutionResult;
  /** Set when a fix passed: a real local branch, in this repo, holding the real commit. Never pushed. */
  branch?: string;
}

/**
 * Runs the real resolver against this repo, locally: a real git clone, the project's own test and build commands
 * (offline in a container when the config says so, same as the workflow), and a real AI provider from .env/env.
 * On success the fix is committed in its workspace, then fetched into this repo as a local branch — nothing is
 * checked out, merged or pushed. Any user with a key in .env can run this after `blazeresolver init`.
 */
/**
 * Everything the working tree has beyond HEAD, new files included (a plain `git diff HEAD` leaves those out, so code
 * importing a file not yet committed would fail in the workspace). Built in a throwaway index, so the repo's own index
 * is untouched; `git add -A` honors .gitignore, so .env and other ignored files never reach the workspace.
 */
export function workingTreePatch(root: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'blaze-index-'));
  try {
    const env = { ...process.env, GIT_INDEX_FILE: join(dir, 'index') };
    const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', env, maxBuffer: 256 * 1024 * 1024 });
    git('read-tree', 'HEAD');
    git('add', '-A');
    return git('diff', '--cached', '--binary', 'HEAD');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Retries a model call the provider turned away for now (overloaded, rate-limited, timed out) after 15s, 30s and 60s,
 * so one busy moment at the provider doesn't end a run that already cloned, installed and tested.
 * Other errors (a bad key, a malformed request) fail at once.
 */
export function withBusyRetry(
  call: (system: string, user: string) => Promise<string>,
  onProgress?: (event: string) => void,
  delaysMs: number[] = [15_000, 30_000, 60_000]
): (system: string, user: string) => Promise<string> {
  return async (system, user) => {
    for (let i = 0; ; i++) {
      try {
        return await call(system, user);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (i >= delaysMs.length || !/\b(429|500|502|503|504)\b|timeout|timed out|overloaded|high demand/i.test(message)) throw err;
        onProgress?.(`the AI provider is busy (${message.slice(0, 80)}); retrying in ${delaysMs[i] / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delaysMs[i]));
      }
    }
  };
}

/**
 * Asks the model again (up to `retries` more times) when its analysis or fix isn't the JSON the engine reads: a model
 * sometimes slips (single quotes, a comment, a trailing comma), and one slip shouldn't end a run that already cloned,
 * installed and tested. Any other failure passes straight through.
 */
export function withMalformedRetry(ai: AIProvider, onProgress?: (event: string) => void, retries = 2): AIProvider {
  const again = async <T>(what: string, call: () => Promise<T>): Promise<T> => {
    for (let i = 0; ; i++) {
      try {
        return await call();
      } catch (err) {
        const malformed = err instanceof SyntaxError || (err instanceof Error && err.name === 'ZodError');
        if (!malformed || i >= retries) throw err;
        onProgress?.(`the model's ${what} wasn't valid JSON (${err.message.split('\n')[0].slice(0, 80)}); asking again...`);
      }
    }
  };
  return {
    investigate: (request) => again('analysis', () => ai.investigate(request)),
    proposeFix: (request) => again('fix', () => ai.proposeFix(request))
  };
}

export async function runTryCommand(opts: TryCommandOptions): Promise<TryCommandResult> {
  const { root, config, env, incident } = opts;
  const baseRef = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const basePatch = workingTreePatch(root);
  const ai =
    opts.ai ??
    (() => {
      const complete = resolveComplete({ env, maxTokens: 4096, timeoutMs: 180_000 });
      if (!complete) {
        throw new Error('No AI key found. Put any provider key in .env as API_KEYS=... (see .env.example), or export it.');
      }
      return withMalformedRetry(new ClaudeProvider(withBusyRetry((system, user) => complete(system, user), opts.onProgress)), opts.onProgress);
    })();

  const workspaces = new GitWorkspace({
    repo: root,
    baseRef,
    basePatch,
    testCommand: config.testCommand,
    buildCommand: config.buildCommand,
    installCommand: config.installCommand,
    offline: resolveOffline(config, opts.dockerUp ?? dockerAvailable)
  });

  // Closed at the end: its server process would otherwise keep this command running after the result is printed.
  const codebase = new CodeGraphAdapter({ root });
  const resolver = new BugResolver({
    codebase,
    workspaces,
    ai,
    secretValues: secretValuesFromEnv(env),
    maxAttempts: opts.maxAttempts,
    onProgress: opts.onProgress
  });

  const result = await resolver.resolve(incident).finally(() => codebase.close().catch(() => undefined));
  if (result.status !== 'READY_FOR_REVIEW' || !result.workspace) return { result };

  await workspaces.commit(result.workspace, result.summary ?? incident.title);
  const branch = result.workspace.branch!;
  execFileSync('git', ['-C', root, 'fetch', '--quiet', result.workspace.path, `${branch}:${branch}`]);
  return { result, branch };
}
