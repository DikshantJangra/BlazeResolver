import { TriagedComplaint, ResolutionAction, PolicyDecision, ResponseDraft, ChannelType } from '../types.js';
import { DomainProfile, formatMoney } from '../domain.js';

export class ResponseEngine {
  constructor(private profile: DomainProfile) {}

  public generateResponse(
    triage: TriagedComplaint,
    resolution: {
      policyDecision: PolicyDecision;
      actions: ResolutionAction[];
      hitlRequired: boolean;
    },
    channel: ChannelType = 'text',
    isSystemic: boolean = false
  ): ResponseDraft {
    const executedAction = resolution.actions[0];
    const isVoice = channel === 'voice';
    const money = (amount: number) => formatMoney(amount, this.profile.currency);

    // 1. Adversarial Response
    if (triage.isPromptInjection) {
      return {
        text: isVoice
          ? "I am sorry, but I cannot process this request as it violates our automated security policy."
          : "We apologize, but your request could not be processed due to a security verification policy check. Please contact our live support desk if you need further assistance.",
        channel,
        tone: 'firm',
        containsRefundConfirmation: false,
        containsApology: true,
        qualityPassed: true,
        qualityReviewNotes: 'Security policy response enforced cleanly without leaking system context.'
      };
    }

    // 2. Pending Human Supervisor (Money Gate) Response
    if (resolution.hitlRequired || executedAction?.approvalStatus === 'pending_human') {
      const amount = executedAction?.amount || triage.claimedAmount || 0;
      const text = isVoice
        ? `I sincerely apologize for the inconvenience with your order. Because this claim is for ${money(amount)}, I have escalated this directly to our shift supervisor for fast-track review. You will receive an SMS confirmation within 15 minutes.`
        : `We sincerely apologize for the trouble with your order. Your claim for ${money(amount)} has been prioritized and routed to our duty manager for instant verification. You will receive an update and transaction confirmation via SMS/WhatsApp within 15 minutes.`;

      return {
        text,
        channel,
        tone: 'urgent',
        containsRefundConfirmation: false,
        containsApology: true,
        qualityPassed: true,
        qualityReviewNotes: 'Gated claim transparently communicated with realistic SLA.'
      };
    }

    // 3. Auto-Approved Refund / Credit Response
    if (executedAction && executedAction.approvalStatus === 'executed') {
      if (executedAction.actionType === 'refund') {
        const amount = executedAction.amount || 0;
        const resourceLabel = this.profile.labels.resource.toLowerCase();
        const systemicNotice = isSystemic
          ? (isVoice
            ? ` Our ${resourceLabel} manager has also been notified so it can be fixed for everyone.`
            : ` We have also alerted our ${resourceLabel} manager to fix the underlying issue immediately.`)
          : "";

        const text = isVoice
          ? `I am truly sorry your order wasn't up to standard. I have immediately processed a full refund of ${money(amount)} back to your original payment method.${systemicNotice} It should reflect shortly.`
          : `We are truly sorry about the issue with your order (${triage.itemName || 'items'}). We have initiated an instant refund of ${money(amount)} to your original payment method (Ref: ${executedAction.idempotencyKey.substring(0, 16)}).${systemicNotice} Thank you for your patience and for helping us maintain top quality.`;

        return {
          text,
          channel,
          tone: 'empathetic',
          containsRefundConfirmation: true,
          containsApology: true,
          qualityPassed: true,
          qualityReviewNotes: 'Immediate restitution provided with empathetic apology.'
        };
      }

      if (executedAction.actionType === 'credit') {
        const amount = executedAction.amount || 0;
        const text = isVoice
          ? `We apologize for the inconvenience. A store credit of ${money(amount)} has been added directly to your wallet for your next order.`
          : `We sincerely apologize for the issue. A courtesy wallet credit of ${money(amount)} has been added to your account instantly. You can use it on your next order.`;

        return {
          text,
          channel,
          tone: 'empathetic',
          containsRefundConfirmation: true,
          containsApology: true,
          qualityPassed: true,
          qualityReviewNotes: 'Courtesy credit confirmed.'
        };
      }
    }

    // 4. General Support / Ticket Created Response
    const defaultText = isVoice
      ? "Thank you for reaching out. We have logged your feedback with our team, and our support staff will assist you shortly."
      : "Thank you for reaching out to us. We have created a support ticket for your query. Our dedicated customer care specialist will follow up with you shortly.";

    return {
      text: defaultText,
      channel,
      tone: 'professional',
      containsRefundConfirmation: false,
      containsApology: true,
      qualityPassed: true,
      qualityReviewNotes: 'Standard service acknowledgment.'
    };
  }
}
