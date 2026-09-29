import { BlazeResolverPipeline } from '../../core/pipeline/index.js';
import { ResolverAdapters } from '../../adapters/contracts.js';
import { CustomerInput, ResolutionAction } from '../../core/types.js';
import { DomainProfile, GENERIC_PROFILE, formatMoney, normalizeOrderId } from '../../core/domain.js';
import { GeminiFunctionDeclaration } from './types.js';

/**
 * Returns function declarations for Gemini Multimodal Live API, worded for the active domain profile.
 */
export function getVoiceToolDeclarations(
  profile: DomainProfile = GENERIC_PROFILE,
  hasRefundGateway: boolean = true
): GeminiFunctionDeclaration[] {
  const { labels, currency, moneyPolicy } = profile;
  const itemLabel = labels.item.toLowerCase();
  const resourceLabel = labels.resource.toLowerCase();
  const categoryExamples = profile.categories.slice(0, 4).map((c) => c.label.toLowerCase()).join(', ');

  const declarations: GeminiFunctionDeclaration[] = [
    {
      name: 'lookup_order',
      description: `Look up real-time order details, line items, prices, delivery status, ${resourceLabel}, and live operational signals. Always invoke this when the customer provides or inquires about an order ID.`,
      parameters: {
        type: 'OBJECT',
        properties: {
          orderId: {
            type: 'STRING',
            description: 'The order ID the customer mentioned'
          }
        },
        required: ['orderId']
      }
    },
    {
      name: 'process_refund',
      description: `Process an instant refund or wallet store credit for an order through the BlazeResolver MoneyGate policy guardrail. Handles auto-refunds up to ${formatMoney(moneyPolicy.autoApproveThreshold, currency)}, or queues higher amounts for human supervisor (HITL) approval.`,
      parameters: {
        type: 'OBJECT',
        properties: {
          orderId: {
            type: 'STRING',
            description: 'The order ID to issue a refund or credit for'
          },
          amount: {
            type: 'NUMBER',
            description: `The refund amount in ${currency.code}`
          },
          reason: {
            type: 'STRING',
            description: `Reason for refund (e.g., ${categoryExamples})`
          },
          refundType: {
            type: 'STRING',
            enum: ['original_payment', 'store_credit'],
            description: 'Refund destination: original payment method or instant store credit'
          }
        },
        required: ['orderId', 'amount', 'reason']
      }
    },
    {
      name: 'file_complaint',
      description: `File and run a customer complaint through the BlazeResolver correlation harness. Cross-references live operational signals to identify systemic ${resourceLabel} problems or ${itemLabel} quality issues.`,
      parameters: {
        type: 'OBJECT',
        properties: {
          complaintText: {
            type: 'STRING',
            description: 'The full text of the customer complaint'
          },
          orderId: {
            type: 'STRING',
            description: 'Associated order ID if known'
          },
          itemName: {
            type: 'STRING',
            description: `Affected ${itemLabel} name`
          },
          claimedAmount: {
            type: 'NUMBER',
            description: `Claimed refund amount in ${currency.code} if requested by customer`
          },
          resourceId: {
            type: 'STRING',
            description: `${labels.resource} ID if known`
          }
        },
        required: ['complaintText']
      }
    },
    {
      name: 'escalate_to_human',
      description:
        'Escalate the voice conversation to a human manager/supervisor for high-risk disputes, agitated customers, or policy exceptions.',
      parameters: {
        type: 'OBJECT',
        properties: {
          orderId: {
            type: 'STRING',
            description: 'Order ID associated with the escalation'
          },
          reason: {
            type: 'STRING',
            description: 'Detailed reason for supervisor escalation'
          },
          urgency: {
            type: 'STRING',
            enum: ['low', 'medium', 'high', 'urgent'],
            description: 'Escalation urgency level'
          },
          customerNotes: {
            type: 'STRING',
            description: 'Key summary points for the supervisor'
          }
        },
        required: ['reason']
      }
    },
    {
      name: 'check_incident_status',
      description: `Check if there is currently an active systemic incident or operational bottleneck at a ${resourceLabel}.`,
      parameters: {
        type: 'OBJECT',
        properties: {
          resourceId: {
            type: 'STRING',
            description: `${labels.resource} ID${profile.resources.length > 0 ? ` (e.g. ${profile.resources.map((r) => r.id).join(', ')})` : ''}`
          }
        },
        required: ['resourceId']
      }
    }
  ];

  return hasRefundGateway ? declarations : declarations.filter((d) => d.name !== 'process_refund');
}

export interface VoiceToolExecutionContext {
  pipeline: BlazeResolverPipeline;
  adapters: ResolverAdapters;
  customerId?: string;
  onEvent?: (eventName: string, payload: unknown) => void;
}

/**
 * Dispatches and executes a tool called mid-conversation by Gemini Live API
 */
export async function executeVoiceTool(
  toolName: string,
  args: Record<string, unknown>,
  context: VoiceToolExecutionContext
): Promise<Record<string, unknown>> {
  const { pipeline, adapters, customerId = 'cust_voice_user', onEvent } = context;
  const profile = pipeline.getProfile();
  const money = (amount: number) => formatMoney(amount, profile.currency);

  switch (toolName) {
    case 'lookup_order': {
      const orderId = normalizeOrderId(String(args.orderId || ''), profile);
      const order = await adapters.orderSource.getOrder(orderId);
      if (!order) {
        return {
          found: false,
          message: `Order #${orderId} not found in the order system. Please verify the order number with the customer.`
        };
      }

      const signal = adapters.signalSource ? await adapters.signalSource.getOrderSignal(orderId) : null;
      const baseline = adapters.signalSource ? await adapters.signalSource.getResourceBaseline(order.resourceId) : null;

      const payload = {
        found: true,
        orderId: order.id,
        customerName: order.customerName,
        resourceId: order.resourceId,
        resourceName: order.resourceName,
        status: order.status,
        totalAmount: order.totalAmount,
        currency: order.currency,
        paymentMethod: order.paymentMethod,
        items: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice
        })),
        orderedAt: order.orderedAt,
        deliveredAt: order.deliveredAt,
        operationalSignal: signal
          ? {
              metric: signal.metric,
              label: signal.label,
              unit: signal.unit,
              value: signal.value,
              baseline: signal.baseline,
              isAnomalous: signal.isAnomalous,
              stage: signal.stage,
              notes: signal.notes
            }
          : null,
        resourceBaseline: baseline ? { label: baseline.label, unit: baseline.unit, baseline: baseline.baseline } : null
      };

      onEvent?.('order_lookup_success', payload);
      return payload;
    }

    case 'process_refund': {
      const orderId = normalizeOrderId(String(args.orderId || ''), profile);
      const amount = Number(args.amount || 0);
      const reason = String(args.reason || 'Customer voice complaint');
      const refundType = (args.refundType as string) || 'original_payment';
      const idempotencyKey = `voice_rfnd_${orderId}_${amount}_${Date.now()}`;

      const threshold = pipeline.getResolutionEngine().getAutoApproveThreshold();
      const order = await adapters.orderSource.getOrder(orderId);

      if (amount > threshold) {
        // High amount: MoneyGate HITL route
        const hitlAction: ResolutionAction = {
          id: `hitl_voice_${Date.now()}`,
          complaintId: `cmp_voice_${orderId}`,
          actionType: refundType === 'store_credit' ? 'credit' : 'refund',
          idempotencyKey,
          amount,
          currency: profile.currency.code,
          orderId,
          customerId: order?.customerId || customerId,
          reason: `High value refund request exceeding ${money(threshold)} threshold: ${reason}`,
          requiresApproval: true,
          approvalStatus: 'pending_human',
          createdAt: new Date()
        };

        pipeline.getResolutionEngine().queueForHumanApproval(hitlAction);
        onEvent?.('hitl_queued', hitlAction);

        return {
          status: 'hitl_gated',
          requiresSupervisorApproval: true,
          amount,
          currency: profile.currency.code,
          orderId,
          reason,
          message: `Refund of ${money(amount)} exceeds the automated safety threshold (${money(threshold)}). It has been placed in the Supervisor Priority Queue for immediate 1-click human approval.`
        };
      }

      if (!adapters.refundGateway) {
        return {
          status: 'unsupported',
          message: 'This business has no refund or payment system connected, so I cannot process refunds or credits. I can file a complaint for a team member to follow up.'
        };
      }

      // Auto-approved under threshold
      let receipt;
      if (refundType === 'store_credit') {
        receipt = await adapters.refundGateway.issueCredit(
          order?.customerId || customerId,
          amount,
          idempotencyKey
        );
      } else {
        receipt = await adapters.refundGateway.issueRefund(orderId, amount, idempotencyKey);
      }

      onEvent?.('refund_processed', receipt);
      return {
        status: 'approved_and_processed',
        refundId: (receipt as any).refundId || (receipt as any).creditId,
        orderId,
        amount,
        currency: profile.currency.code,
        type: refundType,
        message: `Successfully processed ${refundType === 'store_credit' ? 'wallet credit' : 'instant refund'} of ${money(amount)} for Order #${orderId}.`
      };
    }

    case 'file_complaint': {
      const complaintText = String(args.complaintText || '');
      const orderId = args.orderId ? normalizeOrderId(String(args.orderId), profile) : undefined;
      const resourceId = args.resourceId ? String(args.resourceId) : undefined;

      const input: CustomerInput = {
        id: `voice_cmp_${Date.now()}`,
        channel: 'voice',
        rawText: complaintText,
        orderId,
        customerId,
        resourceId,
        timestamp: new Date()
      };

      const result = await pipeline.processComplaint(input);
      onEvent?.('pipeline_completed', result);

      return {
        complaintId: result.complaintId,
        triageCategory: result.triage.category,
        severity: result.triage.severity,
        isSystemicIncident: result.correlation.isSystemic,
        systemicIncident: result.correlation.incident
          ? {
              incidentId: result.correlation.incident.incidentId,
              title: result.correlation.incident.title,
              summary: result.correlation.incident.summary,
              complaintCount: result.correlation.incident.complaintCount,
              signal: result.correlation.incident.signal ?? null
            }
          : null,
        resolutionAction: result.resolution.actions.length > 0 ? result.resolution.actions[0] : null,
        hitlRequired: result.resolution.hitlRequired,
        recommendedSpokenResponse: result.response.text
      };
    }

    case 'escalate_to_human': {
      const orderId = args.orderId ? normalizeOrderId(String(args.orderId), profile) : undefined;
      const reason = String(args.reason || 'Customer requested human agent');
      const urgency = (args.urgency as string) || 'high';
      const customerNotes = args.customerNotes ? String(args.customerNotes) : '';

      const ticket = {
        id: `esc_${Date.now()}`,
        complaintId: `cmp_${orderId || 'voice'}`,
        customerId,
        orderId,
        title: `🎙️ Voice Escalation: ${reason}`,
        description: `Urgent supervisor transfer requested via Voice. Notes: ${customerNotes}`,
        category: 'human_escalation',
        priority: urgency as any,
        status: 'escalated_to_manager' as const,
        createdAt: new Date(),
        assignedManager: 'DJ (Senior Operations Lead)'
      };

      onEvent?.('human_escalated', ticket);

      return {
        escalated: true,
        ticketId: ticket.id,
        assignedSupervisor: ticket.assignedManager,
        priority: urgency,
        message: `Successfully escalated call to Senior Supervisor ${ticket.assignedManager}. A priority manager notification has been dispatched.`
      };
    }

    case 'check_incident_status': {
      const resourceId = args.resourceId ? String(args.resourceId) : '';
      if (!resourceId) {
        return { error: `A ${profile.labels.resource.toLowerCase()} ID is required to check incident status.` };
      }
      const incidents = pipeline.getCorrelateEngine().getIncidents().filter(inc => inc.resourceId === resourceId);
      const clusters = pipeline.getCorrelateEngine().getClusters().filter(c => c.resourceId === resourceId);

      return {
        resourceId,
        hasActiveIncidents: incidents.length > 0,
        activeIncidentsCount: incidents.length,
        incidents: incidents.map(inc => ({
          incidentId: inc.incidentId,
          title: inc.title,
          summary: inc.summary,
          complaintCount: inc.complaintCount,
          signal: inc.signal ?? null,
          itemDisabled: inc.itemDisabled
        })),
        activeClusters: clusters.map(c => ({
          category: c.category,
          itemName: c.itemName,
          count: c.count,
          signal: c.signal ?? null
        }))
      };
    }

    default:
      return {
        error: `Unknown tool function: ${toolName}`
      };
  }
}
