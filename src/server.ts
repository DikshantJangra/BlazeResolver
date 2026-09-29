// Loads .env before anything reads process.env.
import 'dotenv/config';
import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Discover .env from web/.env or workspace roots if not in current cwd
[join(process.cwd(), '.env'), join(process.cwd(), 'web/.env'), join(process.cwd(), '../.env')].forEach((envPath) => {
  if (existsSync(envPath)) dotenvConfig({ path: envPath, override: false });
});
import express from 'express';
import cors from 'cors';
import { createServer, type IncomingHttpHeaders } from 'node:http';
import { WebSocketServer } from 'ws';
import { BlazeResolverPipeline } from './core/pipeline/index.js';
import { loadExample } from './examples/index.js';
import { VoiceChannelBridge } from './channels/voice.js';
import { LiveEvents, type Audience } from './channels/live-events.js';
import { getAgentToolSchemas, createAgentToolExecutor } from './channels/byo-agent.js';
import { buildInboundResponse } from './channels/inbound.js';
import { CustomerInput } from './core/types.js';
import { ReportSchema, describeProviders, resolveComplete, triage, type Severity } from './triage/index.js';
import { ProjectRegistry, type Project } from './projects/index.js';
import { IncidentStore, type IncidentRecord } from './incidents/index.js';
import { ClaudeProvider } from './resolver/claude-provider.js';
import { lockDownServerFiles, resolveFixSandbox, runFix } from './jobs/fix.js';
import { REPO_PATTERN, checkTokenHealth, type TokenHealthStatus } from './github/index.js';
import { MAX_HELP_DOCS, answerQuestion, productName, replyToCustomer } from './answer/index.js';
import { resolveEmbedder } from './answer/embed.js';
import { defaultVectorStore } from './answer/vector-store.js';
import { retrieve, type Chunk } from './answer/retrieve.js';
import { sendFixedEmail } from './notify/index.js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DEMO_SAVED_REPLIES, SupportStore, type SupportTicket } from './support/index.js';
import { fetchTimelineEvents } from './timeline/index.js';

const app = express();
app.set('trust proxy', 1); // behind a host's proxy, req.ip is the real client
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
// The raw body is kept for verifying GitHub's webhook signature.
app.use(express.json({ verify: (req, _res, buf) => void ((req as any).rawBody = buf) }));
// A body that isn't JSON is the sender's mistake: answer 400 instead of logging a stack trace for every one, since
// /api/report is public.
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if ((err as { type?: string })?.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid json' });
  return next(err);
});

// Initialize the example business (BLAZE_EXAMPLE=restaurant | ecommerce), its adapters & the pipeline
const example = loadExample(process.env.BLAZE_EXAMPLE);
const profile = example.profile;

function createPipeline() {
  const freshAdapters = example.createAdapters();
  return {
    adapters: freshAdapters,
    pipeline: new BlazeResolverPipeline(freshAdapters, { profile, correlationSlidingWindowHours: 24 })
  };
}

let { adapters, pipeline } = createPipeline();

const hasAdminToken = (headers: IncomingHttpHeaders) =>
  !!process.env.BLAZE_ADMIN_TOKEN && headers.authorization === `Bearer ${process.env.BLAZE_ADMIN_TOKEN}`;
const isAdmin = (req: express.Request) => hasAdminToken(req.headers);

const requireAdmin: express.RequestHandler<any> = (req, res, next) => {
  if (isAdmin(req)) return next();
  if (process.env.NODE_ENV === 'production' || process.env.BLAZE_REQUIRE_AUTH === 'true' || process.env.BLAZE_ADMIN_TOKEN) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: valid BLAZE_ADMIN_TOKEN required in Authorization: Bearer <token> header'
    });
  }
  return next();
};

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });
const liveEvents = new LiveEvents(() => wss.clients, hasAdminToken);
let voiceBridge = new VoiceChannelBridge(pipeline);

server.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    if (pathname === '/ws' || pathname === '/ws/voice' || pathname === '/') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, url.searchParams);
      });
    } else {
      socket.destroy();
    }
  } catch {
    socket.destroy();
  }
});

wss.on('connection', (ws: any, request: any, searchParams?: any) => {
  liveEvents.register(ws, request.headers);
  voiceBridge.handleConnection(ws, searchParams);
});

// Broadcast live events to WebSocket clients. Events with customer data must use 'admins'.
export function broadcastLiveEvent(eventType: string, data: unknown, audience: Audience) {
  liveEvents.broadcast(eventType, data, audience);
}

// --- Software support intake: projects, widget, reports ---
const registry = new ProjectRegistry();
const store = new IncidentStore();

// Served from here, so every install picks up widget updates as soon as this server is updated.
// Path differs between `tsx src/server.ts` and compiled `dist/server/src/server.js`.
const widgetPath = ['../widget/widget.js', '../../../widget/widget.js'].map((p) => fileURLToPath(new URL(p, import.meta.url))).find(existsSync)!;
app.get(['/widget.js', '/widget/widget.js'], (_req, res) => res.type('application/javascript').set('Cache-Control', 'public, max-age=60').sendFile(widgetPath));
const svgPath = ['../assets/blazyy.svg', '../../../assets/blazyy.svg'].map((p) => fileURLToPath(new URL(p, import.meta.url))).find(existsSync);
if (svgPath) {
  app.get('/blazyy.svg', (_req, res) => res.type('image/svg+xml').set('Cache-Control', 'public, max-age=300').sendFile(svgPath));
}

// ponytail: fixed-window counters in memory, per process; use Redis if this ever runs on more than one instance.
const hits = new Map<string, number[]>();
const limited = (id: string, max: number, windowMs: number) => {
  const now = Date.now();
  const recent = (hits.get(id) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(id, recent);
  return recent.length > max;
};

// The fix engine runs each repo's own tests on this machine, so it stays off on servers anyone can sign up to.
const githubToken = process.env.BLAZE_GITHUB_TOKEN;
// A fix proposal can be 4,096 tokens over large file context, which takes about a minute; allow three.
const fixComplete = resolveComplete({ maxTokens: 4096, timeoutMs: 180_000 });
const fixPrerequisites = process.env.BLAZE_FIX_ENABLED === 'true' && process.env.BLAZE_OPEN_SIGNUP !== 'true' && !!githubToken && !!fixComplete;
// Each fix's tests run AI-written code nobody has reviewed yet, so they run as a separate unprivileged user.
const fixSandbox = fixPrerequisites ? resolveFixSandbox() : undefined;
const fixEnabled = fixSandbox?.ok === true;
if (process.env.BLAZE_FIX_ENABLED === 'true' && !fixEnabled) {
  console.warn(
    fixSandbox && !fixSandbox.ok
      ? `BLAZE_FIX_ENABLED ignored: ${fixSandbox.problem}`
      : 'BLAZE_FIX_ENABLED ignored: it needs BLAZE_GITHUB_TOKEN, an AI key (any provider, e.g. API_KEYS=...) and BLAZE_OPEN_SIGNUP unset.'
  );
}
if (fixSandbox?.ok && fixSandbox.sandbox) lockDownServerFiles();
if (fixSandbox?.ok && !fixSandbox.sandbox) console.warn('Fix engine running WITHOUT a sandbox user (BLAZE_ALLOW_UNSANDBOXED_FIXES=true): only for repos and reporters you trust.');

// One fix at a time. ponytail: in-process queue, lost on restart; a real job queue when volume needs it.
let fixQueue: Promise<unknown> = Promise.resolve();
/** ticketId links the fix run back to the support ticket that triggered it, so its status/branch/PR show up live. */
function enqueueFix(project: Project, incident: IncidentRecord, ticketId?: string) {
  fixQueue = fixQueue.then(async () => {
    store.update(incident.id, { status: 'fixing' });
    let update: Partial<IncidentRecord>;
    try {
      const outcome = await runFix({
        project,
        incident: { id: incident.id, title: incident.title, description: incident.description, stackTrace: incident.stackTrace },
        reportCount: store.incident(incident.id)?.reportIds.length ?? 1,
        token: githubToken!,
        ai: new ClaudeProvider(fixComplete!),
        sandbox: fixSandbox?.ok ? fixSandbox.sandbox : undefined
      });
      update = outcome.status === 'pr_opened' ? { status: 'pr_opened', prUrl: outcome.url } : { status: 'needs_human', issueUrl: outcome.url, failureReason: outcome.reason };
    } catch (err) {
      update = { status: 'needs_human', failureReason: err instanceof Error ? err.message : String(err) };
    }
    broadcastLiveEvent('incident_updated', store.update(incident.id, update), 'admins');

    const ticket = ticketId && supportStore.getTicket(ticketId);
    if (ticket) {
      const updatedTicket = supportStore.updateTicket(ticketId!, {
        pulseStatus: update.status,
        githubPullRequestUrl: update.prUrl ?? ticket.githubPullRequestUrl,
        githubIssueUrl: update.issueUrl ?? ticket.githubIssueUrl
      });
      const note =
        update.status === 'pr_opened'
          ? `✅ Automated fix pipeline opened a pull request for review: ${update.prUrl}`
          : `⚠️ Automated fix pipeline could not produce a passing fix (${update.failureReason ?? 'needs a human'})${update.issueUrl ? ` — ${update.issueUrl}` : ''}`;
      const msg = supportStore.addMessage(ticketId!, { ticketId: ticketId!, role: 'system', senderType: 'system', content: note, body: note });
      broadcastLiveEvent('support_ticket_updated', updatedTicket, 'everyone');
      broadcastLiveEvent('support_message_created', { ticketId, message: msg }, 'everyone');
    }
  });
}

/**
 * Files a customer-reported software bug/outage as an incident and, when a project and the fix engine are
 * configured, runs the real fix pipeline against its repo (clone, reproduce, fix, push a branch, open a PR).
 * Used both by the admin's manual "escalate" action and by the customer chat's automatic bug detection.
 */
function escalateTicket(ticket: SupportTicket, opts: { title?: string; description?: string; severity?: Severity; priority?: SupportTicket['priority']; type?: string }) {
  const triageVerdict: any = {
    type: 'report',
    kind: 'bug',
    severity: opts.severity ?? 'medium',
    summary: opts.title || ticket.subject,
    steps: [],
    source: 'llm',
    injection: false,
    enterFixLoop: true
  };
  const { incident, isNew } = store.addReport(
    'default',
    { message: `${ticket.subject}\n\n${opts.description || ''}`, pageUrl: ticket.outletName || 'app', email: ticket.customerEmail },
    triageVerdict
  );

  const firstProject = registry.list()[0];
  const canRunFix = !!firstProject && !!incident && isNew && fixEnabled;
  const branchName = `blazeresolver/fix-${incident?.id || ticket.id}`;
  const priority: SupportTicket['priority'] = opts.priority ?? (opts.severity === 'critical' ? 'urgent' : 'high');

  const updated = supportStore.updateTicket(ticket.id, {
    isEscalated: true,
    pulseStatus: canRunFix ? 'investigating' : 'needs_human',
    priority,
    githubBranch: canRunFix ? branchName : ticket.githubBranch,
    aiReport: { ...ticket.aiReport, incidentId: incident?.id, incidentTitle: opts.title || ticket.subject, isSystemic: true, suggestedAction: 'Automated Code Fix Pipeline' }
  });

  const note = canRunFix
    ? `⚡ Escalated to the autonomous fix pipeline [${(opts.type || 'bug').toUpperCase()}]: ${opts.title || ticket.subject}. Target branch: ${branchName}`
    : `⚡ Filed as incident ${incident?.id ?? ''} [${(opts.type || 'bug').toUpperCase()}]: ${opts.title || ticket.subject}. Automated fix pipeline is not configured (needs a registered project, BLAZE_GITHUB_TOKEN and BLAZE_FIX_ENABLED=true) — needs a human engineer.`;
  const msg = supportStore.addMessage(ticket.id, { ticketId: ticket.id, role: 'system', senderType: 'system', content: note, body: note });
  broadcastLiveEvent('support_ticket_updated', updated, 'everyone');
  broadcastLiveEvent('support_message_created', { ticketId: ticket.id, message: msg }, 'everyone');

  if (canRunFix) enqueueFix(firstProject!, incident!, ticket.id);
  return { updated, incident, branchName, canRunFix };
}

// Signup: the admin token always works; anyone may register when BLAZE_OPEN_SIGNUP=true (5 per hour per IP).
app.post('/api/projects', (req, res) => {
  if (!isAdmin(req)) {
    if (process.env.BLAZE_OPEN_SIGNUP !== 'true') return res.status(401).json({ error: 'signup is closed' });
    if (limited(`signup:${req.ip}`, 5, 3_600_000)) return res.status(429).json({ error: 'too many signups, try later' });
  }
  const { repo, defaultBranch, testCommand, buildCommand, helpDocs } = req.body ?? {};
  if (typeof repo !== 'string' || !REPO_PATTERN.test(repo)) return res.status(400).json({ error: 'repo must be owner/name' });
  if (typeof helpDocs === 'string' && helpDocs.length > MAX_HELP_DOCS) return res.status(400).json({ error: `helpDocs is over ${MAX_HELP_DOCS} characters` });
  const text = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : undefined);
  const { project, key } = registry.register(repo, text(defaultBranch, 100), text(testCommand, 300), text(buildCommand, 300), text(helpDocs, MAX_HELP_DOCS));
  return res.status(201).json({ project: { id: project.id, repo, defaultBranch: project.defaultBranch }, key });
});

// The widget waits 25 seconds, and triage has already used some of them.
const answerComplete = resolveComplete({ timeoutMs: 12_000 });
const replyComplete = resolveComplete({ timeoutMs: 6_000 });
// Semantic search over help docs, when a provider with embeddings is configured.
const embedder = resolveEmbedder();
// Vectors of every project's docs, kept across restarts. Ids are content hashes, so projects never mix.
const vectorStore = embedder ? defaultVectorStore() : undefined;

app.post('/api/report', async (req, res) => {
  const project = registry.verify(req.header('x-blaze-key'));
  if (!project) return res.status(401).json({ error: 'invalid project key' });
  // The key is public inside the widget, so cap what a leaked one can spend on the model.
  if (limited(`report:${project.id}`, 30, 60_000)) return res.status(429).json({ error: 'rate limit' });
  const parsed = ReportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid report' });
  const result = await triage(parsed.data);
  const { incident, isNew } = store.addReport(project.id, parsed.data, result);
  if (incident && isNew && fixEnabled) enqueueFix(project, incident);
  broadcastLiveEvent('report_triaged', { projectId: project.id, triage: result }, 'admins');
  // A question gets an answer from the project's README and help docs. Everything else gets a short reply to
  // what they said, never the triage verdict; a model that just failed triage isn't waited on again.
  const answer = await answerQuestion(parsed.data, result, {
    complete: answerComplete,
    helpDocs: project.helpDocs,
    readme: { repo: project.repo, token: githubToken },
    embedder,
    vectorStore,
    // This server's own checkout isn't any project's: their READMEs come from GitHub.
    readmePath: false,
    product: productName(undefined, project.repo)
  });
  if (answer) return res.status(200).json({ received: true, answer });
  const reply = await replyToCustomer(parsed.data, result, {
    complete: result.source === 'llm' ? replyComplete : undefined,
    product: productName(undefined, project.repo)
  });
  return res.status(202).json({ received: true, reply });
});

app.get('/api/reports', (req, res) =>
  isAdmin(req) ? res.json({ reports: store.reports() }) : res.status(401).json({ error: 'admin token required' })
);
app.get('/api/incidents', (req, res) =>
  isAdmin(req) ? res.json({ incidents: store.incidents() }) : res.status(401).json({ error: 'admin token required' })
);

// GitHub tells us when a BlazeResolver PR is merged or closed; a merge is what tells customers it is fixed.
app.post('/api/github/webhook', (req, res) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const raw: Buffer | undefined = (req as any).rawBody;
  if (!secret || !raw) return res.status(503).json({ error: 'webhook not configured' });
  const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`);
  const got = Buffer.from(String(req.header('x-hub-signature-256') ?? ''));
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return res.status(401).json({ error: 'bad signature' });

  const pr = req.body?.pull_request;
  if (req.header('x-github-event') === 'pull_request' && req.body?.action === 'closed' && pr) {
    const incident = store.byPullRequest(pr.html_url);
    if (incident) {
      if (pr.merged) {
        store.update(incident.id, { status: 'merged' });
        const emails = new Set(store.reports().filter((r) => incident.reportIds.includes(r.id) && r.email).map((r) => r.email!));
        emails.forEach((to) => sendFixedEmail(to, incident.title).catch(() => {}));
      } else {
        store.update(incident.id, { status: 'needs_human' });
      }
      broadcastLiveEvent('incident_updated', store.incident(incident.id), 'admins');
    }
  }
  return res.json({ ok: true });
});

// REST Endpoints

// 1. Process Single Complaint
app.post('/api/pipeline/process', async (req, res) => {
  try {
    const { rawText, channel = 'text', orderId, customerId, resourceId, itemId } = req.body;
    if (!rawText) {
      return res.status(400).json({ error: 'rawText is required' });
    }

    const input: CustomerInput = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      channel,
      rawText,
      orderId,
      customerId,
      resourceId,
      itemId,
      timestamp: new Date()
    };

    const result = await pipeline.processComplaint(input);
    broadcastLiveEvent('pipeline_result', result, 'everyone');

    return res.json({ success: true, result });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// 1b. Inbound Intake Endpoint (Resolvd Pattern: POST /api/inbound -> triage -> policy auto-resolve or escalate with proposed action attached)
app.post('/api/inbound', async (req, res) => {
  try {
    const {
      customerMessage,
      rawText,
      customerId = 'cust_guest',
      orderId,
      resourceId,
      itemId,
      channel = 'inbound_api'
    } = req.body;

    const message = customerMessage || rawText;
    if (!message) {
      return res.status(400).json({ error: 'customerMessage or rawText is required' });
    }

    const input: CustomerInput = {
      id: `inbound_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      channel,
      rawText: message,
      orderId,
      customerId,
      resourceId,
      itemId,
      timestamp: new Date()
    };

    const result = await pipeline.processComplaint(input);
    broadcastLiveEvent('pipeline_result', result, 'everyone');

    return res.json(buildInboundResponse(result, profile, { orderId, resourceId, itemId }));
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// 2. Run the example's seed complaints sequentially
app.post('/api/pipeline/seed', async (req, res) => {
  try {
    const results = [];
    for (const input of example.seedComplaints) {
      const result = await pipeline.processComplaint({
        ...input,
        timestamp: new Date()
      });
      results.push(result);
      broadcastLiveEvent('pipeline_result', result, 'everyone');
    }

    return res.json({
      success: true,
      processedCount: results.length,
      incidents: pipeline.getCorrelateEngine().getIncidents(),
      hitlQueue: pipeline.getResolutionEngine().getHitlQueue()
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// 3. Reset pipeline & adapters state
app.post('/api/pipeline/reset', requireAdmin, (req, res) => {
  ({ adapters, pipeline } = createPipeline());
  voiceBridge = new VoiceChannelBridge(pipeline);
  supportStore.resetAll();
  broadcastLiveEvent('pipeline_reset', { timestamp: new Date() }, 'everyone');
  return res.json({ success: true, message: 'BlazeResolver pipeline and adapter stores reset to fresh state' });
});

// 4. Live Pipeline Feed
app.get('/api/pipeline/feed', (req, res) => {
  return res.json({
    results: pipeline.getResults(),
    totalCount: pipeline.getResults().length
  });
});

// 5. Correlate Incidents & Clusters
app.get('/api/correlate/incidents', (req, res) => {
  return res.json({
    incidents: pipeline.getCorrelateEngine().getIncidents(),
    clusters: pipeline.getCorrelateEngine().getClusters(),
    bufferSize: pipeline.getCorrelateEngine().getBuffer().length
  });
});

// 6. HITL Money-Gate Queue
app.get('/api/hitl/queue', (req, res) => {
  return res.json({
    queue: pipeline.getResolutionEngine().getHitlQueue(),
    history: pipeline.getResolutionEngine().getExecutionHistory()
  });
});

// 7. Approve / Reject HITL Action
app.post('/api/hitl/action', requireAdmin, async (req, res) => {
  try {
    const { actionId, decision, reason, reviewerName = 'DJ (Supervisor)' } = req.body;
    if (!actionId || !decision) {
      return res.status(400).json({ error: 'actionId and decision (approve/reject) are required' });
    }

    let updatedAction;
    if (decision === 'approve') {
      updatedAction = await pipeline.getResolutionEngine().approveHitlAction(actionId, adapters, reviewerName);
    } else {
      updatedAction = await pipeline.getResolutionEngine().rejectHitlAction(actionId, reason, reviewerName);
    }

    if (!updatedAction) {
      return res.status(404).json({ error: 'Action not found or already processed' });
    }

    // Link HITL decision back into customer ticket chat threads subsequently
    const matchingTickets = supportStore.getTickets().filter(t =>
      (updatedAction.orderId && t.orderId === updatedAction.orderId) ||
      (updatedAction.customerId && t.customerId === updatedAction.customerId)
    );

    for (const t of matchingTickets) {
      const isApproved = decision === 'approve';
      const supervisorNote = isApproved
        ? `✅ Supervisor Authorization: ${reviewerName} approved action [${updatedAction.actionType.toUpperCase()}] for ₹${updatedAction.amount || 0}. Your credit/refund has been executed.`
        : `❌ Supervisor Decision: ${reviewerName} reviewed action [${updatedAction.actionType.toUpperCase()}]. Status: Declined. Note: ${reason || 'Does not meet policy criteria'}.`;

      const followUpMsg = supportStore.addMessage(t.id, {
        ticketId: t.id,
        role: 'agent',
        senderType: 'bot',
        authorName: 'Blazzy AI (Supervisor Linked)',
        senderName: 'Blazzy AI',
        body: supervisorNote,
        content: supervisorNote
      });

      supportStore.updateTicket(t.id, {
        status: isApproved ? 'closed' : t.status,
        aiReport: {
          ...t.aiReport,
          suggestedAction: `Supervisor ${decision}: ${updatedAction.actionType}`
        }
      });

      broadcastLiveEvent('support_message_created', { ticketId: t.id, message: followUpMsg }, 'everyone');
      broadcastLiveEvent('support_ticket_updated', supportStore.getTicket(t.id), 'everyone');
    }

    broadcastLiveEvent('hitl_updated', updatedAction, 'everyone');
    return res.json({ success: true, action: updatedAction });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// 8. Adapters Overview
app.get('/api/adapters/overview', async (req, res) => {
  const currentOrderSource = adapters.orderSource as any;
  const currentRefundGateway = adapters.refundGateway as any;
  const currentTicketSink = adapters.ticketSink as any;

  return res.json({
    orders: currentOrderSource.getAllOrders ? currentOrderSource.getAllOrders() : [],
    refunds: currentRefundGateway.getAllRefunds ? currentRefundGateway.getAllRefunds() : [],
    credits: currentRefundGateway.getAllCredits ? currentRefundGateway.getAllCredits() : [],
    incidents: currentTicketSink.getAllIncidents ? currentTicketSink.getAllIncidents() : [],
    disabledItems: adapters.availabilityControl ? await adapters.availabilityControl.getDisabledItems() : []
  });
});

// 8b. Active domain profile: labels, currency and demo content for the dashboard
app.get('/api/profile', (req, res) => {
  return res.json({
    id: profile.id,
    name: profile.name,
    labels: profile.labels,
    currency: profile.currency,
    moneyPolicy: profile.moneyPolicy,
    categories: profile.categories.map((c) => ({ id: c.id, label: c.label })),
    items: profile.items.map((i) => ({ id: i.id, name: i.name })),
    resources: profile.resources.map((r) => ({ id: r.id, name: r.name })),
    demo: example.demo
  });
});

// 9. BYO Agent Tools Specification
app.get('/api/byo-agent/tools', (req, res) => {
  return res.json({
    description: 'BlazeResolver Pipeline Tools for OpenAI / Anthropic / LangGraph Agents',
    tools: getAgentToolSchemas()
  });
});

// --- Support Desk & Customer Portal Endpoints ---
// The demo desk (the example business) starts with demo saved replies; a product's own desk starts with none.
const supportDataPath = process.env.BLAZE_SUPPORT_DATA_PATH || resolve('.blazeresolver/support-desk.json');
const supportStore = new SupportStore({ savedReplies: DEMO_SAVED_REPLIES, persistPath: supportDataPath });

// Get Tickets
app.get('/api/support/tickets', (req, res) => {
  try {
    const { status, priority, category, search, customerEmail } = req.query as Record<string, string>;
    if (!customerEmail && !isAdmin(req) && (process.env.NODE_ENV === 'production' || process.env.BLAZE_REQUIRE_AUTH === 'true' || process.env.BLAZE_ADMIN_TOKEN)) {
      return res.status(401).json({ success: false, error: 'Unauthorized: listing all tickets requires BLAZE_ADMIN_TOKEN' });
    }
    const tickets = supportStore.getTickets({ status, priority, category, search, customerEmail });
    return res.json({ success: true, data: tickets });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// Get Single Ticket
app.get('/api/support/tickets/:id', (req, res) => {
  const ticket = supportStore.getTicket(req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });
  return res.json({ success: true, data: ticket });
});

// Update Ticket
app.patch('/api/support/tickets/:id', (req, res) => {
  try {
    const updated = supportStore.updateTicket(req.params.id, req.body);
    broadcastLiveEvent('support_ticket_updated', updated, 'everyone');
    return res.json({ success: true, data: updated });
  } catch (err: unknown) {
    return res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// Create Ticket (Customer Portal or Inbound API)
app.post(['/api/support/tickets', '/api/support/tickets/create'], async (req, res) => {
  try {
    const { subject, rawText, message, text, category, orderId, customerId, customerName, customerEmail, customerPhone, outletName, intakeChannel } = req.body;
    const complaintText = rawText || message || text;
    if (!complaintText) return res.status(400).json({ success: false, error: 'rawText or message is required' });

    const result = await supportStore.createTicketFromCustomer(
      {
        subject,
        rawText: complaintText,
        category,
        orderId,
        customerId,
        customerName,
        customerEmail,
        customerPhone,
        outletName,
        intakeChannel
      },
      pipeline
    );

    broadcastLiveEvent('support_ticket_created', result.ticket, 'everyone');
    return res.status(201).json({ success: true, data: result });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// Get Ticket Messages
app.get('/api/support/tickets/:id/messages', (req, res) => {
  try {
    const messages = supportStore.getMessages(req.params.id);
    return res.json({ success: true, data: messages });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

function isCustomerRequestingHuman(text: string): boolean {
  const lower = text.toLowerCase();
  const humanPhrases = [
    'talk to a human', 'talk to human', 'speak to a human', 'speak to human',
    'connect to human', 'connect with human', 'speak to an agent', 'talk to an agent',
    'speak to agent', 'talk to agent', 'real person', 'live person', 'human agent',
    'human representative', 'speak to someone', 'talk to someone', 'customer care executive',
    'human please', 'agent please', 'representative please', 'escalate to supervisor',
    'talk to manager', 'speak to manager', 'human support', 'connect human'
  ];
  return humanPhrases.some(phrase => lower.includes(phrase));
}

// Send Message in Ticket
app.post('/api/support/tickets/:id/messages', async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { body, content, role = 'agent', senderType = 'agent', authorName = 'Support Staff', internalNote = false, attachments } = req.body;
    const text = body || content;
    if (!text && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ success: false, error: 'Message content is required' });
    }

    const ticket = supportStore.getTicket(ticketId);
    if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

    const newMessage = supportStore.addMessage(ticketId, {
      ticketId,
      role: role as any,
      senderType: senderType as any,
      authorName,
      senderName: authorName,
      body: text,
      content: text,
      internalNote,
      attachments
    });

    broadcastLiveEvent('support_message_created', { ticketId, message: newMessage }, 'everyone');

    // If customer sent message:
    if (senderType === 'user' && ticket.status !== 'closed' && !internalNote) {
      // 1. Check for explicit human agent request
      if (isCustomerRequestingHuman(text)) {
        const updated = supportStore.updateTicket(ticketId, {
          isHumanTakeover: true,
          humanTakeoverReason: 'Customer explicitly requested a human specialist.'
        });

        supportStore.addMessage(ticketId, {
          ticketId,
          role: 'system',
          senderType: 'system',
          content: '👤 Customer requested a human agent. Escalating to Support Specialist & pausing autonomous AI.',
          body: '👤 Customer requested a human agent. Escalating to Support Specialist & pausing autonomous AI.'
        });

        const humanReply = supportStore.addMessage(ticketId, {
          ticketId,
          role: 'agent',
          senderType: 'bot',
          authorName: 'Blazzy Concierge',
          senderName: 'Blazzy Concierge',
          body: 'I have connected you with our human support team. A specialist has been notified with your case details and will take over this chat momentarily.',
          content: 'I have connected you with our human support team. A specialist has been notified with your case details and will take over this chat momentarily.'
        });

        broadcastLiveEvent('support_ticket_updated', updated, 'everyone');
        broadcastLiveEvent('support_human_requested', { ticketId, reason: 'Customer requested human agent' }, 'admins');
        broadcastLiveEvent('support_message_created', { ticketId, message: humanReply }, 'everyone');
      } else if (!ticket.isHumanTakeover) {
        // 2. AI Auto-Pilot with RAG grounding. Awaited, so a client that refetches the thread after sending sees the reply.
        await (async () => {
          try {
            const input: CustomerInput = {
              id: `msg_pipe_${Date.now()}`,
              channel: 'text',
              rawText: text,
              orderId: ticket.orderId,
              customerId: ticket.customerId,
              timestamp: new Date()
            };

            const aiResult = await pipeline.processComplaint(input);

            // Ground with RAG over canned knowledge and domain policies
            const canned = supportStore.getCannedResponses();
            const docsContext = canned.map(c => `## ${c.title}\n${c.body}`).join('\n\n');
            const relevantChunks = retrieve(docsContext, text, 2);
            let responseText = aiResult.response.text;
            let ragApplied = false;

            if (relevantChunks.length > 0 && aiResult.triage.sentiment === 'frustrated') {
              const title = relevantChunks[0].headings[relevantChunks[0].headings.length - 1];
              const matchedCanned = canned.find(c => c.title === title);
              if (matchedCanned && !responseText.includes(matchedCanned.body.slice(0, 20))) {
                responseText = `${responseText}\n\n${matchedCanned.body}`;
                ragApplied = true;
              }
            }

            const aiReply = supportStore.addMessage(ticketId, {
              ticketId,
              role: 'agent',
              senderType: 'bot',
              authorName: 'Blazzy AI',
              senderName: 'Blazzy AI',
              body: responseText,
              content: responseText
            });

            // Update ticket AI report
            const updatedTicket = supportStore.updateTicket(ticketId, {
              aiReport: {
                ...ticket.aiReport,
                triageId: aiResult.triage.id,
                intent: aiResult.triage.intent,
                triageCategory: aiResult.triage.category,
                triageSeverity: aiResult.triage.severity,
                triageItemName: aiResult.triage.itemName,
                triageResourceId: aiResult.triage.resourceId,
                triageOrderId: aiResult.triage.orderId,
                sentiment: aiResult.triage.sentiment,
                urgencyScore: aiResult.triage.urgencyScore,
                guardrailPassed: aiResult.triage.guardrailPassed,
                isPromptInjection: aiResult.triage.isPromptInjection,
                policyAllowed: aiResult.resolution.policyDecision.allowed,
                policyRationale: aiResult.resolution.policyDecision.rationale,
                suggestedAction: aiResult.resolution.policyDecision.recommendedAction,
                requiresHitl: aiResult.resolution.hitlRequired,
                claimedAmount: aiResult.triage.claimedAmount,
                incidentId: aiResult.correlation.incident?.incidentId,
                incidentTitle: aiResult.correlation.incident?.title,
                clusterKey: aiResult.correlation.cluster?.clusterKey,
                isSystemic: aiResult.correlation.isSystemic,
                ragMatches: relevantChunks.map((chunk) => {
                  const excerpt = chunk.text.replace(/\s+/g, ' ').trim();
                  return `${chunk.headings.join(' > ') || 'Knowledge'}: ${excerpt.slice(0, 180)}${excerpt.length > 180 ? '…' : ''}`;
                }),
                ragApplied,
                resolutionActions: aiResult.resolution.actions.map(({ actionType, approvalStatus, amount, reason }) => ({
                  actionType,
                  approvalStatus,
                  amount,
                  reason
                })),
                responseChannel: aiResult.response.channel,
                responseTone: aiResult.response.tone,
                responseQualityPassed: aiResult.response.qualityPassed,
                executionDurationMs: aiResult.executionDurationMs,
                processedAt: aiResult.timestamp instanceof Date ? aiResult.timestamp.toISOString() : String(aiResult.timestamp)
              }
            });
            broadcastLiveEvent('support_ticket_updated', updatedTicket, 'everyone');

            broadcastLiveEvent('support_message_created', { ticketId, message: aiReply }, 'everyone');

            // The order-compensation engine above (refunds, credits, re-deliveries) can't fix a broken product.
            // Classify separately for an actual software bug/outage; when real and not already escalated, fire the
            // autonomous code-fix pipeline straight from the customer's own message, no admin click needed.
            if (!ticket.isEscalated) {
              try {
                const bugVerdict = await triage(ReportSchema.parse({ message: text }), resolveComplete({ timeoutMs: 8000 }));
                if (bugVerdict.enterFixLoop) {
                  escalateTicket(supportStore.getTicket(ticketId) ?? ticket, { title: bugVerdict.summary, description: bugVerdict.summary, severity: bugVerdict.severity, type: bugVerdict.kind });
                }
              } catch (e) {
                console.error('Error running software-bug triage for auto-escalation:', e);
              }
            }

            // Multi-step autonomous action follow-up
            const executedActions = aiResult.resolution.actions.filter(a => a.approvalStatus === 'executed' && a.actionType !== 'reject_adversarial');
            const pendingHitlActions = aiResult.resolution.actions.filter(a => a.approvalStatus === 'pending_human');

            if (executedActions.length > 0) {
              setTimeout(() => {
                const act = executedActions[0];
                let followUpText = '';
                if (act.actionType === 'refund' || act.actionType === 'credit') {
                  followUpText = `⚡ Automatic Action Executed: We have processed a wallet credit / refund of ₹${act.amount || 150} for order #${ticket.orderNumber || 'N/A'}. This has been confirmed on your account.`;
                } else if (act.actionType === 're_deliver') {
                  followUpText = `📦 Automatic Action Executed: A complimentary replacement delivery has been confirmed with our fulfillment team.`;
                } else if (act.actionType === 'disable_item') {
                  followUpText = `🛡️ Safety Action Executed: The reported item has been paused from our active catalog to prevent further defects.`;
                }

                if (followUpText) {
                  const actionMsg = supportStore.addMessage(ticketId, {
                    ticketId,
                    role: 'agent',
                    senderType: 'bot',
                    authorName: 'Blazzy AI (Auto-Action)',
                    senderName: 'Blazzy AI',
                    body: followUpText,
                    content: followUpText
                  });
                  broadcastLiveEvent('support_message_created', { ticketId, message: actionMsg }, 'everyone');
                }
              }, 1200);
            } else if (pendingHitlActions.length > 0) {
              setTimeout(() => {
                const act = pendingHitlActions[0];
                const hitlText = `⏳ Supervisor Queue Update: Your claim of ₹${act.amount || 0} exceeds the instant threshold and has been placed in the Supervisor HITL priority queue for 1-click authorization.`;
                const actionMsg = supportStore.addMessage(ticketId, {
                  ticketId,
                  role: 'agent',
                  senderType: 'bot',
                  authorName: 'Blazzy AI (Supervisor Linked)',
                  senderName: 'Blazzy AI',
                  body: hitlText,
                  content: hitlText
                });
                broadcastLiveEvent('support_message_created', { ticketId, message: actionMsg }, 'everyone');
              }, 1200);
            }
          } catch (e) {
            console.error('Error generating AI auto reply:', e);
          }
        })();
      }
    }

    return res.json({ success: true, data: newMessage });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// Toggle Human Takeover
app.post('/api/support/tickets/:id/takeover', requireAdmin, (req, res) => {
  try {
    const { enabled, reason } = req.body;
    const ticketId = req.params.id;
    const ticket = supportStore.getTicket(ticketId);
    if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

    const updated = supportStore.updateTicket(ticketId, {
      isHumanTakeover: enabled,
      humanTakeoverReason: enabled ? reason || 'Support agent manual intervention activated.' : null
    });

    supportStore.addMessage(ticketId, {
      ticketId,
      role: 'system',
      senderType: 'system',
      content: enabled
        ? '👤 Human Specialist took over conversation. Autonomous AI auto-replies paused.'
        : '🤖 Conversation handed back to Blazzy AI Auto-Pilot.',
      body: enabled
        ? '👤 Human Specialist took over conversation. Autonomous AI auto-replies paused.'
        : '🤖 Conversation handed back to Blazzy AI Auto-Pilot.'
    });

    broadcastLiveEvent('support_ticket_updated', updated, 'everyone');
    return res.json({ success: true, data: updated });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// Generate AI Copilot Draft with RAG Context
app.post('/api/support/tickets/:id/blazzy-draft', async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { prompt } = req.body;
    const ticket = supportStore.getTicket(ticketId);
    if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

    const messages = supportStore.getMessages(ticketId);
    const lastUserMsg = [...messages].reverse().find((m) => m.senderType === 'user')?.body || ticket.subject;

    // RAG: retrieve matching knowledge from canned responses & domain policies
    const canned = supportStore.getCannedResponses();
    const docs = canned.map(c => `[${c.title}]\n${c.body}`).join('\n\n');
    const relevantKnowledge = retrieve(docs, prompt || lastUserMsg, 2);
    const contextSnippet = relevantKnowledge.map((k: Chunk) => k.text).join('\n');

    let draft = '';

    // If AI completion is available, attempt to generate draft via model
    if (answerComplete) {
      try {
        const systemPrompt = `You are Blazzy Copilot, an expert customer support AI assistant for ${profile.labels.business}.
Write ONLY the final draft message for the customer in a warm, professional, concise tone. Do not wrap in JSON.`;
        const userPrompt = `Ticket Context:
- Subject: ${ticket.subject}
- Customer: ${ticket.customerName || 'Customer'}
- Order: #${ticket.orderNumber || 'N/A'} (Outlet: ${ticket.outletName || 'Hub'})
- AI Triage Intent: ${ticket.aiReport?.intent || ticket.category} (Urgency: ${Math.round((ticket.aiReport?.urgencyScore ?? 0) * 100)}/100)
- Policy Rationale: ${ticket.aiReport?.policyRationale || 'Standard resolution'}
- Suggested Action: ${ticket.aiReport?.suggestedAction || 'Review and assist'}

Relevant Policy / Knowledge Excerpts:
${contextSnippet || 'Standard customer service guidelines.'}

Admin Instruction / Goal:
${prompt || 'Draft a helpful, polite, and reassuring response addressing the customer\'s latest message.'}

Customer's Latest Message:
"${lastUserMsg}"`;

        const response = await answerComplete(systemPrompt, userPrompt);
        if (response && response.trim().length > 10) {
          draft = response.trim().replace(/^["']|["']$/g, '');
        }
      } catch (err) {
        // Fallback to grounded template logic below
      }
    }

    if (!draft) {
      if (prompt?.includes('Apology') || prompt?.includes('Delay')) {
        draft = `Dear ${ticket.customerName || 'Customer'}, we sincerely apologize for the delay. We are actively expediting order #${ticket.orderNumber || 'your order'} with high priority at ${ticket.outletName || 'our hub'}. Thank you for your patience!`;
      } else if (prompt?.includes('Refund') || prompt?.includes('Credit')) {
        draft = `Hi ${ticket.customerName || 'Customer'}, we have authorized an instant credit of ₹${ticket.aiReport?.claimedAmount || '150'} directly to your account. You should see the updated balance immediately.`;
      } else if (prompt?.includes('Summarize')) {
        draft = `Summary: Customer reported '${ticket.subject}'. AI Triage intent: ${ticket.aiReport?.intent || ticket.category} with sentiment '${ticket.aiReport?.sentiment || 'frustrated'}'. Resolution decision: ${ticket.aiReport?.suggestedAction || 'Agent review required'}.`;
      } else if (relevantKnowledge.length > 0) {
        draft = `Hello ${ticket.customerName || 'Customer'}, thank you for contacting support regarding ${ticket.subject}. ${relevantKnowledge[0].text} Please let us know if we can assist you with anything else!`;
      } else {
        draft = `Hello ${ticket.customerName || 'Customer'}, thank you for contacting support regarding ${ticket.subject}. Our team has reviewed your request and we are ensuring this is resolved immediately. Please let us know if you need any additional assistance!`;
      }
    }

    return res.json({ success: true, data: { draft } });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// Re-run AI Diagnosis On Demand
app.post('/api/support/tickets/:id/diagnose', async (req, res) => {
  try {
    const ticketId = req.params.id;
    const ticket = supportStore.getTicket(ticketId);
    if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

    const messages = supportStore.getMessages(ticketId);
    const userTexts = messages.filter(m => m.senderType === 'user').map(m => m.body || m.content).join(' ');
    const diagnosisText = userTexts || ticket.subject;
    const canned = supportStore.getCannedResponses();
    const docsContext = canned.map((response) => `## ${response.title}\n${response.body}`).join('\n\n');
    const relevant = retrieve(docsContext, diagnosisText, 2);

    const input: CustomerInput = {
      id: `diag_${Date.now()}`,
      channel: 'text',
      rawText: diagnosisText,
      orderId: ticket.orderId,
      customerId: ticket.customerId,
      timestamp: new Date()
    };

    const aiResult = await pipeline.processComplaint(input);

    const updated = supportStore.updateTicket(ticketId, {
      aiReport: {
        triageId: aiResult.triage.id,
        intent: aiResult.triage.intent,
        triageCategory: aiResult.triage.category,
        triageSeverity: aiResult.triage.severity,
        triageItemName: aiResult.triage.itemName,
        triageResourceId: aiResult.triage.resourceId,
        triageOrderId: aiResult.triage.orderId,
        sentiment: aiResult.triage.sentiment,
        urgencyScore: aiResult.triage.urgencyScore,
        guardrailPassed: aiResult.triage.guardrailPassed,
        isPromptInjection: aiResult.triage.isPromptInjection,
        policyAllowed: aiResult.resolution.policyDecision.allowed,
        policyRationale: aiResult.resolution.policyDecision.rationale,
        suggestedAction: aiResult.resolution.policyDecision.recommendedAction,
        requiresHitl: aiResult.resolution.hitlRequired,
        claimedAmount: aiResult.triage.claimedAmount,
        incidentId: aiResult.correlation.incident?.incidentId,
        incidentTitle: aiResult.correlation.incident?.title,
        clusterKey: aiResult.correlation.cluster?.clusterKey,
        isSystemic: aiResult.correlation.isSystemic,
        ragMatches: relevant.map((chunk) => {
          const excerpt = chunk.text.replace(/\s+/g, ' ').trim();
          return `${chunk.headings.join(' > ') || 'Knowledge'}: ${excerpt.slice(0, 180)}${excerpt.length > 180 ? '…' : ''}`;
        }),
        ragApplied: false,
        resolutionActions: aiResult.resolution.actions.map(({ actionType, approvalStatus, amount, reason }) => ({
          actionType,
          approvalStatus,
          amount,
          reason
        })),
        responseChannel: aiResult.response.channel,
        responseTone: aiResult.response.tone,
        responseQualityPassed: aiResult.response.qualityPassed,
        executionDurationMs: aiResult.executionDurationMs,
        processedAt: aiResult.timestamp instanceof Date ? aiResult.timestamp.toISOString() : String(aiResult.timestamp)
      }
    });

    broadcastLiveEvent('support_ticket_updated', updated, 'everyone');
    return res.json({ success: true, data: { ticket: updated, triage: aiResult } });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// 1-Click HITL Action Execution on Ticket
app.post('/api/support/tickets/:id/action', requireAdmin, async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { action, amount, reason = 'Admin resolution' } = req.body;
    const ticket = supportStore.getTicket(ticketId);
    if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

    let actionNote = `⚡ Admin executed resolution action: ${action}`;

    if (action === 'refund' || action === 'credit' || action === 'coupon') {
      if (!adapters.refundGateway) {
        return res.status(422).json({
          success: false,
          error: `This business has no refund/payment adapter configured — ${action}s are not supported here. Connect a RefundGateway adapter to enable this action.`
        });
      }
      if (action === 'coupon') {
        actionNote = `🎟️ Issued goodwill discount coupon CODE: BLAZE${Math.floor(Math.random() * 900 + 100)} to customer.`;
      } else {
        const gatewayAmount = amount || ticket.aiReport?.claimedAmount || 150;
        const idempotencyKey = `admin_${action}_${ticketId}_${gatewayAmount}`;
        if (action === 'credit') {
          await adapters.refundGateway.issueCredit(ticket.customerId || 'CUSTOMER-UNKNOWN', gatewayAmount, idempotencyKey);
        } else {
          await adapters.refundGateway.issueRefund(ticket.orderId || 'ORD-UNKNOWN', gatewayAmount, idempotencyKey);
        }
        actionNote = `💰 Processed ${action === 'credit' ? 'Wallet Credit' : 'Payment Refund'} of ₹${gatewayAmount} for order #${ticket.orderNumber || 'N/A'}. Reason: ${reason}`;
      }
    } else if (action === 'replacement') {
      actionNote = `📦 Authorized complimentary replacement dispatch for order #${ticket.orderNumber || 'N/A'}. Reason: ${reason}`;
    }

    supportStore.addMessage(ticketId, {
      ticketId,
      role: 'system',
      senderType: 'system',
      content: actionNote,
      body: actionNote
    });

    const updated = supportStore.updateTicket(ticketId, {
      status: action === 'resolve' ? 'closed' : ticket.status,
      aiReport: {
        ...ticket.aiReport,
        suggestedAction: `Executed: ${action}`
      }
    });

    broadcastLiveEvent('support_ticket_updated', updated, 'everyone');
    return res.json({ success: true, data: { ticket: updated, note: actionNote } });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// Escalate Ticket to Pulse / Dev Pipeline
app.post('/api/support/tickets/:id/escalate', requireAdmin, async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { title, type = 'bug', priority = 'high', note } = req.body;
    const ticket = supportStore.getTicket(ticketId);
    if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

    const severity: Severity = priority === 'urgent' ? 'critical' : priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'medium';
    const { updated, incident, branchName } = escalateTicket(ticket, { title, description: note, severity, priority, type });

    if (note) {
      supportStore.addMessage(ticketId, {
        ticketId,
        role: 'agent',
        senderType: 'agent',
        authorName: 'Support Agent',
        internalNote: true,
        content: `Dev Notes: ${note}`,
        body: `Dev Notes: ${note}`
      });
    }

    return res.json({ success: true, data: updated, branch: branchName, incidentId: incident?.id });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// Close Ticket
app.post('/api/support/tickets/:id/close', requireAdmin, (req, res) => {
  try {
    const ticketId = req.params.id;
    const { password } = req.body;
    // For demo / admin usability: any non-empty password or 'admin' accepted
    if (!password) {
      return res.status(400).json({ success: false, error: 'Admin password required to close ticket.' });
    }

    const updated = supportStore.updateTicket(ticketId, {
      status: 'closed'
    });

    supportStore.addMessage(ticketId, {
      ticketId,
      role: 'system',
      senderType: 'system',
      content: '🔒 Ticket permanently closed and archived by Admin.',
      body: '🔒 Ticket permanently closed and archived by Admin.'
    });

    broadcastLiveEvent('support_ticket_updated', updated, 'everyone');
    return res.json({ success: true, data: updated });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// Customer Context 360
app.get('/api/support/context/:id', requireAdmin, (req, res) => {
  try {
    const context = supportStore.getCustomerContext(req.params.id);
    return res.json({ success: true, data: context });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// Canned Responses
app.get('/api/support/canned-responses', (_req, res) => {
  return res.json({ success: true, data: supportStore.getCannedResponses() });
});

app.post('/api/support/canned-responses', requireAdmin, (req, res) => {
  try {
    const { title, body, category } = req.body;
    if (!title || !body) return res.status(400).json({ success: false, error: 'Title and body are required' });
    const created = supportStore.addCannedResponse(title, body, category);
    return res.status(201).json({ success: true, data: created });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.patch('/api/support/canned-responses/:id', requireAdmin, (req, res) => {
  try {
    const { title, body } = req.body;
    const updated = supportStore.updateCannedResponse(req.params.id, title, body);
    return res.json({ success: true, data: updated });
  } catch (err: unknown) {
    return res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.delete('/api/support/canned-responses/:id', requireAdmin, (req, res) => {
  const deleted = supportStore.deleteCannedResponse(req.params.id);
  return res.json({ success: deleted });
});

app.post('/api/support/canned-responses/:id/set-auto-reply', requireAdmin, (req, res) => {
  const updated = supportStore.setAutoReply(req.params.id);
  return res.json({ success: true, data: updated });
});

// Ticket Rating CSAT
app.get('/api/support/tickets/:id/rating', (req, res) => {
  const rating = supportStore.getRating(req.params.id);
  return res.json({ success: true, data: rating });
});

app.post('/api/support/tickets/:id/rating', (req, res) => {
  const { rating, comment } = req.body;
  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, error: 'Rating must be a number between 1 and 5' });
  }
  const saved = supportStore.setRating(req.params.id, rating, comment);
  broadcastLiveEvent('support_rating_updated', { ticketId: req.params.id, rating: saved }, 'everyone');
  return res.json({ success: true, data: saved });
});

// Attachments Upload Simulation
app.post('/api/support/tickets/:id/attachments', (req, res) => {
  return res.json({
    success: true,
    data: {
      name: 'receipt_attachment.png',
      url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80',
      size: 142800,
      mimeType: 'image/png'
    }
  });
});

// WS Token endpoint
app.post('/api/support/tickets/:id/ws-token', (req, res) => {
  return res.json({ token: `ws_tok_${Date.now()}` });
});

// ── BlazeTimeline Endpoints (Live Git Commits & Repository Events) ──

const handleTimelineEvents = async (req: express.Request, res: express.Response) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    const source = req.query.source ? String(req.query.source) : undefined;
    let events = await fetchTimelineEvents(limit, false, false);
    if (source && source !== 'all') {
      events = events.filter((e) => e.source === source);
    }
    return res.json({ success: true, data: events });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
};
app.get('/api/timeline/events', handleTimelineEvents);
app.get('/api/pulse/events', handleTimelineEvents);
app.get('/api/admin/timeline/events', handleTimelineEvents);
app.get('/api/admin/pulse/events', handleTimelineEvents);

const handleSyncTimelineCommits = async (req: express.Request, res: express.Response) => {
  try {
    const full = req.query.full === 'true' || req.query.full === '1';
    const limit = full ? 100 : 50;
    const commits = await fetchTimelineEvents(limit, true, full);
    broadcastLiveEvent('timeline_commits_synced', { count: commits.length, timestamp: Date.now() }, 'everyone');
    return res.json({ success: true, count: commits.length, data: commits });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
};
app.post('/api/timeline/sync-github-commits', handleSyncTimelineCommits);
app.post('/api/pulse/sync-github-commits', handleSyncTimelineCommits);
app.post('/api/admin/timeline/sync-github-commits', handleSyncTimelineCommits);
app.post('/api/admin/pulse/sync-github-commits', handleSyncTimelineCommits);

// 12. Health check (supports /health and /api/health)
let cachedTokenHealth: TokenHealthStatus | null = null;
let lastTokenCheckTime = 0;

async function getTokenHealth(force = false): Promise<TokenHealthStatus> {
  const token = process.env.BLAZE_GITHUB_TOKEN;
  const repo = process.env.BLAZE_REPO || process.env.GITHUB_REPOSITORY;
  const now = Date.now();
  if (!force && cachedTokenHealth && now - lastTokenCheckTime < 5 * 60 * 1000) {
    return cachedTokenHealth;
  }
  cachedTokenHealth = await checkTokenHealth(token, repo);
  lastTokenCheckTime = now;
  return cachedTokenHealth;
}

app.get(['/health', '/api/health'], async (_req, res) => {
  const tokenHealth = await getTokenHealth();
  const providers = describeProviders();

  const status = !tokenHealth.configured
    ? 'ready'
    : tokenHealth.valid
    ? tokenHealth.warning
      ? 'degraded'
      : 'healthy'
    : 'error';

  return res.status(status === 'error' ? 503 : 200).json({
    status,
    system: 'BlazeResolver Engine',
    version: '0.8.0',
    profile: profile.id,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    github: {
      configured: tokenHealth.configured,
      valid: tokenHealth.valid,
      status: tokenHealth.status,
      expiresAt: tokenHealth.expiresAt,
      daysUntilExpiration: tokenHealth.daysUntilExpiration,
      rateLimitRemaining: tokenHealth.rateLimitRemaining,
      warning: tokenHealth.warning,
      error: tokenHealth.error
    },
    ai: {
      providers: providers.map((p) => p.split(':')[0]),
      hasActiveKey: providers.length > 0,
      embeddings: embedder ? embedder.id : null
    },
    storage: {
      persisted: Boolean(supportDataPath),
      path: supportDataPath
    }
  });
});

// Dashboard: after `npm run build`, serve it from the same port. In development Vite serves it instead.
const clientDir = resolve('dist/client');
if (existsSync(join(clientDir, 'index.html'))) {
  app.use(express.static(clientDir));
  app.get(/^\/(?!api\/|ws).*/, (req, res) => res.sendFile(join(clientDir, 'index.html')));
}

server.listen(PORT, async () => {
  console.log(`\n🚀 BlazeResolver Server running on http://localhost:${PORT} (profile: ${profile.name})`);
  console.log(`🎙️ Voice WebSocket Bridge listening on ws://localhost:${PORT}/ws`);
  const ai = describeProviders();
  console.log(`🤖 AI providers, in failover order:${ai.length ? ai.map((l) => `\n   ${l}`).join('') : ' none (triage uses keyword rules)'}`);
  console.log(`🔎 Help-doc search: ${embedder ? `keywords + semantic (${embedder.id})` : 'keywords only (no embeddings provider configured)'}`);

  const token = process.env.BLAZE_GITHUB_TOKEN;
  if (token) {
    const health = await getTokenHealth(true);
    if (!health.valid) {
      console.error(`\n⚠️  [blazeresolver] BLAZE_GITHUB_TOKEN check failed: ${health.error || 'Authentication error'}`);
      console.error(`   Automated issue creation and PRs will fail until token is updated.`);
      console.error(`   Run 'npx blazeresolver doctor' to verify repository access.\n`);
    } else if (health.warning) {
      console.warn(`\n⚠️  [blazeresolver] ${health.warning}\n`);
    } else {
      console.log(`🐙 GitHub: authenticated${health.expiresAt ? ` (token expires: ${health.expiresAt})` : ''}`);
    }
  } else {
    console.log(`🐙 GitHub: no token configured (set BLAZE_GITHUB_TOKEN for issue/PR integration)`);
  }

  console.log(`⚡ Ready to triage, correlate, resolve, and respond!\n`);
});
