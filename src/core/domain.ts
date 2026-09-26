import type { TriageSeverity } from './types.js';

/**
 * A DomainProfile holds everything business-specific: the complaint categories and how to
 * resolve them, the product catalog, locations, currency and money limits. The core engine
 * reads the profile and never hardcodes a business. Adapters supply the data; the profile
 * supplies the vocabulary and policy.
 */

/** Built-in categories every profile shares. */
export const GENERAL_INQUIRY = 'general_inquiry';
export const PROMPT_INJECTION = 'prompt_injection';

/** Resolution the pipeline takes on its own for a category (still subject to the money gate). */
export type PolicyAction = 'refund' | 'credit' | 'create_ticket';

export interface CategoryPolicy {
  action: PolicyAction;
  /** Always use this amount and ignore any amount the customer claims (e.g. a fixed apology credit). */
  fixedAmount?: number;
  /** When the customer names no amount, fall back to the order total. */
  useOrderTotal?: boolean;
  /** Upper bound applied to the order-total fallback. */
  maxAmount?: number;
  /** Used when the customer names no amount and no order total is available. */
  defaultAmount?: number;
}

/** A string matches when the text contains it; an array matches only when the text contains every entry. */
export type KeywordRule = string | string[];

export interface CategoryDefinition {
  id: string;
  label: string;
  intent: string;
  /** Lowercase keywords used by the offline classifier. */
  keywords: KeywordRule[];
  severity: TriageSeverity;
  urgencyScore: number;
  policy: CategoryPolicy;
  /** Disable the affected item at the resource when a systemic incident forms for this category. */
  disableItemOnIncident?: boolean;
  /** Recommended next step attached to incidents. `{resource}` is replaced with the resource ID. */
  incidentPlaybook?: string;
}

export interface CatalogEntry {
  id: string;
  name: string;
  /** Lowercase phrases that identify this entry in customer text. */
  aliases: string[];
}

export interface CurrencyConfig {
  /** ISO 4217 code, e.g. 'USD', 'EUR'. */
  code: string;
  symbol: string;
  /** Lowercase words customers use for the currency, e.g. ['dollars'] or ['euros']. */
  aliases: string[];
}

export interface MoneyPolicy {
  /** Refunds and credits at or below this amount execute without human approval. */
  autoApproveThreshold: number;
  /** Hard ceiling for a single wallet credit. */
  maxCreditAmount: number;
  /** Lifetime spend at which the voice agent treats a customer as loyal. */
  loyalCustomerSpend: number;
}

export interface DomainLabels {
  /** How the business describes itself, e.g. 'online store', 'subscription app'. */
  business: string;
  /** What an item is called, e.g. 'Product', 'Plan'. */
  item: string;
  /** What a resource (location or operational unit) is called, e.g. 'Warehouse', 'Store'. */
  resource: string;
}

export interface DomainProfile {
  id: string;
  name: string;
  labels: DomainLabels;
  currency: CurrencyConfig;
  moneyPolicy: MoneyPolicy;
  /** Checked in order; the first category whose keywords match wins. */
  categories: CategoryDefinition[];
  /** Messages matching these are logged as feedback instead of complaints. */
  complimentKeywords: string[];
  items: CatalogEntry[];
  resources: CatalogEntry[];
  /** Pattern whose first capture group is the order ID. */
  orderIdPattern: RegExp;
  normalizeOrderId?: (raw: string) => string;
}

export function matchesKeywords(text: string, rules: KeywordRule[]): boolean {
  return rules.some((rule) => (Array.isArray(rule) ? rule.every((word) => text.includes(word)) : text.includes(rule)));
}

export function findCatalogEntry(text: string, entries: CatalogEntry[]): CatalogEntry | undefined {
  return entries.find((entry) => entry.aliases.some((alias) => text.includes(alias)));
}

export function findCategory(profile: DomainProfile, categoryId: string): CategoryDefinition | undefined {
  return profile.categories.find((category) => category.id === categoryId);
}

export function categoryLabel(profile: DomainProfile, categoryId: string): string {
  return findCategory(profile, categoryId)?.label ?? categoryId.replace(/_/g, ' ');
}

export function formatMoney(amount: number, currency: CurrencyConfig): string {
  return `${currency.symbol}${amount}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Finds an amount written with the profile's currency, e.g. "$40", "40 dollars", "€35", "35 euros". */
export function extractAmount(text: string, currency: CurrencyConfig): number | undefined {
  const tokens = [currency.symbol, currency.code.toLowerCase(), ...currency.aliases]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');
  const pattern = new RegExp(`(?:${tokens})\\s*(\\d+(?:\\.\\d+)?)|(\\d+(?:\\.\\d+)?)\\s*(?:${tokens})`, 'i');
  const match = text.match(pattern);
  return match ? parseFloat(match[1] || match[2]) : undefined;
}

export function normalizeOrderId(raw: string, profile: DomainProfile): string {
  const trimmed = raw.trim();
  return profile.normalizeOrderId ? profile.normalizeOrderId(trimmed) : trimmed;
}

export function extractOrderId(text: string, profile: DomainProfile): string | undefined {
  const match = text.match(profile.orderIdPattern);
  return match ? normalizeOrderId(match[1], profile) : undefined;
}

/**
 * Default profile for general product businesses (e-commerce, retail, subscriptions, apps).
 * Businesses copy and edit it, or pass their own profile to the pipeline.
 */
export const GENERIC_PROFILE: DomainProfile = {
  id: 'generic',
  name: 'General products',
  labels: { business: 'online store', item: 'Product', resource: 'Location' },
  currency: { code: 'USD', symbol: '$', aliases: ['dollars', 'dollar', 'usd'] },
  moneyPolicy: { autoApproveThreshold: 25, maxCreditAmount: 50, loyalCustomerSpend: 500 },
  categories: [
    {
      id: 'damaged_item',
      label: 'Damaged or defective item',
      intent: 'report_damaged_or_defective_item',
      keywords: ['damaged', 'broken', 'defective', 'cracked', 'shattered', 'faulty', 'stopped working', "doesn't work", 'does not work', 'not working', 'dead on arrival'],
      severity: 'high',
      urgencyScore: 0.8,
      policy: { action: 'refund', useOrderTotal: true, defaultAmount: 20 },
      disableItemOnIncident: true,
      incidentPlaybook: 'Quarantine the affected stock at {resource}, pause the listing, and open a supplier quality review.'
    },
    {
      id: 'missing_item',
      label: 'Missing item',
      intent: 'request_refund_for_missing_item',
      keywords: ['missing', 'not in the box', 'not in the package', 'not included', 'did not receive', "didn't receive", 'never received'],
      severity: 'medium',
      urgencyScore: 0.65,
      policy: { action: 'refund', useOrderTotal: true, maxAmount: 25, defaultAmount: 15 },
      incidentPlaybook: 'Audit packing at {resource} for skipped line items.'
    },
    {
      id: 'wrong_item',
      label: 'Wrong item',
      intent: 'report_wrong_item_delivered',
      keywords: ['wrong item', 'wrong size', 'wrong color', 'wrong colour', 'wrong product', 'not what i ordered', ['ordered', 'got']],
      severity: 'medium',
      urgencyScore: 0.5,
      policy: { action: 'refund', useOrderTotal: true, maxAmount: 25, defaultAmount: 15 },
      incidentPlaybook: 'Check pick-and-pack accuracy and SKU labelling at {resource}.'
    },
    {
      id: 'delivery_delay',
      label: 'Late delivery',
      intent: 'track_order_and_expedite',
      keywords: ['delay', 'arrived late', 'is late', 'running late', 'late delivery', 'still waiting', 'where is my', "hasn't arrived", 'has not arrived', 'not delivered yet', 'tracking', 'taking so long'],
      severity: 'medium',
      urgencyScore: 0.5,
      policy: { action: 'credit', fixedAmount: 5 },
      incidentPlaybook: 'Review the dispatch backlog and carrier handoffs at {resource}.'
    },
    {
      id: 'quality_issue',
      label: 'Quality issue',
      intent: 'report_quality_problem',
      keywords: ['poor quality', 'bad quality', 'cheap', 'flimsy', 'expired', 'not as described', 'counterfeit', 'fake', 'smells'],
      severity: 'high',
      urgencyScore: 0.85,
      policy: { action: 'refund', useOrderTotal: true, defaultAmount: 20 },
      disableItemOnIncident: true,
      incidentPlaybook: 'Pause the listing at {resource} and review product quality with the supplier.'
    },
    {
      id: 'billing_issue',
      label: 'Billing issue',
      intent: 'dispute_billing_or_payment',
      keywords: ['charged', 'invoice', 'billing', 'payment', 'subscription', 'price'],
      severity: 'medium',
      urgencyScore: 0.5,
      policy: { action: 'create_ticket' }
    },
    {
      id: 'account_access',
      label: 'Account access',
      intent: 'restore_account_access',
      keywords: ['log in', 'login', 'sign in', 'password', 'locked out', 'verification code', '2fa'],
      severity: 'medium',
      urgencyScore: 0.5,
      policy: { action: 'create_ticket' },
      incidentPlaybook: 'Check the authentication service for an outage affecting {resource}.'
    },
    {
      id: 'technical_issue',
      label: 'Technical issue',
      intent: 'report_technical_problem',
      keywords: ['error', 'crash', 'bug', 'glitch', 'not loading', "won't load", 'keeps freezing', 'blank screen'],
      severity: 'medium',
      urgencyScore: 0.6,
      policy: { action: 'create_ticket' },
      incidentPlaybook: 'Check recent releases and error logs for {resource}; this may be a systemic bug.'
    }
  ],
  complimentKeywords: ['love it', 'loved', 'awesome', 'great job', 'great work', 'kudos', 'excellent service'],
  items: [],
  resources: [],
  orderIdPattern: /(?:order\s*(?:id|number|no\.?)?\s*[:#]?\s*|#)([a-z0-9][a-z0-9_-]*\d[a-z0-9_-]*)/i
};
