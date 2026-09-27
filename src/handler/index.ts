import { commentOnIssue, listOpenIssues, openIssue } from '../github/index.js';
import { ReportSchema, resolveComplete, triage, type Complete } from '../triage/index.js';
import { emailMarker, groupKey, keyMarker, renderIssueBody, renderReport, symptomIn } from './issue.js';
import { sameSymptom, symptomOf } from '../triage/grouping.js';
import { answerQuestion, replyToCustomer } from '../answer/index.js';
import { resolveEmbedder, type Embedder } from '../answer/embed.js';
export { resolveEmbedder, type Embedder, type EmbedKind } from '../answer/embed.js';

export interface HandlerOptions {
  /** owner/name of the repo that gets the issues. */
  repo: string;
  /** Needs Issues: write on that one repo and nothing else. Defaults to BLAZE_GITHUB_TOKEN. */
  githubToken?: string;
  /** Model for triage. Defaults to whichever AI provider has a key configured; without one, keyword rules are used. */
  complete?: Complete;
  /** Extra help docs, searched along with the repo's README when answering customer questions. */
  helpDocs?: string;
  /**
   * Semantic search over the docs, alongside keyword search. Defaults to whichever provider with embeddings has a key
   * configured (see `resolveEmbedder`); `false` keeps search keyword-only.
   */
  embed?: Embedder | false;
  /** Keep the customer's email in the issue so they can be told when it's fixed. Only for private repos. */
  storeEmails?: boolean;
  /**
   * Reports accepted per IP every 10 minutes, and in total per hour, per server instance. Defaults 10 and 100
   * (BLAZE_RATE_LIMIT_PER_HOUR overrides the total). GitHub caps content creation at about 500 per hour per token.
   */
  rateLimit?: { perIp?: number; perHour?: number };
  /** Set when the widget runs on a different origin than the handler. */
  allowOrigin?: string;
  fetch?: typeof fetch;
}

const MAX_BODY = 20_000;
/** The widget waits 25s. Triage past this falls back to keyword rules, so the report is still filed in time. */
const TRIAGE_BUDGET_MS = 8_000;
/** Answering a question comes after triage, inside the same 25s. */
const ANSWER_BUDGET_MS = 12_000;
/** The reply to anything that isn't answered, written while the report is filed. */
const REPLY_BUDGET_MS = 6_000;
/** Everything has to be back well inside the widget's 25s. */
const RESPONSE_BUDGET_MS = 21_000;

function withDeadline(complete: Complete | undefined, ms: number): Complete | undefined {
  if (!complete) return undefined;
  return (system, user) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('triage timed out')), ms); });
    return Promise.race([complete(system, user), deadline]).finally(() => clearTimeout(timer));
  };
}
const env = (name: string) => (globalThis as any).process?.env?.[name] as string | undefined;

// ponytail: in-memory counters, per instance. Serverless instances don't share them, so this only blunts a single-source flood.
const hits = new Map<string, number[]>();
let lastSweep = 0;
function limited(id: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  // Drop idle clients now and then, so a long-running server's memory doesn't grow with every IP it has ever seen.
  if (now - lastSweep > 600_000 || hits.size > 50_000) {
    lastSweep = now;
    for (const [key, times] of hits) if (now - times[times.length - 1] > 3_600_000) hits.delete(key);
  }
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
  const embedder = options.embed === false ? undefined : (options.embed ?? resolveEmbedder());
  const storeEmails = options.storeEmails ?? env('BLAZE_NOTIFY_CUSTOMERS') === 'true';
  const perIp = options.rateLimit?.perIp ?? 10;
  const perHour = options.rateLimit?.perHour ?? (Number(env('BLAZE_RATE_LIMIT_PER_HOUR')) || 100);
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
    if (limited(`ip:${ip}`, perIp, 600_000) || limited('all', perHour, 3_600_000)) return reply(429, { error: 'rate limit' });

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

    const started = Date.now();
    const verdict = await triage(report, withDeadline(options.complete ?? resolveComplete({ timeoutMs: TRIAGE_BUDGET_MS }), TRIAGE_BUDGET_MS));
    const answer = await answerQuestion(report, verdict, {
      complete: withDeadline(options.complete ?? resolveComplete({ timeoutMs: ANSWER_BUDGET_MS }), ANSWER_BUDGET_MS),
      helpDocs: options.helpDocs,
      readme: { repo: options.repo, token, fetch: f },
      embedder
    });
    if (answer) return reply(200, { received: true, answer });
    // Everything else gets a short acknowledgement of what they said, never the verdict. It's written while the
    // report is filed, in whatever is left of the widget's wait. The fixed reply is used when too little is left, or
    // when triage fell back to keyword rules: a model that just failed or hung isn't waited on twice.
    const replyBudget = Math.min(REPLY_BUDGET_MS, RESPONSE_BUDGET_MS - (Date.now() - started));
    const customerReply = replyToCustomer(report, verdict, {
      complete: verdict.source === 'llm' && replyBudget >= 1_500 ? withDeadline(options.complete ?? resolveComplete({ timeoutMs: replyBudget }), replyBudget) : undefined
    });
    const ack = async () => reply(202, { received: true, reply: await customerReply });
    if (verdict.injection || !(verdict.enterFixLoop || verdict.kind === 'feature_request')) return ack();

    try {
      const email = storeEmails ? report.email : undefined;
      if (!verdict.enterFixLoop) {
        await openIssue({ token, repo: options.repo, title: `[feature request] ${verdict.summary}`.slice(0, 200), body: renderIssueBody(report, verdict, groupKey(verdict), email), labels: ['customer-feedback'] }, f);
        return ack();
      }

      const key = groupKey(verdict);
      const symptom = symptomOf(verdict, report.consoleErrors);
      const existing = (await listOpenIssues(token, options.repo, 'blazeresolver', f)).find((i) => {
        const recorded = symptomIn(i.body);
        // Issues filed before symptom markers existed only carry the key.
        return recorded ? sameSymptom(recorded, symptom) : !!i.body?.includes(keyMarker(key));
      });
      if (existing) {
        await commentOnIssue(token, options.repo, existing.number, `Another customer reported this.\n\n${renderReport(report, verdict)}${email ? `\n\n${emailMarker(email)}` : ''}`, f);
      } else {
        await openIssue(
          { token, repo: options.repo, title: `[${verdict.kind}] ${verdict.summary}`.slice(0, 200), body: renderIssueBody(report, verdict, key, email), labels: ['blazeresolver', ...(verdict.severity === 'critical' ? ['priority:critical'] : [])] },
          f
        );
      }
      return ack();
    } catch (err) {
      // Loud on purpose: an expired token or a GitHub limit would otherwise drop every report without a trace.
      console.error(`[blazeresolver] could not file a report in ${options.repo}: ${err instanceof Error ? err.message : err}`);
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
