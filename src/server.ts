import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { BlazeResolverPipeline } from './core/pipeline/index.js';
import { loadExample } from './examples/index.js';
import { VoiceChannelBridge } from './channels/voice.js';
import { getAgentToolSchemas, createAgentToolExecutor } from './channels/byo-agent.js';
import { CustomerInput } from './core/types.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });
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

wss.on('connection', (ws: any, _request: any, searchParams?: any) => {
  voiceBridge.handleConnection(ws, searchParams);
});

// Broadcast live events to WebSocket clients
export function broadcastLiveEvent(eventType: string, data: unknown) {
  const message = JSON.stringify({ type: eventType, data });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

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
    broadcastLiveEvent('pipeline_result', result);

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
    broadcastLiveEvent('pipeline_result', result);

    const hitlActions = (result.resolution.actions || []).filter((a) => a.requiresApproval && a.approvalStatus === 'pending_human');
    const isEscalated = hitlActions.length > 0 || result.triage.severity === 'critical';

    const proposedAction = hitlActions.length > 0 ? {
      actionId: hitlActions[0].id,
      type: hitlActions[0].actionType,
      amount: hitlActions[0].amount,
      currency: profile.currency.code,
      reason: hitlActions[0].reason,
      resourceId: result.triage.resourceId || resourceId,
      itemId: result.triage.itemId || itemId,
      orderId: result.triage.orderId || orderId,
      requiresSupervisorReview: true,
      autoExecutable: false
    } : {
      type: result.resolution.actions[0]?.actionType || 'none',
      amount: result.resolution.actions[0]?.amount,
      currency: profile.currency.code,
      reason: result.resolution.actions[0]?.reason || 'Autonomous resolution',
      autoExecutable: true
    };

    return res.json({
      success: true,
      status: isEscalated ? 'escalated_with_proposed_action' : 'auto_resolved',
      result: {
        complaintId: result.complaintId,
        intent: result.triage.intent,
        category: result.triage.category,
        urgency: result.triage.severity,
        sentiment: result.triage.sentiment,
        response: result.response.text,
        executedActions: (result.resolution.actions || []).filter((a) => a.approvalStatus === 'executed')
      },
      proposedAction,
      ticketId: isEscalated ? (hitlActions[0]?.id || `tkt_${Date.now()}`) : null,
      autoResolved: !isEscalated
    });
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
      broadcastLiveEvent('pipeline_result', result);
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
  broadcastLiveEvent('pipeline_reset', { timestamp: new Date() });
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

    broadcastLiveEvent('hitl_updated', updatedAction);
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

server.listen(PORT, () => {
  console.log(`\n🚀 BlazeResolver Server running on http://localhost:${PORT} (profile: ${profile.name})`);
  console.log(`🎙️ Voice WebSocket Bridge listening on ws://localhost:${PORT}/ws`);
  console.log(`⚡ Ready to triage, correlate, resolve, and respond!\n`);
});
