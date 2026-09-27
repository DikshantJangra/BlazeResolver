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
}

export const BlazzySupportWidget: React.FC<BlazzySupportWidgetProps> = ({
  apiBaseUrl = '',
  defaultPosition = 'bottom-right',
  customerName = '',
  customerEmail = '',
  orderId,
  title = 'Ask Blazzy',
  subtitle = 'Instant AI resolution & support'
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
    <div className="blazzy-widget-root fixed z-50 font-sans" style={{ [isLeft ? 'left' : 'right']: '24px', bottom: '24px' }}>
      {isOpen && (
        <section
          aria-label="BlazeResolver support"
          className="blazzy-dialog mb-4 w-[380px] max-w-[calc(100vw-32px)] h-[560px] max-h-[calc(100vh-120px)] bg-white rounded-3xl shadow-2xl border border-gray-200/80 flex flex-col overflow-hidden text-gray-900"
        >
          <header className="bg-gradient-to-r from-orange-500 via-[#FF7A00] to-amber-500 p-4 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-white p-1 flex items-center justify-center shrink-0">
                <BlazzyIcon className="w-8 h-8" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-base leading-tight truncate">{title}</h3>
                <p className="text-xs text-white/90 mt-0.5 truncate">{subtitle}</p>
              </div>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center" aria-label="Close support">
              <RiCloseLine className="w-5 h-5" />
            </button>
          </header>

          {!identityReady ? (
            <form onSubmit={handleStart} className="flex-1 flex flex-col justify-center p-6 gap-4 bg-gray-50/70">
              <div className="text-center">
                <BlazzyIcon className="w-11 h-11 mx-auto mb-2" />
                <h4 className="font-bold text-sm text-gray-900">Start a support chat</h4>
                <p className="text-xs text-gray-500 mt-1">Just your name and email. Tell us what you need in chat.</p>
              </div>
              <label className="text-xs font-semibold text-gray-700">
                Name
                <input required autoComplete="name" value={userName} onChange={(e) => setUserName(e.target.value)} className="mt-1 w-full bg-white border border-gray-200 focus:border-orange-400 rounded-xl px-3 py-2.5 text-sm outline-none" />
              </label>
              <label className="text-xs font-semibold text-gray-700">
                Email
                <input required type="email" autoComplete="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} className="mt-1 w-full bg-white border border-gray-200 focus:border-orange-400 rounded-xl px-3 py-2.5 text-sm outline-none" />
              </label>
              {statusMsg && <p role="alert" className="text-xs text-red-600">{statusMsg}</p>}
              <button type="submit" className="w-full py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white text-xs font-bold">Continue to chat</button>
            </form>
          ) : (
            <>
              <nav className="bg-orange-50/60 p-1.5 flex gap-1 border-b border-orange-100/60 shrink-0" aria-label="Support views">
                <button type="button" onClick={() => setActiveTab('chat')} className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${activeTab === 'chat' ? 'bg-white text-orange-950 shadow-sm border border-orange-200/60' : 'text-gray-600 hover:text-gray-900'}`}>
                  <RiSparklingLine className="w-3.5 h-3.5 text-[#FF7A00]" /> Chat
                </button>
                <button type="button" onClick={() => setActiveTab('requests')} className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${activeTab === 'requests' ? 'bg-white text-orange-950 shadow-sm border border-orange-200/60' : 'text-gray-600 hover:text-gray-900'}`}>
                  <RiQuestionAnswerLine className="w-3.5 h-3.5 text-[#FF7A00]" /> My requests
                </button>
              </nav>

              {activeTab === 'chat' ? (
                <div className="flex-1 min-h-0 flex flex-col bg-gray-50/50">
                  <div className="p-2.5 bg-white border-b border-gray-100 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{activeTicket?.subject || 'New conversation'}</p>
                      <p className="text-[10px] text-gray-500">{activeTicket ? `${activeTicket.ticketNumber} · ${activeTicket.status}` : 'Your first message opens a request'}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {activeTicket && !activeTicket.isHumanTakeover && activeTicket.status !== 'closed' && (
                        <button type="button" onClick={handleHumanRequest} disabled={isSending} className="px-2 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-[10px] font-semibold hover:bg-gray-50 disabled:opacity-50" title="Request a human specialist">
                          <RiUserVoiceLine className="w-3.5 h-3.5 inline mr-1" />Human
                        </button>
                      )}
                      {activeTicket && <button type="button" onClick={handleNewChat} className="px-2 py-1.5 rounded-lg bg-orange-50 text-orange-800 text-[10px] font-semibold hover:bg-orange-100">New chat</button>}
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                    {!messages.length && (
                      <div className="flex gap-2.5 max-w-[90%]">
                        <div className="w-7 h-7 rounded-xl bg-orange-100 flex items-center justify-center shrink-0 border border-orange-200"><BlazzyIcon className="w-5 h-5" /></div>
                        <div className="bg-white p-3 rounded-2xl rounded-tl-sm border border-gray-200 text-xs text-gray-700">
                          <p className="font-semibold text-gray-900">Hi {userName || 'there'}!</p>
                          <p className="mt-1">Ask a question or tell us what happened. You can track the request and replies here.</p>
                        </div>
                      </div>
                    )}
                    {messages.filter((message) => !message.internalNote).map((message) => {
                      const isUser = message.role === 'user' || message.senderType === 'user';
                      const isSystem = message.role === 'system' || message.senderType === 'system';
                      if (isSystem) return <p key={message.id} className="text-center text-[10px] text-gray-500">{message.body || message.content}</p>;
                      return (
                        <div key={message.id} className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                          {!isUser && <div className="w-7 h-7 rounded-xl bg-orange-100 flex items-center justify-center shrink-0 border border-orange-200"><BlazzyIcon className="w-5 h-5" /></div>}
                          <div className={`max-w-[85%] p-3 rounded-2xl text-xs shadow-sm ${isUser ? 'bg-[#FF7A00] text-white rounded-tr-sm' : 'bg-white text-gray-800 border border-gray-200 rounded-tl-sm'}`}>
                            <p className="whitespace-pre-wrap leading-relaxed">{message.body || message.content}</p>
                            <span className={`block text-[9.5px] mt-1 text-right ${isUser ? 'text-white/75' : 'text-gray-400'}`}>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {activeTicket && (
                    <div className="px-3 py-2 border-t border-amber-100 bg-amber-50/70">
                      {ratingSubmitted ? (
                        <p className="text-[10px] text-emerald-800 font-semibold flex items-center gap-1"><RiCheckDoubleLine className="w-3.5 h-3.5" />Thanks for rating your support.</p>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center" aria-label={`Rating ${userStars} out of 5`}>
                            {[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" onClick={() => setUserStars(star)} aria-label={`${star} stars`} className="p-0.5"><RiStarFill className={`w-3.5 h-3.5 ${star <= userStars ? 'text-amber-500' : 'text-gray-300'}`} /></button>)}
                          </div>
                          <input value={userComment} onChange={(event) => setUserComment(event.target.value)} placeholder="Optional feedback" className="min-w-0 flex-1 px-2 py-1.5 rounded-lg border border-amber-200 bg-white text-[10px] outline-none" />
                          <button type="button" onClick={handleSubmitRating} disabled={isSending} className="px-2 py-1.5 rounded-lg bg-amber-600 text-white text-[10px] font-bold disabled:opacity-50">Rate</button>
                        </div>
                      )}
                    </div>
                  )}

                  <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-gray-200">
                    {statusMsg && <p role="alert" className="text-xs text-red-600 mb-2">{statusMsg}</p>}
                    {activeTicket?.status === 'closed' ? (
                      <p className="text-xs text-gray-500 text-center">This request is closed. Start a new chat to contact support.</p>
                    ) : (
                      <div className="flex gap-2">
                        <input type="text" value={inputMessage} onChange={(event) => setInputMessage(event.target.value)} placeholder="Type your message..." aria-label="Message" className="min-w-0 flex-1 bg-gray-100 border border-transparent focus:border-orange-400 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs outline-none" />
                        <button type="submit" disabled={!inputMessage.trim() || isSending} aria-label="Send message" className="w-10 h-10 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] disabled:opacity-50 text-white flex items-center justify-center shrink-0"><RiSendPlaneFill className="w-4 h-4" /></button>
                      </div>
                    )}
                  </form>
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto p-3 bg-gray-50/50">
                  <button type="button" onClick={handleNewChat} className="w-full mb-3 p-2.5 rounded-xl bg-[#FF7A00] text-white text-xs font-bold hover:bg-[#E66E00]">Start a new chat</button>
                  {tickets.length ? (
                    <div className="space-y-2">
                      {tickets.map((ticket) => (
                        <button key={ticket.id} type="button" onClick={() => { setActiveTicket(ticket); setIsNewChat(false); setActiveTab('chat'); }} className={`w-full text-left p-3 rounded-xl border ${activeTicket?.id === ticket.id ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200 hover:border-orange-200'}`}>
                          <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-mono text-gray-500">{ticket.ticketNumber}</span><span className="text-[10px] capitalize text-gray-500">{ticket.status}</span></div>
                          <p className="mt-1 text-xs font-semibold text-gray-900 line-clamp-2">{ticket.subject}</p>
                          <p className="mt-1 text-[10px] text-gray-400">{new Date(ticket.lastMessageAt || ticket.createdAt).toLocaleDateString()}</p>
                        </button>
                      ))}
                    </div>
                  ) : <div className="py-12 text-center text-xs text-gray-500">No support requests yet.</div>}
                </div>
              )}
            </>
          )}
        </section>
      )}

      <button type="button" onClick={() => setIsOpen((open) => !open)} className="w-14 h-14 rounded-full bg-[#FFF7ED] hover:bg-orange-100 border-2 border-[#FF7A00] shadow-xl flex items-center justify-center transition-transform hover:scale-105" aria-label={isOpen ? 'Close Blazzy Support' : 'Open Blazzy Support'}>
        {isOpen ? <RiCloseLine className="w-7 h-7 text-[#FF7A00]" /> : <BlazzyIcon className="w-9 h-9" />}
      </button>
    </div>
  );
};
