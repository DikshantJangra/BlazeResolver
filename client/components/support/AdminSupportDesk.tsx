import React, { useState, useEffect, useRef } from 'react';
import { SupportHeader } from './SupportHeader.js';
import { TicketFeed } from './TicketFeed.js';
import { TicketChatThread } from './TicketChatThread.js';
import { CustomerContextPanel } from './CustomerContextPanel.js';
import { CannedResponsesDrawer } from './CannedResponsesDrawer.js';
import { CloseTicketModal } from './CloseTicketModal.js';
import { EscalateTicketModal } from './EscalateTicketModal.js';
import { CustomerSupportPortal } from './CustomerSupportPortal.js';
import type { SupportTicket, SupportMessage, CustomerContext, SupportCannedResponse, TicketRating } from './types.js';

export const AdminSupportDesk: React.FC = () => {
  const [viewMode, setViewMode] = useState<'admin' | 'customer'>('admin');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [customerContext, setCustomerContext] = useState<CustomerContext | null>(null);
  const [cannedResponses, setCannedResponses] = useState<SupportCannedResponse[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

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
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/support/tickets?${params.toString()}`);
      if (res.ok) {
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
    try {
      const res = await fetch('/api/support/canned-responses');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setCannedResponses(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch canned responses:', err);
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchCannedResponses();
    const interval = setInterval(fetchTickets, 4000);
    return () => clearInterval(interval);
  }, [statusFilter, priorityFilter, categoryFilter, searchQuery]);

  // When ticket selected -> load messages & customer context
  useEffect(() => {
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

    loadTicketDetails();
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
      const res = await fetch(`/api/support/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      if (res.ok) {
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

  return (
    <div className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden bg-white text-gray-900 rounded-none border-0 shadow-none">
      {/* Top Header */}
      <SupportHeader
        mode={viewMode}
        onModeChange={setViewMode}
        onOpenCannedModal={() => setShowCannedModal(true)}
        onOpenNewTicketModal={() => {}}
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
              ticketRating={ticketRating}
              internalNotes={messages.filter((m) => m.internalNote)}
            />
          )}
        </div>
      ) : (
        <CustomerSupportPortal
          onOpenNewTicketModal={() => {}}
          onRefreshFeed={fetchTickets}
        />
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
