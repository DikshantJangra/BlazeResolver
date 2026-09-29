import { execFile } from 'node:child_process';

export const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

/** Clone/push URL that carries the token. Never log it or store it in a repo's git config. */
export const authedUrl = (repo: string, token: string) => `https://x-access-token:${token}@github.com/${repo}.git`;
export const plainUrl = (repo: string) => `https://github.com/${repo}.git`;

/**
 * Strips personal data from text bound for GitHub, where a public repo makes it public.
 * URLs keep only origin and path (query strings and fragments carry emails and session ids), then emails,
 * IP addresses and long digit runs (phone and card numbers) are masked.
 * ponytail: pattern-based, so a name or street address written in free text still gets through.
 */
export function redactPersonalData(text: string): string {
  return text
    .replace(/\bhttps?:\/\/[^\s<>"'`)\]]+/gi, (raw) => {
      try {
        const url = new URL(raw);
        return `${url.origin}${url.pathname}`;
      } catch {
        return '[url]';
      }
    })
    .replace(/[\w.%+-]+@[\w-]+(?:\.[\w-]+)*/g, '[email]')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[ip]')
    .replace(/\+?\d[\d\s().-]{8,}\d/g, (run) => {
      const digits = run.replace(/\D/g, '').length;
      return digits >= 10 && digits <= 19 ? '[number]' : run;
    });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** How long to wait before retrying, or undefined when the error won't go away by waiting. */
function retryDelay(res: Response, attempt: number): number | undefined {
  const after = Number(res.headers.get('retry-after'));
  const secondaryLimit = res.status === 403 && (res.headers.has('retry-after') || res.headers.get('x-ratelimit-remaining') === '0');
  if (res.status !== 429 && res.status < 500 && !secondaryLimit) return undefined;
  return Math.min(after > 0 ? after * 1000 : 500 * 2 ** attempt, 3_000);
}

async function request(token: string, method: 'GET' | 'POST', url: string, body: unknown, f: typeof fetch): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await f(url, {
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
    if (res.ok) return res;
    const wait = attempt < 2 ? retryDelay(res, attempt) : undefined;
    if (wait === undefined) {
      const path = new URL(url).pathname;
      const hint = res.status === 401 ? ' (token expired or revoked: create a new one and update BLAZE_GITHUB_TOKEN)' : '';
      throw new Error(`github ${path} ${res.status}${hint}: ${(await res.text()).slice(0, 300)}`);
    }
    await sleep(wait);
  }
}

async function call<T = { html_url: string; number: number }>(
  token: string,
  method: 'GET' | 'POST',
  path: string,
  body: unknown,
  f: typeof fetch
): Promise<T> {
  return (await (await request(token, method, `https://api.github.com${path}`, body, f)).json()) as T;
}

/** Follows GitHub's Link headers, up to `maxPages` pages of 100. */
async function paginate<T = any>(token: string, path: string, f: typeof fetch, maxPages = 20): Promise<T[]> {
  const all: T[] = [];
  let url: string | undefined = `https://api.github.com${path}${path.includes('?') ? '&' : '?'}per_page=100`;
  for (let page = 0; url && page < maxPages; page++) {
    const res = await request(token, 'GET', url, undefined, f);
    all.push(...((await res.json()) as T[]));
    const next = res.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
    // The token goes along, so only ever follow links back to the API.
    url = next?.startsWith('https://api.github.com/') ? next : undefined;
  }
  return all;
}
const api = (token: string, path: string, body: unknown, f: typeof fetch) => call(token, 'POST', path, body, f);

/**
 * The repo's README as raw Markdown, or undefined when it has none or GitHub can't be reached. Tried with the token
 * first, then without it: a public repo needs no token, and a private one needs a token with Contents: Read-only
 * (an Issues-only token can't read it).
 */
export async function getReadme(repo: string, token: string | undefined, f: typeof fetch = fetch): Promise<string | undefined> {
  for (const auth of token ? [token, undefined] : [undefined]) {
    try {
      const res = await f(`https://api.github.com/repos/${repo}/readme`, {
        headers: {
          ...(auth ? { authorization: `Bearer ${auth}` } : {}),
          accept: 'application/vnd.github.raw+json',
          'user-agent': 'blazeresolver'
        },
        signal: AbortSignal.timeout(3_000)
      });
      if (res.ok) return await res.text();
    } catch {
      // unreachable or timed out: try the next way, then give up
    }
  }
  return undefined;
}

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

/** Open issues with a label (pull requests excluded), newest first. All pages, so duplicates are found past the first 100. */
export async function listOpenIssues(token: string, repo: string, label: string, f: typeof fetch = fetch): Promise<Issue[]> {
  const raw = await paginate(token, `/repos/${repo}/issues?state=open&labels=${encodeURIComponent(label)}`, f);
  return raw.filter((i) => !i.pull_request).map(toIssue);
}

export async function listComments(token: string, repo: string, number: number, f: typeof fetch = fetch): Promise<string[]> {
  const raw = await paginate(token, `/repos/${repo}/issues/${number}/comments`, f);
  return raw.map((c) => c.body ?? '');
}

export async function commentOnIssue(token: string, repo: string, number: number, body: string, f: typeof fetch = fetch): Promise<void> {
  await api(token, `/repos/${repo}/issues/${number}/comments`, { body: redactPersonalData(body) }, f);
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
  const pr = await api(token, `/repos/${repo}/pulls`, { title: redactPersonalData(title), head, base, body: redactPersonalData(body) }, f);
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
  const issue = await api(
    input.token,
    `/repos/${input.repo}/issues`,
    { title: redactPersonalData(input.title), body: redactPersonalData(input.body), labels: input.labels ?? ['blazeresolver'] },
    f
  );
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

export { checkTokenHealth, type TokenHealthStatus } from './token-health.js';
