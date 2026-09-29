import React, { useState, useEffect, useRef } from 'react';
import {
  RiSendPlaneFill,
  RiStarFill,
  RiAddLine,
  RiShieldCheckLine,
  RiShoppingBag3Line,
  RiCheckDoubleLine,
  RiUserSmileLine,
  RiUserVoiceLine,
  RiEmotionHappyLine,
} from 'react-icons/ri';
import { BlazzyIcon } from './BlazzyMascot.js';
import type { SupportTicket, SupportMessage, TicketRating } from './types.js';

export interface CustomerSupportPortalProps {
  apiBaseUrl?: string;
  wsUrl?: string;
  onOpenNewTicketModal?: () => void;
  onRefreshFeed?: () => void;
}

export const CustomerSupportPortal: React.FC<CustomerSupportPortalProps> = ({
  apiBaseUrl = '',
  wsUrl,
  onRefreshFeed
}) => {
  const baseUrl = apiBaseUrl ? apiBaseUrl.replace(/\/$/, '') : '';
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [customerIdentity, setCustomerIdentity] = useState<{ name: string; email: string } | null>(null);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [rating, setRating] = useState<TicketRating | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [userStars, setUserStars] = useState(5);
  const [userComment, setUserComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [conversationError, setConversationError] = useState('');

  const selectedTicketRef = useRef<SupportTicket | null>(null);
  /** Whether the live socket is connected; while it isn't, the open thread is refreshed by polling. */
  const liveRef = useRef(false);
  selectedTicketRef.current = selectedTicket;

  const [showIdentityForm, setShowIdentityForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTickets = async (email = customerIdentity?.email) => {
    if (!email) {
      setTickets([]);
      setIsLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({ customerEmail: email });
      const res = await fetch(`${baseUrl}/api/support/tickets?${params}`);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const json = await res.json();
        if (json.success && json.data) {
          setTickets(json.data);
          const current = selectedTicketRef.current;
          const match = current && json.data.find((t: SupportTicket) => t.id === current.id);
          setSelectedTicket(match || (isStartingChat ? null : json.data[0] || null));
        }
      } else {
        console.warn('CustomerSupportPortal: Non-JSON response received from /api/support/tickets:', res.status);
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
        fetch(`${baseUrl}/api/support/tickets/${ticketId}/messages`).then(async (r) => {
          const ct = r.headers.get('content-type') || '';
          return r.ok && ct.includes('application/json') ? r.json() : { success: false };
        }).catch(() => ({ success: false })),
        fetch(`${baseUrl}/api/support/tickets/${ticketId}/rating`).then(async (r) => {
          const ct = r.headers.get('content-type') || '';
          return r.ok && ct.includes('application/json') ? r.json() : { success: false };
        }).catch(() => ({ success: false }))
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

  // Real-time WebSocket connection
  useEffect(() => {
    if (typeof window === 'undefined') return;
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
        ws.onopen = () => {
          liveRef.current = true;
        };
        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'support_message_created') {
              const { ticketId, message } = payload.data;
              if (selectedTicketRef.current?.id === ticketId) {
                setMessages((prev) => {
                  if (prev.some((m) => m.id === message.id)) return prev;
                  return [...prev, message];
                });
              }
            } else if (payload.type === 'support_ticket_updated') {
              setTickets((prev) => prev.map((t) => (t.id === payload.data.id ? payload.data : t)));
              setSelectedTicket((prev) => (prev?.id === payload.data.id ? { ...prev, ...payload.data } : prev));
            } else if (
              payload.type === 'support_ticket_created' &&
              String(payload.data.customerEmail || '').trim().toLowerCase() === customerIdentity?.email.toLowerCase()
            ) {
              setTickets((prev) => [payload.data, ...prev.filter((t) => t.id !== payload.data.id)]);
            }
          } catch {}
        };
        ws.onclose = () => {
          liveRef.current = false;
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
  }, [wsUrl, baseUrl, customerIdentity?.email]);

  useEffect(() => {
    if (!customerIdentity) {
      setTickets([]);
      setIsLoading(false);
      return;
    }
    fetchTickets(customerIdentity.email);
    const interval = setInterval(() => fetchTickets(customerIdentity.email), 5000);
    return () => clearInterval(interval);
  }, [baseUrl, customerIdentity?.email, isStartingChat]);

  useEffect(() => {
    if (selectedTicket) {
      loadTicketMessages(selectedTicket.id);
    }
  }, [selectedTicket?.id]);

  // Without the live socket (a backend that has none, like the Next.js route), refresh the open thread instead, so
  // notes posted after the reply (the fix pipeline's progress) still show up.
  useEffect(() => {
    if (!selectedTicket) return;
    const ticketId = selectedTicket.id;
    const interval = setInterval(async () => {
      if (liveRef.current) return;
      const res = await fetch(`${baseUrl}/api/support/tickets/${ticketId}/messages`).catch(() => undefined);
      const json = res?.ok && (res.headers.get('content-type') || '').includes('application/json') ? await res.json().catch(() => undefined) : undefined;
      if (json?.success && Array.isArray(json.data) && selectedTicketRef.current?.id === ticketId) setMessages(json.data);
    }, 4000);
    return () => clearInterval(interval);
  }, [baseUrl, selectedTicket?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text || (!selectedTicket && !isStartingChat) || isSending) return;

    setIsSending(true);
    setConversationError('');

    try {
      if (!selectedTicket) {
        if (!customerIdentity) throw new Error('Add your name and email to start a chat.');
        const res = await fetch(`${baseUrl}/api/support/tickets/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawText: text,
            customerName: customerIdentity.name,
            customerEmail: customerIdentity.email,
            intakeChannel: 'customer_portal'
          })
        });
        const json = await res.json();
        if (!res.ok || !json.success || !json.data?.ticket) throw new Error(json.error || 'Could not start this chat.');
        setInputMessage('');
        setSelectedTicket(json.data.ticket);
        setIsStartingChat(false);
        await loadTicketMessages(json.data.ticket.id);
        await fetchTickets(customerIdentity.email);
        onRefreshFeed?.();
      } else {
        const res = await fetch(`${baseUrl}/api/support/tickets/${selectedTicket.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'user',
            senderType: 'user',
            authorName: customerIdentity?.name || selectedTicket.customerName || 'Customer',
            body: text,
            content: text
          })
        });
        if (!res.ok) throw new Error('Could not send your message. Please try again.');
        setInputMessage('');
        await loadTicketMessages(selectedTicket.id);
        fetchTickets();
        onRefreshFeed?.();
      }
    } catch (err) {
      setConversationError(err instanceof Error ? err.message : 'Could not send your message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCustomerName.trim();
    const email = newCustomerEmail.trim();
    if (!name || !email) return;
    setCustomerIdentity({ name, email });
    setSelectedTicket(null);
    setMessages([]);
    setInputMessage('');
    setConversationError('');
    setIsStartingChat(true);
    setShowIdentityForm(false);
  };

  const handleNewConversation = () => {
    setSelectedTicket(null);
    setMessages([]);
    setInputMessage('');
    setConversationError('');
    if (customerIdentity) setIsStartingChat(true);
    else setShowIdentityForm(true);
  };

  const handleSubmitRating = async () => {
    if (!selectedTicket || submittingRating) return;
    setSubmittingRating(true);
    try {
      const res = await fetch(`${baseUrl}/api/support/tickets/${selectedTicket.id}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: userStars,
          comment: userComment.trim() || undefined
        })
      });

      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
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
    <div
      className="blaze-customer-portal w-full flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden bg-gray-50/50"
      style={{
        minHeight: '100vh',
        height: '100%',
        color: '#111827',
        backgroundColor: '#f9fafb',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}
    >
      {/* Left Sidebar: My Support Tickets */}
      <div className={`${selectedTicket || isStartingChat || showIdentityForm ? 'hidden sm:flex' : 'flex'} w-full sm:w-80 lg:w-96 bg-white border-r border-gray-200 flex-col min-h-0 overflow-hidden shrink-0`}>
        <div className="p-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
          <div>
            <h3 className="font-bold text-sm text-gray-900">Your Support Requests</h3>
            <p className="text-[11px] text-gray-500">Live AI Assistant & resolution tracking</p>
          </div>
          <button
            type="button"
            onClick={handleNewConversation}
            className="px-3 py-1.5 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white text-xs font-bold transition-colors shadow-2xs flex items-center gap-1"
          >
            <RiAddLine className="w-4 h-4" />
            <span>New Chat</span>
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
                Start a chat and follow replies here.
              </p>
            </div>
          ) : (
            tickets.map((t) => {
              const isSelected = selectedTicket?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedTicket(t);
                    setIsStartingChat(false);
                  }}
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
      {selectedTicket || isStartingChat ? (
        <div className="flex-1 min-w-0 bg-white flex flex-col min-h-0 overflow-hidden">
          {/* Header */}
          <div className="p-3.5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div>
              <button type="button" onClick={() => { setSelectedTicket(null); setMessages([]); setIsStartingChat(false); }} className="sm:hidden text-[11px] font-semibold text-orange-700 mb-1">
                ‹ Your requests
              </button>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-gray-500">
                  {selectedTicket ? selectedTicket.ticketNumber || selectedTicket.id.slice(0, 8) : 'New chat'}
                </span>
                <h3 className="font-bold text-sm text-gray-900">{selectedTicket?.subject || 'How can we help?'}</h3>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedTicket?.orderNumber && (
                  <span className="font-medium text-gray-700">Order #{selectedTicket.orderNumber} • </span>
                )}
                {selectedTicket ? <span>Category: <strong className="capitalize">{selectedTicket.category || 'General'}</strong></span> : <span>Your message starts the request.</span>}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {selectedTicket?.isHumanTakeover ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-900 text-xs font-semibold border border-blue-200">
                  <RiUserVoiceLine className="w-4 h-4 shrink-0 text-blue-600" />
                  <span>Human Specialist Connected</span>
                </span>
              ) : selectedTicket ? (
                <>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-900 text-xs font-semibold border border-orange-200">
                    <BlazzyIcon className="w-4 h-4 shrink-0" color="#EA580C" />
                    <span>BlazeResolver AI Concierge</span>
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedTicket || isSending) return;
                      setConversationError('');
                      const res = await fetch(`${baseUrl}/api/support/tickets/${selectedTicket.id}/messages`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          senderType: 'user',
                          role: 'user',
                          authorName: customerIdentity?.name || selectedTicket.customerName || 'Customer',
                          body: 'I would like to speak to a human support specialist please.',
                          content: 'I would like to speak to a human support specialist please.'
                        })
                      });
                      if (res.ok) await loadTicketMessages(selectedTicket.id);
                      else setConversationError('Could not request a specialist. Please try again.');
                    }}
                    className="px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium border border-gray-300 transition-colors flex items-center gap-1"
                    title="Request human support specialist takeover"
                  >
                    <RiUserVoiceLine className="w-3.5 h-3.5 text-gray-600" />
                    <span>Talk to Human</span>
                  </button>
                </>
              ) : null}
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
          {selectedTicket && <div className="p-3 border-t border-gray-200 bg-amber-50/50 flex flex-col gap-2">
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
          </div>}

          {/* Composer */}
          <div className="border-t border-gray-200 bg-white p-3 flex flex-col gap-1.5">
            {conversationError && <p role="alert" className="text-xs text-red-600 px-1">{conversationError}</p>}
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input
                type="text"
                placeholder={selectedTicket ? 'Ask a question or reply to support...' : 'Describe what you need help with...'}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                aria-label="Message"
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
                <span>BlazeResolver triage and support</span>
              </span>
            </div>
          </div>
        </div>
      ) : showIdentityForm ? (
        <form onSubmit={handleCreateTicket} className="flex-1 min-w-0 flex flex-col items-center justify-center gap-4 p-8 bg-white">
          <div className="max-w-sm w-full">
            <div className="mb-5 text-center">
              <BlazzyIcon className="w-10 h-10 mx-auto mb-2" />
              <h3 className="font-bold text-base text-gray-900">Start a support chat</h3>
              <p className="text-xs text-gray-500 mt-1">Add your name and email. Tell us what you need in the chat.</p>
            </div>
            <label className="block mb-3 text-xs font-semibold text-gray-700">
              Name
              <input
                type="text"
                autoComplete="name"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                required
                className="mt-1 w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-400/20 focus:border-orange-500 outline-none"
              />
            </label>
            <label className="block text-xs font-semibold text-gray-700">
              Email
              <input
                type="email"
                autoComplete="email"
                value={newCustomerEmail}
                onChange={(e) => setNewCustomerEmail(e.target.value)}
                required
                className="mt-1 w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-400/20 focus:border-orange-500 outline-none"
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setShowIdentityForm(false)} className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200">
                Cancel
              </button>
              <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-[#FF7A00] text-white text-xs font-bold hover:bg-[#E66E00]">
                Continue
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="hidden sm:flex flex-1 flex-col items-center justify-center p-8 text-center text-gray-400">
          <RiUserSmileLine className="w-12 h-12 text-gray-300 mb-2" />
          <p className="font-semibold text-sm text-gray-700">Welcome to Customer Support</p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm">
            {customerIdentity ? 'Select a request or start a new chat.' : 'Share your name and email to start a chat and track replies here.'}
          </p>
          <button type="button" onClick={handleNewConversation} className="mt-4 px-4 py-2 rounded-xl bg-[#FF7A00] text-white text-xs font-bold hover:bg-[#E66E00]">
            Start a chat
          </button>
        </div>
      )}

    </div>
  );
};
