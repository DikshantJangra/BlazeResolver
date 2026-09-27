import { z } from "zod";
import type { SupportStateType, Urgency, Sentiment } from "./state.js";
import { checkGuardrails } from "../guardrails/policies.js";

export const TriageSchema = z.object({
  intent: z.string().describe("Short label for what the customer wants, e.g. 'order_status', 'refund_request'"),
  category: z
    .enum(["knowledge_base", "order_billing", "troubleshooting", "escalation", "quality_issue", "fulfillment"])
    .describe("Category of the customer's issue"),
  urgency: z.enum(["low", "medium", "high", "critical"]),
  sentiment: z.enum(["positive", "neutral", "negative", "angry"]),
  extractedEntities: z
    .object({
      orderId: z.string().optional(),
      itemId: z.string().optional(),
      resourceId: z.string().optional(),
      amount: z.number().optional(),
    })
    .optional(),
});

export type TriageResult = z.infer<typeof TriageSchema>;

/**
 * Deterministic classifier fallback when no external LLM API is available or for high-speed offline operations.
 */
export function classifyMessageDeterministically(message: string): TriageResult {
  const text = message.toLowerCase();

  // Extract common ID patterns preserving original case
  const orderMatch = message.match(/(?:order\s*#?|#)([a-zA-Z0-9_-]{3,})/i);
  const resourceMatch = message.match(/(?:branch|location|resource|facility|store)\s*[:#]?\s*([a-zA-Z0-9_-]+)/i);
  const itemMatch = message.match(/(?:item|product|dish|sku)\s*[:#]?\s*([a-zA-Z0-9_-]+)/i);
  const amountMatch = message.match(/(?:₹|\$|inr|usd)\s*(\d+(?:\.\d{1,2})?)/i) || message.match(/(\d+(?:\.\d{1,2})?)\s*(?:rupees|dollars|rs)/i);

  let category: TriageResult["category"] = "order_billing";
  let intent = "general_inquiry";
  let urgency: Urgency = "low";
  let sentiment: Sentiment = "neutral";

  // Sentiment
  if (text.includes("angry") || text.includes("ridiculous") || text.includes("worst") || text.includes("unacceptable") || text.includes("sue") || text.includes("scam")) {
    sentiment = "angry";
    urgency = "high";
  } else if (text.includes("bad") || text.includes("disappointed") || text.includes("waste") || text.includes("annoyed") || text.includes("hate")) {
    sentiment = "negative";
    urgency = "medium";
  } else if (text.includes("thank") || text.includes("great") || text.includes("good") || text.includes("loved")) {
    sentiment = "positive";
  }

  // Category & Intent: Prioritize high-fidelity operational issues first
  if (text.includes("speak to human") || text.includes("representative") || text.includes("agent") || text.includes("lawyer") || text.includes("manager")) {
    category = "escalation";
    intent = "request_human_escalation";
    urgency = "critical";
  } else if (text.includes("broken") || text.includes("cold") || text.includes("damaged") || text.includes("spill") || text.includes("rotten") || text.includes("stale") || text.includes("defective")) {
    category = "quality_issue";
    intent = "report_item_quality_defect";
    urgency = "high";
  } else if (text.includes("refund") || text.includes("charge") || text.includes("bill") || text.includes("paid") || text.includes("invoice")) {
    category = "order_billing";
    intent = "refund_or_billing_dispute";
    if (urgency === "low") urgency = "medium";
  } else if (text.includes("broken") || text.includes("cold") || text.includes("damaged") || text.includes("spill") || text.includes("rotten") || text.includes("stale") || text.includes("defective")) {
    category = "quality_issue";
    intent = "report_item_quality_defect";
    urgency = "high";
  } else if (text.includes("missing") || text.includes("late") || text.includes("delayed") || text.includes("where is")) {
    category = "fulfillment";
    intent = "track_or_missing_fulfillment";
    if (urgency === "low") urgency = "medium";
  } else if (text.includes("how do i") || text.includes("what is") || text.includes("policy") || text.includes("hours")) {
    category = "knowledge_base";
    intent = "policy_or_faq_query";
  }

  return {
    intent,
    category,
    urgency,
    sentiment,
    extractedEntities: {
      orderId: orderMatch ? orderMatch[1] : undefined,
      resourceId: resourceMatch ? resourceMatch[1] : undefined,
      itemId: itemMatch ? itemMatch[1] : undefined,
      amount: amountMatch ? parseFloat(amountMatch[1]) : undefined,
    },
  };
}

/**
 * TRIAGE stage — intent, category, urgency, sentiment classifier.
 * Always the entry node in the LangGraph support agent harness.
 */
export async function triageNode(state: SupportStateType): Promise<Partial<SupportStateType>> {
  // 1. Prompt Injection Security Guardrail check
  const guard = checkGuardrails({
    category: "general",
    draftResponse: "",
    userMessage: state.customerMessage,
  });

  if (guard.flags.includes("prompt_injection_detected")) {
    return {
      intent: "adversarial_prompt_injection",
      category: "escalation",
      urgency: "critical",
      sentiment: "neutral",
      isPromptInjection: true,
      draftResponse: "I am unable to process this request due to security and policy restrictions.",
      needsEscalation: false,
    };
  }

  // 2. Classify intent, category, urgency, sentiment
  // In production, invoke chatModel().withStructuredOutput(TriageSchema) when OPENAI_API_KEY is present
  const result = classifyMessageDeterministically(state.customerMessage);

  return {
    intent: result.intent,
    category: result.category,
    urgency: result.urgency,
    sentiment: result.sentiment,
    orderId: state.orderId || result.extractedEntities?.orderId || null,
    resourceId: state.resourceId || result.extractedEntities?.resourceId || null,
    itemId: state.itemId || result.extractedEntities?.itemId || null,
    isPromptInjection: false,
  };
}
