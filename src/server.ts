// Loads .env before anything reads process.env.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer, type IncomingHttpHeaders } from 'http';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { WebSocketServer } from 'ws';
import { BlazeResolverPipeline } from './core/pipeline/index.js';
import { loadExample } from './examples/index.js';
import { VoiceChannelBridge } from './channels/voice.js';
import { LiveEvents, type Audience } from './channels/live-events.js';
import { getAgentToolSchemas, createAgentToolExecutor } from './channels/byo-agent.js';
import { buildInboundResponse } from './channels/inbound.js';
import { CustomerInput } from './core/types.js';
import { ReportSchema, anthropicComplete, triage } from './triage/index.js';
import { ProjectRegistry, type Project } from './projects/index.js';
import { IncidentStore, type IncidentRecord } from './incidents/index.js';
import { ClaudeProvider } from './resolver/claude-provider.js';
import { lockDownServerFiles, resolveFixSandbox, runFix } from './jobs/fix.js';
import { REPO_PATTERN } from './github/index.js';
import { sendFixedEmail } from './notify/index.js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const app = express();
app.set('trust proxy', 1); // behind a host's proxy, req.ip is the real client
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
// The raw body is kept for verifying GitHub's webhook signature.
app.use(express.json({ verify: (req, _res, buf) => void ((req as any).rawBody = buf) }));

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
app.get('/widget.js', (_req, res) => res.type('application/javascript').set('Cache-Control', 'public, max-age=300').sendFile(widgetPath));

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
const fixComplete = anthropicComplete({ maxTokens: 4096, timeoutMs: 180_000 });
const fixPrerequisites = process.env.BLAZE_FIX_ENABLED === 'true' && process.env.BLAZE_OPEN_SIGNUP !== 'true' && !!githubToken && !!fixComplete;
// Each fix's tests run AI-written code nobody has reviewed yet, so they run as a separate unprivileged user.
const fixSandbox = fixPrerequisites ? resolveFixSandbox() : undefined;
const fixEnabled = fixSandbox?.ok === true;
if (process.env.BLAZE_FIX_ENABLED === 'true' && !fixEnabled) {
  console.warn(
    fixSandbox && !fixSandbox.ok
      ? `BLAZE_FIX_ENABLED ignored: ${fixSandbox.problem}`
      : 'BLAZE_FIX_ENABLED ignored: it needs BLAZE_GITHUB_TOKEN, ANTHROPIC_API_KEY and BLAZE_OPEN_SIGNUP unset.'
  );
}
if (fixSandbox?.ok && fixSandbox.sandbox) lockDownServerFiles();
if (fixSandbox?.ok && !fixSandbox.sandbox) console.warn('Fix engine running WITHOUT a sandbox user (BLAZE_ALLOW_UNSANDBOXED_FIXES=true): only for repos and reporters you trust.');

// One fix at a time. ponytail: in-process queue, lost on restart; a real job queue when volume needs it.
let fixQueue: Promise<unknown> = Promise.resolve();
function enqueueFix(project: Project, incident: IncidentRecord) {
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
  });
}

// Signup: the admin token always works; anyone may register when BLAZE_OPEN_SIGNUP=true (5 per hour per IP).
app.post('/api/projects', (req, res) => {
  if (!isAdmin(req)) {
    if (process.env.BLAZE_OPEN_SIGNUP !== 'true') return res.status(401).json({ error: 'signup is closed' });
    if (limited(`signup:${req.ip}`, 5, 3_600_000)) return res.status(429).json({ error: 'too many signups, try later' });
  }
  const { repo, defaultBranch, testCommand, buildCommand } = req.body ?? {};
  if (typeof repo !== 'string' || !REPO_PATTERN.test(repo)) return res.status(400).json({ error: 'repo must be owner/name' });
  const text = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : undefined);
  const { project, key } = registry.register(repo, text(defaultBranch, 100), text(testCommand, 300), text(buildCommand, 300));
  return res.status(201).json({ project: { id: project.id, repo, defaultBranch: project.defaultBranch }, key });
});

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
  // The customer only gets an acknowledgement, never the triage verdict.
  return res.status(202).json({ received: true });
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
app.post('/api/pipeline/reset', (req, res) => {
  ({ adapters, pipeline } = createPipeline());
  voiceBridge = new VoiceChannelBridge(pipeline);
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
app.post('/api/hitl/action', async (req, res) => {
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

// 10. Health check
app.get('/api/health', (req, res) => {
  return res.json({
    status: 'healthy',
    system: 'BlazeResolver Engine',
    version: '1.0.0',
    profile: profile.id,
    uptime: process.uptime()
  });
});

// Dashboard: after `npm run build`, serve it from the same port. In development Vite serves it instead.
const clientDir = resolve('dist/client');
if (existsSync(join(clientDir, 'index.html'))) {
  app.use(express.static(clientDir));
  app.get(/^\/(?!api\/|ws).*/, (req, res) => res.sendFile(join(clientDir, 'index.html')));
}

server.listen(PORT, () => {
  console.log(`\n🚀 BlazeResolver Server running on http://localhost:${PORT} (profile: ${profile.name})`);
  console.log(`🎙️ Voice WebSocket Bridge listening on ws://localhost:${PORT}/ws`);
  console.log(`⚡ Ready to triage, correlate, resolve, and respond!\n`);
});
