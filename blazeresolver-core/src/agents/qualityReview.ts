import type { SupportStateType } from "./state.js";
import { checkGuardrails } from "../guardrails/policies.js";

/**
 * RESPOND stage: Quality review, deterministic policy guardrail enforcement, and tone pass.
 * Prevents hallucinations, unauthorized financial commitments, and legal liabilities.
 */
export async function qualityReviewNode(state: SupportStateType): Promise<Partial<SupportStateType>> {
  const currentDraft = state.draftResponse || "Thank you for contacting customer support. How may I assist you further?";

  // 1. Guardrail policy evaluation
  const guardrailResult = checkGuardrails({
    category: state.category,
    draftResponse: currentDraft,
    hasCitations: state.citations.length > 0,
    toolBackedRefundIssued: state.toolBackedRefundIssued || (state.proposedAction?.autoExecutable === true),
    userMessage: state.customerMessage,
  });

  // 2. Passed guardrail check
  if (guardrailResult.passed) {
    return {
      finalResponse: currentDraft,
      qualityFlags: [],
    };
  }

  // 3. Guardrail violation handling
  if (state.qualityRetryCount >= 1) {
    // Fallback if repeat violation
    return {
      finalResponse:
        "Thank you for your patience. I want to ensure you receive completely accurate details, so I have routed this case to our specialized support team who will assist you promptly.",
      qualityFlags: guardrailResult.flags,
      qualityRetryCount: state.qualityRetryCount + 1,
    };
  }

  // First violation: sanitize draft deterministically to remove unsupported claims
  let sanitized = currentDraft;
  if (guardrailResult.flags.includes("unsupported_refund_promise")) {
    sanitized = sanitized.replace(
      /\b(will be refunded|you'll get a refund|refunded within \d+|has been refunded)\b/gi,
      "is currently being reviewed for potential resolution"
    );
  }
  if (guardrailResult.flags.includes("legal_advice_detected")) {
    sanitized = "I cannot provide legal guidance. Our customer advocacy team is here to assist with your order details.";
  }

  return {
    draftResponse: sanitized,
    finalResponse: sanitized,
    qualityFlags: guardrailResult.flags,
    qualityRetryCount: state.qualityRetryCount + 1,
  };
}
