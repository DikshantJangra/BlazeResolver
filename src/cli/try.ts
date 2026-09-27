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
export async function runTryCommand(opts: TryCommandOptions): Promise<TryCommandResult> {
  const { root, config, env, incident } = opts;
  const baseRef = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const basePatch = execFileSync('git', ['-C', root, 'diff', '--binary', 'HEAD'], { encoding: 'utf8' });
  const ai =
    opts.ai ??
    (() => {
      const complete = resolveComplete({ env, maxTokens: 4096, timeoutMs: 180_000 });
      if (!complete) {
        throw new Error('No AI key found. Put any provider key in .env as API_KEYS=... (see .env.example), or export it.');
      }
      return new ClaudeProvider(async (system, user) => complete(system, user));
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

  const resolver = new BugResolver({
    codebase: new CodeGraphAdapter({ root }),
    workspaces,
    ai,
    secretValues: secretValuesFromEnv(env),
    maxAttempts: opts.maxAttempts,
    onProgress: opts.onProgress
  });

  const result = await resolver.resolve(incident);
  if (result.status !== 'READY_FOR_REVIEW' || !result.workspace) return { result };

  await workspaces.commit(result.workspace, result.summary ?? incident.title);
  const branch = result.workspace.branch!;
  execFileSync('git', ['-C', root, 'fetch', '--quiet', result.workspace.path, `${branch}:${branch}`]);
  return { result, branch };
}
