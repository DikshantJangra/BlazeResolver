import { commentOnIssue, listOpenIssues, openIssue } from '../github/index.js';
import { ReportSchema, anthropicComplete, triage, type Complete } from '../triage/index.js';
import { emailMarker, groupKey, keyMarker, renderIssueBody, renderReport } from './issue.js';

export interface HandlerOptions {
  /** owner/name of the repo that gets the issues. */
  repo: string;
  /** Needs Issues: write on that one repo and nothing else. Defaults to BLAZE_GITHUB_TOKEN. */
  githubToken?: string;
  /** Model for triage. Defaults to Claude via ANTHROPIC_API_KEY; without a key, keyword rules are used. */
  complete?: Complete;
  /** Keep the customer's email in the issue so they can be told when it's fixed. Only for private repos. */
  storeEmails?: boolean;
  /** Set when the widget runs on a different origin than the handler. */
  allowOrigin?: string;
  fetch?: typeof fetch;
}

const MAX_BODY = 20_000;
const env = (name: string) => (globalThis as any).process?.env?.[name] as string | undefined;

// ponytail: in-memory counters, per instance. Serverless instances don't share them, so this only blunts a single-source flood.
const hits = new Map<string, number[]>();
function limited(id: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(id) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(id, recent);
  return recent.length > max;
}

/**
 * A Web-standard `(Request) => Response` handler for the widget. Mount it in Next.js, Cloudflare, Vercel, Deno or Bun as is,
 * or in Express with `nodeHandler`. It triages a report and files it as a GitHub issue; the workflow in that repo does the rest.
 * It holds no state and no secrets beyond an Issues-only token, and it can't push code.
 */
export function createHandler(options: HandlerOptions): (req: Request) => Promise<Response> {
  const token = options.githubToken ?? env('BLAZE_GITHUB_TOKEN');
  const f = options.fetch ?? fetch;
  const storeEmails = options.storeEmails ?? env('BLAZE_NOTIFY_CUSTOMERS') === 'true';
  const cors: Record<string, string> = options.allowOrigin
    ? { 'access-control-allow-origin': options.allowOrigin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' }
    : {};
  const reply = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors } });

  return async (req) => {
    if (req.method === 'OPTIONS') return reply(204);
    if (req.method !== 'POST') return reply(405, { error: 'POST only' });
    if (!token) return reply(500, { error: 'BLAZE_GITHUB_TOKEN is not set' });

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    if (limited(`ip:${ip}`, 10, 600_000) || limited('all', 100, 3_600_000)) return reply(429, { error: 'rate limit' });

    const text = await req.text();
    if (text.length > MAX_BODY) return reply(413, { error: 'too large' });
    let parsed;
    try {
      parsed = ReportSchema.safeParse(JSON.parse(text));
    } catch {
      return reply(400, { error: 'invalid json' });
    }
    if (!parsed.success) return reply(400, { error: 'invalid report' });
    const report = parsed.data;

    const verdict = await triage(report, options.complete ?? anthropicComplete());
    // The customer only ever gets an acknowledgement, never the verdict.
    const ack = () => reply(202, { received: true });
    if (verdict.injection || !(verdict.enterFixLoop || verdict.kind === 'feature_request')) return ack();

    try {
      const email = storeEmails ? report.email : undefined;
      if (!verdict.enterFixLoop) {
        await openIssue({ token, repo: options.repo, title: `[feature request] ${verdict.summary}`.slice(0, 200), body: renderIssueBody(report, verdict, groupKey(verdict), email), labels: ['customer-feedback'] }, f);
        return ack();
      }

      const key = groupKey(verdict);
      const existing = (await listOpenIssues(token, options.repo, 'blazeresolver', f)).find((i) => i.body?.includes(keyMarker(key)));
      if (existing) {
        await commentOnIssue(token, options.repo, existing.number, `Another customer reported this.\n\n${renderReport(report, verdict)}${email ? `\n\n${emailMarker(email)}` : ''}`, f);
      } else {
        await openIssue(
          { token, repo: options.repo, title: `[${verdict.kind}] ${verdict.summary}`.slice(0, 200), body: renderIssueBody(report, verdict, key, email), labels: ['blazeresolver', ...(verdict.severity === 'critical' ? ['priority:critical'] : [])] },
          f
        );
      }
      return ack();
    } catch {
      return reply(502, { error: 'could not file the report' });
    }
  };
}

/** Adapts the handler to Node's (req, res), for Express and plain http servers. Works with or without a body parser. */
export function nodeHandler(handler: (req: Request) => Promise<Response>) {
  return async (req: any, res: any) => {
    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body !== undefined) body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      else body = await new Promise<string>((resolve) => { let d = ''; req.on('data', (c: Buffer) => (d += c)); req.on('end', () => resolve(d)); });
    }
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers[k] = v;
    const out = await handler(new Request(`http://localhost${req.originalUrl ?? req.url}`, { method: req.method, headers, body }));
    res.statusCode = out.status;
    out.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(await out.text());
  };
}
