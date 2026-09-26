import {
  OrderSource,
  RefundGateway,
  TicketSink,
  MenuControl,
  ResolverAdapters,
  Order,
  KitchenTiming,
  RefundReceipt,
  CreditReceipt,
  Ticket
} from '../../adapters/contracts.js';
import { TriagedComplaint, CorrelatedIncident } from '../../core/types.js';

export class BlazeEatsOrderSource implements OrderSource {
  private orders: Map<string, Order> = new Map();
  private kitchenTimings: Map<string, KitchenTiming> = new Map();
  private branchBaselines: Map<string, { avgMinutes: number; baselineMinutes: number }> = new Map([
    ['branch_cp_02', { avgMinutes: 12.4, baselineMinutes: 4.0 }],
    ['branch_ind_01', { avgMinutes: 4.2, baselineMinutes: 4.0 }],
    ['branch_kor_03', { avgMinutes: 4.8, baselineMinutes: 4.5 }],
  ]);

  constructor() {
    this.seedDefaultOrders();
  }

  public async getOrder(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) || null;
  }

  public async getOrdersByCustomer(customerId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(o => o.customerId === customerId);
  }

  public async getKitchenTiming(orderId: string): Promise<KitchenTiming | null> {
    return this.kitchenTimings.get(orderId) || null;
  }

  public async getBranchAveragePrepTime(branchId: string): Promise<{ avgMinutes: number; baselineMinutes: number }> {
    return this.branchBaselines.get(branchId) || { avgMinutes: 6.0, baselineMinutes: 4.0 };
  }

  public addOrder(order: Order, timing?: KitchenTiming): void {
    this.orders.set(order.id, order);
    if (timing) {
      this.kitchenTimings.set(order.id, timing);
    }
  }

  public getAllOrders(): Order[] {
    return Array.from(this.orders.values());
  }

  private seedDefaultOrders(): void {
    const now = new Date();

    // Seed all sample orders used across test suites & seed complaints
    const seedOrderList: Array<{
      id: string;
      customerId: string;
      customerName: string;
      branchId: string;
      dishId: string;
      dishName: string;
      amount: number;
      prepMinutes: number;
    }> = [
      { id: 'ord-1021', customerId: 'cust_amit_01', customerName: 'Amit Sharma', branchId: 'branch_cp_02', dishId: 'dish_biryani_01', dishName: 'Hyderabadi Dum Biryani', amount: 280, prepMinutes: 13.2 },
      { id: 'ord-1022', customerId: 'cust_priya_02', customerName: 'Priya Verma', branchId: 'branch_cp_02', dishId: 'dish_biryani_01', dishName: 'Hyderabadi Dum Biryani', amount: 280, prepMinutes: 12.8 },
      { id: 'ord-1023', customerId: 'cust_rahul_03', customerName: 'Rahul Mehta', branchId: 'branch_cp_02', dishId: 'dish_biryani_01', dishName: 'Hyderabadi Dum Biryani', amount: 295, prepMinutes: 14.1 },
      { id: 'ord-1024', customerId: 'cust_sneha_04', customerName: 'Sneha Patel', branchId: 'branch_cp_02', dishId: 'dish_biryani_01', dishName: 'Hyderabadi Dum Biryani', amount: 280, prepMinutes: 11.9 },
      { id: 'ord-1025', customerId: 'cust_vikram_05', customerName: 'Vikram Malhotra', branchId: 'branch_cp_02', dishId: 'dish_biryani_01', dishName: 'Hyderabadi Dum Biryani', amount: 310, prepMinutes: 13.5 },
      { id: 'ord-1040', customerId: 'cust_rohit_09', customerName: 'Rohit Nair', branchId: 'branch_ind_01', dishId: 'dish_dessert_05', dishName: 'Gulab Jamun (2 pcs)', amount: 260, prepMinutes: 4.1 },
      { id: 'ord-1041', customerId: 'cust_karan_10', customerName: 'Karan Mehra', branchId: 'branch_ind_01', dishId: 'dish_naan_04', dishName: 'Butter Garlic Naan', amount: 240, prepMinutes: 3.8 },
      { id: 'ord-1042', customerId: 'cust_divya_11', customerName: 'Divya Iyer', branchId: 'branch_kor_03', dishId: 'dish_paneer_03', dishName: 'Paneer Tikka Masala', amount: 320, prepMinutes: 4.5 },
      { id: 'ord-1043', customerId: 'cust_samir_12', customerName: 'Samir Joshi', branchId: 'branch_kor_03', dishId: 'dish_butter_chicken_02', dishName: 'Dal Makhani Combo', amount: 290, prepMinutes: 4.2 },
      { id: 'ord-1044', customerId: 'cust_tanvi_13', customerName: 'Tanvi Sen', branchId: 'branch_ind_01', dishId: 'dish_pizza_06', dishName: 'Classic Margherita Pizza', amount: 350, prepMinutes: 16.0 },
      { id: 'ord-1045', customerId: 'cust_manish_14', customerName: 'Manish Gupta', branchId: 'branch_cp_02', dishId: 'dish_biryani_01', dishName: 'Dum Biryani Box', amount: 320, prepMinutes: 15.0 },
      { id: 'ord-1046', customerId: 'cust_neha_15', customerName: 'Neha Rao', branchId: 'branch_cp_02', dishId: 'dish_paneer_03', dishName: 'Paneer Tikka Masala', amount: 260, prepMinutes: 5.0 },
      { id: 'ord-1047', customerId: 'cust_arjun_16', customerName: 'Arjun Das', branchId: 'branch_cp_02', dishId: 'dish_paneer_03', dishName: 'Paneer Tikka Masala', amount: 260, prepMinutes: 5.2 },
      { id: 'ord-1048', customerId: 'cust_kavita_21', customerName: 'Kavita Singh', branchId: 'branch_cp_02', dishId: 'dish_burger_07', dishName: 'Crispy Burger Box', amount: 280, prepMinutes: 4.0 },
    ];

    seedOrderList.forEach(item => {
      this.orders.set(item.id, {
        id: item.id,
        customerId: item.customerId,
        customerName: item.customerName,
        branchId: item.branchId,
        branchName: item.branchId === 'branch_cp_02' ? 'Connaught Place Flagship (Branch 2)' : item.branchId === 'branch_ind_01' ? 'Indiranagar (Branch 1)' : 'Koramangala (Branch 3)',
        items: [
          { id: item.dishId, name: item.dishName, quantity: 1, unitPrice: item.amount, totalPrice: item.amount }
        ],
        totalAmount: item.amount,
        deliveryFee: 30,
        tax: 15,
        status: 'delivered',
        orderedAt: new Date(now.getTime() - 45 * 60 * 1000),
        deliveredAt: new Date(now.getTime() - 15 * 60 * 1000),
        paymentMethod: 'upi',
        paymentId: `pay_upi_${item.id}`
      });

      this.kitchenTimings.set(item.id, {
        orderId: item.id,
        branchId: item.branchId,
        prepStart: new Date(now.getTime() - 40 * 60 * 1000),
        prepEnd: new Date(now.getTime() - (40 - item.prepMinutes) * 60 * 1000),
        prepMinutes: item.prepMinutes,
        baselineMinutes: 4.0,
        isBottleneck: item.prepMinutes > 8.0,
        station: item.branchId === 'branch_cp_02' ? 'Biryani Expedite Station 2' : 'General Line 1',
        chefNotes: item.prepMinutes > 8.0 ? 'Station backlog; heat-lamp saturation' : 'Standard prep'
      });
    });

    // High value party order for HITL Money-Gate demo (₹1,450)
    this.orders.set('ord-1030', {
      id: 'ord-1030',
      customerId: 'cust_ananya_08',
      customerName: 'Ananya Roy',
      branchId: 'branch_cp_02',
      branchName: 'Connaught Place Flagship (Branch 2)',
      items: [
        { id: 'dish_butter_chicken_02', name: 'Butter Chicken (Family Pack)', quantity: 2, unitPrice: 550, totalPrice: 1100 },
        { id: 'dish_naan_04', name: 'Butter Garlic Naan (Pack of 5)', quantity: 1, unitPrice: 250, totalPrice: 250 },
        { id: 'dish_dessert_05', name: 'Gulab Jamun Platter', quantity: 1, unitPrice: 100, totalPrice: 100 }
      ],
      totalAmount: 1450,
      deliveryFee: 40,
      tax: 72,
      status: 'delivered',
      orderedAt: new Date(now.getTime() - 60 * 60 * 1000),
      deliveredAt: new Date(now.getTime() - 25 * 60 * 1000),
      paymentMethod: 'card',
      paymentId: 'pay_card_1030'
    });

    // Normal fast orders at Indiranagar (Branch 1)
    this.orders.set('ord-1040', {
      id: 'ord-1040',
      customerId: 'cust_rohit_09',
      customerName: 'Rohit Nair',
      branchId: 'branch_ind_01',
      branchName: 'Indiranagar (Branch 1)',
      items: [
        { id: 'dish_paneer_03', name: 'Paneer Tikka Masala', quantity: 1, unitPrice: 260, totalPrice: 260 }
      ],
      totalAmount: 260,
      deliveryFee: 30,
      tax: 13,
      status: 'delivered',
      orderedAt: new Date(now.getTime() - 35 * 60 * 1000),
      deliveredAt: new Date(now.getTime() - 10 * 60 * 1000),
      paymentMethod: 'upi',
      paymentId: 'pay_upi_1040'
    });

    this.kitchenTimings.set('ord-1040', {
      orderId: 'ord-1040',
      branchId: 'branch_ind_01',
      prepStart: new Date(now.getTime() - 32 * 60 * 1000),
      prepEnd: new Date(now.getTime() - 28 * 60 * 1000),
      prepMinutes: 4.1,
      baselineMinutes: 4.0,
      isBottleneck: false,
      station: 'Curry Station 1'
    });
  }
}

export class BlazeEatsRefundGateway implements RefundGateway {
  private refunds: Map<string, RefundReceipt> = new Map();
  private credits: Map<string, CreditReceipt> = new Map();
  private customerBalances: Map<string, number> = new Map();

  public async issueRefund(orderId: string, amount: number, idempotencyKey: string): Promise<RefundReceipt> {
    // Check idempotency
    const existing = Array.from(this.refunds.values()).find(r => r.idempotencyKey === idempotencyKey);
    if (existing) {
      return { ...existing, isDuplicateRequest: true };
    }

    const receipt: RefundReceipt = {
      refundId: `rfnd_rzp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      orderId,
      amount,
      currency: 'INR',
      idempotencyKey,
      gatewayReference: `rzp_txn_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      status: 'processed',
      processedAt: new Date()
    };

    this.refunds.set(receipt.refundId, receipt);
    return receipt;
  }

  public async issueCredit(customerId: string, amount: number, idempotencyKey: string): Promise<CreditReceipt> {
    const existing = Array.from(this.credits.values()).find(c => c.idempotencyKey === idempotencyKey);
    if (existing) {
      return { ...existing, isDuplicateRequest: true };
    }

    const currentBalance = this.customerBalances.get(customerId) || 0;
    const newBalance = currentBalance + amount;
    this.customerBalances.set(customerId, newBalance);

    const receipt: CreditReceipt = {
      creditId: `crd_wlt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      customerId,
      amount,
      currency: 'INR',
      idempotencyKey,
      newBalance,
      status: 'processed',
      processedAt: new Date()
    };

    this.credits.set(receipt.creditId, receipt);
    return receipt;
  }

  public async getRefundStatus(idempotencyKey: string): Promise<RefundReceipt | null> {
    return Array.from(this.refunds.values()).find(r => r.idempotencyKey === idempotencyKey) || null;
  }

  public getAllRefunds(): RefundReceipt[] {
    return Array.from(this.refunds.values());
  }

  public getAllCredits(): CreditReceipt[] {
    return Array.from(this.credits.values());
  }
}

export class BlazeEatsTicketSink implements TicketSink {
  private tickets: Map<string, Ticket> = new Map();
  private incidents: Map<string, CorrelatedIncident> = new Map();

  public async createTicket(complaint: TriagedComplaint): Promise<Ticket> {
    const ticket: Ticket = {
      id: `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      complaintId: complaint.id,
      customerId: complaint.customerId,
      orderId: complaint.orderId,
      branchId: complaint.branchId || 'branch_cp_02',
      title: `${complaint.category.replace('_', ' ').toUpperCase()}: ${complaint.dish || 'Order inquiry'}`,
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
    incidentData?: Partial<CorrelatedIncident>
  ): Promise<CorrelatedIncident> {
    const incidentId = `inc_kds_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const now = new Date();

    const incident: CorrelatedIncident = {
      incidentId,
      title: incidentData?.title || `Operational Bottleneck - ${incidentData?.branchId || 'Branch'}`,
      summary: incidentSummary,
      branchId: incidentData?.branchId || 'branch_cp_02',
      category: incidentData?.category || 'cold_food',
      dishId: incidentData?.dishId,
      dishName: incidentData?.dishName,
      ticketIds,
      complaintCount: ticketIds.length,
      avgTicketTimeMinutes: incidentData?.avgTicketTimeMinutes || 12.0,
      baselineTimeMinutes: incidentData?.baselineTimeMinutes || 4.0,
      delayRatio: incidentData?.delayRatio || 3.0,
      status: 'investigating',
      recommendedAction: incidentData?.recommendedAction || 'Alert kitchen staff and shift supervisor.',
      managerNotified: false,
      dishDisabled: false,
      createdAt: now,
      updatedAt: now
    };

    this.incidents.set(incidentId, incident);

    // Update tickets to linked status
    for (const tktId of ticketIds) {
      const tkt = this.tickets.get(tktId);
      if (tkt) {
        tkt.status = 'linked_to_incident';
        tkt.incidentId = incidentId;
      }
    }

    return incident;
  }

  public async routeToManager(ticketIdOrIncidentId: string, branchId: string, notes?: string): Promise<void> {
    const incident = this.incidents.get(ticketIdOrIncidentId);
    if (incident) {
      incident.managerNotified = true;
      incident.updatedAt = new Date();
    }

    const ticket = this.tickets.get(ticketIdOrIncidentId);
    if (ticket) {
      ticket.status = 'escalated_to_manager';
      ticket.assignedManager = `Manager @ ${branchId}`;
    }
  }

  public async getTickets(): Promise<Ticket[]> {
    return Array.from(this.tickets.values());
  }

  public getAllIncidents(): CorrelatedIncident[] {
    return Array.from(this.incidents.values());
  }
}

export class BlazeEatsMenuControl implements MenuControl {
  private dishAvailability: Map<string, boolean> = new Map([
    ['dish_biryani_01::branch_cp_02', true],
    ['dish_butter_chicken_02::branch_cp_02', true],
    ['dish_paneer_03::branch_cp_02', true],
    ['dish_naan_04::branch_cp_02', true],
  ]);

  private disabledHistory: Array<{ dishId: string; dishName: string; branchId: string; disabledAt: Date; reason: string }> = [];

  public async disableDish(dishId: string, branchId: string, reason: string): Promise<void> {
    const key = `${dishId}::${branchId}`;
    this.dishAvailability.set(key, false);

    const dishNameMap: Record<string, string> = {
      dish_biryani_01: 'Hyderabadi Dum Biryani',
      dish_butter_chicken_02: 'Butter Chicken',
      dish_paneer_03: 'Paneer Tikka Masala',
      dish_naan_04: 'Butter Garlic Naan',
      dish_dessert_05: 'Gulab Jamun',
      dish_pizza_06: 'Classic Margherita Pizza'
    };

    this.disabledHistory.push({
      dishId,
      dishName: dishNameMap[dishId] || dishId,
      branchId,
      disabledAt: new Date(),
      reason
    });
  }

  public async enableDish(dishId: string, branchId: string): Promise<void> {
    const key = `${dishId}::${branchId}`;
    this.dishAvailability.set(key, true);
  }

  public async getDishAvailability(dishId: string, branchId: string): Promise<boolean> {
    const key = `${dishId}::${branchId}`;
    return this.dishAvailability.get(key) ?? true;
  }

  public async getDisabledDishes(branchId?: string): Promise<Array<{ dishId: string; dishName: string; branchId: string; disabledAt: Date; reason: string }>> {
    if (branchId) {
      return this.disabledHistory.filter(d => d.branchId === branchId);
    }
    return [...this.disabledHistory];
  }
}

export function createBlazeEatsAdapters(): ResolverAdapters {
  return {
    orderSource: new BlazeEatsOrderSource(),
    refundGateway: new BlazeEatsRefundGateway(),
    ticketSink: new BlazeEatsTicketSink(),
    menuControl: new BlazeEatsMenuControl()
  };
}
