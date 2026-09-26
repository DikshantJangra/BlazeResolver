import { readFileSync } from 'node:fs';
import { addLabels, commentOnIssue, getIssue, listComments } from '../github/index.js';
import { parseIssueBody } from '../handler/issue.js';
import { runFix } from '../jobs/fix.js';
import type { AIProvider } from '../resolver/ai-provider.js';
import { ClaudeProvider } from '../resolver/claude-provider.js';
import { anthropicComplete } from '../triage/index.js';

export interface ProjectConfig {
  repo: string;
  defaultBranch: string;
  testCommand: string;
  buildCommand: string;
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

  const ai =
    opts.ai ??
    (() => {
      const complete = anthropicComplete({ apiKey: env.ANTHROPIC_API_KEY, maxTokens: 4096 });
      if (!complete) throw new Error('ANTHROPIC_API_KEY secret is not set');
      return new ClaudeProvider(complete);
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
      fetch: f
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
