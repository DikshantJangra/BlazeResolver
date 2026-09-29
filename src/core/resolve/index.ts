import {
  TriagedComplaint,
  ResolutionAction,
  ResolutionActionType,
  PolicyDecision
} from '../types.js';
import { ResolverAdapters } from '../../adapters/contracts.js';
import { MoneyGate, ToolExecutionGuard, IdempotencyManager, ToolExecutionLimits } from '../guardrails/index.js';
import { CategoryPolicy, DomainProfile, findCategory } from '../domain.js';

export interface ResolutionEngineOptions {
  autoApproveThreshold: number;
  maxCreditAmount: number;
}

export class ResolutionEngine {
  private moneyGate: MoneyGate;
  private limits: ToolExecutionLimits;
  private idempotencyManager: IdempotencyManager;
  private hitlQueue: ResolutionAction[] = [];
  private executionHistory: ResolutionAction[] = [];

  constructor(
    private profile: DomainProfile,
    options: ResolutionEngineOptions
  ) {
    this.moneyGate = new MoneyGate(options.autoApproveThreshold, profile.currency);
    this.limits = { maxCreditAmount: options.maxCreditAmount, currency: profile.currency };
    this.idempotencyManager = new IdempotencyManager();
  }

  public getAutoApproveThreshold(): number {
    return this.moneyGate.getThreshold();
  }

  public getHitlQueue(): ResolutionAction[] {
    return this.hitlQueue.filter(a => a.approvalStatus === 'pending_human');
  }

  public getExecutionHistory(): ResolutionAction[] {
    return [...this.executionHistory];
  }

  /** Puts an action proposed outside the pipeline (e.g. by the voice agent) in the supervisor queue. */
  public queueForHumanApproval(action: ResolutionAction): void {
    action.requiresApproval = true;
    action.approvalStatus = 'pending_human';
    this.hitlQueue.unshift(action);
    this.executionHistory.push(action);
  }

  public async resolve(
    triage: TriagedComplaint,
    adapters: ResolverAdapters,
    customerPastComplaintsCount: number = 0
  ): Promise<{
    policyDecision: PolicyDecision;
    actions: ResolutionAction[];
    hitlRequired: boolean;
  }> {
    // 1. Guardrail / Adversarial rejection
    if (triage.isPromptInjection) {
      const decision: PolicyDecision = {
        allowed: false,
        rationale: 'Rejected due to security guardrail violation (prompt injection attempt).',
        recommendedAction: 'reject_adversarial',
        requiresHitl: false
      };

      const action: ResolutionAction = {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        complaintId: triage.id,
        actionType: 'reject_adversarial',
        idempotencyKey: `idem_reject_${triage.id}`,
        reason: 'Adversarial input blocked by security policy',
        requiresApproval: false,
        approvalStatus: 'executed',
        executedAt: new Date(),
        createdAt: new Date()
      };

      this.executionHistory.push(action);
      return { policyDecision: decision, actions: [action], hitlRequired: false };
    }

    // 2. Determine the action and amount from the category's policy in the domain profile
    let orderTotal = 0;
    if (triage.orderId) {
      const order = await adapters.orderSource.getOrder(triage.orderId);
      if (order) {
        orderTotal = order.totalAmount;
      }
    }

    const policy: CategoryPolicy = findCategory(this.profile, triage.category)?.policy ?? { action: 'create_ticket' };
    const actionType: ResolutionActionType = policy.action;
    const targetAmount = this.proposeAmount(policy, triage.claimedAmount, orderTotal);

    // 3. Create proposed action with stable idempotency key
    const idempotencyKey = `idem_${actionType}_${triage.orderId || triage.customerId || triage.id}_${targetAmount || 0}`;

    // Check if duplicate request was already processed
    if (this.idempotencyManager.has(idempotencyKey)) {
      const existingReceipt = this.idempotencyManager.getReceipt(idempotencyKey);
      const existingAction: ResolutionAction = {
        id: `act_dup_${Date.now()}`,
        complaintId: triage.id,
        actionType,
        idempotencyKey,
        amount: targetAmount,
        currency: this.profile.currency.code,
        orderId: triage.orderId,
        customerId: triage.customerId,
        reason: 'Duplicate request detected — returned existing idempotency receipt',
        requiresApproval: false,
        approvalStatus: 'executed',
        executionResult: { ...((existingReceipt as object) || {}), isDuplicate: true },
        executedAt: new Date(),
        createdAt: new Date()
      };
      return {
        policyDecision: {
          allowed: true,
          rationale: 'Idempotency key match: Request already processed previously.',
          recommendedAction: actionType,
          suggestedAmount: targetAmount,
          requiresHitl: false
        },
        actions: [existingAction],
        hitlRequired: false
      };
    }

    const proposedAction: ResolutionAction = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      complaintId: triage.id,
      actionType,
      idempotencyKey,
      amount: targetAmount,
      currency: this.profile.currency.code,
      orderId: triage.orderId,
      customerId: triage.customerId,
      itemId: triage.itemId,
      resourceId: triage.resourceId,
      reason: `Automated policy resolution for ${triage.category.replace(/_/g, ' ')} (${triage.intent})`,
      requiresApproval: false,
      approvalStatus: 'auto_approved',
      createdAt: new Date()
    };

    // 4. Validate through Tool Execution Guard
    const toolValidation = await ToolExecutionGuard.validateAction(proposedAction, triage, adapters, this.limits);
    if (!toolValidation.valid) {
      proposedAction.approvalStatus = 'failed';
      proposedAction.reason = `Blocked by Tool Execution Guard: ${toolValidation.reason}`;
      this.executionHistory.push(proposedAction);
      // No money moves, but the claim must not be dropped: a person follows up through a support ticket.
      const followUp = await this.openFollowUpTicket(triage, adapters, proposedAction);
      return {
        policyDecision: {
          allowed: false,
          rationale: proposedAction.reason,
          recommendedAction: 'create_ticket',
          requiresHitl: false
        },
        actions: [proposedAction, followUp],
        hitlRequired: false
      };
    }

    // 5. Evaluate through Money Gate
    const policyDecision = this.moneyGate.evaluate(proposedAction, triage, customerPastComplaintsCount);

    if (policyDecision.requiresHitl) {
      proposedAction.requiresApproval = true;
      proposedAction.approvalStatus = 'pending_human';
      this.hitlQueue.push(proposedAction);
      this.executionHistory.push(proposedAction);

      return {
        policyDecision,
        actions: [proposedAction],
        hitlRequired: true
      };
    }

    // 6. Execute Deterministic Mutation via Adapter
    try {
      const execResult = await this.executeAction(proposedAction, adapters, triage);
      proposedAction.approvalStatus = 'executed';
      proposedAction.executedAt = new Date();
      proposedAction.executionResult = execResult;
      this.idempotencyManager.saveReceipt(idempotencyKey, execResult);
      this.executionHistory.push(proposedAction);
    } catch (err: unknown) {
      proposedAction.approvalStatus = 'failed';
      proposedAction.reason = `Adapter execution error: ${err instanceof Error ? err.message : String(err)}`;
      this.executionHistory.push(proposedAction);
    }

    return {
      policyDecision,
      actions: [proposedAction],
      hitlRequired: false
    };
  }

  public async approveHitlAction(
    actionId: string,
    adapters: ResolverAdapters,
    approvedBy: string = 'Supervisor'
  ): Promise<ResolutionAction | null> {
    const action = this.hitlQueue.find(a => a.id === actionId);
    if (!action || action.approvalStatus !== 'pending_human') {
      return null;
    }

    action.approvalStatus = 'human_approved';
    try {
      const result = await this.executeAction(action, adapters);
      action.approvalStatus = 'executed';
      action.executedAt = new Date();
      action.executionResult = { ...result, approvedBy };
      this.idempotencyManager.saveReceipt(action.idempotencyKey, result);
    } catch (err: unknown) {
      action.approvalStatus = 'failed';
      action.reason = `Adapter execution error post-approval: ${err instanceof Error ? err.message : String(err)}`;
    }

    return action;
  }

  public async rejectHitlAction(
    actionId: string,
    reason: string = 'Supervisor rejected claim',
    rejectedBy: string = 'Supervisor'
  ): Promise<ResolutionAction | null> {
    const action = this.hitlQueue.find(a => a.id === actionId);
    if (!action || action.approvalStatus !== 'pending_human') {
      return null;
    }

    action.approvalStatus = 'human_rejected';
    action.reason = reason;
    action.executionResult = { rejectedBy, rejectedAt: new Date() };
    return action;
  }

  private proposeAmount(policy: CategoryPolicy, claimedAmount: number | undefined, orderTotal: number): number | undefined {
    if (policy.action === 'create_ticket') return undefined;
    if (policy.fixedAmount !== undefined) return policy.fixedAmount;
    if (claimedAmount) return claimedAmount;
    if (policy.useOrderTotal && orderTotal > 0) {
      return policy.maxAmount !== undefined ? Math.min(orderTotal, policy.maxAmount) : orderTotal;
    }
    return policy.defaultAmount;
  }

  /** Opens a support ticket for a claim the guard blocked; a repeat of the same claim reuses the ticket. */
  private async openFollowUpTicket(
    triage: TriagedComplaint,
    adapters: ResolverAdapters,
    blocked: ResolutionAction
  ): Promise<ResolutionAction> {
    const followUp: ResolutionAction = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      complaintId: triage.id,
      actionType: 'create_ticket',
      idempotencyKey: `${blocked.idempotencyKey}_follow_up_ticket`,
      currency: this.profile.currency.code,
      orderId: triage.orderId,
      customerId: triage.customerId,
      resourceId: triage.resourceId,
      reason: `Support follow-up: ${blocked.reason}`,
      requiresApproval: false,
      approvalStatus: 'auto_approved',
      createdAt: new Date()
    };

    try {
      const existing = this.idempotencyManager.has(followUp.idempotencyKey)
        ? this.idempotencyManager.getReceipt(followUp.idempotencyKey)
        : undefined;
      const result = (existing as Record<string, unknown> | undefined) ?? (await this.executeAction(followUp, adapters, triage));
      this.idempotencyManager.saveReceipt(followUp.idempotencyKey, result);
      followUp.approvalStatus = 'executed';
      followUp.executedAt = new Date();
      followUp.executionResult = result;
    } catch (err: unknown) {
      followUp.approvalStatus = 'failed';
      followUp.reason = `Could not open a support ticket: ${err instanceof Error ? err.message : String(err)}`;
    }
    this.executionHistory.push(followUp);
    return followUp;
  }

  private async executeAction(
    action: ResolutionAction,
    adapters: ResolverAdapters,
    triage?: TriagedComplaint
  ): Promise<Record<string, unknown>> {
    switch (action.actionType) {
      case 'refund': {
        if (!adapters.refundGateway) throw new Error('No refund gateway configured for this business');
        if (!action.orderId) throw new Error('Missing orderId for refund');
        if (!action.amount) throw new Error('Missing amount for refund');
        const refundReceipt = await adapters.refundGateway.issueRefund(action.orderId, action.amount, action.idempotencyKey);
        return refundReceipt as unknown as Record<string, unknown>;
      }

      case 'credit': {
        if (!adapters.refundGateway) throw new Error('No refund gateway configured for this business');
        if (!action.customerId) throw new Error('Missing customerId for credit');
        if (!action.amount) throw new Error('Missing amount for credit');
        const creditReceipt = await adapters.refundGateway.issueCredit(action.customerId, action.amount, action.idempotencyKey);
        return creditReceipt as unknown as Record<string, unknown>;
      }

      case 'disable_item': {
        if (!action.itemId || !action.resourceId) throw new Error('Missing itemId or resourceId');
        if (!adapters.availabilityControl) throw new Error('No AvailabilityControl adapter configured');
        await adapters.availabilityControl.disableItem(action.itemId, action.resourceId, action.reason);
        return { itemDisabled: true, itemId: action.itemId, resourceId: action.resourceId };
      }

      case 'create_ticket': {
        if (!triage) throw new Error('Missing complaint for ticket');
        const ticket = await adapters.ticketSink.createTicket(triage);
        return { ticketId: ticket.id, ticketStatus: ticket.status };
      }

      default:
        return { status: 'acknowledged', actionType: action.actionType };
    }
  }
}
