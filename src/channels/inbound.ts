import type { DomainProfile } from '../core/domain.js';
import type { PipelineResult } from '../core/types.js';

/** Identifiers the caller sent, used when triage did not extract them. */
export interface InboundRequestIds {
  orderId?: string;
  resourceId?: string;
  itemId?: string;
}

export type InboundStatus = 'auto_resolved' | 'escalated_with_proposed_action' | 'escalated_to_support';

/**
 * The POST /api/inbound response for a processed complaint.
 * - auto_resolved: an action executed and settled the complaint.
 * - escalated_with_proposed_action: a supervisor must approve the attached action.
 * - escalated_to_support: nothing was settled automatically (e.g. the guard blocked the claim); a person
 *   follows up on the support ticket in `ticketId`.
 */
export function buildInboundResponse(result: PipelineResult, profile: DomainProfile, request: InboundRequestIds) {
  const actions = result.resolution.actions || [];
  const hitlActions = actions.filter((a) => a.requiresApproval && a.approvalStatus === 'pending_human');
  const blockedAction = actions.find((a) => a.approvalStatus === 'failed');
  const ticketAction = actions.find((a) => a.actionType === 'create_ticket' && a.approvalStatus === 'executed');
  const supportTicketId = ticketAction?.executionResult?.ticketId as string | undefined;

  const status: InboundStatus =
    hitlActions.length > 0 || result.triage.severity === 'critical'
      ? 'escalated_with_proposed_action'
      : blockedAction || supportTicketId
        ? 'escalated_to_support'
        : 'auto_resolved';
  const primaryAction = blockedAction ?? actions[0];

  const proposedAction = hitlActions.length > 0 ? {
    actionId: hitlActions[0].id,
    type: hitlActions[0].actionType,
    amount: hitlActions[0].amount,
    currency: profile.currency.code,
    reason: hitlActions[0].reason,
    resourceId: result.triage.resourceId || request.resourceId,
    itemId: result.triage.itemId || request.itemId,
    orderId: result.triage.orderId || request.orderId,
    requiresSupervisorReview: true,
    autoExecutable: false
  } : {
    type: primaryAction?.actionType || 'none',
    amount: primaryAction?.amount,
    currency: profile.currency.code,
    reason: primaryAction?.reason || 'Autonomous resolution',
    autoExecutable: status === 'auto_resolved'
  };

  return {
    success: true,
    status,
    result: {
      complaintId: result.complaintId,
      intent: result.triage.intent,
      category: result.triage.category,
      urgency: result.triage.severity,
      sentiment: result.triage.sentiment,
      response: result.response.text,
      executedActions: actions.filter((a) => a.approvalStatus === 'executed')
    },
    proposedAction,
    // A real ID only: the pending approval, or the support ticket that was opened.
    ticketId: hitlActions[0]?.id ?? supportTicketId ?? null,
    autoResolved: status === 'auto_resolved'
  };
}
