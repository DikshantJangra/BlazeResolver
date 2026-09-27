import React, { useEffect, useRef, useState } from 'react';
import {
  RiCheckDoubleLine,
  RiCloseLine,
  RiCustomerService2Line,
  RiQuestionAnswerLine,
  RiSendPlaneFill,
  RiSparklingLine,
  RiStarFill,
  RiUserVoiceLine
} from 'react-icons/ri';
import { BlazzyIcon } from './BlazzyMascot.js';
import type { SupportMessage, SupportTicket, TicketRating } from './types.js';

export interface BlazzySupportWidgetProps {
  apiBaseUrl?: string;
  wsUrl?: string;
  defaultPosition?: 'bottom-right' | 'bottom-left';
  primaryColor?: string;
  customerName?: string;
  customerEmail?: string;
  orderId?: string;
  title?: string;
  subtitle?: string;
  logoSrc?: string;
}

export const BlazzySupportWidget: React.FC<BlazzySupportWidgetProps> = ({
  apiBaseUrl = '',
  defaultPosition = 'bottom-right',
  customerName = '',
  customerEmail = '',
  orderId,
  title = 'BlazeResolver',
  subtitle = 'Autonomous AI resolution & support',
  logoSrc = '/blazyy.svg'
}) => {
  const baseUrl = apiBaseUrl.replace(/\/$/, '');
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'requests'>('chat');
  const [userName, setUserName] = useState(customerName);
  const [userEmail, setUserEmail] = useState(customerEmail);
  const [identityReady, setIdentityReady] = useState(Boolean(customerName.trim() && customerEmail.trim()));
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [isNewChat, setIsNewChat] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [rating, setRating] = useState<TicketRating | null>(null);
  const [userStars, setUserStars] = useState(5);
  const [userComment, setUserComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeTicketRef = useRef(activeTicket);
  activeTicketRef.current = activeTicket;

  const loadMessages = async (ticketId: string) => {
    const res = await fetch(`${baseUrl}/api/support/tickets/${ticketId}/messages`);
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Could not load this conversation.');
    setMessages(json.data || []);
  };

  const loadRating = async (ticketId: string) => {
    const res = await fetch(`${baseUrl}/api/support/tickets/${ticketId}/rating`);
    const json = await res.json();
    if (json.success && json.data) {
      setRating(json.data);
      setUserStars(json.data.rating);
      setUserComment(json.data.comment || '');
      setRatingSubmitted(true);
    } else {
      setRating(null);
      setUserStars(5);
      setUserComment('');
      setRatingSubmitted(false);
    }
  };

  const fetchTickets = async (email = userEmail, updateSelection = true) => {
    if (!email) return;
    const params = new URLSearchParams({ customerEmail: email });
    const res = await fetch(`${baseUrl}/api/support/tickets?${params}`);
    const json = await res.json();
    if (!res.ok || !json.success) return;
    const nextTickets = json.data || [];
    setTickets(nextTickets);
    if (updateSelection) {
      const current = activeTicketRef.current;
      const match = current && nextTickets.find((ticket: SupportTicket) => ticket.id === current.id);
      setActiveTicket(match || current || (isNewChat ? null : nextTickets[0] || null));
    }
  };

  useEffect(() => {
    if (!isOpen || !identityReady || !userEmail) return;
    fetchTickets().catch(() => {});
    const interval = setInterval(() => fetchTickets().catch(() => {}), 5000);
    return () => clearInterval(interval);
  }, [isOpen, identityReady, userEmail, isNewChat, baseUrl]);

  useEffect(() => {
    if (!isOpen || !activeTicket) return;
    loadMessages(activeTicket.id).catch(() => {});
    loadRating(activeTicket.id).catch(() => {});
    const interval = setInterval(() => loadMessages(activeTicket.id).catch(() => {}), 4000);
    return () => clearInterval(interval);
  }, [isOpen, activeTicket?.id, baseUrl]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isOpen]);

  const handleStart = (event: React.FormEvent) => {
    event.preventDefault();
    setUserName(userName.trim());
    setUserEmail(userEmail.trim());
    setIdentityReady(true);
    setStatusMsg('');
  };

  const handleNewChat = () => {
    setActiveTicket(null);
    setMessages([]);
    setRating(null);
    setRatingSubmitted(false);
    setStatusMsg('');
    setIsNewChat(true);
    setActiveTab('chat');
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = inputMessage.trim();
    if (!text || isSending) return;
    setIsSending(true);
    setStatusMsg('');
    try {
      if (!activeTicket) {
        const res = await fetch(`${baseUrl}/api/support/tickets/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawText: text,
            customerName: userName,
            customerEmail: userEmail,
            orderId,
            intakeChannel: 'widget'
          })
        });
        const json = await res.json();
        if (!res.ok || !json.success || !json.data?.ticket) throw new Error(json.error || 'Could not start this chat.');
        const ticket = json.data.ticket as SupportTicket;
        setActiveTicket(ticket);
        setIsNewChat(false);
        setInputMessage('');
        await loadMessages(ticket.id);
        await fetchTickets(userEmail, false);
        return;
      }

      const res = await fetch(`${baseUrl}/api/support/tickets/${activeTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', senderType: 'user', authorName: userName, body: text, content: text })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Could not send your message.');
      setInputMessage('');
      await loadMessages(activeTicket.id);
    } catch (error) {
      setStatusMsg(error instanceof Error ? error.message : 'Could not send your message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleHumanRequest = async () => {
    if (!activeTicket || isSending) return;
    setIsSending(true);
    setStatusMsg('');
    try {
      const res = await fetch(`${baseUrl}/api/support/tickets/${activeTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'user',
          senderType: 'user',
          authorName: userName,
          body: 'I would like to speak to a human support specialist please.',
          content: 'I would like to speak to a human support specialist please.'
        })
      });
      if (!res.ok) throw new Error('Could not request a specialist. Please try again.');
      await loadMessages(activeTicket.id);
      await fetchTickets();
    } catch (error) {
      setStatusMsg(error instanceof Error ? error.message : 'Could not request a specialist.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!activeTicket || ratingSubmitted || isSending) return;
    setIsSending(true);
    setStatusMsg('');
    try {
      const res = await fetch(`${baseUrl}/api/support/tickets/${activeTicket.id}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: userStars, comment: userComment.trim() || undefined })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Could not save your rating.');
      setRating(json.data);
      setRatingSubmitted(true);
    } catch (error) {
      setStatusMsg(error instanceof Error ? error.message : 'Could not save your rating.');
    } finally {
      setIsSending(false);
    }
  };

  const isLeft = defaultPosition === 'bottom-left';

  return (
    <div
      className="blazzy-widget-root fixed z-50 font-sans"
      style={{
        [isLeft ? 'left' : 'right']: '24px',
        bottom: '24px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {isOpen && (
        <section
          aria-label="BlazeResolver support"
          style={{
            backgroundColor: '#ffffff',
            color: '#111827',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            borderColor: '#E5E7EB',
          }}
          className="blazzy-dialog mb-4 w-[380px] max-w-[calc(100vw-32px)] h-[560px] max-h-[calc(100vh-120px)] rounded-3xl border flex flex-col overflow-hidden text-gray-900"
        >
          <header
            style={{
              background: 'linear-gradient(135deg, #ff7a00 0%, #ea580c 100%)',
              color: '#ffffff',
            }}
            className="p-4 flex items-center justify-between shrink-0"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                style={{ backgroundColor: '#ffffff' }}
                className="w-10 h-10 rounded-2xl p-1 flex items-center justify-center shrink-0 shadow-sm"
              >
                <BlazzyIcon src={logoSrc} className="w-8 h-8" />
              </div>
              <div className="min-w-0">
                <h3 style={{ color: '#ffffff' }} className="font-bold text-base leading-tight truncate">{title}</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.9)' }} className="text-xs mt-0.5 truncate">{subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}
              className="w-8 h-8 rounded-full hover:opacity-80 flex items-center justify-center transition-opacity cursor-pointer"
              aria-label="Close support"
            >
              <RiCloseLine className="w-5 h-5" />
            </button>
          </header>

          {!identityReady ? (
            <form onSubmit={handleStart} style={{ backgroundColor: '#F9FAFB', color: '#111827' }} className="flex-1 flex flex-col justify-center p-6 gap-4">
              <div className="text-center">
                <BlazzyIcon src={logoSrc} className="w-12 h-12 mx-auto mb-2" />
                <h4 style={{ color: '#111827' }} className="font-bold text-base">Start a support chat</h4>
                <p style={{ color: '#6B7280' }} className="text-xs mt-1">Just your name and email. Tell us what you need in chat.</p>
              </div>
              <label style={{ color: '#374151' }} className="text-xs font-semibold">
                Name
                <input
                  required
                  autoComplete="name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  style={{ backgroundColor: '#ffffff', color: '#111827', borderColor: '#D1D5DB' }}
                  className="mt-1 w-full border focus:border-orange-500 rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
                  placeholder="Your name"
                />
              </label>
              <label style={{ color: '#374151' }} className="text-xs font-semibold">
                Email
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  style={{ backgroundColor: '#ffffff', color: '#111827', borderColor: '#D1D5DB' }}
                  className="mt-1 w-full border focus:border-orange-500 rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
                  placeholder="your.email@example.com"
                />
              </label>
              {statusMsg && <p role="alert" style={{ color: '#DC2626' }} className="text-xs">{statusMsg}</p>}
              <button
                type="submit"
                style={{ backgroundColor: '#FF7A00', color: '#ffffff' }}
                className="w-full py-2.5 rounded-xl hover:opacity-95 text-xs font-bold transition-opacity cursor-pointer shadow-sm"
              >
                Continue to chat
              </button>
            </form>
          ) : (
            <>
              <nav style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }} className="p-1.5 flex gap-1 border-b shrink-0" aria-label="Support views">
                <button
                  type="button"
                  onClick={() => setActiveTab('chat')}
                  style={
                    activeTab === 'chat'
                      ? { backgroundColor: '#ffffff', color: '#431407', borderColor: '#FDBA74', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
                      : { color: '#4B5563', borderColor: 'transparent' }
                  }
                  className="flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border cursor-pointer"
                >
                  <RiSparklingLine style={{ color: '#FF7A00', width: 14, height: 14 }} /> Chat
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('requests')}
                  style={
                    activeTab === 'requests'
                      ? { backgroundColor: '#ffffff', color: '#431407', borderColor: '#FDBA74', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
                      : { color: '#4B5563', borderColor: 'transparent' }
                  }
                  className="flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border cursor-pointer"
                >
                  <RiQuestionAnswerLine style={{ color: '#FF7A00', width: 14, height: 14 }} /> My requests
                </button>
              </nav>

              {activeTab === 'chat' ? (
                <div style={{ backgroundColor: '#F9FAFB' }} className="flex-1 min-h-0 flex flex-col">
                  <div style={{ backgroundColor: '#ffffff', borderColor: '#F3F4F6' }} className="p-2.5 border-b flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p style={{ color: '#111827' }} className="text-xs font-semibold truncate">{activeTicket?.subject || 'New conversation'}</p>
                      <p style={{ color: '#6B7280' }} className="text-[10px]">{activeTicket ? `${activeTicket.ticketNumber} · ${activeTicket.status}` : 'Your first message opens a request'}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {activeTicket && !activeTicket.isHumanTakeover && activeTicket.status !== 'closed' && (
                        <button
                          type="button"
                          onClick={handleHumanRequest}
                          disabled={isSending}
                          style={{ borderColor: '#E5E7EB', color: '#374151', backgroundColor: '#ffffff' }}
                          className="px-2 py-1.5 rounded-lg border text-[10px] font-semibold hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                          title="Request a human specialist"
                        >
                          <RiUserVoiceLine className="w-3.5 h-3.5 inline mr-1 text-orange-600" />Human
                        </button>
                      )}
                      {activeTicket && (
                        <button
                          type="button"
                          onClick={handleNewChat}
                          style={{ backgroundColor: '#FFF7ED', color: '#9A3412' }}
                          className="px-2 py-1.5 rounded-lg text-[10px] font-semibold hover:opacity-90 cursor-pointer"
                        >
                          New chat
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                    {!messages.length && (
                      <div className="flex gap-2.5 max-w-[90%]">
                        <div style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }} className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border">
                          <BlazzyIcon src={logoSrc} className="w-5 h-5" />
                        </div>
                        <div style={{ backgroundColor: '#ffffff', borderColor: '#E5E7EB', color: '#374151' }} className="p-3 rounded-2xl rounded-tl-sm border text-xs shadow-xs">
                          <p style={{ color: '#111827' }} className="font-semibold">Hi {userName || 'there'}!</p>
                          <p className="mt-1 leading-relaxed">Ask a question or tell us what happened. You can track the request and replies here.</p>
                        </div>
                      </div>
                    )}
                    {messages.filter((message) => !message.internalNote).map((message) => {
                      const isUser = message.role === 'user' || message.senderType === 'user';
                      const isSystem = message.role === 'system' || message.senderType === 'system';
                      if (isSystem) return <p key={message.id} style={{ color: '#6B7280' }} className="text-center text-[10px]">{message.body || message.content}</p>;
                      return (
                        <div key={message.id} className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                          {!isUser && (
                            <div style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }} className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border">
                              <BlazzyIcon src={logoSrc} className="w-5 h-5" />
                            </div>
                          )}
                          <div
                            style={
                              isUser
                                ? { backgroundColor: '#FF7A00', color: '#ffffff' }
                                : { backgroundColor: '#ffffff', color: '#1F2937', borderColor: '#E5E7EB' }
                            }
                            className={`max-w-[85%] p-3 rounded-2xl text-xs shadow-xs ${isUser ? 'rounded-tr-sm' : 'border rounded-tl-sm'}`}
                          >
                            <p className="whitespace-pre-wrap leading-relaxed">{message.body || message.content}</p>
                            <span style={{ color: isUser ? 'rgba(255, 255, 255, 0.75)' : '#9CA3AF' }} className="block text-[9.5px] mt-1 text-right">
                              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {activeTicket && (
                    <div style={{ backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }} className="px-3 py-2 border-t">
                      {ratingSubmitted ? (
                        <p style={{ color: '#065F46' }} className="text-[10px] font-semibold flex items-center gap-1">
                          <RiCheckDoubleLine className="w-3.5 h-3.5" />Thanks for rating your support.
                        </p>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center" aria-label={`Rating ${userStars} out of 5`}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button key={star} type="button" onClick={() => setUserStars(star)} aria-label={`${star} stars`} className="p-0.5 cursor-pointer">
                                <RiStarFill className={`w-3.5 h-3.5 ${star <= userStars ? 'text-amber-500' : 'text-gray-300'}`} />
                              </button>
                            ))}
                          </div>
                          <input
                            value={userComment}
                            onChange={(event) => setUserComment(event.target.value)}
                            placeholder="Optional feedback"
                            style={{ backgroundColor: '#ffffff', color: '#111827', borderColor: '#FDE68A' }}
                            className="min-w-0 flex-1 px-2 py-1.5 rounded-lg border text-[10px] outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleSubmitRating}
                            disabled={isSending}
                            style={{ backgroundColor: '#D97706', color: '#ffffff' }}
                            className="px-2 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-50 cursor-pointer shadow-xs"
                          >
                            Rate
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <form onSubmit={handleSendMessage} style={{ backgroundColor: '#ffffff', borderColor: '#E5E7EB' }} className="p-3 border-t">
                    {statusMsg && <p role="alert" style={{ color: '#DC2626' }} className="text-xs mb-2">{statusMsg}</p>}
                    {activeTicket?.status === 'closed' ? (
                      <p style={{ color: '#6B7280' }} className="text-xs text-center">This request is closed. Start a new chat to contact support.</p>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={inputMessage}
                          onChange={(event) => setInputMessage(event.target.value)}
                          placeholder="Type your message..."
                          aria-label="Message"
                          style={{ backgroundColor: '#F3F4F6', color: '#111827', borderColor: '#E5E7EB' }}
                          className="min-w-0 flex-1 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:bg-white focus:border-orange-500 border transition-colors"
                        />
                        <button
                          type="submit"
                          disabled={!inputMessage.trim() || isSending}
                          aria-label="Send message"
                          style={{ backgroundColor: '#FF7A00', color: '#ffffff' }}
                          className="w-10 h-10 rounded-xl hover:opacity-95 disabled:opacity-50 flex items-center justify-center shrink-0 cursor-pointer shadow-xs"
                        >
                          <RiSendPlaneFill className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </form>
                </div>
              ) : (
                <div style={{ backgroundColor: '#F9FAFB' }} className="flex-1 min-h-0 overflow-y-auto p-3">
                  <button
                    type="button"
                    onClick={handleNewChat}
                    style={{ backgroundColor: '#FF7A00', color: '#ffffff' }}
                    className="w-full mb-3 p-2.5 rounded-xl text-xs font-bold hover:opacity-95 cursor-pointer shadow-xs"
                  >
                    Start a new chat
                  </button>
                  {tickets.length ? (
                    <div className="space-y-2">
                      {tickets.map((ticket) => (
                        <button
                          key={ticket.id}
                          type="button"
                          onClick={() => { setActiveTicket(ticket); setIsNewChat(false); setActiveTab('chat'); }}
                          style={
                            activeTicket?.id === ticket.id
                              ? { backgroundColor: '#FFF7ED', borderColor: '#FDBA74' }
                              : { backgroundColor: '#ffffff', borderColor: '#E5E7EB' }
                          }
                          className="w-full text-left p-3 rounded-xl border hover:border-orange-300 transition-colors cursor-pointer shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span style={{ color: '#6B7280' }} className="text-[10px] font-mono">{ticket.ticketNumber}</span>
                            <span style={{ color: ticket.status === 'open' ? '#047857' : '#6B7280' }} className="text-[10px] capitalize font-medium">{ticket.status}</span>
                          </div>
                          <p style={{ color: '#111827' }} className="mt-1 text-xs font-semibold line-clamp-2">{ticket.subject}</p>
                          <p style={{ color: '#9CA3AF' }} className="mt-1 text-[10px]">{new Date(ticket.lastMessageAt || ticket.createdAt).toLocaleDateString()}</p>
                        </button>
                      ))}
                    </div>
                  ) : <div style={{ color: '#6B7280' }} className="py-12 text-center text-xs">No support requests yet.</div>}
                </div>
              )}
            </>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        style={{
          backgroundColor: '#ffffff',
          borderColor: '#FF7A00',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        }}
        className="w-14 h-14 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-105 cursor-pointer text-[#FF7A00]"
        aria-label={isOpen ? 'Close Blazzy Support' : 'Open Blazzy Support'}
      >
        {isOpen ? <RiCloseLine style={{ width: 28, height: 28, color: '#FF7A00' }} /> : <BlazzyIcon src={logoSrc} className="w-9 h-9" />}
      </button>
    </div>
  );
};
