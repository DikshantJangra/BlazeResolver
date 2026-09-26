import {
  OrderSource,
  RefundGateway,
  TicketSink,
  SignalSource,
  AvailabilityControl,
  Order,
  OperationalSignal,
  ResourceBaseline,
  RefundReceipt,
  CreditReceipt,
  Ticket,
  DisabledItem
} from './contracts.js';
import { TriagedComplaint, CorrelatedIncident } from '../core/types.js';

/**
 * In-memory reference implementations of every adapter contract.
 * The examples seed them with demo data; businesses can use them to test a DomainProfile
 * before writing adapters for their real systems.
 */

export class InMemoryOrderSource implements OrderSource {
  private orders = new Map<string, Order>();

  constructor(orders: Order[] = []) {
    orders.forEach((order) => this.orders.set(order.id, order));
  }

  public async getOrder(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) || null;
  }

  public async getOrdersByCustomer(customerId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter((o) => o.customerId === customerId);
  }

  public addOrder(order: Order): void {
    this.orders.set(order.id, order);
  }

  public getAllOrders(): Order[] {
    return Array.from(this.orders.values());
  }
}

export class InMemorySignalSource implements SignalSource {
  private signals = new Map<string, OperationalSignal>();

  constructor(
    signals: OperationalSignal[] = [],
    private baselines: Record<string, ResourceBaseline> = {},
    private defaultBaseline: ResourceBaseline | null = null
  ) {
    signals.forEach((signal) => this.signals.set(signal.orderId, signal));
  }

  public async getOrderSignal(orderId: string): Promise<OperationalSignal | null> {
    return this.signals.get(orderId) || null;
  }

  public async getResourceBaseline(resourceId: string): Promise<ResourceBaseline | null> {
    return this.baselines[resourceId] || this.defaultBaseline;
  }
}

export class InMemoryRefundGateway implements RefundGateway {
  private refunds = new Map<string, RefundReceipt>();
  private credits = new Map<string, CreditReceipt>();
  private customerBalances = new Map<string, number>();

  constructor(private currency: string) {}

  public async issueRefund(orderId: string, amount: number, idempotencyKey: string): Promise<RefundReceipt> {
    const existing = Array.from(this.refunds.values()).find((r) => r.idempotencyKey === idempotencyKey);
    if (existing) {
      return { ...existing, isDuplicateRequest: true };
    }

    const receipt: RefundReceipt = {
      refundId: `rfnd_pg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      orderId,
      amount,
      currency: this.currency,
      idempotencyKey,
      gatewayReference: `txn_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      status: 'processed',
      processedAt: new Date()
    };

    this.refunds.set(receipt.refundId, receipt);
    return receipt;
  }

  public async issueCredit(customerId: string, amount: number, idempotencyKey: string): Promise<CreditReceipt> {
    const existing = Array.from(this.credits.values()).find((c) => c.idempotencyKey === idempotencyKey);
    if (existing) {
      return { ...existing, isDuplicateRequest: true };
    }

    const newBalance = (this.customerBalances.get(customerId) || 0) + amount;
    this.customerBalances.set(customerId, newBalance);

    const receipt: CreditReceipt = {
      creditId: `crd_wlt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      customerId,
      amount,
      currency: this.currency,
      idempotencyKey,
      newBalance,
      status: 'processed',
      processedAt: new Date()
    };

    this.credits.set(receipt.creditId, receipt);
    return receipt;
  }

  public async getRefundStatus(idempotencyKey: string): Promise<RefundReceipt | null> {
    return Array.from(this.refunds.values()).find((r) => r.idempotencyKey === idempotencyKey) || null;
  }

  public getAllRefunds(): RefundReceipt[] {
    return Array.from(this.refunds.values());
  }

  public getAllCredits(): CreditReceipt[] {
    return Array.from(this.credits.values());
  }
}

export class InMemoryTicketSink implements TicketSink {
  private tickets = new Map<string, Ticket>();
  private incidents = new Map<string, CorrelatedIncident>();

  public async createTicket(complaint: TriagedComplaint): Promise<Ticket> {
    const ticket: Ticket = {
      id: `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      complaintId: complaint.id,
      customerId: complaint.customerId,
      orderId: complaint.orderId,
      resourceId: complaint.resourceId,
      title: `${complaint.category.replace(/_/g, ' ').toUpperCase()}: ${complaint.itemName || 'Order inquiry'}`,
      description: complaint.input.rawText,
      category: complaint.category,
      priority: complaint.severity === 'critical' ? 'urgent' : complaint.severity === 'high' ? 'high' : 'medium',
      status: 'open',
      createdAt: new Date()
    };

    this.tickets.set(ticket.id, ticket);
    return ticket;
  }

  public async linkTicketsToIncident(
    ticketIds: string[],
    incidentSummary: string,
    incidentData: Partial<CorrelatedIncident> = {}
  ): Promise<CorrelatedIncident> {
    const incidentId = `inc_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const now = new Date();

    const incident: CorrelatedIncident = {
      incidentId,
      title: incidentData.title || `Systemic issue at ${incidentData.resourceId || 'unassigned'}`,
      summary: incidentSummary,
      resourceId: incidentData.resourceId || 'unassigned',
      category: incidentData.category || 'general_inquiry',
      itemId: incidentData.itemId,
      itemName: incidentData.itemName,
      ticketIds,
      complaintCount: incidentData.complaintCount ?? ticketIds.length,
      signal: incidentData.signal,
      status: 'investigating',
      recommendedAction: incidentData.recommendedAction || 'Investigate and notify the responsible manager.',
      managerNotified: false,
      itemDisabled: false,
      createdAt: now,
      updatedAt: now
    };

    this.incidents.set(incidentId, incident);

    for (const ticketId of ticketIds) {
      const ticket = this.tickets.get(ticketId);
      if (ticket) {
        ticket.status = 'linked_to_incident';
        ticket.incidentId = incidentId;
      }
    }

    return incident;
  }

  public async routeToManager(ticketOrIncidentId: string, resourceId: string): Promise<void> {
    const incident = this.incidents.get(ticketOrIncidentId);
    if (incident) {
      incident.managerNotified = true;
      incident.updatedAt = new Date();
    }

    const ticket = this.tickets.get(ticketOrIncidentId);
    if (ticket) {
      ticket.status = 'escalated_to_manager';
      ticket.assignedManager = `Manager @ ${resourceId}`;
    }
  }

  public async getTickets(filter: { resourceId?: string; incidentId?: string; status?: string } = {}): Promise<Ticket[]> {
    return Array.from(this.tickets.values()).filter(
      (t) =>
        (!filter.resourceId || t.resourceId === filter.resourceId) &&
        (!filter.incidentId || t.incidentId === filter.incidentId) &&
        (!filter.status || t.status === filter.status)
    );
  }

  public getAllIncidents(): CorrelatedIncident[] {
    return Array.from(this.incidents.values());
  }
}

export class InMemoryAvailabilityControl implements AvailabilityControl {
  private unavailable = new Set<string>();
  private disabledHistory: DisabledItem[] = [];

  /** `itemNames` maps item IDs to display names for the disabled-items report. */
  constructor(private itemNames: Record<string, string> = {}) {}

  public async disableItem(itemId: string, resourceId: string, reason: string): Promise<void> {
    this.unavailable.add(`${itemId}::${resourceId}`);
    this.disabledHistory.push({
      itemId,
      itemName: this.itemNames[itemId] || itemId,
      resourceId,
      disabledAt: new Date(),
      reason
    });
  }

  public async enableItem(itemId: string, resourceId: string): Promise<void> {
    this.unavailable.delete(`${itemId}::${resourceId}`);
  }

  public async isItemAvailable(itemId: string, resourceId: string): Promise<boolean> {
    return !this.unavailable.has(`${itemId}::${resourceId}`);
  }

  public async getDisabledItems(resourceId?: string): Promise<DisabledItem[]> {
    return resourceId ? this.disabledHistory.filter((d) => d.resourceId === resourceId) : [...this.disabledHistory];
  }
}
