import { CustomerInput, TriagedComplaint, ResolutionAction, PolicyDecision } from '../types.js';
import { ResolverAdapters } from '../../adapters/contracts.js';

export interface GuardrailCheckResult {
  passed: boolean;
  reason?: string;
  sanitizedInput?: string;
  threatLevel: 'none' | 'low' | 'high' | 'critical';
}

export class PromptInjectionGuard {
  private static injectionPatterns: RegExp[] = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
    /system\s+prompt/i,
    /you\s+are\s+now\s+(in\s+developer\s+mode|dan|unrestricted|god\s+mode)/i,
    /override\s+policy/i,
    /disregard\s+rules/i,
    /bypass\s+(guardrails|limits|verification)/i,
    /give\s+me\s+a\s+refund\s+of\s+₹?\s*(10000|50000|999999)/i,
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /drop\s+table/i,
    /union\s+select/i,
    /grant\s+admin/i
  ];

  public static inspect(input: CustomerInput): GuardrailCheckResult {
    const text = input.rawText;
    for (const pattern of this.injectionPatterns) {
      if (pattern.test(text)) {
        return {
          passed: false,
          reason: `Adversarial prompt injection pattern detected: "${pattern.source}"`,
          threatLevel: 'high',
          sanitizedInput: text.replace(/<[^>]*>?/gm, '')
        };
      }
    }

    return {
      passed: true,
      threatLevel: 'none',
      sanitizedInput: text.trim()
    };
  }
}

export class ToolExecutionGuard {
  public static async validateAction(
    action: ResolutionAction,
    triage: TriagedComplaint,
    adapters: ResolverAdapters
  ): Promise<{ valid: boolean; reason?: string }> {
    // 1. Prompt injections can never execute financial mutations
    if (triage.isPromptInjection && (action.actionType === 'refund' || action.actionType === 'credit')) {
      return {
        valid: false,
        reason: 'Financial mutation strictly forbidden on adversarial/injected inputs'
      };
    }

    // 2. Financial bounds check
    if (action.actionType === 'refund') {
      if (!action.orderId) {
        return { valid: false, reason: 'Refund action requires a valid orderId' };
      }
      if (!action.amount || action.amount <= 0) {
        return { valid: false, reason: 'Refund amount must be greater than zero' };
      }

      // Check against real order from OrderSource
      const order = await adapters.orderSource.getOrder(action.orderId);
      if (!order) {
        return { valid: false, reason: `Order ${action.orderId} not found in OrderSource` };
      }
      if (action.amount > order.totalAmount) {
        return {
          valid: false,
          reason: `Refund amount ₹${action.amount} exceeds order total ₹${order.totalAmount}`
        };
      }
    }

    if (action.actionType === 'credit') {
      if (!action.customerId) {
        return { valid: false, reason: 'Credit action requires a valid customerId' };
      }
      if (!action.amount || action.amount <= 0) {
        return { valid: false, reason: 'Credit amount must be greater than zero' };
      }
      if (action.amount > 1000) {
        return { valid: false, reason: 'Wallet credit exceeds safety ceiling of ₹1,000' };
      }
    }

    if (action.actionType === 'disable_dish') {
      if (!action.dishId || !action.branchId) {
        return { valid: false, reason: 'Dish suspension requires dishId and branchId' };
      }
    }

    return { valid: true };
  }
}

export class MoneyGate {
  private thresholdINR: number;

  constructor(thresholdINR: number = 300) {
    this.thresholdINR = thresholdINR;
  }

  public evaluate(
    action: ResolutionAction,
    triage: TriagedComplaint,
    customerPastComplaintsCount: number = 0
  ): PolicyDecision {
    const amount = action.amount || 0;

    // Prompt injection check
    if (triage.isPromptInjection) {
      return {
        allowed: false,
        rationale: 'Rejected due to security guardrail violation',
        recommendedAction: 'reject_adversarial',
        requiresHitl: false
      };
    }

    // Non-financial actions don't need money-gate approval (can auto-execute)
    if (action.actionType !== 'refund' && action.actionType !== 'credit') {
      return {
        allowed: true,
        rationale: 'Non-financial operational action allowed per policy',
        recommendedAction: action.actionType,
        requiresHitl: false
      };
    }

    // Frequent complainer heuristic
    if (customerPastComplaintsCount >= 4) {
      return {
        allowed: false,
        rationale: `High complaint velocity detected for customer (${customerPastComplaintsCount} recent complaints). Escalating to supervisor.`,
        recommendedAction: action.actionType,
        suggestedAmount: amount,
        requiresHitl: true,
        hitlReason: 'High frequency refund requester'
      };
    }

    // Under threshold -> Auto-approved
    if (amount <= this.thresholdINR) {
      return {
        allowed: true,
        rationale: `Amount ₹${amount} is within auto-resolution threshold (≤ ₹${this.thresholdINR}). Auto-approving.`,
        recommendedAction: action.actionType,
        suggestedAmount: amount,
        requiresHitl: false
      };
    }

    // Over threshold -> Gated for Human-In-The-Loop Approval
    return {
      allowed: false,
      rationale: `Amount ₹${amount} exceeds auto-approval threshold of ₹${this.thresholdINR}. Gated for human supervisor approval.`,
      recommendedAction: action.actionType,
      suggestedAmount: amount,
      requiresHitl: true,
      hitlReason: `Refund amount ₹${amount} > ₹${this.thresholdINR} threshold`
    };
  }
}

export class IdempotencyManager {
  private receipts = new Map<string, unknown>();

  public getReceipt<T>(key: string): T | undefined {
    return this.receipts.get(key) as T | undefined;
  }

  public saveReceipt(key: string, receipt: unknown): void {
    this.receipts.set(key, receipt);
  }

  public has(key: string): boolean {
    return this.receipts.has(key);
  }
}
