import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { BlazeResolverPipeline } from '../core/pipeline/index.js';
import { CustomerInput } from '../core/types.js';
import { retrieve } from '../answer/retrieve.js';

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
  intakeChannel?: string;
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
  githubIssueUrl?: string;
  githubIssueNumber?: number;
  githubBranch?: string;
  githubPullRequestUrl?: string;
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
    triageCategory?: string;
    triageSeverity?: string;
    triageItemName?: string;
    triageResourceId?: string;
    triageOrderId?: string;
    ragMatches?: string[];
    ragApplied?: boolean;
    resolutionActions?: Array<{ actionType: string; approvalStatus: string; amount?: number; reason?: string }>;
    responseChannel?: string;
    responseTone?: string;
    responseQualityPassed?: boolean;
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

/**
 * Saved replies for BlazeResolver's own demo desk (the example business in server.ts). Never a product's default:
 * they state things about orders and credits that are only true in the demo.
 */
export const DEMO_SAVED_REPLIES: SupportCannedResponse[] = [
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

export class SupportStore {
  private tickets: Map<string, SupportTicket> = new Map();
  private messages: Map<string, SupportMessage[]> = new Map();
  private cannedResponses: SupportCannedResponse[] = [];
  private ratings: Map<string, TicketRating> = new Map();
  private ticketSeq = 1001;
  private persistPath?: string;

  /** The saved replies a new or reset store starts with. */
  private readonly initialReplies: SupportCannedResponse[];

  /**
   * Starts with no saved replies: a product's desk answers only from its own docs and the replies its team writes.
   * Pass persistPath or set BLAZE_SUPPORT_DATA_PATH to persist tickets and messages across process restarts.
   */
  constructor(options: { savedReplies?: SupportCannedResponse[]; persistPath?: string } = {}) {
    this.initialReplies = options.savedReplies ?? [];
    this.persistPath = options.persistPath ?? (typeof process !== 'undefined' ? process.env.BLAZE_SUPPORT_DATA_PATH : undefined);
    this.seedDefaults();
    this.loadState();
  }

  private seedDefaults() {
    this.cannedResponses = this.initialReplies.map((reply) => ({ ...reply }));
  }

  private loadState(): void {
    if (!this.persistPath) return;
    try {
      if (existsSync(this.persistPath)) {
        const raw = readFileSync(this.persistPath, 'utf8');
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') {
          if (Array.isArray(data.tickets)) {
            for (const t of data.tickets) this.tickets.set(t.id, t);
          }
          if (data.messages && typeof data.messages === 'object') {
            for (const [k, msgs] of Object.entries(data.messages)) {
              if (Array.isArray(msgs)) this.messages.set(k, msgs as SupportMessage[]);
            }
          }
          if (Array.isArray(data.cannedResponses) && data.cannedResponses.length > 0) {
            this.cannedResponses = data.cannedResponses;
          }
          if (data.ratings && typeof data.ratings === 'object') {
            for (const [k, r] of Object.entries(data.ratings)) {
              this.ratings.set(k, r as TicketRating);
            }
          }
          if (typeof data.ticketSeq === 'number') {
            this.ticketSeq = data.ticketSeq;
          }
        }
      }
    } catch (err) {
      console.warn(`[blazeresolver] could not load support store from ${this.persistPath}:`, err);
    }
  }

  private saveState(): void {
    if (!this.persistPath) return;
    try {
      const dir = dirname(this.persistPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const serialized = JSON.stringify(
        {
          tickets: Array.from(this.tickets.values()),
          messages: Object.fromEntries(this.messages.entries()),
          cannedResponses: this.cannedResponses,
          ratings: Object.fromEntries(this.ratings.entries()),
          ticketSeq: this.ticketSeq,
          savedAt: new Date().toISOString()
        },
        null,
        2
      );
      const tmp = `${this.persistPath}.tmp.${Date.now()}`;
      writeFileSync(tmp, serialized, 'utf8');
      renameSync(tmp, this.persistPath);
    } catch (err) {
      console.warn(`[blazeresolver] could not persist support store to ${this.persistPath}:`, err);
    }
  }

  public resetAll(): void {
    this.tickets.clear();
    this.messages.clear();
    this.ratings.clear();
    this.ticketSeq = 1001;
    this.seedDefaults();
    this.saveState();
  }

  public getTickets(filters?: {
    status?: string;
    priority?: string;
    category?: string;
    search?: string;
    customerEmail?: string;
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
    if (filters?.customerEmail) {
      const email = filters.customerEmail.trim().toLowerCase();
      result = result.filter((t) => t.customerEmail?.trim().toLowerCase() === email);
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
    this.saveState();

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
      intakeChannel?: string;
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
        const docsContext = this.cannedResponses.map((response) => `## ${response.title}\n${response.body}`).join('\n\n');
        const relevant = retrieve(docsContext, data.rawText, 2);
        let ragApplied = false;
        let responseText = result.response.text;
        if (relevant.length && result.triage.sentiment === 'frustrated') {
          const title = relevant[0].headings[relevant[0].headings.length - 1];
          const matched = this.cannedResponses.find((response) => response.title === title);
          if (matched) {
            ragApplied = true;
            if (!responseText.includes(matched.body.slice(0, 20))) responseText = `${responseText}\n\n${matched.body}`;
          }
        }
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
          ragMatches: relevant.map((chunk) => {
            const excerpt = chunk.text.replace(/\s+/g, ' ').trim();
            return `${chunk.headings.join(' > ') || 'Knowledge'}: ${excerpt.slice(0, 180)}${excerpt.length > 180 ? '…' : ''}`;
          }),
          ragApplied,
          resolutionActions: result.resolution.actions.map(({ actionType, approvalStatus, amount, reason }) => ({
            actionType,
            approvalStatus,
            amount,
            reason
          })),
          responseChannel: result.response.channel,
          responseTone: result.response.tone,
          responseQualityPassed: result.response.qualityPassed,
          incidentId: result.correlation.incident?.incidentId,
          incidentTitle: result.correlation.incident?.title,
          clusterKey: result.correlation.cluster?.clusterKey,
          isSystemic: result.correlation.isSystemic,
          executionDurationMs: result.executionDurationMs,
          triageCategory: result.triage.category,
          triageSeverity: result.triage.severity,
          triageItemName: result.triage.itemName,
          triageResourceId: result.triage.resourceId,
          triageOrderId: result.triage.orderId,
          processedAt: result.timestamp instanceof Date ? result.timestamp.toISOString() : String(result.timestamp)
        };
        aiResponseText = responseText;
      } catch (err) {
        console.error('AI pipeline processing error for ticket:', err);
      }
    }

    const newTicket: SupportTicket = {
      id,
      ticketNumber,
      status: 'open',
      priority: aiReport?.urgencyScore != null && aiReport.urgencyScore >= 0.75 ? 'urgent' : 'normal',
      subject: data.subject || (data.rawText.slice(0, 50) + (data.rawText.length > 50 ? '...' : '')),
      category: data.category || aiReport?.intent || 'general',
      customerId: data.customerId || 'cust_user',
      customerName: data.customerName || 'Customer',
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      intakeChannel: data.intakeChannel || 'support_api',
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

    if (aiReport?.policyAllowed && aiReport?.suggestedAction && aiReport.suggestedAction !== 'create_ticket') {
      const actionMsg: SupportMessage = {
        id: `msg_${Date.now()}_act`,
        ticketId: id,
        role: 'agent',
        senderType: 'bot',
        authorName: 'Blazzy AI (Auto-Action)',
        content: `⚡ Action Completed: Successfully authorized ${aiReport.suggestedAction} of ₹${aiReport.claimedAmount || 150} for order #${newTicket.orderNumber || 'your order'}.`,
        body: `⚡ Action Completed: Successfully authorized ${aiReport.suggestedAction} of ₹${aiReport.claimedAmount || 150} for order #${newTicket.orderNumber || 'your order'}.`,
        createdAt: new Date(Date.now() + 1000).toISOString()
      };
      messagesList.push(actionMsg);
      newTicket.lastMessageAt = actionMsg.createdAt;
    }

    this.messages.set(id, messagesList);
    this.saveState();
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
    this.saveState();
    return updated;
  }

  public getCustomerContext(customerIdOrOutletId: string): CustomerContext {
    const tickets = Array.from(this.tickets.values()).filter(
      (t) => t.customerId === customerIdOrOutletId || t.outletId === customerIdOrOutletId
    );

    const first = tickets[0];
    return {
      userId: customerIdOrOutletId,
      name: first?.customerName || '',
      email: first?.customerEmail || '',
      phone: first?.customerPhone || '',
      outletName: first?.outletName || '',
      isVip: false,
      recentTickets: tickets.slice(0, 5).map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        status: t.status,
        createdAt: t.createdAt
      })),
      recentOrders: []
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
    this.saveState();
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
    this.saveState();
    return this.cannedResponses[index];
  }

  public deleteCannedResponse(id: string): boolean {
    const initialLen = this.cannedResponses.length;
    this.cannedResponses = this.cannedResponses.filter((c) => c.id !== id);
    const changed = this.cannedResponses.length < initialLen;
    if (changed) this.saveState();
    return changed;
  }

  public setAutoReply(id: string): SupportCannedResponse[] {
    this.cannedResponses = this.cannedResponses.map((c) => ({
      ...c,
      isAutoReply: c.id === id ? !c.isAutoReply : false
    }));
    this.saveState();
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
    this.saveState();
    return r;
  }
}

export * from './handler.js';
