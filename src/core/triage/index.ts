import { CustomerInput, TriagedComplaint, TriageCategory, TriageSeverity, TriageSentiment } from '../types.js';
import { PromptInjectionGuard } from '../guardrails/index.js';
import {
  CategoryDefinition,
  DomainProfile,
  GENERAL_INQUIRY,
  PROMPT_INJECTION,
  extractAmount,
  extractOrderId,
  findCatalogEntry,
  matchesKeywords
} from '../domain.js';

const FURIOUS_WORDS = ['ridiculous', 'worst', 'furious', 'unacceptable', 'scam', 'sue', 'pathetic'];
const FRUSTRATED_WORDS = ['angry', 'bad', 'annoyed', 'disappointed', 'hate', 'waste'];
const POSITIVE_WORDS = ['thank', 'appreciate', 'great', 'good'];

export class TriageEngine {
  constructor(private profile: DomainProfile) {}

  public async triage(input: CustomerInput): Promise<TriagedComplaint> {
    // 1. Run prompt injection security check
    const securityCheck = PromptInjectionGuard.inspect(input);
    if (!securityCheck.passed) {
      return {
        id: `triage_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        input,
        intent: 'adversarial_prompt_injection',
        category: PROMPT_INJECTION,
        severity: 'critical',
        sentiment: 'neutral',
        urgencyScore: 1.0,
        isPromptInjection: true,
        guardrailPassed: false,
        guardrailViolationReason: securityCheck.reason,
        incidentLinked: false,
        timestamp: new Date()
      };
    }

    const text = input.rawText.toLowerCase();

    // 2. Classify category & intent using the profile's categories, in order
    const { category, intent, definition } = this.classify(text);

    // 3. Sentiment analysis
    let sentiment: TriageSentiment = 'neutral';
    if (FURIOUS_WORDS.some((w) => text.includes(w))) {
      sentiment = 'furious';
    } else if (FRUSTRATED_WORDS.some((w) => text.includes(w))) {
      sentiment = 'frustrated';
    } else if (POSITIVE_WORDS.some((w) => text.includes(w))) {
      sentiment = 'positive';
    }

    // 4. Severity & urgency: a furious customer is always high priority
    let severity: TriageSeverity = 'low';
    let urgencyScore = 0.3;
    if (sentiment === 'furious') {
      severity = 'high';
      urgencyScore = 0.85;
    } else if (definition) {
      severity = definition.severity;
      urgencyScore = definition.urgencyScore;
    }

    // 5. Entity extraction (item, resource, order ID, claimed amount)
    const item = input.itemId
      ? this.profile.items.find((entry) => entry.id === input.itemId)
      : findCatalogEntry(text, this.profile.items);
    const resourceId = input.resourceId || findCatalogEntry(text, this.profile.resources)?.id;
    const orderId = input.orderId || extractOrderId(input.rawText, this.profile);
    const claimedAmount = extractAmount(text, this.profile.currency);

    return {
      id: `triage_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      input,
      intent,
      category,
      severity,
      sentiment,
      itemId: input.itemId || item?.id,
      itemName: item?.name,
      resourceId,
      orderId,
      customerId: input.customerId,
      claimedAmount,
      urgencyScore,
      isPromptInjection: false,
      guardrailPassed: true,
      incidentLinked: false,
      timestamp: new Date()
    };
  }

  private classify(text: string): { category: TriageCategory; intent: string; definition?: CategoryDefinition } {
    if (matchesKeywords(text, this.profile.complimentKeywords)) {
      return { category: GENERAL_INQUIRY, intent: 'customer_compliment_and_feedback' };
    }

    const definition = this.profile.categories.find((c) => matchesKeywords(text, c.keywords));
    if (definition) {
      return { category: definition.id, intent: definition.intent, definition };
    }

    return { category: GENERAL_INQUIRY, intent: 'inquire_status' };
  }
}
