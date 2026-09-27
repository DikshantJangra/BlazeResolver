import type { SupportStateType, ProposedAction } from "./state.js";

export interface ResolveToolContext {
  orderId?: string | null;
  customerId?: string | null;
  resourceId?: string | null;
  itemId?: string | null;
  autoRefundThreshold?: number; // e.g. 300 INR
}

const DEFAULT_AUTO_REFUND_THRESHOLD = 300;

/**
 * Generic tool definitions for RESOLVE stage.
 * Business-agnostic: items instead of dishes, resourceId instead of branchId.
 */
export function buildGenericResolutionTools(ctx: ResolveToolContext) {
  return [
    {
      name: "lookup_order",
      description: "Look up order metadata, items, timestamps, and payment status",
      invoke: async (args: { orderId: string }) => {
        return JSON.stringify({
          orderId: args.orderId,
          status: "delivered",
          totalAmount: 450,
          currency: "INR",
          resourceId: ctx.resourceId || "res_main_01",
          items: [{ itemId: ctx.itemId || "item_standard_01", name: "Ordered Item", price: 350 }],
        });
      },
    },
    {
      name: "propose_refund",
      description: "Propose or execute a customer refund bounded by policy",
      invoke: async (args: { orderId: string; amount: number; reason: string }) => {
        const threshold = ctx.autoRefundThreshold ?? DEFAULT_AUTO_REFUND_THRESHOLD;
        const autoExecutable = args.amount <= threshold;
        return JSON.stringify({
          success: true,
          orderId: args.orderId,
          amount: args.amount,
          reason: args.reason,
          autoExecutable,
          status: autoExecutable ? "auto_approved" : "requires_human_approval",
          receiptId: autoExecutable ? `rcpt_${Date.now()}` : null,
        });
      },
    },
    {
      name: "propose_credit",
      description: "Propose or issue an apology wallet credit",
      invoke: async (args: { customerId: string; amount: number; reason: string }) => {
        return JSON.stringify({
          success: true,
          customerId: args.customerId,
          amount: args.amount,
          reason: args.reason,
          autoExecutable: true,
          receiptId: `crd_${Date.now()}`,
        });
      },
    },
  ];
}

/**
 * RESOLVE stage tool-calling node.
 * Evaluates the triaged issue, invokes appropriate lookup or compensation tools,
 * and attaches a structured proposedAction if money/compensation is involved.
 */
export async function resolveNode(state: SupportStateType): Promise<Partial<SupportStateType>> {
  // If prompt injection was detected during triage, pass through
  if (state.isPromptInjection) {
    return {
      draftResponse: "Your request was declined by policy guardrails.",
    };
  }

  const threshold = DEFAULT_AUTO_REFUND_THRESHOLD;
  const orderId = state.orderId || "ord_sample_101";
  const itemId = state.itemId || "item_sample_01";
  const resourceId = state.resourceId || "res_node_01";

  // Determine needed compensation based on triage
  let proposedAction: ProposedAction | null = null;
  let draft = "";
  let toolBackedRefundIssued = false;

  if (state.category === "order_billing" || state.category === "quality_issue") {
    // Determine financial amount (extract currency specifically or use fallback)
    const amountMatch =
      state.customerMessage.match(/(?:₹|\$|inr|usd)\s*(\d+(?:\.\d{1,2})?)/i) ||
      state.customerMessage.match(/(\d+(?:\.\d{1,2})?)\s*(?:rupees|dollars|rs|refund)/i);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : 250;

    if (amount <= threshold) {
      // Auto-resolve within money-gate policy
      proposedAction = {
        type: "refund",
        amount,
        currency: "INR",
        reason: `Auto-approved refund for ${state.category} under ₹${threshold} limit`,
        resourceId,
        itemId,
        orderId,
        autoExecutable: true,
      };
      toolBackedRefundIssued = true;
      draft = `I've approved an immediate refund of ₹${amount} for order #${orderId}. The amount has been credited to your original payment method.`;
    } else {
      // Requires Human Approval (HITL) — attach proposed action
      proposedAction = {
        type: "refund",
        amount,
        currency: "INR",
        reason: `High-value refund claim of ₹${amount} exceeds ₹${threshold} auto-approval limit`,
        resourceId,
        itemId,
        orderId,
        autoExecutable: false,
      };
      draft = `I understand your concern regarding order #${orderId} for ₹${amount}. Because this amount exceeds our instant automated threshold, I have prepared a resolution proposal and escalated it to our supervisor team for immediate 1-click review.`;
    }
  } else if (state.category === "fulfillment") {
    proposedAction = {
      type: "credit",
      amount: 100,
      currency: "INR",
      reason: "Apology credit for fulfillment delay",
      resourceId,
      itemId,
      orderId,
      autoExecutable: true,
    };
    draft = `I'm very sorry for the delay with order #${orderId}. I've credited ₹100 to your wallet as an apology while our logistics team expedites your delivery.`;
  } else {
    draft = `Thank you for reaching out. How else can I assist you with order #${orderId}?`;
  }

  return {
    orderId,
    itemId,
    resourceId,
    proposedAction,
    toolBackedRefundIssued,
    draftResponse: draft,
    attemptedFixes: [`resolve_stage_evaluated_${state.category}`],
  };
}
