export type ChannelType = 'text' | 'voice' | 'webhook' | 'email';

export interface CustomerInput {
  id: string;
  channel: ChannelType;
  rawText: string;
  customerId?: string;
  orderId?: string;
  branchId?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export type TriageCategory =
  | 'cold_food'
  | 'missing_item'
  | 'wrong_item'
  | 'delivery_delay'
  | 'quality_issue'
  | 'spill_leak'
  | 'pricing_billing'
  | 'general_inquiry'
  | 'prompt_injection';

export type TriageSeverity = 'low' | 'medium' | 'high' | 'critical';
export type TriageSentiment = 'positive' | 'neutral' | 'frustrated' | 'furious';

export interface TriagedComplaint {
  id: string;
  input: CustomerInput;
  intent: string;
  category: TriageCategory;
  severity: TriageSeverity;
  sentiment: TriageSentiment;
  dish?: string;
  dishId?: string;
  branchId?: string;
  orderId?: string;
  customerId?: string;
  claimedAmount?: number;
  urgencyScore: number; // 0.0 to 1.0
  isPromptInjection: boolean;
  guardrailPassed: boolean;
  guardrailViolationReason?: string;
  incidentLinked: boolean;
  timestamp: Date;
}

export interface CorrelateCluster {
  clusterKey: string;
  branchId: string;
  category: TriageCategory;
  dishId?: string;
  dishName?: string;
  complaintIds: string[];
  count: number;
  avgKitchenPrepMinutes: number;
  baselinePrepMinutes: number;
  isAnomalous: boolean;
  rootCauseHypothesis?: string;
  incidentId?: string;
  firstSeen: Date;
  lastSeen: Date;
}

export interface CorrelatedIncident {
  incidentId: string;
  title: string;
  summary: string;
  branchId: string;
  category: TriageCategory;
  dishId?: string;
  dishName?: string;
  ticketIds: string[];
  complaintCount: number;
  avgTicketTimeMinutes: number;
  baselineTimeMinutes: number;
  delayRatio: number;
  status: 'investigating' | 'action_taken' | 'resolved';
  recommendedAction: string;
  managerNotified: boolean;
  dishDisabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ResolutionActionType =
  | 'refund'
  | 'credit'
  | 're_deliver'
  | 'disable_dish'
  | 'create_ticket'
  | 'route_to_manager'
  | 'escalate_hitl'
  | 'apology_only'
  | 'reject_adversarial';

export type ApprovalStatus =
  | 'auto_approved'
  | 'pending_human'
  | 'human_approved'
  | 'human_rejected'
  | 'executed'
  | 'failed';

export interface ResolutionAction {
  id: string;
  complaintId: string;
  actionType: ResolutionActionType;
  idempotencyKey: string;
  amount?: number;
  orderId?: string;
  customerId?: string;
  dishId?: string;
  branchId?: string;
  reason: string;
  requiresApproval: boolean;
  approvalStatus: ApprovalStatus;
  executionResult?: Record<string, unknown>;
  executedAt?: Date;
  createdAt: Date;
}

export interface PolicyDecision {
  allowed: boolean;
  rationale: string;
  recommendedAction: ResolutionActionType;
  suggestedAmount?: number;
  requiresHitl: boolean;
  hitlReason?: string;
}

export interface ResponseDraft {
  text: string;
  channel: ChannelType;
  tone: 'empathetic' | 'professional' | 'urgent' | 'firm';
  containsRefundConfirmation: boolean;
  containsApology: boolean;
  qualityPassed: boolean;
  qualityReviewNotes?: string;
}

export interface PipelineResult {
  complaintId: string;
  input: CustomerInput;
  triage: TriagedComplaint;
  correlation: {
    isSystemic: boolean;
    cluster?: CorrelateCluster;
    incident?: CorrelatedIncident;
  };
  resolution: {
    policyDecision: PolicyDecision;
    actions: ResolutionAction[];
    hitlRequired: boolean;
  };
  response: ResponseDraft;
  executionDurationMs: number;
  timestamp: Date;
}
