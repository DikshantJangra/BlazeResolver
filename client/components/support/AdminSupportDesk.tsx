import React, { useState, useEffect, useRef } from 'react';
import { SupportHeader } from './SupportHeader.js';
import { TicketFeed } from './TicketFeed.js';
import { TicketChatThread } from './TicketChatThread.js';
import { CustomerContextPanel } from './CustomerContextPanel.js';
import { CannedResponsesDrawer } from './CannedResponsesDrawer.js';
import { CloseTicketModal } from './CloseTicketModal.js';
import { EscalateTicketModal } from './EscalateTicketModal.js';
import { BlazeTimeline } from '../timeline/BlazeTimeline.js';
import type { SupportTicket, SupportMessage, CustomerContext, SupportCannedResponse, TicketRating } from './types.js';

export interface AdminSupportDeskProps {
  apiBaseUrl?: string;
  wsUrl?: string;
  adminToken?: string;
  className?: string;
  initialViewMode?: 'admin' | 'timeline';
}

export const AdminSupportDesk: React.FC<AdminSupportDeskProps> = ({
  apiBaseUrl = '',
  wsUrl,
  adminToken = '',
  className = '',
  initialViewMode = 'admin'
}) => {
  const baseUrl = apiBaseUrl ? apiBaseUrl.replace(/\/$/, '') : '';
  const [viewMode, setViewMode] = useState<'admin' | 'timeline'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlView = params.get('view') || params.get('tab') || params.get('mode');
      if (urlView === 'timeline') return 'timeline';
      if (urlView === 'admin') return 'admin';
    }
    return initialViewMode;
  });

  const handleModeChange = (mode: 'admin' | 'timeline') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('view', mode);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [customerContext, setCustomerContext] = useState<CustomerContext | null>(null);
  const [cannedResponses, setCannedResponses] = useState<SupportCannedResponse[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const selectedTicketRef = useRef<SupportTicket | null>(null);
  selectedTicketRef.current = selectedTicket;

  const authHeaders: Record<string, string> = adminToken ? { Authorization: `Bearer ${adminToken}` } : {};

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & ratings
  const [showCannedModal, setShowCannedModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [ticketRating, setTicketRating] = useState<TicketRating | null>(null);

  // Fetch ticket list
  const fetchTickets = async () => {
    if (viewMode !== 'admin') return;
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`${baseUrl}/api/support/tickets?${params.toString()}`, {
        headers: { ...authHeaders }
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setTickets(json.data);
          setSelectedTicket((prev) => {
            if (!prev) return json.data[0] || null;
            const match = json.data.find((t: SupportTicket) => t.id === prev.id);
            return match ? { ...prev, ...match } : prev;
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  // Fetch canned responses
  const fetchCannedResponses = async () => {
    if (viewMode !== 'admin') return;
    try {
      const res = await fetch(`${baseUrl}/api/support/canned-responses`, {
        headers: { ...authHeaders }
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const json = await res.json();
        if (json.success) setCannedResponses(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch canned responses:', err);
    }
  };

  // Real-time WebSocket connection
  useEffect(() => {
    if (typeof window === 'undefined' || viewMode !== 'admin') return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const defaultWs = `${protocol}//${window.location.host}/ws`;
    const targetWs = wsUrl || (baseUrl ? baseUrl.replace(/^http/, 'ws') + '/ws' : defaultWs);

    let ws: WebSocket | null = null;
    let retryTimer: any = null;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      try {
        ws = new WebSocket(targetWs);
        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'support_ticket_created') {
              setTickets((prev) => [payload.data, ...prev.filter((t) => t.id !== payload.data.id)]);
            } else if (payload.type === 'support_ticket_updated') {
              setTickets((prev) => prev.map((t) => (t.id === payload.data.id ? payload.data : t)));
              setSelectedTicket((prev) => (prev?.id === payload.data.id ? { ...prev, ...payload.data } : prev));
            } else if (payload.type === 'support_message_created') {
              const { ticketId, message } = payload.data;
              setMessages((prev) => {
                if (selectedTicketRef.current?.id === ticketId) {
                  if (prev.some((m) => m.id === message.id)) return prev;
                  return [...prev, message];
                }
                return prev;
              });
              fetchTickets();
            } else if (payload.type === 'support_rating_updated') {
              const { ticketId, rating } = payload.data;
              if (selectedTicketRef.current?.id === ticketId) {
                setTicketRating(rating);
              }
            }
          } catch {
            // ignore non-json
          }
        };
        ws.onclose = () => {
          if (isMounted) retryTimer = setTimeout(connect, 3000);
        };
      } catch {
        if (isMounted) retryTimer = setTimeout(connect, 3000);
      }
    };

    connect();
    return () => {
      isMounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [wsUrl, baseUrl, viewMode]);

  useEffect(() => {
    if (viewMode !== 'admin') return;
    fetchTickets();
    fetchCannedResponses();
    const interval = setInterval(fetchTickets, 5000);
    return () => clearInterval(interval);
  }, [statusFilter, priorityFilter, categoryFilter, searchQuery, baseUrl, viewMode]);

  // When ticket selected -> load messages & customer context
  useEffect(() => {
    if (viewMode !== 'admin') return;
    if (!selectedTicket) {
      setMessages([]);
      setCustomerContext(null);
      setTicketRating(null);
      return;
    }

    let cancelled = false;

    const loadTicketDetails = async () => {
      setIsLoadingMessages(true);
      try {
        const [msgRes, ctxRes, ratingRes] = await Promise.all([
          fetch(`${baseUrl}/api/support/tickets/${selectedTicket.id}/messages`, { headers: { ...authHeaders } }).then(async (r) => {
            const ct = r.headers.get('content-type') || '';
            return r.ok && ct.includes('application/json') ? r.json() : null;
          }).catch(() => null),
          fetch(`${baseUrl}/api/support/context/${selectedTicket.customerId || selectedTicket.outletId || 'cust_user'}`, { headers: { ...authHeaders } }).then(async (r) => {
            const ct = r.headers.get('content-type') || '';
            return r.ok && ct.includes('application/json') ? r.json() : null;
          }).catch(() => null),
          fetch(`${baseUrl}/api/support/tickets/${selectedTicket.id}/rating`, { headers: { ...authHeaders } }).then(async (r) => {
            const ct = r.headers.get('content-type') || '';
            return r.ok && ct.includes('application/json') ? r.json() : null;
          }).catch(() => null)
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


    loadTicketDetails();
    return () => {
      cancelled = true;
    };
  }, [selectedTicket?.id, viewMode]);

  const handleUpdateTicket = async (updates: Partial<SupportTicket>) => {
    if (!selectedTicket) return;
    try {
      const res = await fetch(`${baseUrl}/api/support/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(updates)
      });

      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
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
    if ((!body.trim() && !file) || !selectedTicket) {
      return { success: false };
    }

    let attachments: any[] | undefined = undefined;
    if (file) {
      attachments = [
        {
          name: file.name,
          url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80',
          size: file.size,
          mimeType: file.type
        }
      ];
    }

    try {
      const res = await fetch(`${baseUrl}/api/support/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          body: body.trim(),
          content: body.trim(),
          role: 'agent',
          senderType: 'agent',
          authorName: 'Support Staff',
          internalNote: isInternalNote,
          attachments
        })
      });

      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const json = await res.json();
        if (json.success) {
          setMessages((prev) => [...prev, json.data]);
          fetchTickets();
          return { success: true };
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
    return { success: true };
  };

  const handleToggleTakeover = async (enabled: boolean) => {
    if (!selectedTicket) return;
    try {
      const res = await fetch(`${baseUrl}/api/support/tickets/${selectedTicket.id}/takeover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ enabled })
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const json = await res.json();
        if (json.success) {
          setSelectedTicket(json.data);
          setTickets((prev) => prev.map((t) => (t.id === json.data.id ? json.data : t)));
          const msgRes = await fetch(`${baseUrl}/api/support/tickets/${selectedTicket.id}/messages`, {
            headers: { ...authHeaders }
          });
          const msgCt = msgRes.headers.get('content-type') || '';
          if (msgRes.ok && msgCt.includes('application/json')) {
            const msgJson = await msgRes.json();
            if (msgJson.success) setMessages(msgJson.data);
          }
        }
      }
    } catch (err) {
      console.error('Failed to toggle takeover:', err);
    }
  };

  const handleGenerateBlazzyDraft = async (prompt?: string): Promise<string | null> => {
    if (!selectedTicket) return null;
    try {
      const res = await fetch(`${baseUrl}/api/support/tickets/${selectedTicket.id}/blazzy-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ prompt })
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
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
      const res = await fetch(`${baseUrl}/api/support/tickets/${selectedTicket.id}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(data)
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const json = await res.json();
        if (json?.success) {
          setSelectedTicket(json.data);
          setTickets((prev) => prev.map((t) => (t.id === json.data.id ? json.data : t)));
          const msgRes = await fetch(`${baseUrl}/api/support/tickets/${selectedTicket.id}/messages`, {
            headers: { ...authHeaders }
          });
          const msgCt = msgRes.headers.get('content-type') || '';
          if (msgRes.ok && msgCt.includes('application/json')) {
            const msgJson = await msgRes.json();
            if (msgJson.success) setMessages(msgJson.data);
          }
          return { success: true };
        }
        return { success: false, error: json?.error || 'Failed to escalate ticket' };
      }
      return { success: false, error: `HTTP ${res.status}: Failed to escalate ticket` };
    } catch (err) {
      console.error('Failed to escalate ticket:', err);
      return { success: false, error: 'Connection error while escalating' };
    }
  };

  const handleConfirmCloseTicket = async (password: string): Promise<{ success: boolean; error?: string }> => {
    if (!selectedTicket) return { success: false, error: 'No ticket selected' };
    try {
      const res = await fetch(`${baseUrl}/api/support/tickets/${selectedTicket.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ password })
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const json = await res.json();
        if (json.success) {
          setSelectedTicket(json.data);
          setTickets((prev) => prev.map((t) => (t.id === json.data.id ? json.data : t)));
          return { success: true };
        }
        return { success: false, error: json?.error || 'Failed to close ticket' };
      }
      return { success: false, error: `HTTP ${res.status}: Failed to close ticket` };
    } catch (err) {
      console.error('Failed to close ticket:', err);
      return { success: false, error: 'Error occurred while closing ticket' };
    }
  };

  const handleAddCannedResponse = async (title: string, body: string) => {
    try {
      const res = await fetch(`${baseUrl}/api/support/canned-responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ title, body })
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const json = await res.json();
        if (json.success) setCannedResponses((prev) => [json.data, ...prev]);
      }
    } catch (err) {
      console.error('Failed to add canned response:', err);
    }
  };

  const handleUpdateCannedResponse = async (id: string, title: string, body: string) => {
    try {
      const res = await fetch(`${baseUrl}/api/support/canned-responses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ title, body })
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const json = await res.json();
        if (json.success) setCannedResponses((prev) => prev.map((c) => (c.id === id ? json.data : c)));
      }
    } catch (err) {
      console.error('Failed to update canned response:', err);
    }
  };

  const handleDeleteCannedResponse = async (id: string) => {
    try {
      const res = await fetch(`${baseUrl}/api/support/canned-responses/${id}`, {
        method: 'DELETE',
        headers: { ...authHeaders }
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
      const res = await fetch(`${baseUrl}/api/support/canned-responses/${id}/set-auto-reply`, {
        method: 'POST',
        headers: { ...authHeaders }
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const json = await res.json();
        if (json.success) setCannedResponses(json.data);
      }
    } catch (err) {
      console.error('Failed to set auto reply:', err);
    }
  };

  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const handleExecuteTicketAction = async (action: string, amount?: number) => {
    if (!selectedTicket) return;
    setIsExecutingAction(true);
    try {
      const res = await fetch(`${baseUrl}/api/support/tickets/${selectedTicket.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ action, amount, reason: `Admin 1-Click Action: ${action}` })
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const json = await res.json();
        if (json.success) {
          setSelectedTicket(json.data.ticket);
          setTickets((prev) => prev.map((t) => (t.id === json.data.ticket.id ? json.data.ticket : t)));
          // Refresh messages
          const msgRes = await fetch(`${baseUrl}/api/support/tickets/${selectedTicket.id}/messages`, {
            headers: { ...authHeaders }
          });
          const msgCt = msgRes.headers.get('content-type') || '';
          if (msgRes.ok && msgCt.includes('application/json')) {
            const msgJson = await msgRes.json();
            if (msgJson.success) setMessages(msgJson.data);
          }
        }
      }
    } catch (err) {
      console.error('Failed to execute ticket action:', err);
    } finally {
      setIsExecutingAction(false);
    }
  };

  const handleDiagnoseTicket = async () => {
    if (!selectedTicket) return;
    setIsDiagnosing(true);
    try {
      const res = await fetch(`${baseUrl}/api/support/tickets/${selectedTicket.id}/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders }
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const json = await res.json();
        if (json.success) {
          setSelectedTicket(json.data.ticket);
          setTickets((prev) => prev.map((t) => (t.id === json.data.ticket.id ? json.data.ticket : t)));
        }
      }
    } catch (err) {
      console.error('Failed to diagnose ticket:', err);
    } finally {
      setIsDiagnosing(false);
    }
  };


  const handleSendCannedDirectly = async (bodyText: string) => {
    await handleSendMessage({ body: bodyText, file: null, isInternalNote: false });
  };

  return (
    <div
      className={`blaze-support-desk w-full flex-1 flex flex-col min-h-0 overflow-hidden bg-white text-gray-900 rounded-none border-0 shadow-none ${className}`}
      style={{
        height: '100vh',
        maxHeight: '100vh',
        color: '#111827',
        backgroundColor: '#ffffff',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}
    >
      {/* Top Header */}
      <SupportHeader
        mode={viewMode}
        onModeChange={handleModeChange}
        onOpenCannedModal={() => setShowCannedModal(true)}
      />

      {/* Main View: Admin Desk vs Customer Portal */}
      {viewMode === 'admin' ? (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Column: Tickets Feed */}
          <TicketFeed
            tickets={tickets}
            selectedTicket={selectedTicket}
            onSelectTicket={setSelectedTicket}
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

          {/* Middle Column: Chat Thread */}
          <TicketChatThread
            selectedTicket={selectedTicket}
            messages={messages}
            ticketRating={ticketRating}
            isLoadingMessages={isLoadingMessages}
            cannedResponses={cannedResponses}
            onUpdateTicket={handleUpdateTicket}
            onToggleTakeover={handleToggleTakeover}
            onGenerateBlazzyDraft={handleGenerateBlazzyDraft}
            onOpenEscalate={() => setShowEscalateModal(true)}
            onOpenCloseTicket={() => setShowCloseModal(true)}
            onSendMessage={handleSendMessage}
          />

          {/* Right Column: Customer 360 & AI Diagnostics Panel */}
          {selectedTicket && (
            <CustomerContextPanel
              customerContext={customerContext}
              selectedTicket={selectedTicket}
              firstCustomerMessage={messages.find((message) => !message.internalNote && message.senderType === 'user')}
              ticketRating={ticketRating}
              internalNotes={messages.filter((m) => m.internalNote)}
              onExecuteAction={handleExecuteTicketAction}
              onDiagnoseTicket={handleDiagnoseTicket}
              isExecutingAction={isExecutingAction}
              isDiagnosing={isDiagnosing}
            />
          )}
        </div>
      ) : (
        <BlazeTimeline apiBaseUrl={baseUrl} />
      )}

      {/* Canned Responses Library Drawer */}
      <CannedResponsesDrawer
        isOpen={showCannedModal}
        onClose={() => setShowCannedModal(false)}
        cannedResponses={cannedResponses}
        onAddCannedResponse={handleAddCannedResponse}
        onUpdateCannedResponse={handleUpdateCannedResponse}
        onDeleteCannedResponse={handleDeleteCannedResponse}
        onSetAutoReply={handleSetAutoReply}
        onSendDirectly={handleSendCannedDirectly}
        onInsertText={() => {}}
      />

      {/* Password Confirm Modal for Closing Ticket */}
      <CloseTicketModal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        onConfirmClose={handleConfirmCloseTicket}
      />

      {/* Escalate to Pulse Modal */}
      <EscalateTicketModal
        isOpen={showEscalateModal}
        onClose={() => setShowEscalateModal(false)}
        selectedTicket={selectedTicket}
        onConfirmEscalate={handleConfirmEscalate}
      />
    </div>
  );
};
