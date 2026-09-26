import { TriagedComplaint, CorrelatedIncident } from '../core/types.js';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customizations?: string[];
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  branchId: string;
  branchName: string;
  items: OrderItem[];
  totalAmount: number;
  deliveryFee: number;
  tax: number;
  status: 'pending' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  orderedAt: Date;
  deliveredAt?: Date;
  paymentMethod: 'upi' | 'card' | 'wallet' | 'cod';
  paymentId?: string;
}

export interface KitchenTiming {
  orderId: string;
  branchId: string;
  prepStart: Date;
  prepEnd: Date;
  prepMinutes: number;
  baselineMinutes: number;
  isBottleneck: boolean;
  station?: string;
  chefNotes?: string;
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
  branchId?: string;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'linked_to_incident' | 'resolved' | 'escalated_to_manager';
  incidentId?: string;
  createdAt: Date;
  assignedManager?: string;
}

/**
 * The 4 Core Adapter Interfaces of BlazeResolver.
 * The core engine never touches a database or payment gateway directly;
 * it only communicates through these 4 typed contracts.
 */

export interface OrderSource {
  getOrder(orderId: string): Promise<Order | null>;
  getOrdersByCustomer(customerId: string, since?: Date): Promise<Order[]>;
  getKitchenTiming(orderId: string): Promise<KitchenTiming | null>;
  getBranchAveragePrepTime(branchId: string, shiftWindowHours?: number): Promise<{ avgMinutes: number; baselineMinutes: number }>;
}

export interface RefundGateway {
  issueRefund(orderId: string, amount: number, idempotencyKey: string): Promise<RefundReceipt>;
  issueCredit(customerId: string, amount: number, idempotencyKey: string): Promise<CreditReceipt>;
  getRefundStatus(idempotencyKey: string): Promise<RefundReceipt | null>;
}

export interface TicketSink {
  createTicket(complaint: TriagedComplaint): Promise<Ticket>;
  linkTicketsToIncident(ticketIds: string[], incidentSummary: string, incidentData?: Partial<CorrelatedIncident>): Promise<CorrelatedIncident>;
  routeToManager(ticketId: string, branchId: string, notes?: string): Promise<void>;
  getTickets(filter?: { branchId?: string; incidentId?: string; status?: string }): Promise<Ticket[]>;
}

export interface MenuControl {
  disableDish(dishId: string, branchId: string, reason: string): Promise<void>;
  enableDish(dishId: string, branchId: string): Promise<void>;
  getDishAvailability(dishId: string, branchId: string): Promise<boolean>;
  getDisabledDishes(branchId?: string): Promise<Array<{ dishId: string; dishName: string; branchId: string; disabledAt: Date; reason: string }>>;
}

export interface ResolverAdapters {
  orderSource: OrderSource;
  refundGateway: RefundGateway;
  ticketSink: TicketSink;
  menuControl: MenuControl;
}
