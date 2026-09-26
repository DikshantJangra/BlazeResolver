import type { SupportStateType } from "./state.js";

export interface EscalationEvaluation {
  shouldEscalate: boolean;
  reason: string;
  handoffSummary: string;
}

/**
 * Evaluates whether human escalation is required.
 * Implements the Resolvd pattern:
 * - Auto-resolve under limit (no escalation required).
 * - If above limit or high-friction, escalate with PROPOSED ACTION ATTACHED for 1-click human review.
 */
export function evaluateEscalation(state: SupportStateType): EscalationEvaluation {
  // 1. Money-gate policy check: High-value proposed action requires human approval
  if (state.proposedAction && !state.proposedAction.autoExecutable) {
    return {
      shouldEscalate: true,
      reason: `Money-gate policy threshold exceeded: proposed ${state.proposedAction.type} of ₹${state.proposedAction.amount} exceeds automated ceiling.`,
      handoffSummary: `PROPOSED ACTION: Approve ${state.proposedAction.type.toUpperCase()} for ₹${state.proposedAction.amount} on Order #${state.orderId || 'N/A'}. Reason: ${state.proposedAction.reason}`,
    };
  }

  // 2. Explicit human agent demand or legal threat
  if (state.category === "escalation" || state.urgency === "critical") {
    return {
      shouldEscalate: true,
      reason: "Customer explicitly requested human specialist or expressed critical dissatisfaction.",
      handoffSummary: `Customer requested supervisor assistance. Sentiment: ${state.sentiment}. Intent: ${state.intent}.`,
    };
  }

  // 3. VIP tier customer with high urgency
  if (state.customerTier === "vip" && state.urgency === "high") {
    return {
      shouldEscalate: true,
      reason: "Priority SLA: VIP customer with high urgency issue.",
      handoffSummary: `VIP Customer ticket: Priority escalation for immediate supervisor resolution.`,
    };
  }

  // 4. Repeated contact / angry sentiment with unresolved issue
  if (state.sentiment === "angry" && state.attemptedFixes.length > 2) {
    return {
      shouldEscalate: true,
      reason: "Customer remains angry after multiple automated attempts.",
      handoffSummary: `Escalated due to repeated friction: ${state.customerMessage.slice(0, 150)}`,
    };
  }

  return {
    shouldEscalate: false,
    reason: "Issue resolved automatically or within autonomous policy boundaries.",
    handoffSummary: "",
  };
}

/**
 * ESCALATION stage node.
 * Evaluates human-approval / money-gate triggers.
 * Attaches the proposed action if escalation is needed.
 */
export async function escalationNode(state: SupportStateType): Promise<Partial<SupportStateType>> {
  if (state.isPromptInjection) {
    return {
      needsEscalation: false,
    };
  }

  const evaluation = evaluateEscalation(state);

  if (!evaluation.shouldEscalate) {
    return {
      needsEscalation: false,
      escalationSummary: null,
    };
  }

  const ticketId = `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  return {
    needsEscalation: true,
    escalationSummary: evaluation.handoffSummary,
    ticketId,
  };
}
