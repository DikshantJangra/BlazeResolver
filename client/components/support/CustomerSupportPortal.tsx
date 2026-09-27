import React, { useState, useEffect, useRef } from 'react';
import {
  RiSendPlaneFill,
  RiAttachmentLine,
  RiStarFill,
  RiAddLine,
  RiShieldCheckLine,
  RiShoppingBag3Line,
  RiCheckDoubleLine,
  RiRobot2Line,
  RiUserSmileLine,
  RiUserVoiceLine,
  RiEmotionHappyLine,
  RiCloseLine
} from 'react-icons/ri';
import { BlazzyIcon, BlazzyBadge } from './BlazzyMascot.js';
import type { SupportTicket, SupportMessage, TicketRating } from './types.js';

interface CustomerSupportPortalProps {
  onOpenNewTicketModal: () => void;
  onRefreshFeed?: () => void;
}

export const CustomerSupportPortal: React.FC<CustomerSupportPortalProps> = ({
  onOpenNewTicketModal,
  onRefreshFeed
}) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [rating, setRating] = useState<TicketRating | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [userStars, setUserStars] = useState(5);
  const [userComment, setUserComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // New ticket modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('orders');
  const [newOrderId, setNewOrderId] = useState('');
  const [newComplaintText, setNewComplaintText] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTickets = async () => {
    try {
      const res = await fetch('/api/support/tickets');
      const json = await res.json();
      if (json.success && json.data) {
        setTickets(json.data);
        if (!selectedTicket && json.data.length > 0) {
          setSelectedTicket(json.data[0]);
        }
      }
    } catch (e) {
      console.error('Failed to fetch customer tickets:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTicketMessages = async (ticketId: string) => {
    try {
      const [msgRes, ratingRes] = await Promise.all([
        fetch(`/api/support/tickets/${ticketId}/messages`).then((r) => r.json()),
        fetch(`/api/support/tickets/${ticketId}/rating`).then((r) => r.json())
      ]);

      if (msgRes.success) {
        setMessages(msgRes.data || []);
      }
      if (ratingRes.success && ratingRes.data) {
        setRating(ratingRes.data);
        setRatingSubmitted(true);
      } else {
        setRating(null);
        setRatingSubmitted(false);
      }
    } catch (e) {
      console.error('Failed to load ticket messages:', e);
    }
  };

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedTicket) {
      loadTicketMessages(selectedTicket.id);
    }
  }, [selectedTicket?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCreateModal) {
        setShowCreateModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCreateModal]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedTicket || isSending) return;

    setIsSending(true);
    const text = inputMessage.trim();
    setInputMessage('');

    try {
      const res = await fetch(`/api/support/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'user',
          senderType: 'user',
          authorName: selectedTicket.customerName || 'Customer',
          body: text,
          content: text
        })
      });

      if (res.ok) {
        await loadTicketMessages(selectedTicket.id);
        fetchTickets();
        onRefreshFeed?.();
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComplaintText.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const res = await fetch('/api/support/tickets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: newSubject.trim() || newComplaintText.trim().slice(0, 45) + '...',
          rawText: newComplaintText.trim(),
          category: newCategory,
          orderId: newOrderId.trim() || undefined,
          customerName: newCustomerName.trim() || 'Customer',
          customerEmail: newCustomerEmail.trim() || undefined
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.ticket) {
          setShowCreateModal(false);
          setNewSubject('');
          setNewCustomerName('');
          setNewCustomerEmail('');
          setNewOrderId('');
          setNewComplaintText('');
          await fetchTickets();
          setSelectedTicket(json.data.ticket);
          onRefreshFeed?.();
        }
      }
    } catch (err) {
      console.error('Failed to create ticket:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!selectedTicket || submittingRating) return;
    setSubmittingRating(true);
    try {
      const res = await fetch(`/api/support/tickets/${selectedTicket.id}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: userStars,
          comment: userComment.trim() || undefined
        })
      });

      if (res.ok) {
        setRatingSubmitted(true);
        const json = await res.json();
        if (json.data) setRating(json.data);
      }
    } catch (err) {
      console.error('Failed to submit rating:', err);
    } finally {
      setSubmittingRating(false);
    }
  };

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden bg-gray-50/50">
      {/* Left Sidebar: My Support Tickets */}
      <div className="w-80 lg:w-96 bg-white border-r border-gray-200 flex flex-col min-h-0 overflow-hidden shrink-0">
        <div className="p-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
          <div>
            <h3 className="font-bold text-sm text-gray-900">Your Support Requests</h3>
            <p className="text-[11px] text-gray-500">Live AI Assistant & resolution tracking</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white text-xs font-bold transition-colors shadow-2xs flex items-center gap-1"
          >
            <RiAddLine className="w-4 h-4" />
            <span>New Query</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-gray-100">
          {isLoading ? (
            <div className="text-center py-12 text-xs text-gray-400">Loading your requests...</div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 px-4 text-gray-400">
              <RiShoppingBag3Line className="w-10 h-10 mx-auto text-gray-300 mb-2" />
              <p className="font-semibold text-xs text-gray-700">No active support requests</p>
              <p className="text-[11px] text-gray-400 mt-1">
                Have a question or issue with an order? Click &quot;New Query&quot; to connect with BlazeResolver.
              </p>
            </div>
          ) : (
            tickets.map((t) => {
              const isSelected = selectedTicket?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className={`p-3 rounded-xl cursor-pointer transition-all flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-orange-50/80 border border-orange-200 shadow-2xs'
                      : 'bg-white hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-gray-500">
                      {t.ticketNumber || t.id.slice(0, 8)}
                    </span>
                    <span
                      className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        t.status === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-gray-900 line-clamp-1">{t.subject}</p>
                  <div className="flex items-center justify-between text-[10.5px] text-gray-400 pt-0.5">
                    {t.orderNumber && (
                      <span className="font-mono font-medium text-gray-600">Order #{t.orderNumber}</span>
                    )}
                    <span>
                      {new Date(t.lastMessageAt || t.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Area: Interactive Customer Support Chat */}
      {selectedTicket ? (
        <div className="flex-1 bg-white flex flex-col min-h-0 overflow-hidden">
          {/* Header */}
          <div className="p-3.5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-gray-500">
                  {selectedTicket.ticketNumber || selectedTicket.id.slice(0, 8)}
                </span>
                <h3 className="font-bold text-sm text-gray-900">{selectedTicket.subject}</h3>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedTicket.orderNumber && (
                  <span className="font-medium text-gray-700">Order #{selectedTicket.orderNumber} • </span>
                )}
                <span>Category: <strong className="capitalize">{selectedTicket.category || 'General'}</strong></span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-900 text-xs font-semibold border border-orange-200">
                <BlazzyIcon className="w-4 h-4 shrink-0" color="#EA580C" />
                <span>BlazeResolver AI Concierge</span>
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-gray-50/40">
            {messages.filter(m => !m.internalNote).map((m) => {
              const isSystem = m.role === 'system' || m.senderType === 'system';
              const isBot = m.senderType === 'bot' || m.authorName === 'Blazzy AI';
              const isUser = m.senderType === 'user' || m.role === 'user';

              if (isSystem) {
                return (
                  <div key={m.id} className="self-center my-1 text-center max-w-md">
                    <span className="inline-block px-3 py-1 rounded-full bg-gray-200 text-gray-700 text-[10.5px] font-medium border border-gray-300">
                      {m.body || m.content}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    isUser ? 'self-end items-end max-w-[80%]' : 'self-start items-start max-w-[85%]'
                  }`}
                >
                  <span className="text-[10px] text-gray-400 px-1 mb-0.5 flex items-center gap-1">
                    {isBot ? (
                      <>
                        <BlazzyIcon className="w-3 h-3 inline shrink-0" color="#EA580C" />
                        <strong className="text-orange-700">Blazzy AI Assistant</strong>
                      </>
                    ) : isUser ? (
                      <strong>You</strong>
                    ) : (
                      <strong className="text-gray-800">Support Specialist</strong>
                    )}{' '}
                    •{' '}
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  <div
                    className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                      isUser
                        ? 'bg-[#FF7A00] text-white rounded-br-none shadow-2xs font-medium'
                        : isBot
                          ? 'bg-white border border-orange-200 text-gray-900 rounded-bl-none shadow-2xs'
                          : 'bg-gray-900 text-white rounded-bl-none shadow-2xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.body || m.content}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* CSAT Rating Widget */}
          <div className="p-3 border-t border-gray-200 bg-amber-50/50 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-amber-900 flex items-center gap-1.5">
                <RiEmotionHappyLine className="w-4 h-4 text-amber-600" />
                <span>How was your support experience?</span>
              </span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setUserStars(s)}
                    disabled={ratingSubmitted}
                    className="p-1 text-amber-400 hover:text-amber-500 transition-transform hover:scale-110"
                  >
                    <RiStarFill className={`w-4 h-4 ${s <= (rating?.rating || userStars) ? 'text-amber-500' : 'text-gray-300'}`} />
                  </button>
                ))}
              </div>
            </div>

            {!ratingSubmitted ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Optional feedback comment..."
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  className="flex-1 p-2 rounded-xl border border-amber-200 bg-white text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={handleSubmitRating}
                  disabled={submittingRating}
                  className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shadow-2xs"
                >
                  {submittingRating ? 'Saving...' : 'Submit Rating'}
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1">
                <RiCheckDoubleLine className="w-4 h-4 text-emerald-600" />
                <span>Thank you! Your feedback has been recorded.</span>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-gray-200 bg-white p-3 flex flex-col gap-1.5">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Ask a question or reply to assistant..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-500 text-xs"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isSending}
                className="p-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white transition-colors shadow-2xs disabled:opacity-50"
                aria-label="Send message"
              >
                <RiSendPlaneFill className="w-4 h-4" />
              </button>
            </form>
            <div className="flex items-center justify-between text-[10px] text-gray-400 px-1 select-none">
              <span className="flex items-center gap-1">
                <RiShieldCheckLine className="w-3 h-3 text-emerald-600" />
                <span>Protected by BlazeResolver Triage Guardrails</span>
              </span>
              <span>All communications audited per compliance policy</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
          <RiUserSmileLine className="w-12 h-12 text-gray-300 mb-2" />
          <p className="font-semibold text-sm text-gray-700">Welcome to Customer Support</p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm">
            Select an existing ticket from the left panel or click &quot;New Query&quot; to start a live assisted conversation with BlazeResolver.
          </p>
        </div>
      )}

      {/* Modal: Create New Support Ticket */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleCreateTicket}
            className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-200 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5 text-orange-600">
                <BlazzyIcon className="w-4 h-4" color="#EA580C" />
                <span>Submit Customer Support Request</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <RiCloseLine className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1 text-xs text-gray-700">Your Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Morgan"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-orange-400/20 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1 text-xs text-gray-700">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. alex@example.com"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-orange-400/20 focus:border-orange-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold block mb-1 text-xs text-gray-700">Issue Subject</label>
              <input
                type="text"
                placeholder="e.g. Missing beverage in order #9821"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-orange-400/20 focus:border-orange-500 outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1 text-xs text-gray-700">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-orange-400/20 outline-none"
                >
                  <option value="orders">Missing / Wrong Item</option>
                  <option value="kitchen">Food Quality & Taste</option>
                  <option value="delivery">Delivery Delay</option>
                  <option value="billing">Payment & Billing</option>
                  <option value="refund">Refund Request</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1 text-xs text-gray-700">Linked Order</label>
                <input
                  type="text"
                  placeholder="e.g. ORD-9821"
                  value={newOrderId}
                  onChange={(e) => setNewOrderId(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-orange-400/20 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold block mb-1 text-xs text-gray-700">Problem Description</label>
              <textarea
                placeholder="Describe what happened in detail. Our AI will automatically verify against active policy..."
                value={newComplaintText}
                onChange={(e) => setNewComplaintText(e.target.value)}
                rows={4}
                className="w-full p-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-orange-400/20 focus:border-orange-500 outline-none resize-none"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating || !newComplaintText.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-[#FF7A00] hover:bg-[#E66E00] rounded-xl transition-colors shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
              >
                <RiSendPlaneFill className="w-4 h-4" />
                <span>{isCreating ? 'Processing AI Triage...' : 'Submit to BlazeResolver'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
