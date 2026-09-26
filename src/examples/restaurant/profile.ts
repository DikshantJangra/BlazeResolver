import { DomainProfile } from '../../core/domain.js';

const KITCHEN_PLAYBOOK = 'Inspect the KDS fry/expedite station at {resource}, dispatch the shift manager, and prioritize hot thermal packaging.';

export const RESTAURANT_PROFILE: DomainProfile = {
  id: 'restaurant',
  name: 'Restaurant & food delivery',
  labels: { business: 'restaurant and food delivery service', item: 'Dish', resource: 'Branch' },
  currency: { code: 'INR', symbol: '₹', aliases: ['rupees', 'rs.', 'rs'] },
  moneyPolicy: { autoApproveThreshold: 300, maxCreditAmount: 1000, loyalCustomerSpend: 1000 },
  categories: [
    {
      id: 'cold_food',
      label: 'Cold food',
      intent: 'request_refund_or_replacement_for_cold_food',
      keywords: ['cold', 'not hot', 'freezing', 'chilled'],
      severity: 'medium',
      urgencyScore: 0.65,
      policy: { action: 'refund', useOrderTotal: true, defaultAmount: 280 },
      incidentPlaybook: KITCHEN_PLAYBOOK
    },
    {
      id: 'missing_item',
      label: 'Missing item',
      intent: 'request_refund_for_missing_item',
      keywords: ['missing', 'forgot', 'did not receive', "didn't receive", 'not in bag'],
      severity: 'medium',
      urgencyScore: 0.65,
      policy: { action: 'refund', useOrderTotal: true, maxAmount: 220, defaultAmount: 180 },
      incidentPlaybook: 'Audit the packing checklist at {resource} for skipped items.'
    },
    {
      id: 'wrong_item',
      label: 'Wrong item',
      intent: 'report_wrong_dish_delivered',
      keywords: ['wrong', 'different', ['ordered', 'got']],
      severity: 'medium',
      urgencyScore: 0.5,
      policy: { action: 'refund', useOrderTotal: true, maxAmount: 220, defaultAmount: 180 },
      incidentPlaybook: 'Check order labelling and handoff at {resource}.'
    },
    {
      id: 'delivery_delay',
      label: 'Delivery delay',
      intent: 'track_order_and_expedite',
      keywords: ['late', 'delay', 'hour', 'taking so long', 'where is', 'route', 'gps'],
      severity: 'medium',
      urgencyScore: 0.5,
      policy: { action: 'credit', fixedAmount: 100 },
      incidentPlaybook: KITCHEN_PLAYBOOK
    },
    {
      id: 'quality_issue',
      label: 'Quality issue',
      intent: 'report_food_quality_defect',
      keywords: ['stale', 'sour', 'bad', 'rotten', 'smell', 'raw', 'hair', 'spoiled', 'ruined', 'burnt', 'undercooked'],
      severity: 'high',
      urgencyScore: 0.85,
      policy: { action: 'refund', useOrderTotal: true, defaultAmount: 350 },
      disableItemOnIncident: true,
      incidentPlaybook: 'Pull the affected dish at {resource}, inspect ingredient batches, and brief the kitchen lead.'
    },
    {
      id: 'spill_leak',
      label: 'Spill or leak',
      intent: 'request_compensation_for_damaged_package',
      keywords: ['spill', 'leaked', 'torn', 'container open', 'mess', 'damaged'],
      severity: 'medium',
      urgencyScore: 0.5,
      policy: { action: 'credit', useOrderTotal: true, maxAmount: 200, defaultAmount: 150 },
      incidentPlaybook: 'Check container seals and packaging stock at {resource}.'
    },
    {
      id: 'pricing_billing',
      label: 'Pricing or billing',
      intent: 'dispute_billing_or_payment',
      keywords: ['charged', 'bill', 'double', 'payment', 'price'],
      severity: 'medium',
      urgencyScore: 0.5,
      policy: { action: 'create_ticket' },
      softwareDefect: true
    }
  ],
  complimentKeywords: ['top notch', 'loved', 'awesome', 'kudos', 'great work', 'delicious'],
  items: [
    { id: 'dish_biryani_01', name: 'Hyderabadi Dum Biryani', aliases: ['biryani'] },
    { id: 'dish_butter_chicken_02', name: 'Butter Chicken', aliases: ['butter chicken'] },
    { id: 'dish_paneer_03', name: 'Paneer Tikka Masala', aliases: ['paneer'] },
    { id: 'dish_naan_04', name: 'Butter Garlic Naan', aliases: ['garlic naan', 'naan'] },
    { id: 'dish_dessert_05', name: 'Gulab Jamun (2 pcs)', aliases: ['gulab jamun'] },
    { id: 'dish_pizza_06', name: 'Classic Margherita Pizza', aliases: ['pizza', 'margherita'] },
    { id: 'dish_burger_07', name: 'Crispy Chicken Burger', aliases: ['burger'] }
  ],
  resources: [
    { id: 'branch_cp_02', name: 'Central Flagship (Branch 2)', aliases: ['branch 2', 'connaught place', 'cp branch', 'branch-02', 'central branch'] },
    { id: 'branch_ind_01', name: 'East Hub (Branch 1)', aliases: ['branch 1', 'indiranagar', 'branch-01', 'east hub'] },
    { id: 'branch_kor_03', name: 'South Hub (Branch 3)', aliases: ['branch 3', 'koramangala', 'branch-03', 'south hub'] }
  ],
  orderIdPattern: /(?:ord[-_]?|order\s*(?:id|#)?\s*|#)([a-z0-9-]+)/i,
  normalizeOrderId: (raw) => {
    const id = raw.toLowerCase();
    return id.startsWith('ord-') ? id : `ord-${id}`;
  }
};
