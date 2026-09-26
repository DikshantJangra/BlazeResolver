import { execFile } from 'node:child_process';

export const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

/** Clone/push URL that carries the token. Never log it or store it in a repo's git config. */
export const authedUrl = (repo: string, token: string) => `https://x-access-token:${token}@github.com/${repo}.git`;
export const plainUrl = (repo: string) => `https://github.com/${repo}.git`;

async function call<T = { html_url: string; number: number }>(
  token: string,
  method: 'GET' | 'POST',
  path: string,
  body: unknown,
  f: typeof fetch
): Promise<T> {
  const res = await f(`https://api.github.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'blazeresolver'
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000)
  });
  if (!res.ok) throw new Error(`github ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}
const api = (token: string, path: string, body: unknown, f: typeof fetch) => call(token, 'POST', path, body, f);

export interface Issue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: 'open' | 'closed';
  author_association: string;
  labels: string[];
}

const toIssue = (raw: any): Issue => ({
  number: raw.number,
  title: raw.title,
  body: raw.body ?? null,
  html_url: raw.html_url,
  state: raw.state,
  author_association: raw.author_association,
  labels: (raw.labels ?? []).map((l: any) => (typeof l === 'string' ? l : l.name))
});

export async function getIssue(token: string, repo: string, number: number, f: typeof fetch = fetch): Promise<Issue> {
  return toIssue(await call(token, 'GET', `/repos/${repo}/issues/${number}`, undefined, f));
}

/** Open issues with a label (pull requests excluded), newest first. */
export async function listOpenIssues(token: string, repo: string, label: string, f: typeof fetch = fetch): Promise<Issue[]> {
  const raw = await call<any[]>(token, 'GET', `/repos/${repo}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=100`, undefined, f);
  return raw.filter((i) => !i.pull_request).map(toIssue);
}

export async function listComments(token: string, repo: string, number: number, f: typeof fetch = fetch): Promise<string[]> {
  const raw = await call<any[]>(token, 'GET', `/repos/${repo}/issues/${number}/comments?per_page=100`, undefined, f);
  return raw.map((c) => c.body ?? '');
}

export async function commentOnIssue(token: string, repo: string, number: number, body: string, f: typeof fetch = fetch): Promise<void> {
  await api(token, `/repos/${repo}/issues/${number}/comments`, { body }, f);
}

export async function addLabels(token: string, repo: string, number: number, labels: string[], f: typeof fetch = fetch): Promise<void> {
  await api(token, `/repos/${repo}/issues/${number}/labels`, { labels }, f);
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
  input: { token: string; repo: string; title: string; body: string; labels?: string[] },
  f: typeof fetch = fetch
): Promise<{ url: string; number: number }> {
  const issue = await api(input.token, `/repos/${input.repo}/issues`, { title: input.title, body: input.body, labels: input.labels ?? ['blazeresolver'] }, f);
  return { url: issue.html_url, number: issue.number };
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
