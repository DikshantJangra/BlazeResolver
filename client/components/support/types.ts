export interface SupportTicket {
  id: string;
  ticketNumber: string;
  status: 'open' | 'closed' | 'pending';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  subject: string;
  category?: string;
  assignedTo?: string;
  customerId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  intakeChannel?: string;
  orderId?: string | null;
  orderNumber?: string | null;
  orderTotalPaise?: number | null;
  orderStatus?: string | null;
  outletId?: string;
  outletName?: string;
  branchId?: string;
  branchName?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
  isEscalated?: boolean;
  pulseStatus?: string;
  isHumanTakeover?: boolean;
  humanTakeoverReason?: string | null;
  aiAssisted?: boolean;
  lastAiReplyAt?: string | null;
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
  [key: string]: any;
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
  orgId?: string;
  outletId?: string;
  branchId?: string;
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
  [key: string]: any;
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

export const getBaseUrl = (): string => {
  return '/api';
};

export const getAuthHeaders = (): Record<string, string> => {
  return {
    'Content-Type': 'application/json'
  };
};
