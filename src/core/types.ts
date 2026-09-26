export type ChannelType = 'text' | 'voice' | 'webhook' | 'email';

export interface CustomerInput {
  id: string;
  channel: ChannelType;
  rawText: string;
  customerId?: string;
  orderId?: string;
  /** Location or operational unit the complaint concerns (store, warehouse, region). */
  resourceId?: string;
  itemId?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/** A category ID from the active DomainProfile, or one of the built-ins in domain.ts. */
export type TriageCategory = string;

export type TriageSeverity = 'low' | 'medium' | 'high' | 'critical';
export type TriageSentiment = 'positive' | 'neutral' | 'frustrated' | 'furious';

export interface TriagedComplaint {
  id: string;
  input: CustomerInput;
  intent: string;
  category: TriageCategory;
  severity: TriageSeverity;
  sentiment: TriageSentiment;
  itemId?: string;
  itemName?: string;
  resourceId?: string;
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

/** An operational metric compared with its baseline, e.g. prep time, dispatch delay, error rate. */
export interface SignalSummary {
  metric: string;
  label: string;
  unit: string;
  average: number;
  baseline: number;
  ratio: number;
}

export interface CorrelateCluster {
  clusterKey: string;
  resourceId: string;
  category: TriageCategory;
  itemId?: string;
  itemName?: string;
  complaintIds: string[];
  count: number;
  signal?: SignalSummary;
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
  resourceId: string;
  category: TriageCategory;
  itemId?: string;
  itemName?: string;
  ticketIds: string[];
  complaintCount: number;
  signal?: SignalSummary;
  status: 'investigating' | 'action_taken' | 'resolved';
  recommendedAction: string;
  managerNotified: boolean;
  itemDisabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ResolutionActionType =
  | 'refund'
  | 'credit'
  | 're_deliver'
  | 'disable_item'
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
  currency?: string;
  orderId?: string;
  customerId?: string;
  itemId?: string;
  resourceId?: string;
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
