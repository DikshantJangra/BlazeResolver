import { BlazeResolverPipeline } from '../core/pipeline/index.js';
import { CustomerInput } from '../core/types.js';

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  status: 'open' | 'closed' | 'pending';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  subject: string;
  category: string;
  assignedTo?: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  orderId?: string;
  orderNumber?: string;
  orderTotalPaise?: number;
  orderStatus?: string;
  outletId?: string;
  outletName?: string;
  branchId?: string;
  branchName?: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  isEscalated?: boolean;
  pulseStatus?: string;
  isHumanTakeover?: boolean;
  humanTakeoverReason?: string | null;
  aiAssisted?: boolean;
  lastAiReplyAt?: string | null;
  // BlazeResolver AI Execution Metrics & Triage Report
  aiReport?: {
    triageId?: string;
    intent?: string;
    sentiment?: string;
    urgencyScore?: number;
    guardrailPassed?: boolean;
    isPromptInjection?: boolean;
    policyAllowed?: boolean;
    policyRationale?: string;
    suggestedAction?: string;
    requiresHitl?: boolean;
    claimedAmount?: number;
    incidentId?: string;
    incidentTitle?: string;
    clusterKey?: string;
    isSystemic?: boolean;
    executionDurationMs?: number;
    processedAt?: string;
  };
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  body?: string;
  authorName?: string;
  senderName?: string;
  senderType?: 'user' | 'agent' | 'system' | 'bot';
  internalNote?: boolean;
  attachments?: Array<{ name: string; url: string; mimeType?: string; size?: number }>;
  createdAt: string;
}

export interface CustomerContext {
  userId?: string;
  name?: string;
  email?: string;
  phone?: string;
  planName?: string;
  outletName?: string;
  isVip?: boolean;
  lifetimeSpendPaise?: number;
  recentTickets?: Array<{ id: string; ticketNumber: string; subject: string; status: string; createdAt: string }>;
  recentOrders?: Array<{
    id: string;
    orderNumber: string;
    totalPaise: number;
    status: string;
    createdAt: string;
    itemsSummary?: string;
    outletName?: string;
  }>;
}

export interface SupportCannedResponse {
  id: string;
  title: string;
  body: string;
  category?: string;
  isAutoReply?: boolean;
}

export interface TicketRating {
  rating: number;
  comment?: string | null;
  createdAt?: string;
}

export class SupportStore {
  private tickets: Map<string, SupportTicket> = new Map();
  private messages: Map<string, SupportMessage[]> = new Map();
  private cannedResponses: SupportCannedResponse[] = [];
  private ratings: Map<string, TicketRating> = new Map();
  private ticketSeq = 1001;

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    // Seed canned responses
    this.cannedResponses = [
      {
        id: 'canned-1',
        title: 'Immediate Refund / Credit Confirmation',
        body: 'We apologize for the inconvenience! We have processed a credit directly to your account with zero deduction. You should see this immediately reflected on your dashboard.',
        category: 'refund',
        isAutoReply: false
      },
      {
        id: 'canned-2',
        title: 'AI Diagnostic Resolution Note',
        body: 'Our BlazeResolver AI triage engine verified this issue against our active policy. A fix has been recorded and relevant actions have been dispatched.',
        category: 'technical',
        isAutoReply: true
      },
      {
        id: 'canned-3',
        title: 'Escalated to Engineering Core',
        body: 'We have logged this bug report into our dev pipeline. Our engineering team is currently investigating with high priority.',
        category: 'technical',
        isAutoReply: false
      },
      {
        id: 'canned-4',
        title: 'Order Status & Dispatch Check',
        body: 'Your order is verified and currently in transit. Delivery partner has confirmed dispatch. Please allow a few minutes for arrival.',
        category: 'orders',
        isAutoReply: false
      }
    ];

    // Seed sample initial tickets
    const ticket1Id = 'tkt-1001';
    const ticket1: SupportTicket = {
      id: ticket1Id,
      ticketNumber: 'TKT-1001',
      status: 'open',
      priority: 'high',
      subject: 'Missing item in order #ORD-9821 - Salad not included',
      category: 'orders',
      customerId: 'cust_priya',
      customerName: 'Priya Sharma',
      customerEmail: 'priya.s@example.com',
      customerPhone: '+91 98765 43210',
      orderId: 'ORD-9821',
      orderNumber: '9821',
      orderTotalPaise: 45000,
      orderStatus: 'delivered',
      outletName: 'Downtown Kitchen Hub',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 1200000).toISOString(),
      lastMessageAt: new Date(Date.now() - 1200000).toISOString(),
      isEscalated: false,
      isHumanTakeover: false,
      aiAssisted: true,
      aiReport: {
        triageId: 'trg_9821',
        intent: 'missing_item',
        sentiment: 'frustrated',
        urgencyScore: 82,
        guardrailPassed: true,
        isPromptInjection: false,
        policyAllowed: true,
        policyRationale: 'Customer reported missing Caesar Salad (₹180). Auto-refund approved within policy limit (₹500).',
        suggestedAction: 'Issue ₹180 Wallet Credit',
        requiresHitl: false,
        claimedAmount: 180,
        isSystemic: false,
        executionDurationMs: 342,
        processedAt: new Date(Date.now() - 3600000).toISOString()
      }
    };

    const ticket2Id = 'tkt-1002';
    const ticket2: SupportTicket = {
      id: ticket2Id,
      ticketNumber: 'TKT-1002',
      status: 'open',
      priority: 'urgent',
      subject: 'Repeated cold food delivery from Downtown Hub',
      category: 'kitchen',
      customerId: 'cust_rahul',
      customerName: 'Rahul Verma',
      customerEmail: 'rahul.v@example.com',
      customerPhone: '+91 91234 56789',
      orderId: 'ORD-9844',
      orderNumber: '9844',
      orderTotalPaise: 89000,
      orderStatus: 'delivered',
      outletName: 'Downtown Kitchen Hub',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      updatedAt: new Date(Date.now() - 1800000).toISOString(),
      lastMessageAt: new Date(Date.now() - 1800000).toISOString(),
      isEscalated: true,
      pulseStatus: 'investigating',
      isHumanTakeover: true,
      humanTakeoverReason: 'Customer requested human agent escalation after systemic heat lamp incident detection.',
      aiAssisted: true,
      aiReport: {
        triageId: 'trg_9844',
        intent: 'food_quality',
        sentiment: 'angry',
        urgencyScore: 94,
        guardrailPassed: true,
        isPromptInjection: false,
        policyAllowed: false,
        policyRationale: 'Systemic thermal issue cluster detected. Exceeds auto-resolve limit. Kitchen manager alert dispatched.',
        suggestedAction: 'Supervisor intervention & 50% Courtesy Voucher',
        requiresHitl: true,
        claimedAmount: 445,
        incidentId: 'inc_thermal_downtown_01',
        incidentTitle: 'Downtown Hub Heat Lamp Station Failure',
        clusterKey: 'kitchen:cold_food:downtown',
        isSystemic: true,
        executionDurationMs: 418,
        processedAt: new Date(Date.now() - 7200000).toISOString()
      }
    };

    const ticket3Id = 'tkt-1003';
    const ticket3: SupportTicket = {
      id: ticket3Id,
      ticketNumber: 'TKT-1003',
      status: 'closed',
      priority: 'normal',
      subject: 'Inquiry on GST Invoice Download',
      category: 'billing',
      customerId: 'cust_arjun',
      customerName: 'Arjun Mehta',
      customerEmail: 'arjun.m@techcorp.in',
      customerPhone: '+91 99887 76655',
      orderId: 'ORD-9750',
      orderNumber: '9750',
      orderTotalPaise: 125000,
      orderStatus: 'completed',
      outletName: 'CyberCity Express',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 43200000).toISOString(),
      lastMessageAt: new Date(Date.now() - 43200000).toISOString(),
      isEscalated: false,
      isHumanTakeover: false,
      aiAssisted: true,
      aiReport: {
        triageId: 'trg_9750',
        intent: 'invoice_request',
        sentiment: 'neutral',
        urgencyScore: 35,
        guardrailPassed: true,
        isPromptInjection: false,
        policyAllowed: true,
        policyRationale: 'Automated invoice link generation successful.',
        suggestedAction: 'Provided direct GST download URL',
        requiresHitl: false,
        isSystemic: false,
        executionDurationMs: 210,
        processedAt: new Date(Date.now() - 86400000).toISOString()
      }
    };

    this.tickets.set(ticket1Id, ticket1);
    this.tickets.set(ticket2Id, ticket2);
    this.tickets.set(ticket3Id, ticket3);

    // Messages for Ticket 1
    this.messages.set(ticket1Id, [
      {
        id: 'msg-101',
        ticketId: ticket1Id,
        role: 'user',
        senderType: 'user',
        senderName: 'Priya Sharma',
        content: 'Hi, I received my order #ORD-9821 but the Caesar salad is completely missing from the bag!',
        body: 'Hi, I received my order #ORD-9821 but the Caesar salad is completely missing from the bag!',
        createdAt: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'msg-102',
        ticketId: ticket1Id,
        role: 'agent',
        senderType: 'bot',
        authorName: 'Blazzy AI',
        content: 'Hello Priya! I sincerely apologize for the missing Caesar Salad in order #ORD-9821. I have verified your order details and immediately processed a full refund credit of ₹180 back to your Blaze wallet. You can check your wallet balance right away!',
        body: 'Hello Priya! I sincerely apologize for the missing Caesar Salad in order #ORD-9821. I have verified your order details and immediately processed a full refund credit of ₹180 back to your Blaze wallet. You can check your wallet balance right away!',
        createdAt: new Date(Date.now() - 3580000).toISOString()
      },
      {
        id: 'msg-103',
        ticketId: ticket1Id,
        role: 'system',
        senderType: 'system',
        content: '⚡ BlazeResolver Policy Engine executed: Auto-credit ₹180 approved (Ref: IDEM_SALAD_9821).',
        body: '⚡ BlazeResolver Policy Engine executed: Auto-credit ₹180 approved (Ref: IDEM_SALAD_9821).',
        createdAt: new Date(Date.now() - 3570000).toISOString()
      },
      {
        id: 'msg-104',
        ticketId: ticket1Id,
        role: 'user',
        senderType: 'user',
        senderName: 'Priya Sharma',
        content: 'Thank you so much! That was super fast. Have a nice day!',
        body: 'Thank you so much! That was super fast. Have a nice day!',
        createdAt: new Date(Date.now() - 1200000).toISOString()
      }
    ]);

    // Messages for Ticket 2
    this.messages.set(ticket2Id, [
      {
        id: 'msg-201',
        ticketId: ticket2Id,
        role: 'user',
        senderType: 'user',
        senderName: 'Rahul Verma',
        content: 'This is the second time this week our burger and fries arrived stone cold from Downtown Hub. What is going on?',
        body: 'This is the second time this week our burger and fries arrived stone cold from Downtown Hub. What is going on?',
        createdAt: new Date(Date.now() - 7200000).toISOString()
      },
      {
        id: 'msg-202',
        ticketId: ticket2Id,
        role: 'agent',
        senderType: 'bot',
        authorName: 'Blazzy AI',
        content: 'Hi Rahul, we are very sorry for this frustrating experience. Our system has flagged a thermal anomaly at Downtown Kitchen Hub, and our kitchen management team has been alerted. I am connecting you with a senior human support specialist right away to assist you with compensation.',
        body: 'Hi Rahul, we are very sorry for this frustrating experience. Our system has flagged a thermal anomaly at Downtown Kitchen Hub, and our kitchen management team has been alerted. I am connecting you with a senior human support specialist right away to assist you with compensation.',
        createdAt: new Date(Date.now() - 7180000).toISOString()
      },
      {
        id: 'msg-203',
        ticketId: ticket2Id,
        role: 'system',
        senderType: 'system',
        content: '🚨 Correlated with Systemic Incident #inc_thermal_downtown_01. Human specialist handover triggered.',
        body: '🚨 Correlated with Systemic Incident #inc_thermal_downtown_01. Human specialist handover triggered.',
        createdAt: new Date(Date.now() - 7170000).toISOString()
      },
      {
        id: 'msg-204',
        ticketId: ticket2Id,
        role: 'agent',
        senderType: 'agent',
        authorName: 'DJ (Support Supervisor)',
        internalNote: true,
        content: 'Kitchen manager confirmed Station 2 heat lamp was faulty and has been replaced. Providing customer 50% discount voucher.',
        body: 'Kitchen manager confirmed Station 2 heat lamp was faulty and has been replaced. Providing customer 50% discount voucher.',
        createdAt: new Date(Date.now() - 1800000).toISOString()
      }
    ]);

    // Rating for Ticket 3
    this.ratings.set(ticket3Id, {
      rating: 5,
      comment: 'Super fast instant resolution by the AI bot! Got my tax invoice in 2 seconds.',
      createdAt: new Date(Date.now() - 43000000).toISOString()
    });
  }

  public getTickets(filters?: {
    status?: string;
    priority?: string;
    category?: string;
    search?: string;
  }): SupportTicket[] {
    let result = Array.from(this.tickets.values());

    if (filters?.status) {
      result = result.filter((t) => t.status.toLowerCase() === filters.status?.toLowerCase());
    }
    if (filters?.priority) {
      result = result.filter((t) => t.priority.toLowerCase() === filters.priority?.toLowerCase());
    }
    if (filters?.category) {
      result = result.filter((t) => t.category.toLowerCase() === filters.category?.toLowerCase());
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (t) =>
          t.subject.toLowerCase().includes(q) ||
          t.ticketNumber.toLowerCase().includes(q) ||
          (t.customerName && t.customerName.toLowerCase().includes(q)) ||
          (t.orderNumber && t.orderNumber.toLowerCase().includes(q))
      );
    }

    // Sort newest lastMessageAt first
    return result.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }

  public getTicket(id: string): SupportTicket | undefined {
    return this.tickets.get(id);
  }

  public getMessages(ticketId: string): SupportMessage[] {
    return this.messages.get(ticketId) || [];
  }

  public addMessage(ticketId: string, message: Omit<SupportMessage, 'id' | 'createdAt'>): SupportMessage {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    const newMessage: SupportMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString()
    };

    const list = this.messages.get(ticketId) || [];
    list.push(newMessage);
    this.messages.set(ticketId, list);

    ticket.lastMessageAt = newMessage.createdAt;
    ticket.updatedAt = newMessage.createdAt;
    this.tickets.set(ticketId, ticket);

    return newMessage;
  }

  public async createTicketFromCustomer(
    data: {
      subject: string;
      rawText: string;
      category?: string;
      orderId?: string;
      customerId?: string;
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
      outletName?: string;
    },
    pipeline?: BlazeResolverPipeline
  ): Promise<{ ticket: SupportTicket; initialMessage: SupportMessage; aiReply?: SupportMessage }> {
    const id = `tkt-${++this.ticketSeq}`;
    const ticketNumber = `TKT-${this.ticketSeq}`;
    const now = new Date().toISOString();

    let aiReport: SupportTicket['aiReport'] = undefined;
    let aiResponseText: string | undefined = undefined;

    if (pipeline) {
      try {
        const input: CustomerInput = {
          id: `req_${id}`,
          channel: 'text',
          rawText: data.rawText,
          orderId: data.orderId,
          customerId: data.customerId || 'cust_user',
          timestamp: new Date()
        };

        const result = await pipeline.processComplaint(input);
        aiReport = {
          triageId: result.triage.id,
          intent: result.triage.intent,
          sentiment: result.triage.sentiment,
          urgencyScore: result.triage.urgencyScore,
          guardrailPassed: result.triage.guardrailPassed,
          isPromptInjection: result.triage.isPromptInjection,
          policyAllowed: result.resolution.policyDecision.allowed,
          policyRationale: result.resolution.policyDecision.rationale,
          suggestedAction: result.resolution.policyDecision.recommendedAction,
          requiresHitl: result.resolution.hitlRequired,
          claimedAmount: result.triage.claimedAmount,
          incidentId: result.correlation.incident?.incidentId,
          incidentTitle: result.correlation.incident?.title,
          clusterKey: result.correlation.cluster?.clusterKey,
          isSystemic: result.correlation.isSystemic,
          executionDurationMs: result.executionDurationMs,
          processedAt: result.timestamp instanceof Date ? result.timestamp.toISOString() : String(result.timestamp)
        };
        aiResponseText = result.response.text;
      } catch (err) {
        console.error('AI pipeline processing error for ticket:', err);
      }
    }

    const newTicket: SupportTicket = {
      id,
      ticketNumber,
      status: 'open',
      priority: aiReport?.urgencyScore && aiReport.urgencyScore > 75 ? 'urgent' : 'normal',
      subject: data.subject || (data.rawText.slice(0, 50) + (data.rawText.length > 50 ? '...' : '')),
      category: data.category || aiReport?.intent || 'general',
      customerId: data.customerId || 'cust_user',
      customerName: data.customerName || 'Customer',
      customerEmail: data.customerEmail || 'customer@example.com',
      customerPhone: data.customerPhone || '+91 98000 00000',
      orderId: data.orderId,
      orderNumber: data.orderId ? data.orderId.replace(/^[^\d]*/, '') : undefined,
      outletName: data.outletName || 'Downtown Kitchen Hub',
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      isEscalated: aiReport?.isSystemic || false,
      pulseStatus: aiReport?.isSystemic ? 'investigating' : undefined,
      isHumanTakeover: false,
      aiAssisted: true,
      lastAiReplyAt: aiResponseText ? now : null,
      aiReport
    };

    this.tickets.set(id, newTicket);

    const userMessage: SupportMessage = {
      id: `msg_${Date.now()}_u`,
      ticketId: id,
      role: 'user',
      senderType: 'user',
      senderName: newTicket.customerName,
      content: data.rawText,
      body: data.rawText,
      createdAt: now
    };

    const messagesList = [userMessage];

    let aiReply: SupportMessage | undefined;
    if (aiResponseText) {
      aiReply = {
        id: `msg_${Date.now()}_bot`,
        ticketId: id,
        role: 'agent',
        senderType: 'bot',
        authorName: 'Blazzy AI',
        content: aiResponseText,
        body: aiResponseText,
        createdAt: new Date(Date.now() + 500).toISOString()
      };
      messagesList.push(aiReply);
      newTicket.lastMessageAt = aiReply.createdAt;
    }

    this.messages.set(id, messagesList);
    return { ticket: newTicket, initialMessage: userMessage, aiReply };
  }

  public updateTicket(id: string, updates: Partial<SupportTicket>): SupportTicket {
    const ticket = this.tickets.get(id);
    if (!ticket) throw new Error(`Ticket ${id} not found`);

    const updated = {
      ...ticket,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.tickets.set(id, updated);
    return updated;
  }

  public getCustomerContext(customerIdOrOutletId: string): CustomerContext {
    const tickets = Array.from(this.tickets.values()).filter(
      (t) => t.customerId === customerIdOrOutletId || t.outletId === customerIdOrOutletId
    );

    return {
      userId: customerIdOrOutletId,
      name: tickets[0]?.customerName || 'Customer Profile',
      email: tickets[0]?.customerEmail || 'customer@example.com',
      phone: tickets[0]?.customerPhone || '+91 98765 43210',
      planName: 'Enterprise Diamond Diner',
      outletName: tickets[0]?.outletName || 'Downtown Kitchen Hub',
      isVip: true,
      lifetimeSpendPaise: 3840000,
      recentTickets: tickets.slice(0, 5).map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        status: t.status,
        createdAt: t.createdAt
      })),
      recentOrders: [
        {
          id: 'ORD-9821',
          orderNumber: '9821',
          totalPaise: 45000,
          status: 'delivered',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          itemsSummary: '1x Margherita Pizza, 1x Caesar Salad, 2x Cold Beverage',
          outletName: 'Downtown Kitchen Hub'
        },
        {
          id: 'ORD-9844',
          orderNumber: '9844',
          totalPaise: 89000,
          status: 'delivered',
          createdAt: new Date(Date.now() - 7200000).toISOString(),
          itemsSummary: '2x Truffle Burger, 1x Large Seasoned Fries',
          outletName: 'Downtown Kitchen Hub'
        }
      ]
    };
  }

  public getCannedResponses(): SupportCannedResponse[] {
    return this.cannedResponses;
  }

  public addCannedResponse(title: string, body: string, category?: string): SupportCannedResponse {
    const newCanned: SupportCannedResponse = {
      id: `canned-${Date.now()}`,
      title,
      body,
      category: category || 'general',
      isAutoReply: false
    };
    this.cannedResponses.unshift(newCanned);
    return newCanned;
  }

  public updateCannedResponse(id: string, title: string, body: string): SupportCannedResponse {
    const index = this.cannedResponses.findIndex((c) => c.id === id);
    if (index === -1) throw new Error(`Canned response ${id} not found`);

    this.cannedResponses[index] = {
      ...this.cannedResponses[index],
      title,
      body
    };
    return this.cannedResponses[index];
  }

  public deleteCannedResponse(id: string): boolean {
    const initialLen = this.cannedResponses.length;
    this.cannedResponses = this.cannedResponses.filter((c) => c.id !== id);
    return this.cannedResponses.length < initialLen;
  }

  public setAutoReply(id: string): SupportCannedResponse[] {
    this.cannedResponses = this.cannedResponses.map((c) => ({
      ...c,
      isAutoReply: c.id === id ? !c.isAutoReply : false
    }));
    return this.cannedResponses;
  }

  public getRating(ticketId: string): TicketRating | null {
    return this.ratings.get(ticketId) || null;
  }

  public setRating(ticketId: string, rating: number, comment?: string): TicketRating {
    const r: TicketRating = {
      rating,
      comment,
      createdAt: new Date().toISOString()
    };
    this.ratings.set(ticketId, r);
    return r;
  }
}
