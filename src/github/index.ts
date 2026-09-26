import { execFile } from 'node:child_process';

export const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

/** Clone/push URL that carries the token. Never log it or store it in a repo's git config. */
export const authedUrl = (repo: string, token: string) => `https://x-access-token:${token}@github.com/${repo}.git`;
export const plainUrl = (repo: string) => `https://github.com/${repo}.git`;

async function api(token: string, path: string, body: unknown, f: typeof fetch): Promise<{ html_url: string; number: number }> {
  const res = await f(`https://api.github.com${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'blazeresolver'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000)
  });
  if (!res.ok) throw new Error(`github ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as { html_url: string; number: number };
}

export interface PullRequestInput {
  token: string;
  repo: string;
  head: string;
  base: string;
  title: string;
  body: string;
}

export async function openPullRequest(input: PullRequestInput, f: typeof fetch = fetch): Promise<{ url: string; number: number }> {
  const { token, repo, head, base, title, body } = input;
  const pr = await api(token, `/repos/${repo}/pulls`, { title, head, base, body }, f);
  try {
    await api(token, `/repos/${repo}/issues/${pr.number}/labels`, { labels: ['blazeresolver'] }, f);
  } catch {
    // the label is a convenience; the PR stands without it
  }
  return { url: pr.html_url, number: pr.number };
}

/** Used when the fix engine can't produce a passing fix: the findings go to the developers instead. */
export async function openIssue(
  input: { token: string; repo: string; title: string; body: string },
  f: typeof fetch = fetch
): Promise<{ url: string }> {
  const issue = await api(input.token, `/repos/${input.repo}/issues`, { title: input.title, body: input.body, labels: ['blazeresolver'] }, f);
  return { url: issue.html_url };
}

/** Pushes the workspace's HEAD to `branch` on the remote. Errors are scrubbed of the token. */
export function pushBranch(cwd: string, remoteUrl: string, branch: string, token: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['push', '--quiet', remoteUrl, `HEAD:refs/heads/${branch}`],
      { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
      (err, _out, stderr) => (err ? reject(new Error(`git push failed: ${(stderr || err.message).split(token).join('***')}`)) : resolve())
    );
  });
}
