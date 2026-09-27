import { Annotation } from "@langchain/langgraph";

export type Sentiment = "positive" | "neutral" | "negative" | "angry";
export type Urgency = "low" | "medium" | "high" | "critical";
export type CustomerTier = "standard" | "vip" | "enterprise";

export interface Citation {
  id: string;
  source: string;
  content: string;
}

export interface ProposedAction {
  type: "refund" | "credit" | "replace_item" | "create_ticket" | "escalate_hitl";
  amount?: number;
  currency?: string;
  reason: string;
  resourceId?: string; // Generic: resourceId not branchId
  itemId?: string;     // Generic: item not dish
  orderId?: string;
  autoExecutable: boolean;
}

/**
 * Shared state threaded through every node in the BlazeResolver LangGraph agent pipeline.
 * Each field is modified deterministically by the node responsible for it, ensuring
 * complete auditability and compatibility with any BYO-Agent runner.
 */
export const SupportState = Annotation.Root({
  // Customer input context
  customerMessage: Annotation<string>(),
  conversationId: Annotation<string | null>({ reducer: (_, u) => u, default: () => null }),
  customerId: Annotation<string | null>({ reducer: (_, u) => u, default: () => null }),
  customerTier: Annotation<CustomerTier>({
    reducer: (_, update) => update,
    default: () => "standard" as CustomerTier,
  }),
  conversationHistory: Annotation<string[]>({ reducer: (_, u) => u, default: () => [] }),

  // Generic entity references (item not dish, resourceId not branchId)
  orderId: Annotation<string | null>({ reducer: (_, u) => u, default: () => null }),
  resourceId: Annotation<string | null>({ reducer: (_, u) => u, default: () => null }),
  itemId: Annotation<string | null>({ reducer: (_, u) => u, default: () => null }),

  // Set by TRIAGE stage
  intent: Annotation<string>({ reducer: (_, u) => u, default: () => "" }),
  category: Annotation<string>({ reducer: (_, u) => u, default: () => "general" }),
  urgency: Annotation<Urgency>({ reducer: (_, u) => u, default: () => "low" as Urgency }),
  sentiment: Annotation<Sentiment>({ reducer: (_, u) => u, default: () => "neutral" as Sentiment }),
  isPromptInjection: Annotation<boolean>({ reducer: (_, u) => u, default: () => false }),

  // Set by RESOLVE stage (specialist tool-calling)
  attemptedFixes: Annotation<string[]>({
    reducer: (curr, u) => [...curr, ...u],
    default: () => [],
  }),
  citations: Annotation<Citation[]>({ reducer: (_, u) => u, default: () => [] }),
  draftResponse: Annotation<string>({ reducer: (_, u) => u, default: () => "" }),
  clarifyingQuestion: Annotation<string | null>({ reducer: (_, u) => u, default: () => null }),
  toolBackedRefundIssued: Annotation<boolean>({ reducer: (_, u) => u, default: () => false }),
  proposedAction: Annotation<ProposedAction | null>({ reducer: (_, u) => u, default: () => null }),

  // Set by ESCALATION stage (Resolvd pattern: auto-resolve under threshold, escalate with proposed action attached)
  needsEscalation: Annotation<boolean>({ reducer: (_, u) => u, default: () => false }),
  escalationSummary: Annotation<string | null>({ reducer: (_, u) => u, default: () => null }),
  ticketId: Annotation<string | null>({ reducer: (_, u) => u, default: () => null }),

  // Set by RESPOND / QUALITY REVIEW stage
  qualityFlags: Annotation<string[]>({ reducer: (_, u) => u, default: () => [] }),
  qualityRetryCount: Annotation<number>({ reducer: (_, u) => u, default: () => 0 }),
  finalResponse: Annotation<string>({ reducer: (_, u) => u, default: () => "" }),
});

export type SupportStateType = typeof SupportState.State;
