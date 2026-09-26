import { readFileSync } from 'node:fs';
import { commentOnIssue, getIssue, listComments } from '../github/index.js';
import { emailsIn } from '../handler/issue.js';
import { sendFixedEmail } from '../notify/index.js';

/** Issue numbers a PR body promises to close ("Closes #12"). */
export const closedIssues = (body: string | null | undefined) =>
  [...(body ?? '').matchAll(/\b(?:closes|fixes|resolves)\s+#(\d+)/gi)].map((m) => Number(m[1]));

/**
 * Runs when a BlazeResolver PR merges: emails the customers who opted in (only if the site owner stored addresses
 * and set RESEND_API_KEY + BLAZE_FROM_EMAIL), then leaves a count on the issue. Never writes addresses anywhere.
 */
export async function runNotifyCommand(opts: { env: Record<string, string | undefined>; repo: string; fetch?: typeof fetch }): Promise<string> {
  const { env, repo, fetch: f } = opts;
  const token = env.GITHUB_TOKEN;
  const eventPath = env.GITHUB_EVENT_PATH;
  if (!token || !eventPath) throw new Error('GITHUB_TOKEN and GITHUB_EVENT_PATH are required');

  const pr = JSON.parse(readFileSync(eventPath, 'utf8')).pull_request;
  if (!pr?.merged || !String(pr.head?.ref).startsWith('blazeresolver/fix-')) return 'not a merged BlazeResolver PR, skipping';
  if (!env.RESEND_API_KEY || !env.BLAZE_FROM_EMAIL) return 'RESEND_API_KEY / BLAZE_FROM_EMAIL not set, skipping customer emails';

  let sent = 0;
  for (const number of closedIssues(pr.body)) {
    const issue = await getIssue(token, repo, number, f);
    const emails = emailsIn([issue.body ?? '', ...(await listComments(token, repo, number, f))]);
    const results = await Promise.all(emails.map((to) => sendFixedEmail(to, issue.title.replace(/^\[[^\]]*\]\s*/, ''), f, env).catch(() => false)));
    const ok = results.filter(Boolean).length;
    sent += ok;
    if (ok) await commentOnIssue(token, repo, number, `${ok} customer(s) told the fix is merged.`, f);
  }
  return `notified ${sent} customer(s)`;
}
