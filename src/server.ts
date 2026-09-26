import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { BlazeResolverPipeline } from './core/pipeline/index.js';
import { createBlazeEatsAdapters } from './examples/blazeeats/index.js';
import { SEED_COMPLAINTS } from './examples/blazeeats/seed.js';
import { VoiceChannelBridge } from './channels/voice.js';
import { getAgentToolSchemas, createAgentToolExecutor } from './channels/byo-agent.js';
import { CustomerInput } from './core/types.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize Adapter Reference & Pipeline
let adapters = createBlazeEatsAdapters();
let pipeline = new BlazeResolverPipeline(adapters, {
  autoRefundThresholdINR: 300,
  correlationSlidingWindowHours: 24
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const voiceBridge = new VoiceChannelBridge(pipeline);

wss.on('connection', (ws) => {
  voiceBridge.handleConnection(ws);
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
    const { rawText, channel = 'text', orderId, customerId, branchId } = req.body;
    if (!rawText) {
      return res.status(400).json({ error: 'rawText is required' });
    }

    const input: CustomerInput = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      channel,
      rawText,
      orderId,
      customerId,
      branchId,
      timestamp: new Date()
    };

    const result = await pipeline.processComplaint(input);
    broadcastLiveEvent('pipeline_result', result);

    return res.json({ success: true, result });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// 2. Run All 20 Seed Complaints sequentially
app.post('/api/pipeline/seed', async (req, res) => {
  try {
    const results = [];
    for (const input of SEED_COMPLAINTS) {
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
  adapters = createBlazeEatsAdapters();
  pipeline = new BlazeResolverPipeline(adapters, {
    autoRefundThresholdINR: 300,
    correlationSlidingWindowHours: 24
  });
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
  const blazeOrderSource = adapters.orderSource as any;
  const blazeRefundGateway = adapters.refundGateway as any;
  const blazeTicketSink = adapters.ticketSink as any;
  const blazeMenuControl = adapters.menuControl as any;

  return res.json({
    orders: blazeOrderSource.getAllOrders ? blazeOrderSource.getAllOrders() : [],
    refunds: blazeRefundGateway.getAllRefunds ? blazeRefundGateway.getAllRefunds() : [],
    credits: blazeRefundGateway.getAllCredits ? blazeRefundGateway.getAllCredits() : [],
    incidents: blazeTicketSink.getAllIncidents ? blazeTicketSink.getAllIncidents() : [],
    disabledDishes: await blazeMenuControl.getDisabledDishes()
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
    uptime: process.uptime()
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 BlazeResolver Server running on http://localhost:${PORT}`);
  console.log(`🎙️ Voice WebSocket Bridge listening on ws://localhost:${PORT}/ws`);
  console.log(`⚡ Ready to triage, correlate, resolve, and respond!\n`);
});
