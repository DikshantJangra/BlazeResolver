import { CustomerInput, TriagedComplaint, TriageCategory, TriageSeverity, TriageSentiment } from '../types.js';
import { PromptInjectionGuard } from '../guardrails/index.js';

export class TriageEngine {
  public async triage(input: CustomerInput): Promise<TriagedComplaint> {
    // 1. Run prompt injection security check
    const securityCheck = PromptInjectionGuard.inspect(input);
    if (!securityCheck.passed) {
      return {
        id: `triage_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        input,
        intent: 'adversarial_prompt_injection',
        category: 'prompt_injection',
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

    // 2. Classify Category & Intent
    let category: TriageCategory = 'general_inquiry';
    let intent = 'inquire_status';

    const isCompliment = text.includes('top notch') || text.includes('loved') || text.includes('awesome') || text.includes('kudos') || text.includes('great work') || text.includes('delicious');

    if (isCompliment) {
      category = 'general_inquiry';
      intent = 'customer_compliment_and_feedback';
    } else if (text.includes('cold') || text.includes('not hot') || text.includes('freezing') || text.includes('chilled')) {
      category = 'cold_food';
      intent = 'request_refund_or_replacement_for_cold_food';
    } else if (text.includes('missing') || text.includes('forgot') || text.includes('did not receive') || text.includes("didn't receive") || text.includes('not in bag')) {
      category = 'missing_item';
      intent = 'request_refund_for_missing_item';
    } else if (text.includes('wrong') || text.includes('different') || (text.includes('ordered') && text.includes('got'))) {
      category = 'wrong_item';
      intent = 'report_wrong_dish_delivered';
    } else if (text.includes('late') || text.includes('delay') || text.includes('hour') || text.includes('taking so long') || text.includes('where is') || text.includes('route') || text.includes('gps')) {
      category = 'delivery_delay';
      intent = 'track_order_and_expedite';
    } else if (text.includes('stale') || text.includes('sour') || text.includes('bad') || text.includes('rotten') || text.includes('smell') || text.includes('raw') || text.includes('hair') || text.includes('spoiled') || text.includes('ruined') || text.includes('burnt') || text.includes('undercooked')) {
      category = 'quality_issue';
      intent = 'report_food_quality_defect';
    } else if (text.includes('spill') || text.includes('leaked') || text.includes('torn') || text.includes('container open') || text.includes('mess') || text.includes('damaged')) {
      category = 'spill_leak';
      intent = 'request_compensation_for_damaged_package';
    } else if (text.includes('charged') || text.includes('bill') || text.includes('double') || text.includes('payment') || text.includes('price')) {
      category = 'pricing_billing';
      intent = 'dispute_billing_or_payment';
    }

    // 3. Sentiment Analysis
    let sentiment: TriageSentiment = 'neutral';
    if (text.includes('ridiculous') || text.includes('worst') || text.includes('furious') || text.includes('unacceptable') || text.includes('scam') || text.includes('sue') || text.includes('pathetic')) {
      sentiment = 'furious';
    } else if (text.includes('angry') || text.includes('bad') || text.includes('annoyed') || text.includes('disappointed') || text.includes('hate') || text.includes('waste')) {
      sentiment = 'frustrated';
    } else if (text.includes('thank') || text.includes('appreciate') || text.includes('great') || text.includes('good')) {
      sentiment = 'positive';
    }

    // 4. Severity & Urgency
    let severity: TriageSeverity = 'medium';
    let urgencyScore = 0.5;

    if (category === 'quality_issue' || sentiment === 'furious') {
      severity = 'high';
      urgencyScore = 0.85;
    } else if (category === 'cold_food' || category === 'missing_item') {
      severity = 'medium';
      urgencyScore = 0.65;
    } else if (category === 'general_inquiry') {
      severity = 'low';
      urgencyScore = 0.3;
    }

    // 5. Entity Extraction (Dish, Branch, OrderId, Claimed Amount)
    let dish: string | undefined;
    let dishId: string | undefined;

    if (text.includes('biryani')) {
      dish = 'Hyderabadi Dum Biryani';
      dishId = 'dish_biryani_01';
    } else if (text.includes('butter chicken')) {
      dish = 'Butter Chicken';
      dishId = 'dish_butter_chicken_02';
    } else if (text.includes('paneer') || text.includes('paneer tikka')) {
      dish = 'Paneer Tikka Masala';
      dishId = 'dish_paneer_03';
    } else if (text.includes('garlic naan') || text.includes('naan')) {
      dish = 'Butter Garlic Naan';
      dishId = 'dish_naan_04';
    } else if (text.includes('gulab jamun')) {
      dish = 'Gulab Jamun (2 pcs)';
      dishId = 'dish_dessert_05';
    } else if (text.includes('pizza') || text.includes('margherita')) {
      dish = 'Classic Margherita Pizza';
      dishId = 'dish_pizza_06';
    } else if (text.includes('burger')) {
      dish = 'Crispy Chicken Burger';
      dishId = 'dish_burger_07';
    }

    // Extract Order ID regex (e.g. ORD-1024, #1024, order 1024)
    let orderId = input.orderId;
    if (!orderId) {
      const orderMatch = text.match(/(?:ord[-_]?|order\s*(?:id|#)?\s*|#)([a-z0-9-]+)/i);
      if (orderMatch) {
        orderId = orderMatch[1].startsWith('ord-') ? orderMatch[1] : `ord-${orderMatch[1]}`;
      }
    }

    // Extract Branch ID
    let branchId = input.branchId;
    if (!branchId) {
      if (text.includes('branch 2') || text.includes('connaught place') || text.includes('cp branch') || text.includes('branch-02')) {
        branchId = 'branch_cp_02';
      } else if (text.includes('branch 1') || text.includes('indiranagar') || text.includes('branch-01')) {
        branchId = 'branch_ind_01';
      } else if (text.includes('branch 3') || text.includes('koramangala') || text.includes('branch-03')) {
        branchId = 'branch_kor_03';
      }
    }

    // Extract Claimed Amount (e.g. ₹450, 450 rs, rs 450, 450 rupees)
    let claimedAmount: number | undefined;
    const amountMatch = text.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:rs|rupees|inr|₹)/i);
    if (amountMatch) {
      claimedAmount = parseFloat(amountMatch[1] || amountMatch[2]);
    }

    return {
      id: `triage_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      input,
      intent,
      category,
      severity,
      sentiment,
      dish,
      dishId,
      branchId,
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
}
