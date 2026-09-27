import { commentOnIssue, listOpenIssues, openIssue } from '../github/index.js';
import { ReportSchema, resolveComplete, triage, type Complete } from '../triage/index.js';
import { emailMarker, groupKey, keyMarker, renderIssueBody, renderReport, symptomIn } from './issue.js';
import { sameSymptom, symptomOf } from '../triage/grouping.js';
import { answerQuestion, productName, replyToCustomer } from '../answer/index.js';
import { resolveEmbedder, type Embedder } from '../answer/embed.js';
export { resolveEmbedder, type Embedder, type EmbedKind } from '../answer/embed.js';
import { defaultVectorStore, type VectorStore } from '../answer/vector-store.js';
export { defaultVectorStore, localVectorStore, sqliteVectorStore, postgresVectorStore, type VectorStore, type StoredVector } from '../answer/vector-store.js';

export interface HandlerOptions {
  /** owner/name of the repo that gets the issues. */
  repo: string;
  /**
   * Needs Issues: write on that one repo. For a private repo also Contents: Read-only, so questions can be answered
   * from its README. Defaults to BLAZE_GITHUB_TOKEN.
   */
  githubToken?: string;
  /** Model for triage. Defaults to whichever AI provider has a key configured; without one, keyword rules are used. */
  complete?: Complete;
  /** Extra help docs, searched along with the repo's README when answering customer questions. */
  helpDocs?: string;
  /**
   * The product's name, so Blazzy answers for it and nothing else. Defaults to BLAZE_PRODUCT_NAME, else the repo's
   * name (`acme/shop` -> `shop`).
   */
  product?: string;
  /**
   * The README on disk, read before GitHub's. By default the one at the root of this app's checkout, when its GitHub
   * remote is `repo`. A path reads that file; `false` reads none (GitHub only).
   */
  readmePath?: string | false;
  /**
   * Where the docs' vectors are kept, when semantic search is on. Defaults to a SQLite file in the product,
   * `.blazeresolver/vectors.db` (see `localVectorStore`); `sqliteVectorStore` / `postgresVectorStore` use a database the
   * product has; `false` keeps them in memory only.
   */
  vectorStore?: VectorStore | false;
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
  rateLimit?: {
    perIp?: number;
    perHour?: number;
    /** Atomic shared limiter for serverless deployments. Return true when the limit is exceeded. */
    check?: (id: string, max: number, windowMs: number) => boolean | Promise<boolean>;
  };
  /** Distributed lock for issue deduplication. Defaults to a process-local lock. */
  withIssueLock?: <T>(key: string, run: () => Promise<T>) => Promise<T>;
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

// ponytail: process-local fallback; pass rateLimit.check backed by shared storage when deploying multiple instances.
const hits = new Map<string, number[]>();
const filing = new Map<string, Promise<void>>();
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

async function serialize<T>(key: string, run: () => Promise<T>): Promise<T> {
  const previous = filing.get(key);
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  filing.set(key, current);
  await previous;
  try {
    return await run();
  } finally {
    release();
    if (filing.get(key) === current) filing.delete(key);
  }
}

/**
 * A Web-standard `(Request) => Response` handler for the widget. Mount it in Next.js, Cloudflare, Vercel, Deno or Bun as is,
 * or in Express with `nodeHandler`. It triages a report and files it as a GitHub issue; the workflow in that repo does the rest.
 * It holds no state and no secrets beyond a token that can only write issues (and read a private repo), and it can't push code.
 */
export function createHandler(options: HandlerOptions): (req: Request) => Promise<Response> {
  const token = options.githubToken ?? env('BLAZE_GITHUB_TOKEN');
  const f = options.fetch ?? fetch;
  const embedder = options.embed === false ? undefined : (options.embed ?? resolveEmbedder());
  const product = productName(options.product, options.repo);
  // Only opened when there's something to keep: without embeddings there are no vectors.
  const vectorStore = !embedder || options.vectorStore === false ? undefined : (options.vectorStore ?? defaultVectorStore());
  const storeEmails = options.storeEmails ?? env('BLAZE_NOTIFY_CUSTOMERS') === 'true';
  const perIp = options.rateLimit?.perIp ?? 10;
  const perHour = options.rateLimit?.perHour ?? (Number(env('BLAZE_RATE_LIMIT_PER_HOUR')) || 100);
  const lockIssue = options.withIssueLock ?? serialize;
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
    const checkLimit = options.rateLimit?.check ?? limited;
    try {
      if (await checkLimit(`ip:${ip}`, perIp, 600_000) || await checkLimit('all', perHour, 3_600_000)) return reply(429, { error: 'rate limit' });
    } catch {
      return reply(503, { error: 'rate limiter unavailable' });
    }

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
      embedder,
      product,
      readmePath: options.readmePath,
      vectorStore
    });
    if (answer) return reply(200, { received: true, answer });
    // Everything else gets a short acknowledgement of what they said, never the verdict. It's written while the
    // report is filed, in whatever is left of the widget's wait. The fixed reply is used when too little is left, or
    // when triage fell back to keyword rules: a model that just failed or hung isn't waited on twice.
    const replyBudget = Math.min(REPLY_BUDGET_MS, RESPONSE_BUDGET_MS - (Date.now() - started));
    const customerReply = replyToCustomer(report, verdict, {
      product,
      complete: verdict.source === 'llm' && replyBudget >= 1_500 ? withDeadline(options.complete ?? resolveComplete({ timeoutMs: replyBudget }), replyBudget) : undefined
    });
    const ack = async () => reply(202, { received: true, reply: await customerReply });
    // Questions (answered or not) and injection attempts are never filed.
    if (verdict.injection || verdict.type !== 'report') return ack();

    try {
      const email = storeEmails ? report.email : undefined;
      const key = groupKey(verdict);
      const symptom = symptomOf(verdict, report.consoleErrors);
      let joined = false;
      await lockIssue(`${options.repo}:${key}`, async () => {
        // A report of a bug that already has an issue joins it, however this one was classified: the same overcharge
        // reads as a bug to one customer and a billing complaint to the next. Only bug reports join on the page alone.
        const existing = (await listOpenIssues(token, options.repo, 'blazeresolver', f)).find((i) => {
          const recorded = symptomIn(i.body);
          // Issues filed before symptom markers existed only carry the key.
          return recorded ? sameSymptom(recorded, symptom, verdict.enterFixLoop) : verdict.enterFixLoop && !!i.body?.includes(keyMarker(key));
        });
        if (existing) {
          await commentOnIssue(token, options.repo, existing.number, `Another customer reported this.\n\n${renderReport(report, verdict)}${email ? `\n\n${emailMarker(email)}` : ''}`, f);
          joined = true;
        } else if (verdict.enterFixLoop) {
          await openIssue(
            { token, repo: options.repo, title: `[${verdict.kind}] ${verdict.summary}`.slice(0, 200), body: renderIssueBody(report, verdict, key, email), labels: ['blazeresolver', ...(verdict.severity === 'critical' ? ['priority:critical'] : [])] },
            f
          );
        }
      });
      if (!joined && verdict.kind === 'feature_request') {
        await openIssue({ token, repo: options.repo, title: `[feature request] ${verdict.summary}`.slice(0, 200), body: renderIssueBody(report, verdict, key, email), labels: ['customer-feedback'] }, f);
      }
      return ack();
    } catch (err) {
      // Loud on purpose: an expired token or a GitHub limit would otherwise drop every report without a trace.
      console.error(`[blazeresolver] could not file a report in ${options.repo}: ${err instanceof Error ? err.message : err}`);
      // A report that would only have joined an existing issue loses nothing it was promised.
      if (!verdict.enterFixLoop && verdict.kind !== 'feature_request') return ack();
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
