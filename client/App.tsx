import React, { useState, useEffect, useRef } from 'react';
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiCpu,
  FiDollarSign,
  FiLayers,
  FiMic,
  FiMicOff,
  FiPlay,
  FiRefreshCw,
  FiSend,
  FiShield,
  FiUserCheck,
  FiZap,
  FiChevronRight,
  FiDatabase,
  FiLock,
  FiInbox,
  FiTrendingUp,
  FiPlus,
  FiX
} from 'react-icons/fi';
import { TbGitFork, TbArrowsExchange } from 'react-icons/tb';
import { RiCustomerService2Line, RiCpuLine, RiRobot2Line, RiSparklingLine } from 'react-icons/ri';
import { VoiceAgentConsole } from './components/VoiceAgentConsole.js';
import { TicketFeed } from './components/support/TicketFeed.js';
import { TicketChatThread } from './components/support/TicketChatThread.js';
import { CustomerContextPanel } from './components/support/CustomerContextPanel.js';
import { CannedResponsesDrawer } from './components/support/CannedResponsesDrawer.js';
import { CloseTicketModal } from './components/support/CloseTicketModal.js';
import { EscalateTicketModal } from './components/support/EscalateTicketModal.js';
import { BlazzyIcon, BlazzyBadge } from './components/support/BlazzyMascot.js';
import type { SupportTicket, SupportMessage, CustomerContext, SupportCannedResponse, TicketRating } from './components/support/types.js';

export interface PipelineResult {
  complaintId: string;
  input: {
    id: string;
    channel: string;
    rawText: string;
    orderId?: string;
    customerId?: string;
    resourceId?: string;
    timestamp: string;
  };
  triage: {
    id: string;
    intent: string;
    category: string;
    severity: string;
    sentiment: string;
    itemName?: string;
    resourceId?: string;
    orderId?: string;
    claimedAmount?: number;
    urgencyScore: number;
    isPromptInjection: boolean;
    guardrailPassed: boolean;
    incidentLinked: boolean;
  };
  correlation: {
    isSystemic: boolean;
    cluster?: {
      clusterKey: string;
      resourceId: string;
      category: string;
      itemName?: string;
      count: number;
      signal?: SignalSummary;
      isAnomalous: boolean;
      rootCauseHypothesis?: string;
    };
    incident?: {
      incidentId: string;
      title: string;
      summary: string;
      resourceId: string;
      category: string;
      complaintCount: number;
      signal?: SignalSummary;
      managerNotified: boolean;
      itemDisabled: boolean;
      recommendedAction: string;
    };
  };
  resolution: {
    policyDecision: {
      allowed: boolean;
      rationale: string;
      recommendedAction: string;
      suggestedAmount?: number;
      requiresHitl: boolean;
    };
    actions: Array<{
      id: string;
      actionType: string;
      idempotencyKey: string;
      amount?: number;
      orderId?: string;
      reason: string;
      approvalStatus: string;
      executionResult?: any;
    }>;
    hitlRequired: boolean;
  };
  response: {
    text: string;
    channel: string;
    tone: string;
    containsRefundConfirmation: boolean;
    qualityPassed: boolean;
  };
  executionDurationMs: number;
  timestamp: string;
}

export interface SignalSummary {
  metric: string;
  label: string;
  unit: string;
  average: number;
  baseline: number;
  ratio: number;
}

export interface CorrelatedIncident {
  incidentId: string;
  title: string;
  summary: string;
  resourceId: string;
  category: string;
  itemName?: string;
  complaintCount: number;
  signal?: SignalSummary;
  status: string;
  recommendedAction: string;
  managerNotified: boolean;
  itemDisabled: boolean;
  createdAt: string;
}

export interface ProfileInfo {
  id: string;
  name: string;
  labels: { business: string; item: string; resource: string };
  currency: { code: string; symbol: string };
  moneyPolicy: { autoApproveThreshold: number; maxCreditAmount: number };
  categories: Array<{ id: string; label: string }>;
  items: Array<{ id: string; name: string }>;
  resources: Array<{ id: string; name: string }>;
  demo: {
    defaultCustomerId: string;
    sampleOrders: Array<{ id: string; label: string }>;
    samplePrompts: Array<{ label: string; text: string; tone?: 'warning' | 'danger' }>;
    complaintPlaceholder: string;
  };
}

export interface HitlAction {
  id: string;
  complaintId: string;
  actionType: string;
  idempotencyKey: string;
  amount?: number;
  orderId?: string;
  customerId?: string;
  reason: string;
  approvalStatus: string;
  createdAt: string;
}

export default function App() {
  // Live Support State
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [customerContext, setCustomerContext] = useState<CustomerContext | null>(null);
  const [cannedResponses, setCannedResponses] = useState<SupportCannedResponse[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Rating
  const [showCannedModal, setShowCannedModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [ticketRating, setTicketRating] = useState<TicketRating | null>(null);

  // Engine & Diagnostics State
  const [feed, setFeed] = useState<PipelineResult[]>([]);
  const [incidents, setIncidents] = useState<CorrelatedIncident[]>([]);
  const [hitlQueue, setHitlQueue] = useState<HitlAction[]>([]);
  const [adaptersData, setAdaptersData] = useState<any>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'context' | 'voice' | 'pipeline' | 'incidents' | 'hitl' | 'adapters'>('context');
  const [adapterSubTab, setAdapterSubTab] = useState<'orderSource' | 'refundGateway' | 'ticketSink' | 'availabilityControl'>('orderSource');

  // New Ticket / Inbound Input State
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [newTicketCategory, setNewTicketCategory] = useState('FOOD_QUALITY');
  const [newTicketPriority, setNewTicketPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [newTicketChannel, setNewTicketChannel] = useState<'text' | 'voice' | 'webhook' | 'email'>('text');
  const [newTicketOrderId, setNewTicketOrderId] = useState('');
  const [newTicketCustomerName, setNewTicketCustomerName] = useState('Sarah Jenkins');
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  // Sync state & live WebSocket
  useEffect(() => {
    fetchAllState();
    fetchProfile();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'pipeline_result') {
            setFeed((prev) => [msg.data, ...prev]);
            fetchAllState();
          } else if (msg.type === 'hitl_updated' || msg.type === 'pipeline_reset' || msg.type === 'ticket_updated') {
            fetchAllState();
          }
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };
      ws.onclose = () => setWsConnected(false);
    } catch (err) {
      console.warn('WS connection skipped:', err);
    }

    const interval = setInterval(fetchAllState, 4000);
    return () => {
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
    };
  }, [statusFilter, priorityFilter, categoryFilter, searchQuery]);

  const fetchAllState = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (searchQuery) params.set('search', searchQuery);

      const [ticketsRes, feedRes, incRes, hitlRes, adaptRes, cannedRes] = await Promise.all([
        fetch(`/api/support/tickets?${params.toString()}`).then((r) => r.json()).catch(() => ({ data: [] })),
        fetch('/api/pipeline/feed').then((r) => r.json()).catch(() => ({ results: [] })),
        fetch('/api/correlate/incidents').then((r) => r.json()).catch(() => ({ incidents: [] })),
        fetch('/api/hitl/queue').then((r) => r.json()).catch(() => ({ queue: [] })),
        fetch('/api/adapters/overview').then((r) => r.json()).catch(() => null),
        fetch('/api/support/canned-responses').then((r) => r.json()).catch(() => ({ data: [] }))
      ]);

      if (ticketsRes.success && Array.isArray(ticketsRes.data)) {
        setTickets(ticketsRes.data);
        setSelectedTicket((prev) => {
          if (!prev) return ticketsRes.data[0] || null;
          const match = ticketsRes.data.find((t: SupportTicket) => t.id === prev.id);
          return match ? { ...prev, ...match } : prev;
        });
      }
      if (feedRes.results) setFeed(feedRes.results);
      if (incRes.incidents) setIncidents(incRes.incidents);
      if (hitlRes.queue) setHitlQueue(hitlRes.queue);
      if (adaptRes) setAdaptersData(adaptRes);
      if (cannedRes.success) setCannedResponses(cannedRes.data);
    } catch (err) {
      console.error('Error fetching state:', err);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const data: ProfileInfo = await fetch('/api/profile').then((r) => r.json());
      setProfile(data);
      if (!newTicketOrderId && data.demo.sampleOrders[0]) {
        setNewTicketOrderId(data.demo.sampleOrders[0].id);
      }
    } catch (err) {
      console.error('Error fetching domain profile:', err);
    }
  };

  // When selected ticket changes, load messages & context
  useEffect(() => {
    if (!selectedTicket) {
      setMessages([]);
      setCustomerContext(null);
      setTicketRating(null);
      return;
    }

    let cancelled = false;
    const loadDetails = async () => {
      setIsLoadingMessages(true);
      try {
        const [msgRes, ctxRes, ratingRes] = await Promise.all([
          fetch(`/api/support/tickets/${selectedTicket.id}/messages`).then((r) => r.json()).catch(() => null),
          fetch(`/api/support/context/${selectedTicket.customerId || selectedTicket.outletId || 'cust_user'}`).then((r) => r.json()).catch(() => null),
          fetch(`/api/support/tickets/${selectedTicket.id}/rating`).then((r) => r.json()).catch(() => null)
        ]);

        if (!cancelled) {
          if (msgRes?.success) setMessages(msgRes.data || []);
          if (ctxRes?.success) setCustomerContext(ctxRes.data || null);
          if (ratingRes?.success && ratingRes.data) setTicketRating(ratingRes.data);
          else setTicketRating(null);
        }
      } catch (err) {
        console.error('Failed to load ticket details:', err);
      } finally {
        if (!cancelled) setIsLoadingMessages(false);
      }
    };

    loadDetails();
    return () => {
      cancelled = true;
    };
  }, [selectedTicket?.id]);

  const handleUpdateTicket = async (updates: Partial<SupportTicket>) => {
    if (!selectedTicket) return;
    try {
      const res = await fetch(`/api/support/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setSelectedTicket(json.data);
          setTickets((prev) => prev.map((t) => (t.id === json.data.id ? json.data : t)));
        }
      }
    } catch (err) {
      console.error('Failed to update ticket:', err);
    }
  };

  const handleSendMessage = async ({
    body,
    file,
    isInternalNote
  }: {
    body: string;
    file: File | null;
    isInternalNote: boolean;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!selectedTicket) return { success: false, error: 'No ticket selected' };

    try {
      const payload: Record<string, any> = {
        body,
        isInternalNote,
        senderType: isInternalNote ? 'agent' : selectedTicket.handledBy === 'ai' ? 'ai' : 'agent',
        senderName: isInternalNote ? 'Admin Operator' : selectedTicket.handledBy === 'ai' ? 'Blazzy AI' : 'Support Specialist'
      };

      if (file) {
        payload.attachmentUrl = URL.createObjectURL(file);
        payload.attachmentName = file.name;
        payload.attachmentType = file.type;
      }

      const res = await fetch(`/api/support/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setMessages((prev) => [...prev, json.data]);
          fetchAllState();
          return { success: true };
        }
      }
      return { success: false, error: 'Failed to send message' };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  };

  const handleCreateNewTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) return;

    setIsCreatingTicket(true);
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: newTicketSubject,
          message: newTicketMessage,
          category: newTicketCategory,
          priority: newTicketPriority,
          channel: newTicketChannel,
          orderNumber: newTicketOrderId || undefined,
          customerName: newTicketCustomerName || 'Valued Customer',
          customerEmail: 'customer@example.com'
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setShowNewTicketModal(false);
          setNewTicketSubject('');
          setNewTicketMessage('');
          await fetchAllState();
          setSelectedTicket(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to create ticket:', err);
    } finally {
      setIsCreatingTicket(false);
    }
  };

  const handleRunSeedDemo = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch('/api/pipeline/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchAllState();
      }
    } catch (err) {
      console.error('Error running seed demo:', err);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleResetState = async () => {
    try {
      await fetch('/api/pipeline/reset', { method: 'POST' });
      setFeed([]);
      setIncidents([]);
      setHitlQueue([]);
      await fetchAllState();
    } catch (err) {
      console.error('Error resetting state:', err);
    }
  };

  const handleHitlDecision = async (actionId: string, decision: 'approve' | 'reject') => {
    try {
      await fetch('/api/hitl/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, decision })
      });
      await fetchAllState();
    } catch (err) {
      console.error('Error updating HITL decision:', err);
    }
  };

  const handleToggleTakeover = async (enabled: boolean) => {

    if (!selectedTicket) return;
    try {
      const res = await fetch(`/api/support/tickets/${selectedTicket.id}/takeover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setSelectedTicket(json.data);
          setTickets((prev) => prev.map((t) => (t.id === json.data.id ? json.data : t)));
          const msgRes = await fetch(`/api/support/tickets/${selectedTicket.id}/messages`);
          const msgJson = await msgRes.json();
          if (msgJson.success) setMessages(msgJson.data);
        }
      }
    } catch (err) {
      console.error('Failed to toggle takeover:', err);
    }
  };

  const handleGenerateBlazzyDraft = async (prompt?: string): Promise<string | null> => {
    if (!selectedTicket) return null;
    try {
      const res = await fetch(`/api/support/tickets/${selectedTicket.id}/blazzy-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.draft) {
          return json.data.draft;
        }
      }
    } catch (err) {
      console.error('Failed to generate Blazzy draft:', err);
    }
    return null;
  };

  const handleConfirmEscalate = async (data: {
    title: string;
    type: 'bug' | 'feature' | 'note';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    note: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!selectedTicket) return { success: false, error: 'No ticket selected' };
    try {
      const res = await fetch(`/api/support/tickets/${selectedTicket.id}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (res.ok && json?.success) {
        setSelectedTicket(json.data);
        setTickets((prev) => prev.map((t) => (t.id === json.data.id ? json.data : t)));
        const msgRes = await fetch(`/api/support/tickets/${selectedTicket.id}/messages`);
        const msgJson = await msgRes.json();
        if (msgJson.success) setMessages(msgJson.data);
        return { success: true };
      }
      return { success: false, error: json?.error || 'Failed to escalate ticket' };
    } catch (err) {
      console.error('Failed to escalate ticket:', err);
      return { success: false, error: 'Connection error while escalating' };
    }
  };

  const handleConfirmCloseTicket = async (password: string): Promise<{ success: boolean; error?: string }> => {
    if (!selectedTicket) return { success: false, error: 'No ticket selected' };
    try {
      const res = await fetch(`/api/support/tickets/${selectedTicket.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSelectedTicket(json.data);
        setTickets((prev) => prev.map((t) => (t.id === json.data.id ? json.data : t)));
        return { success: true };
      }
      return { success: false, error: json?.error || 'Failed to close ticket' };
    } catch (err) {
      console.error('Failed to close ticket:', err);
      return { success: false, error: 'Error occurred while closing ticket' };
    }
  };

  const handleAddCannedResponse = async (title: string, body: string) => {
    try {
      const res = await fetch('/api/support/canned-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) setCannedResponses((prev) => [json.data, ...prev]);
      }
    } catch (err) {
      console.error('Failed to add canned response:', err);
    }
  };

  const handleUpdateCannedResponse = async (id: string, title: string, body: string) => {
    try {
      const res = await fetch(`/api/support/canned-responses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) setCannedResponses((prev) => prev.map((c) => (c.id === id ? json.data : c)));
      }
    } catch (err) {
      console.error('Failed to update canned response:', err);
    }
  };

  const handleDeleteCannedResponse = async (id: string) => {
    try {
      const res = await fetch(`/api/support/canned-responses/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setCannedResponses((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete canned response:', err);
    }
  };

  const handleSetAutoReply = async (id: string) => {
    try {
      const res = await fetch(`/api/support/canned-responses/${id}/set-auto-reply`, {
        method: 'POST'
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) setCannedResponses(json.data);
      }
    } catch (err) {
      console.error('Failed to set auto reply:', err);
    }
  };

  const handleSendCannedDirectly = async (bodyText: string) => {
    await handleSendMessage({ body: bodyText, file: null, isInternalNote: false });
  };


  const money = (amount: number | undefined) => `${profile?.currency.symbol ?? '$'}${amount ?? 0}`;
  const approvalThreshold = profile?.moneyPolicy.autoApproveThreshold ?? 300;
  const resourceLabel = profile?.labels.resource ?? 'Location';
  const itemLabel = profile?.labels.item ?? 'Item';

  // Metrics
  const totalTickets = tickets.length;
  const openTickets = tickets.filter((t) => t.status === 'open').length;
  const aiHandledCount = tickets.filter((t) => t.handledBy === 'ai').length;
  const autoResolvedRate = totalTickets > 0 ? Math.round((aiHandledCount / totalTickets) * 100) : 100;
  const hitlPendingCount = hitlQueue.length;
  const attacksBlockedCount = feed.filter((f) => f.triage.isPromptInjection).length;

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Universal Command Header */}
      <header className="h-14 bg-white border-b border-slate-200 px-5 flex items-center justify-between gap-4 shrink-0 shadow-2xs z-30">
        <div className="flex items-center gap-3">
          <BlazzyIcon className="w-8 h-8 rounded-xl object-contain border border-orange-200 bg-orange-50 p-1 shadow-2xs" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm tracking-tight text-slate-900">BlazeResolver</h1>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-800 border border-orange-200">
                AI Customer Resolution Command Center{profile ? ` • ${profile.name}` : ''}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
              Unified Autonomous Support Desk, Real-Time Voice Layer & Self-Healing Pipeline
            </p>
          </div>
        </div>

        {/* Global Live Stats Strip */}
        <div className="hidden xl:flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-medium">Active Tickets:</span>
            <span className="font-bold text-slate-900 font-mono">{totalTickets}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-purple-50 border border-purple-200">
            <span className="text-purple-700 font-medium">Incidents:</span>
            <span className="font-bold text-purple-900 font-mono">{incidents.length}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
            <span className="text-emerald-700 font-medium">AI Resolution:</span>
            <span className="font-bold text-emerald-900 font-mono">{autoResolvedRate}%</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-50 border border-amber-200">
            <span className="text-amber-700 font-medium">HITL Gated:</span>
            <span className="font-bold text-amber-900 font-mono">{hitlPendingCount}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-1">
            <span className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-emerald-500 badge-pulse' : 'bg-amber-500'}`}></span>
            <span className="text-[10.5px] font-mono font-medium text-slate-500 hidden md:inline">
              {wsConnected ? 'Socket Live' : 'Connecting...'}
            </span>
          </div>

          <button
            onClick={() => setShowNewTicketModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all shadow-xs"
          >
            <FiPlus className="w-3.5 h-3.5" />
            <span>+ New Claim / Ticket</span>
          </button>

          <button
            onClick={handleRunSeedDemo}
            disabled={isSeeding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all disabled:opacity-50 border border-slate-200"
            title="Seed real-world customer complaints benchmark"
          >
            <FiPlay className={`w-3.5 h-3.5 text-orange-600 ${isSeeding ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSeeding ? 'Seeding...' : 'Seed Benchmark'}</span>
          </button>

          <button
            onClick={handleResetState}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-all border border-slate-200"
            title="Reset pipeline & ticket stores"
          >
            <FiRefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Main 3-Column Unified Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* LEFT COLUMN: Unified Ingest & Ticket Feed */}
        <TicketFeed
          tickets={tickets}
          selectedTicket={selectedTicket}
          onSelectTicket={(ticket) => setSelectedTicket(ticket)}
          isLoading={isLoadingTickets}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={setPriorityFilter}
        />

        {/* CENTER COLUMN: Real-Time Live Resolution Desk & Conversation */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 bg-white overflow-hidden">
          <TicketChatThread
            selectedTicket={selectedTicket}
            messages={messages}
            cannedResponses={cannedResponses}
            isLoadingMessages={isLoadingMessages}
            ticketRating={ticketRating}
            onSendMessage={handleSendMessage}
            onUpdateTicket={handleUpdateTicket}
            onToggleTakeover={handleToggleTakeover}
            onGenerateBlazzyDraft={handleGenerateBlazzyDraft}
            onOpenEscalate={() => setShowEscalateModal(true)}
            onOpenCloseTicket={() => setShowCloseModal(true)}
          />
        </div>

        {/* RIGHT COLUMN: Multi-Tab Intelligence, Voice Layer & Engine Telemetry Inspector */}
        <div className="w-80 xl:w-96 bg-slate-50 flex flex-col min-h-0 overflow-hidden shrink-0 border-l border-slate-200">
          {/* Sub-Tabs Selector */}
          <div className="p-2 border-b border-slate-200 bg-white flex items-center gap-1 overflow-x-auto shadow-2xs">
            <button
              onClick={() => setInspectorTab('context')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                inspectorTab === 'context' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Customer 360
            </button>
            <button
              onClick={() => setInspectorTab('voice')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                inspectorTab === 'voice' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FiMic /> Voice Bridge
            </button>
            <button
              onClick={() => setInspectorTab('pipeline')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                inspectorTab === 'pipeline' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FiZap /> Pipeline ({feed.length})
            </button>
            <button
              onClick={() => setInspectorTab('incidents')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                inspectorTab === 'incidents' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FiActivity /> Incidents ({incidents.length})
            </button>
            <button
              onClick={() => setInspectorTab('hitl')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                inspectorTab === 'hitl' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FiUserCheck /> HITL ({hitlQueue.length})
            </button>
            <button
              onClick={() => setInspectorTab('adapters')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                inspectorTab === 'adapters' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <TbGitFork /> Adapters
            </button>
          </div>

          {/* Inspector Content Area */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
            {/* TAB 1: Customer Context & AI Triage Diagnostics */}
            {inspectorTab === 'context' && (
              <CustomerContextPanel
                customerContext={customerContext}
                selectedTicket={selectedTicket}
                ticketRating={ticketRating}
              />
            )}


            {/* TAB 2: Live Voice Agent Console */}
            {inspectorTab === 'voice' && (
              <div className="h-full min-h-[580px]">
                <VoiceAgentConsole
                  profile={profile}
                  onIncidentDetected={fetchAllState}
                  onHitlUpdated={fetchAllState}
                />
              </div>
            )}

            {/* TAB 3: 4-Stage Engine Pipeline Execution Stream */}
            {inspectorTab === 'pipeline' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <FiZap className="text-amber-500" /> Real-Time 4-Stage Execution
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">
                    {feed.length} Events
                  </span>
                </div>

                {feed.length === 0 ? (
                  <div className="p-6 bg-white border border-slate-200 rounded-xl text-center">
                    <FiPlay className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-700 font-bold">No pipeline executions yet</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      File a claim or click "Seed Benchmark" to stream live evaluations.
                    </p>
                  </div>
                ) : (
                  feed.map((item) => (
                    <div
                      key={item.complaintId}
                      className={`p-3 bg-white rounded-xl border shadow-2xs space-y-2 ${
                        item.correlation.isSystemic
                          ? 'border-purple-300 bg-purple-50/20'
                          : item.triage.isPromptInjection
                          ? 'border-red-300 bg-red-50/20'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-slate-700 uppercase">
                          {item.input.channel === 'voice' ? '🎙️ VOICE' : '💬 TEXT'} • #{item.triage.orderId || 'ORDER'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">{item.executionDurationMs}ms</span>
                      </div>

                      <p className="text-[11px] text-slate-800 italic bg-slate-50 p-2 rounded-lg border border-slate-200 font-normal">
                        "{item.input.rawText}"
                      </p>

                      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                        <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                          <span className="font-bold text-sky-700 block">1. TRIAGE</span>
                          <span className="text-slate-600 truncate block">{item.triage.category}</span>
                        </div>
                        <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                          <span className="font-bold text-purple-700 block">2. CORRELATE</span>
                          <span className="text-slate-600 truncate block">
                            {item.correlation.isSystemic ? 'Systemic' : 'Isolated'}
                          </span>
                        </div>
                        <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                          <span className="font-bold text-emerald-700 block">3. RESOLVE</span>
                          <span className="text-slate-600 truncate block">
                            {item.triage.isPromptInjection
                              ? 'Blocked'
                              : item.resolution.hitlRequired
                              ? 'HITL'
                              : item.resolution.actions[0]?.actionType || 'Safe'}
                          </span>
                        </div>
                        <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                          <span className="font-bold text-amber-700 block">4. RESPOND</span>
                          <span className="text-slate-600 truncate block">Pass</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 4: Correlated Incidents */}
            {inspectorTab === 'incidents' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <FiActivity className="text-purple-600" /> Correlated Systemic Incidents
                  </h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                    {incidents.length} Active
                  </span>
                </div>

                {incidents.length === 0 ? (
                  <div className="p-6 bg-white border border-slate-200 rounded-xl text-center">
                    <FiCheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-700 font-bold">No operational anomalies</p>
                    <p className="text-[11px] text-slate-500 mt-1">Buffer window is stable.</p>
                  </div>
                ) : (
                  incidents.map((inc) => (
                    <div
                      key={inc.incidentId}
                      className="p-3.5 bg-white border border-purple-200 rounded-xl shadow-2xs space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[9px] font-mono font-bold text-purple-700 uppercase">
                            SYSTEMIC INCIDENT • {inc.resourceId.toUpperCase()}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900">{inc.title}</h4>
                        </div>
                        {inc.signal && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800">
                            {inc.signal.ratio}x {inc.signal.label}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-700">{inc.summary}</p>

                      <div className="grid grid-cols-3 gap-1 bg-purple-50/50 p-2 rounded-lg border border-purple-100 text-center font-mono text-[10px]">
                        <div>
                          <div className="text-slate-500 font-sans text-[9px]">Tickets</div>
                          <div className="font-bold text-slate-900">{inc.complaintCount}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 font-sans text-[9px]">Signal</div>
                          <div className="font-bold text-red-600">{inc.signal?.average ?? 'n/a'}</div>
                        </div>
                        <div>
                          <div className="text-slate-500 font-sans text-[9px]">Baseline</div>
                          <div className="font-bold text-emerald-600">{inc.signal?.baseline ?? 'n/a'}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 5: HITL Money-Gate Queue */}
            {inspectorTab === 'hitl' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <FiUserCheck className="text-amber-600" /> Human Approval Queue
                  </h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {hitlQueue.length} Pending
                  </span>
                </div>

                {hitlQueue.length === 0 ? (
                  <div className="p-6 bg-white border border-slate-200 rounded-xl text-center">
                    <FiCheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-700 font-bold">HITL Queue Clean</p>
                    <p className="text-[11px] text-slate-500 mt-1">No claims waiting for human approval.</p>
                  </div>
                ) : (
                  hitlQueue.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 bg-white border border-amber-200 rounded-xl shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[9px] font-mono font-bold text-amber-800 uppercase">
                            HIGH-VALUE REFUND
                          </span>
                          <h4 className="text-xs font-bold text-slate-900">
                            Refund {money(item.amount)} ({item.orderId || 'Order'})
                          </h4>
                        </div>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          Pending Signoff
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-700">{item.reason}</p>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleHitlDecision(item.id, 'approve')}
                          className="flex-1 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all shadow-2xs"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleHitlDecision(item.id, 'reject')}
                          className="flex-1 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-all border border-slate-200"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 6: Adapters & BYO Hub */}
            {inspectorTab === 'adapters' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <TbGitFork className="text-sky-600" /> Adapter Telemetry
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-[10px] font-mono">
                  <button
                    onClick={() => setAdapterSubTab('orderSource')}
                    className={`py-1 rounded ${
                      adapterSubTab === 'orderSource' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    OrderSource
                  </button>
                  <button
                    onClick={() => setAdapterSubTab('refundGateway')}
                    className={`py-1 rounded ${
                      adapterSubTab === 'refundGateway' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    RefundGateway
                  </button>
                  <button
                    onClick={() => setAdapterSubTab('ticketSink')}
                    className={`py-1 rounded ${
                      adapterSubTab === 'ticketSink' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    TicketSink
                  </button>
                  <button
                    onClick={() => setAdapterSubTab('availabilityControl')}
                    className={`py-1 rounded ${
                      adapterSubTab === 'availabilityControl' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    Availability
                  </button>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 font-mono text-[10px] text-slate-800 max-h-64 overflow-y-auto">
                  {adapterSubTab === 'orderSource' && (
                    <pre className="text-slate-600 whitespace-pre-wrap">
                      {JSON.stringify(adaptersData?.orders?.slice(0, 3) || [], null, 2)}
                    </pre>
                  )}
                  {adapterSubTab === 'refundGateway' && (
                    <pre className="text-slate-600 whitespace-pre-wrap">
                      {JSON.stringify(adaptersData?.refunds || [], null, 2)}
                    </pre>
                  )}
                  {adapterSubTab === 'ticketSink' && (
                    <pre className="text-slate-600 whitespace-pre-wrap">
                      {JSON.stringify(adaptersData?.incidents || [], null, 2)}
                    </pre>
                  )}
                  {adapterSubTab === 'availabilityControl' && (
                    <pre className="text-slate-600 whitespace-pre-wrap">
                      {JSON.stringify(adaptersData?.disabledItems || [], null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Claim / Ticket Modal */}
      {showNewTicketModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <BlazzyIcon className="w-5 h-5" />
                <h3 className="font-bold text-sm text-slate-900">File Customer Claim / Inbound Ticket</h3>
              </div>
              <button
                onClick={() => setShowNewTicketModal(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewTicket} className="p-5 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cold Biryani delivered or Missing Item"
                  value={newTicketSubject}
                  onChange={(e) => setNewTicketSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500 font-medium bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={newTicketCustomerName}
                    onChange={(e) => setNewTicketCustomerName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500 bg-slate-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Order Number</label>
                  <input
                    type="text"
                    placeholder="e.g. ORD-9821"
                    value={newTicketOrderId}
                    onChange={(e) => setNewTicketOrderId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 font-mono focus:outline-none focus:border-orange-500 bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={newTicketCategory}
                    onChange={(e) => setNewTicketCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500 font-medium"
                  >
                    <option value="FOOD_QUALITY">Food Quality</option>
                    <option value="DELIVERY_DELAY">Delivery Delay</option>
                    <option value="MISSING_ITEM">Missing Item</option>
                    <option value="BILLING">Billing</option>
                    <option value="PROMPT_INJECTION">Security / Probe</option>
                    <option value="GENERAL">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={newTicketPriority}
                    onChange={(e) => setNewTicketPriority(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500 font-medium"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Channel</label>
                  <select
                    value={newTicketChannel}
                    onChange={(e) => setNewTicketChannel(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500 font-medium"
                  >
                    <option value="text">💬 Text / Chat</option>
                    <option value="voice">🎙️ Voice Bridge</option>
                    <option value="email">✉️ Email</option>
                    <option value="webhook">⚡ Webhook</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Customer Complaint Message</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the complaint in detail..."
                  value={newTicketMessage}
                  onChange={(e) => setNewTicketMessage(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500 font-medium bg-slate-50 focus:bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewTicketModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTicket || !newTicketSubject.trim() || !newTicketMessage.trim()}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-xs"
                >
                  {isCreatingTicket ? 'Submitting...' : 'Ingest & Trigger AI Triage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Canned Responses Drawer */}
      <CannedResponsesDrawer
        isOpen={showCannedModal}
        onClose={() => setShowCannedModal(false)}
        cannedResponses={cannedResponses}
        onAddCannedResponse={handleAddCannedResponse}
        onUpdateCannedResponse={handleUpdateCannedResponse}
        onDeleteCannedResponse={handleDeleteCannedResponse}
        onSetAutoReply={handleSetAutoReply}
        onSendDirectly={handleSendCannedDirectly}
        onInsertText={(bodyText) => {
          handleSendMessage({ body: bodyText, file: null, isInternalNote: false });
        }}
      />

      {/* Close Ticket Modal */}
      <CloseTicketModal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        onConfirmClose={handleConfirmCloseTicket}
      />

      {/* Escalate Ticket Modal */}
      <EscalateTicketModal
        isOpen={showEscalateModal}
        onClose={() => setShowEscalateModal(false)}
        selectedTicket={selectedTicket}
        onConfirmEscalate={handleConfirmEscalate}
      />
    </div>
  );
}


