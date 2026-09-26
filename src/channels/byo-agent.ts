import { BlazeResolverPipeline } from '../core/pipeline/index.js';
import { CustomerInput } from '../core/types.js';

export function getAgentToolSchemas() {
  return [
    {
      name: 'blaze_triage',
      description: 'Classify customer support complaint into structured intent, category, severity, and extracted entities (dish, branch, orderId, claimedAmount). Enforces prompt-injection security guardrail.',
      parameters: {
        type: 'object',
        properties: {
          rawText: { type: 'string', description: 'Raw customer complaint text or voice transcript' },
          channel: { type: 'string', enum: ['text', 'voice', 'webhook', 'email'], default: 'text' },
          orderId: { type: 'string', description: 'Optional known order identifier' },
          customerId: { type: 'string', description: 'Optional customer identifier' },
          branchId: { type: 'string', description: 'Optional branch identifier' }
        },
        required: ['rawText']
      }
    },
    {
      name: 'blaze_correlate',
      description: 'Cross-reference customer complaint with live operational KDS kitchen prep timestamps across sliding buffer window. Detects systemic bottlenecks and emits linked Incidents instead of isolated tickets.',
      parameters: {
        type: 'object',
        properties: {
          complaintId: { type: 'string', description: 'The triaged complaint ID' },
          category: { type: 'string', description: 'Triage category (e.g. cold_food, delivery_delay)' },
          branchId: { type: 'string', description: 'Restaurant branch ID' },
          dishId: { type: 'string', description: 'Optional dish ID' },
          orderId: { type: 'string', description: 'Associated order ID' }
        },
        required: ['complaintId', 'category', 'branchId']
      }
    },
    {
      name: 'blaze_resolve',
      description: 'Apply policy-bounded resolution logic. Dispatches idempotent financial tool mutations (refund/credit) through MoneyGate policy (auto-resolves under threshold, gates above threshold for HITL approval).',
      parameters: {
        type: 'object',
        properties: {
          triageId: { type: 'string', description: 'Triaged complaint ID' },
          category: { type: 'string', description: 'Complaint category' },
          orderId: { type: 'string', description: 'Order ID to resolve' },
          claimedAmount: { type: 'number', description: 'Claimed refund amount in INR' }
        },
        required: ['triageId', 'category']
      }
    },
    {
      name: 'blaze_respond',
      description: 'Generate empathetic, channel-specific response with automated quality review pass ensuring truthfulness and policy confirmation.',
      parameters: {
        type: 'object',
        properties: {
          triageId: { type: 'string', description: 'Triaged complaint ID' },
          channel: { type: 'string', enum: ['text', 'voice'], default: 'text' }
        },
        required: ['triageId']
      }
    },
    {
      name: 'blaze_run_pipeline',
      description: 'Execute the complete end-to-end BlazeResolver harness (Triage -> Correlate -> Resolve -> Respond) in a single call.',
      parameters: {
        type: 'object',
        properties: {
          rawText: { type: 'string', description: 'Customer message' },
          channel: { type: 'string', enum: ['text', 'voice', 'webhook'], default: 'text' },
          orderId: { type: 'string', description: 'Associated order ID if known' },
          customerId: { type: 'string', description: 'Customer ID' },
          branchId: { type: 'string', description: 'Branch ID' }
        },
        required: ['rawText']
      }
    }
  ];
}

export function createAgentToolExecutor(pipeline: BlazeResolverPipeline) {
  return {
    async executeTool(name: string, args: Record<string, unknown>) {
      switch (name) {
        case 'blaze_run_pipeline': {
          const input: CustomerInput = {
            id: `agent_call_${Date.now()}`,
            channel: (args.channel as any) || 'text',
            rawText: String(args.rawText || ''),
            orderId: args.orderId as string | undefined,
            customerId: args.customerId as string | undefined,
            branchId: args.branchId as string | undefined,
            timestamp: new Date()
          };
          return await pipeline.processComplaint(input);
        }

        case 'blaze_triage': {
          const input: CustomerInput = {
            id: `agent_triage_${Date.now()}`,
            channel: (args.channel as any) || 'text',
            rawText: String(args.rawText || ''),
            orderId: args.orderId as string | undefined,
            customerId: args.customerId as string | undefined,
            branchId: args.branchId as string | undefined,
            timestamp: new Date()
          };
          const triaged = await pipeline['triageEngine'].triage(input);
          return triaged;
        }

        default:
          throw new Error(`Unsupported tool: ${name}`);
      }
    }
  };
}
