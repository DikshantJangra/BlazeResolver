import {
  TriagedComplaint,
  ResolutionAction,
  ResolutionActionType,
  PolicyDecision,
  ApprovalStatus
} from '../types.js';
import { ResolverAdapters } from '../../adapters/contracts.js';
import { MoneyGate, ToolExecutionGuard, IdempotencyManager } from '../guardrails/index.js';

export class ResolutionEngine {
  private moneyGate: MoneyGate;
  private idempotencyManager: IdempotencyManager;
  private hitlQueue: ResolutionAction[] = [];
  private executionHistory: ResolutionAction[] = [];

  constructor(autoRefundThresholdINR: number = 300) {
    this.moneyGate = new MoneyGate(autoRefundThresholdINR);
    this.idempotencyManager = new IdempotencyManager();
  }

  public getHitlQueue(): ResolutionAction[] {
    return this.hitlQueue.filter(a => a.approvalStatus === 'pending_human');
  }

  public getExecutionHistory(): ResolutionAction[] {
    return [...this.executionHistory];
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

    // 2. Determine appropriate resolution action & amount
    let actionType: ResolutionActionType = 'create_ticket';
    let targetAmount: number | undefined;

    // Fetch order details if available
    let orderTotal = 0;
    if (triage.orderId) {
      const order = await adapters.orderSource.getOrder(triage.orderId);
      if (order) {
        orderTotal = order.totalAmount;
      }
    }

    if (triage.category === 'cold_food') {
      actionType = 'refund';
      targetAmount = triage.claimedAmount || (orderTotal > 0 ? orderTotal : 280);
    } else if (triage.category === 'missing_item' || triage.category === 'wrong_item') {
      actionType = 'refund';
      targetAmount = triage.claimedAmount || (orderTotal > 0 ? Math.min(orderTotal, 220) : 180);
    } else if (triage.category === 'spill_leak') {
      actionType = 'credit';
      targetAmount = triage.claimedAmount || (orderTotal > 0 ? Math.min(orderTotal, 200) : 150);
    } else if (triage.category === 'quality_issue') {
      actionType = 'refund';
      targetAmount = triage.claimedAmount || (orderTotal > 0 ? orderTotal : 350);
    } else if (triage.category === 'delivery_delay') {
      actionType = 'credit';
      targetAmount = 100; // Apology credit
    } else {
      actionType = 'create_ticket';
    }

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
      orderId: triage.orderId,
      customerId: triage.customerId,
      dishId: triage.dishId,
      branchId: triage.branchId,
      reason: `Automated policy resolution for ${triage.category.replace('_', ' ')} (${triage.intent})`,
      requiresApproval: false,
      approvalStatus: 'auto_approved',
      createdAt: new Date()
    };

    // 4. Validate through Tool Execution Guard
    const toolValidation = await ToolExecutionGuard.validateAction(proposedAction, triage, adapters);
    if (!toolValidation.valid) {
      proposedAction.approvalStatus = 'failed';
      proposedAction.reason = `Blocked by Tool Execution Guard: ${toolValidation.reason}`;
      return {
        policyDecision: {
          allowed: false,
          rationale: proposedAction.reason,
          recommendedAction: 'create_ticket',
          requiresHitl: false
        },
        actions: [proposedAction],
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
      const execResult = await this.executeAction(proposedAction, adapters);
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

  private async executeAction(action: ResolutionAction, adapters: ResolverAdapters): Promise<Record<string, unknown>> {
    switch (action.actionType) {
      case 'refund':
        const resolvedOrderId = action.orderId || 'ord-1021';
        if (!action.amount) throw new Error('Missing amount for refund');
        const refundReceipt = await adapters.refundGateway.issueRefund(
          resolvedOrderId,
          action.amount,
          action.idempotencyKey
        );
        return refundReceipt as unknown as Record<string, unknown>;

      case 'credit':
        const resolvedCustomerId = action.customerId || 'cust_registered_user';
        if (!action.amount) throw new Error('Missing amount for credit');
        const creditReceipt = await adapters.refundGateway.issueCredit(
          resolvedCustomerId,
          action.amount,
          action.idempotencyKey
        );
        return creditReceipt as unknown as Record<string, unknown>;

      case 'disable_dish':
        if (!action.dishId || !action.branchId) throw new Error('Missing dishId or branchId');
        await adapters.menuControl.disableDish(action.dishId, action.branchId, action.reason);
        return { dishDisabled: true, dishId: action.dishId, branchId: action.branchId };

      default:
        return { status: 'acknowledged', actionType: action.actionType };
    }
  }
}
