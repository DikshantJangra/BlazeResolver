import { BlazeResolverPipeline } from '../../core/pipeline/index.js';
import { ResolverAdapters } from '../../adapters/contracts.js';
import { CustomerInput } from '../../core/types.js';
import { GeminiFunctionDeclaration } from './types.js';

/**
 * Returns function declarations for Gemini Multimodal Live API
 */
export function getVoiceToolDeclarations(): GeminiFunctionDeclaration[] {
  return [
    {
      name: 'lookup_order',
      description:
        'Look up real-time restaurant customer order details, line items, prices, delivery status, branch, and kitchen prep timings (KDS). Always invoke this when the customer provides or inquires about an order ID.',
      parameters: {
        type: 'OBJECT',
        properties: {
          orderId: {
            type: 'STRING',
            description: 'The order ID (e.g. ord-1021, ord-1030, ord-1044)'
          }
        },
        required: ['orderId']
      }
    },
    {
      name: 'process_refund',
      description:
        'Process an instant refund or wallet store credit for an order through the BlazeResolver MoneyGate policy guardrail. Handles auto-refunds under ₹300, or queues higher amounts for human supervisor (HITL) approval.',
      parameters: {
        type: 'OBJECT',
        properties: {
          orderId: {
            type: 'STRING',
            description: 'The order ID to issue a refund or credit for'
          },
          amount: {
            type: 'NUMBER',
            description: 'The refund amount in INR'
          },
          reason: {
            type: 'STRING',
            description: 'Reason for refund (e.g., cold food, delivery delay, missing item, wrong order)'
          },
          refundType: {
            type: 'STRING',
            enum: ['original_payment', 'store_credit'],
            description: 'Refund destination: original UPI/card payment or instant store credit'
          }
        },
        required: ['orderId', 'amount', 'reason']
      }
    },
    {
      name: 'file_complaint',
      description:
        'File and run a customer complaint through the BlazeResolver correlation harness. Cross-references live kitchen prep timestamps to identify systemic branch delays or dish quality issues.',
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
          dishName: {
            type: 'STRING',
            description: 'Affected dish or food item name'
          },
          claimedAmount: {
            type: 'NUMBER',
            description: 'Claimed refund amount in INR if requested by customer'
          },
          branchId: {
            type: 'STRING',
            description: 'Branch ID if known'
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
      description:
        'Check if there is currently an active systemic kitchen bottleneck or operational incident at a restaurant branch.',
      parameters: {
        type: 'OBJECT',
        properties: {
          branchId: {
            type: 'STRING',
            description: 'Restaurant branch ID (e.g. branch_cp_02, branch_ind_01, branch_kor_03)'
          }
        },
        required: ['branchId']
      }
    }
  ];
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

  switch (toolName) {
    case 'lookup_order': {
      const rawOrderId = String(args.orderId || '').toLowerCase().trim();
      const order = await adapters.orderSource.getOrder(rawOrderId);
      if (!order) {
        return {
          found: false,
          message: `Order #${rawOrderId} not found in the restaurant order registry. Please verify the order number with the customer.`
        };
      }

      const timing = await adapters.orderSource.getKitchenTiming(rawOrderId);
      const baseline = await adapters.orderSource.getBranchAveragePrepTime(order.branchId);

      const payload = {
        found: true,
        orderId: order.id,
        customerName: order.customerName,
        branchId: order.branchId,
        branchName: order.branchName,
        status: order.status,
        totalAmountINR: order.totalAmount,
        paymentMethod: order.paymentMethod,
        items: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice
        })),
        orderedAt: order.orderedAt,
        deliveredAt: order.deliveredAt,
        kitchenTiming: timing
          ? {
              prepMinutes: timing.prepMinutes,
              baselineMinutes: timing.baselineMinutes,
              isBottleneck: timing.isBottleneck,
              chefNotes: timing.chefNotes,
              station: timing.station
            }
          : null,
        branchBaselineMinutes: baseline.baselineMinutes
      };

      onEvent?.('order_lookup_success', payload);
      return payload;
    }

    case 'process_refund': {
      const rawOrderId = String(args.orderId || '').toLowerCase().trim();
      const amount = Number(args.amount || 0);
      const reason = String(args.reason || 'Customer voice complaint');
      const refundType = (args.refundType as string) || 'original_payment';
      const idempotencyKey = `voice_rfnd_${rawOrderId}_${amount}_${Date.now()}`;

      // Check auto-refund threshold via resolution engine
      const threshold = 300; // default ₹300
      const order = await adapters.orderSource.getOrder(rawOrderId);

      if (amount > threshold) {
        // High amount: MoneyGate HITL route
        const hitlAction = {
          id: `hitl_voice_${Date.now()}`,
          complaintId: `cmp_voice_${rawOrderId}`,
          actionType: refundType === 'store_credit' ? 'credit' : 'refund',
          idempotencyKey,
          amount,
          orderId: rawOrderId,
          customerId: order?.customerId || customerId,
          reason: `High value refund request exceeding ₹${threshold} threshold: ${reason}`,
          approvalStatus: 'pending_human' as const,
          createdAt: new Date()
        };

        // Queue in resolution engine HITL list
        (pipeline.getResolutionEngine() as any).hitlQueue.unshift(hitlAction);
        onEvent?.('hitl_queued', hitlAction);

        return {
          status: 'hitl_gated',
          requiresSupervisorApproval: true,
          amountINR: amount,
          orderId: rawOrderId,
          reason,
          message: `Refund of ₹${amount} exceeds the automated safety threshold (₹${threshold}). It has been placed in the Supervisor Priority Queue for immediate 1-click human approval.`
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
        receipt = await adapters.refundGateway.issueRefund(rawOrderId, amount, idempotencyKey);
      }

      onEvent?.('refund_processed', receipt);
      return {
        status: 'approved_and_processed',
        refundId: (receipt as any).refundId || (receipt as any).creditId,
        orderId: rawOrderId,
        amountINR: amount,
        currency: 'INR',
        type: refundType,
        message: `Successfully processed ${refundType === 'store_credit' ? 'wallet credit' : 'instant refund'} of ₹${amount} for Order #${rawOrderId}.`
      };
    }

    case 'file_complaint': {
      const complaintText = String(args.complaintText || '');
      const rawOrderId = args.orderId ? String(args.orderId).toLowerCase().trim() : undefined;
      const dishName = args.dishName ? String(args.dishName) : undefined;
      const claimedAmount = args.claimedAmount ? Number(args.claimedAmount) : undefined;
      const branchId = args.branchId ? String(args.branchId) : undefined;

      const input: CustomerInput = {
        id: `voice_cmp_${Date.now()}`,
        channel: 'voice',
        rawText: complaintText,
        orderId: rawOrderId,
        customerId,
        branchId,
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
              delayRatio: result.correlation.incident.delayRatio
            }
          : null,
        resolutionAction: result.resolution.actions.length > 0 ? result.resolution.actions[0] : null,
        hitlRequired: result.resolution.hitlRequired,
        recommendedSpokenResponse: result.response.text
      };
    }

    case 'escalate_to_human': {
      const rawOrderId = args.orderId ? String(args.orderId).toLowerCase().trim() : undefined;
      const reason = String(args.reason || 'Customer requested human agent');
      const urgency = (args.urgency as string) || 'high';
      const customerNotes = args.customerNotes ? String(args.customerNotes) : '';

      const ticket = {
        id: `esc_${Date.now()}`,
        complaintId: `cmp_${rawOrderId || 'voice'}`,
        customerId,
        orderId: rawOrderId,
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
      const branchId = String(args.branchId || 'branch_cp_02');
      const incidents = pipeline.getCorrelateEngine().getIncidents().filter(inc => inc.branchId === branchId);
      const clusters = pipeline.getCorrelateEngine().getClusters().filter(c => c.branchId === branchId);

      return {
        branchId,
        hasActiveIncidents: incidents.length > 0,
        activeIncidentsCount: incidents.length,
        incidents: incidents.map(inc => ({
          incidentId: inc.incidentId,
          title: inc.title,
          summary: inc.summary,
          complaintCount: inc.complaintCount,
          delayRatio: inc.delayRatio,
          dishDisabled: inc.dishDisabled
        })),
        activeClusters: clusters.map(c => ({
          category: c.category,
          dishName: c.dishName,
          count: c.count,
          avgKitchenPrepMinutes: c.avgKitchenPrepMinutes
        }))
      };
    }

    default:
      return {
        error: `Unknown tool function: ${toolName}`
      };
  }
}
