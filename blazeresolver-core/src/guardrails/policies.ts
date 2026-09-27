export type IssueCategory =
  | "knowledge_base"
  | "order_billing"
  | "troubleshooting"
  | "escalation"
  | "quality_issue"
  | "fulfillment"
  | "general";

export interface GuardrailContext {
  category: string;
  draftResponse: string;
  hasCitations?: boolean;
  toolBackedRefundIssued?: boolean;
  userMessage?: string;
}

export interface GuardrailResult {
  passed: boolean;
  flags: string[];
  reasons: string[];
}

const REFUND_PROMISE_PATTERNS = [
  /\bwill (be )?refund(ed)?\b/i,
  /\byou('ll| will) (get|receive) (a |your )?refund\b/i,
  /\brefund(ed)? within \d+/i,
  /\b(\$|₹|INR|USD)\s?\d+(\.\d{2})?\s*(will be|has been|is being)?\s*refunded/i,
  /\bcredited back\b/i,
];

const LEGAL_ADVICE_PATTERNS = [
  /\byou should (sue|file a lawsuit|take legal action)\b/i,
  /\bthis (violates|breaks) the law\b/i,
  /\bconsult(ing)? (a |with )?lawyer\b.*\b(unnecessary|don't need)\b/i,
  /\bI('m| am) (your|acting as a) (lawyer|attorney)\b/i,
];

const POLICY_CLAIM_PATTERNS = [
  /\bour policy (is|states|allows)\b/i,
  /\bwithin \d+ days?\b/i,
  /\byou are (entitled|eligible) to\b/i,
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s+prompt/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /override\s+(all\s+)?security/i,
  /disregard\s+the\s+above/i,
  /leak\s+(the\s+)?api\s+key/i,
  /grant\s+admin\s+privilege/i,
  /refund\s+(all|every|maximum|unlimited)/i,
];

/**
 * Deterministic guardrail checks run before a draft response is sent to the customer
 * or when an inbound message is evaluated.
 * Enforces:
 * - Anti-hallucination of refund promises (must be tool-backed)
 * - Anti-legal advice liability
 * - Uncited policy claim restrictions
 * - Prompt injection interception
 */
export function checkGuardrails(ctx: GuardrailContext): GuardrailResult {
  const flags: string[] = [];
  const reasons: string[] = [];

  // 1. Check prompt injection in user message if provided
  if (ctx.userMessage) {
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(ctx.userMessage)) {
        flags.push("prompt_injection_detected");
        reasons.push("Prompt injection attempt intercepted by security policy.");
        break;
      }
    }
  }

  // 2. Unsupported refund promises
  const promisesRefund = REFUND_PROMISE_PATTERNS.some((p) => p.test(ctx.draftResponse));
  if (promisesRefund && !ctx.toolBackedRefundIssued) {
    flags.push("unsupported_refund_promise");
    reasons.push("Draft promises a financial refund that has not been approved/executed by an authorized tool call.");
  }

  // 3. Legal advice prevention
  if (LEGAL_ADVICE_PATTERNS.some((p) => p.test(ctx.draftResponse))) {
    flags.push("legal_advice_detected");
    reasons.push("Draft contains prohibited legal counsel or speculation.");
  }

  // 4. Uncited policy claims
  const makesPolicyClaim = POLICY_CLAIM_PATTERNS.some((p) => p.test(ctx.draftResponse));
  if (ctx.category === "knowledge_base" && makesPolicyClaim && !ctx.hasCitations) {
    flags.push("uncited_policy_claim");
    reasons.push("Draft asserts company policy without verifiable citations.");
  }

  return {
    passed: flags.length === 0,
    flags,
    reasons,
  };
}
