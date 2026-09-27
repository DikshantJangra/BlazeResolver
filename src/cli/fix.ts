import { readFileSync } from 'node:fs';
import { addLabels, commentOnIssue, getIssue, listComments } from '../github/index.js';
import { parseIssueBody } from '../handler/issue.js';
import { runFix } from '../jobs/fix.js';
import { secretValuesFromEnv } from '../resolver/guards.js';
import type { AIProvider } from '../resolver/ai-provider.js';
import { ClaudeProvider } from '../resolver/claude-provider.js';
import { describeProviders, listProviders, resolveComplete } from '../triage/index.js';

export interface ProjectConfig {
  repo: string;
  defaultBranch: string;
  testCommand: string;
  buildCommand: string;
  /** Installs dependencies with network; tests and build then run offline in a container. Absent in configs from before offline tests. */
  installCommand?: string;
  sandbox?: 'docker' | 'none';
  sandboxImage?: string;
}

/** Names of the AI providers configured, in failover order. Never keys. */
function providerNames(env: Record<string, string | undefined>): string[] {
  const known = new Set(listProviders().map((p) => p.name));
  return describeProviders(env as NodeJS.ProcessEnv).map((l) => l.split(':')[0]).filter((n) => known.has(n));
}

/** Labels that mean this issue was already worked on, so a repeated workflow run does nothing. */
const HANDLED = ['blazeresolver:fixing', 'blazeresolver:pr-opened', 'blazeresolver:needs-human'];
/** Only issues opened by people with write access are trusted. The handler's token belongs to one. */
const TRUSTED = ['OWNER', 'MEMBER', 'COLLABORATOR'];

export interface FixCommandOptions {
  env: Record<string, string | undefined>;
  config: ProjectConfig;
  /** Tests inject these. */
  ai?: AIProvider;
  fetch?: typeof fetch;
  remoteUrl?: string;
  /** Tests: whether Docker is usable. */
  dockerUp?: () => boolean;
}

/**
 * The GitHub Action's job: take the labeled issue, run the fix engine on the runner, open a PR that closes the issue.
 * The runner is the sandbox: a throwaway machine with only this repo's own secrets.
 */
export async function runFixCommand(opts: FixCommandOptions): Promise<string> {
  const { env } = opts;
  const token = env.GITHUB_TOKEN;
  const eventPath = env.GITHUB_EVENT_PATH;
  if (!token || !eventPath) throw new Error('GITHUB_TOKEN and GITHUB_EVENT_PATH are required (run this inside the BlazeResolver workflow)');

  const number: number = JSON.parse(readFileSync(eventPath, 'utf8')).issue?.number;
  if (!number) throw new Error('this event has no issue');
  const repo = opts.config.repo;
  const f = opts.fetch;

  // The event payload can be stale; decide from the issue as it is now.
  const issue = await getIssue(token, repo, number, f);
  if (!issue.labels.includes('blazeresolver')) return 'not a BlazeResolver issue, skipping';
  if (HANDLED.some((l) => issue.labels.includes(l))) return 'already handled, skipping';
  if (!TRUSTED.includes(issue.author_association)) return `issue author is ${issue.author_association}, not a collaborator: skipping`;

  let modelCalls = 0;
  const ai =
    opts.ai ??
    (() => {
      const complete = resolveComplete({ env, maxTokens: 4096, timeoutMs: 180_000 });
      if (!complete) {
        throw new Error('No AI key is set. Add any provider\'s key as the API_KEYS repo secret (several, comma-separated, for failover); the provider is recognized automatically.');
      }
      return new ClaudeProvider(async (system, user) => {
        modelCalls++;
        return complete(system, user);
      });
    })();

  await addLabels(token, repo, number, ['blazeresolver:fixing'], f);
  const comments = await listComments(token, repo, number, f);
  const reportCount = 1 + comments.filter((c) => c.startsWith('Another customer reported this.')).length;
  const { title, description, stackTrace } = parseIssueBody(issue.title, issue.body ?? '');

  try {
    const outcome = await runFix({
      project: opts.config,
      incident: { id: `issue-${number}`, title, description, stackTrace },
      reportCount,
      token,
      ai,
      issueNumber: number,
      remoteUrl: opts.remoteUrl,
      fetch: f,
      dockerUp: opts.dockerUp,
      secretValues: secretValuesFromEnv(env, [token]),
      audit: { providers: opts.ai ? undefined : providerNames(env), modelCalls: opts.ai ? undefined : () => modelCalls, maxAttempts: 3 }
    });
    if (outcome.status === 'pr_opened') {
      await addLabels(token, repo, number, ['blazeresolver:pr-opened'], f);
      await commentOnIssue(token, repo, number, `BlazeResolver opened a fix for review: ${outcome.url}`, f);
      return `opened ${outcome.url}`;
    }
    await addLabels(token, repo, number, ['blazeresolver:needs-human'], f);
    return `needs a human: ${outcome.reason}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await addLabels(token, repo, number, ['blazeresolver:needs-human'], f).catch(() => {});
    await commentOnIssue(token, repo, number, `BlazeResolver hit an error and stopped: ${message.slice(0, 500)}`, f).catch(() => {});
    throw err;
  }
}
