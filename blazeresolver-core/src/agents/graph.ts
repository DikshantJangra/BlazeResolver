import { StateGraph, START, END } from "@langchain/langgraph";
import { SupportState, SupportStateType } from "./state.js";
import { triageNode } from "./triage.js";
import { resolveNode } from "./resolve.js";
import { escalationNode } from "./escalation.js";
import { qualityReviewNode } from "./qualityReview.js";

/**
 * Creates the complete LangGraph StateGraph harness for BlazeResolver.
 * Sequential pipeline with policy & money-gate checks:
 * START -> triageNode -> resolveNode -> escalationNode -> qualityReviewNode -> END
 */
export function buildSupportGraph() {
  const workflow = new StateGraph(SupportState)
    .addNode("triage", triageNode)
    .addNode("resolve", resolveNode)
    .addNode("escalation", escalationNode)
    .addNode("quality_review", qualityReviewNode)
    .addEdge(START, "triage")
    .addEdge("triage", "resolve")
    .addEdge("resolve", "escalation")
    .addEdge("escalation", "quality_review")
    .addEdge("quality_review", END);

  return workflow.compile();
}

/**
 * Executes the compiled LangGraph pipeline on an incoming customer message.
 */
export async function runSupportGraph(input: {
  customerMessage: string;
  conversationId?: string | null;
  customerId?: string | null;
  orderId?: string | null;
  resourceId?: string | null;
  itemId?: string | null;
}): Promise<SupportStateType> {
  const graph = buildSupportGraph();
  const initialState = {
    customerMessage: input.customerMessage,
    conversationId: input.conversationId ?? `conv_${Date.now()}`,
    customerId: input.customerId ?? "cust_guest",
    orderId: input.orderId ?? null,
    resourceId: input.resourceId ?? null,
    itemId: input.itemId ?? null,
  };

  const result = await graph.invoke(initialState);
  return result as SupportStateType;
}
