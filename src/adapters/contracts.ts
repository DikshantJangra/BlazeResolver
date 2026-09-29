import { TriagedComplaint, CorrelatedIncident } from '../core/types.js';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  /** Variant details such as size, colour or add-ons. */
  options?: string[];
}

export type OrderStatus = 'pending' | 'processing' | 'in_transit' | 'delivered' | 'cancelled' | 'refunded';

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  /** Location or operational unit that fulfilled the order (store, warehouse, branch). */
  resourceId: string;
  resourceName: string;
  items: OrderItem[];
  totalAmount: number;
  /** ISO 4217 code. */
  currency: string;
  deliveryFee?: number;
  tax?: number;
  status: OrderStatus;
  orderedAt: Date;
  deliveredAt?: Date;
  paymentMethod?: string;
  paymentId?: string;
  metadata?: Record<string, unknown>;
}

/** One measurement of an operational metric for an order, e.g. kitchen prep time or warehouse dispatch time. */
export interface OperationalSignal {
  orderId: string;
  resourceId: string;
  metric: string;
  label: string;
  unit: string;
  value: number;
  baseline: number;
  isAnomalous: boolean;
  /** Where in the operation it was measured, e.g. a station or packing line. */
  stage?: string;
  notes?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ResourceBaseline {
  metric: string;
  label: string;
  unit: string;
  /** Current average for the resource over the requested window. */
  current: number;
  /** Normal value for the resource. */
  baseline: number;
}

export interface RefundReceipt {
  refundId: string;
  orderId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
  gatewayReference: string;
  status: 'processed' | 'queued' | 'failed';
  processedAt: Date;
  isDuplicateRequest?: boolean;
}

export interface CreditReceipt {
  creditId: string;
  customerId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
  newBalance: number;
  status: 'processed' | 'queued' | 'failed';
  processedAt: Date;
  isDuplicateRequest?: boolean;
}

export interface Ticket {
  id: string;
  complaintId: string;
  customerId?: string;
  orderId?: string;
  resourceId?: string;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'linked_to_incident' | 'resolved' | 'escalated_to_manager';
  incidentId?: string;
  createdAt: Date;
  assignedManager?: string;
}

export interface DisabledItem {
  itemId: string;
  itemName: string;
  resourceId: string;
  disabledAt: Date;
  reason: string;
}

/**
 * The adapter interfaces of BlazeResolver.
 * The core engine never touches a database, payment provider or ops system directly;
 * it only communicates through these typed contracts. Implement them for your business
 * and the core runs unchanged.
 */

export interface OrderSource {
  getOrder(orderId: string): Promise<Order | null>;
  getOrdersByCustomer(customerId: string, since?: Date): Promise<Order[]>;
}

export interface RefundGateway {
  issueRefund(orderId: string, amount: number, idempotencyKey: string): Promise<RefundReceipt>;
  issueCredit(customerId: string, amount: number, idempotencyKey: string): Promise<CreditReceipt>;
  getRefundStatus(idempotencyKey: string): Promise<RefundReceipt | null>;
}

export interface TicketSink {
  createTicket(complaint: TriagedComplaint): Promise<Ticket>;
  linkTicketsToIncident(ticketIds: string[], incidentSummary: string, incidentData?: Partial<CorrelatedIncident>): Promise<CorrelatedIncident>;
  routeToManager(ticketId: string, resourceId: string, notes?: string): Promise<void>;
  getTickets(filter?: { resourceId?: string; incidentId?: string; status?: string }): Promise<Ticket[]>;
}

/** Optional. Lets the Correlate stage confirm a systemic issue with real operational data. */
export interface SignalSource {
  getOrderSignal(orderId: string): Promise<OperationalSignal | null>;
  getResourceBaseline(resourceId: string, windowHours?: number): Promise<ResourceBaseline | null>;
}

/** Optional. Lets BlazeResolver temporarily pull an item (a dish, SKU, plan or feature) at a resource. */
export interface AvailabilityControl {
  disableItem(itemId: string, resourceId: string, reason: string): Promise<void>;
  enableItem(itemId: string, resourceId: string): Promise<void>;
  isItemAvailable(itemId: string, resourceId: string): Promise<boolean>;
  getDisabledItems(resourceId?: string): Promise<DisabledItem[]>;
}

export interface ResolverAdapters {
  orderSource: OrderSource;
  /** Optional. Omit when this business has no refund/credit/payment system. */
  refundGateway?: RefundGateway;
  ticketSink: TicketSink;
  signalSource?: SignalSource;
  availabilityControl?: AvailabilityControl;
}
