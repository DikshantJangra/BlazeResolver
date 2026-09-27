import React, { useState, useEffect, useRef } from 'react';
import {
  RiCloseLine,
  RiSendPlaneFill,
  RiCustomerService2Line,
  RiSparklingLine,
  RiCheckDoubleLine,
  RiRobot2Line,
  RiShieldCheckLine,
  RiShoppingBag3Line,
  RiQuestionAnswerLine
} from 'react-icons/ri';
import { BlazzyIcon, BlazzyBadge } from './BlazzyMascot.js';
import type { SupportTicket, SupportMessage } from './types.js';

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
  wsUrl,
  defaultPosition = 'bottom-right',
  customerName = 'Customer',
  customerEmail,
  orderId,
  title = 'Ask Blazzy',
  subtitle = 'Instant AI resolution & support'
}) => {
  const baseUrl = apiBaseUrl ? apiBaseUrl.replace(/\/$/, '') : '';
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'ticket'>('chat');
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');
  const [userEmail, setUserEmail] = useState(customerEmail || '');
  const [userOrderId, setUserOrderId] = useState(orderId || '');
  const [statusMsg, setStatusMsg] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isOpen]);

  // Load or create initial session ticket
  const ensureSessionTicket = async () => {
    if (activeTicket) return activeTicket;
    try {
      const res = await fetch(`${baseUrl}/api/support/tickets/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'Live Blazzy Session',
          rawText: 'Customer started a live session via Blazzy Widget',
          category: 'general',
          orderId: userOrderId || undefined,
          customerName: customerName,
          customerEmail: userEmail || undefined
        })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.ticket) {
          setActiveTicket(json.data.ticket);
          return json.data.ticket;
        }
      }
    } catch (e) {
      console.error('Failed to initialize session ticket:', e);
    }
    return null;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInputMessage('');

    try {
      const ticket = activeTicket || (await ensureSessionTicket());
      if (!ticket) throw new Error('No active session');

      const res = await fetch(`${baseUrl}/api/support/tickets/${ticket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'user',
          senderType: 'user',
          authorName: customerName,
          body: text,
          content: text
        })
      });

      if (res.ok) {
        const msgRes = await fetch(`${baseUrl}/api/support/tickets/${ticket.id}/messages`).then((r) => r.json());
        if (msgRes.success) {
          setMessages(msgRes.data || []);
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setStatusMsg('Could not send message. Please retry.');
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuery.trim() || isSending) return;

    setIsSending(true);
    setStatusMsg('');

    try {
      const res = await fetch(`${baseUrl}/api/support/tickets/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: quickQuery.slice(0, 45) + (quickQuery.length > 45 ? '...' : ''),
          rawText: quickQuery.trim(),
          category: userOrderId ? 'orders' : 'general',
          orderId: userOrderId || undefined,
          customerName: customerName,
          customerEmail: userEmail || undefined
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.ticket) {
          setActiveTicket(json.data.ticket);
          setQuickQuery('');
          setActiveTab('chat');
          const msgRes = await fetch(`${baseUrl}/api/support/tickets/${json.data.ticket.id}/messages`).then((r) => r.json());
          if (msgRes.success) {
            setMessages(msgRes.data || []);
          }
        }
      }
    } catch (err) {
      console.error('Failed to file ticket:', err);
      setStatusMsg('Failed to submit ticket. Please check connection.');
    } finally {
      setIsSending(false);
    }
  };

  const isLeft = defaultPosition === 'bottom-left';

  return (
    <div className="blazzy-widget-root fixed z-50 font-sans select-none" style={{ [isLeft ? 'left' : 'right']: '24px', bottom: '24px' }}>
      {/* Expanded Support Dialog */}
      {isOpen && (
        <div
          className="blazzy-dialog mb-4 w-[380px] max-w-[calc(100vw-32px)] h-[560px] max-h-[calc(100vh-120px)] bg-white rounded-3xl shadow-2xl border border-gray-200/80 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200 text-gray-900"
          style={{ transformOrigin: isLeft ? 'bottom left' : 'bottom right' }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 via-[#FF7A00] to-amber-500 p-4 text-white flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/95 p-1 flex items-center justify-center shadow-xs">
                <BlazzyIcon className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-base leading-tight tracking-tight">{title}</h3>
                  <span className="bg-white/20 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full text-white/90">
                    Live
                  </span>
                </div>
                <p className="text-xs text-white/90 font-medium leading-tight mt-0.5">{subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
              aria-label="Close"
            >
              <RiCloseLine className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="bg-orange-50/60 p-1.5 flex gap-1 border-b border-orange-100/60 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-white text-orange-950 shadow-xs border border-orange-200/60'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <RiSparklingLine className="w-3.5 h-3.5 text-[#FF7A00]" />
              <span>Blazzy AI Chat</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ticket')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'ticket'
                  ? 'bg-white text-orange-950 shadow-xs border border-orange-200/60'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <RiCustomerService2Line className="w-3.5 h-3.5 text-[#FF7A00]" />
              <span>Submit Ticket</span>
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 min-h-0 flex flex-col bg-gray-50/50">
            {activeTab === 'chat' ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {/* Greeting message */}
                  <div className="flex gap-2.5 max-w-[85%]">
                    <div className="w-7 h-7 rounded-xl bg-orange-100 flex items-center justify-center shrink-0 border border-orange-200">
                      <BlazzyIcon className="w-5 h-5" />
                    </div>
                    <div className="bg-white p-3 rounded-2xl rounded-tl-sm border border-gray-200 shadow-xs text-xs text-gray-800 space-y-1">
                      <p className="font-semibold text-gray-900">Hey there! I'm Blazzy ⚡</p>
                      <p>
                        How can I help you today? Ask about order status, refunds, delivery delays, or app issues!
                      </p>
                    </div>
                  </div>

                  {messages.map((m) => {
                    const isUser = m.role === 'user' || m.senderType === 'user';
                    return (
                      <div key={m.id} className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                        {!isUser && (
                          <div className="w-7 h-7 rounded-xl bg-orange-100 flex items-center justify-center shrink-0 border border-orange-200">
                            <BlazzyIcon className="w-5 h-5" />
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] p-3 rounded-2xl text-xs shadow-xs ${
                            isUser
                              ? 'bg-[#FF7A00] text-white rounded-tr-sm'
                              : 'bg-white text-gray-800 border border-gray-200 rounded-tl-sm'
                          }`}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">{m.body || m.content}</p>
                          <span
                            className={`block text-[9.5px] mt-1 text-right ${
                              isUser ? 'text-white/75' : 'text-gray-400'
                            }`}
                          >
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Input */}
                <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-gray-200 flex gap-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type your message to Blazzy..."
                    className="flex-1 bg-gray-100 border border-transparent focus:border-orange-400 focus:bg-white rounded-xl px-3.5 py-2 text-xs text-gray-900 outline-hidden transition-all placeholder:text-gray-400"
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || isSending}
                    className="w-9 h-9 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <RiSendPlaneFill className="w-4 h-4" />
                  </button>
                </form>
              </div>
            ) : (
              <form onSubmit={handleQuickSubmit} className="flex-1 p-4 overflow-y-auto space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">What happened?</label>
                  <textarea
                    rows={4}
                    value={quickQuery}
                    onChange={(e) => setQuickQuery(e.target.value)}
                    placeholder="Describe what went wrong or what you need help with..."
                    className="w-full bg-white border border-gray-200 focus:border-orange-400 rounded-xl p-3 text-xs text-gray-900 outline-hidden resize-none transition-all placeholder:text-gray-400"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Order ID (optional)</label>
                    <input
                      type="text"
                      value={userOrderId}
                      onChange={(e) => setUserOrderId(e.target.value)}
                      placeholder="#ORD-1092"
                      className="w-full bg-white border border-gray-200 focus:border-orange-400 rounded-xl px-3 py-2 text-xs text-gray-900 outline-hidden transition-all placeholder:text-gray-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Email for updates</label>
                    <input
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="you@email.com"
                      className="w-full bg-white border border-gray-200 focus:border-orange-400 rounded-xl px-3 py-2 text-xs text-gray-900 outline-hidden transition-all placeholder:text-gray-400"
                    />
                  </div>
                </div>

                {statusMsg && <p className="text-xs text-red-600 font-medium">{statusMsg}</p>}

                <button
                  type="submit"
                  disabled={!quickQuery.trim() || isSending}
                  className="w-full py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <RiCustomerService2Line className="w-4 h-4" />
                  <span>{isSending ? 'Connecting with Blazzy...' : 'Submit to Blazzy Support'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modern Floating Launcher Button (Blazzy SVG Icon) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-14 h-14 rounded-full bg-[#FFF7ED] hover:bg-orange-100 border-2 border-[#FF7A00] text-gray-900 shadow-xl flex items-center justify-center transition-all transform hover:scale-108 hover:-translate-y-1 cursor-pointer group"
        aria-label="Open Blazzy Support"
      >
        {isOpen ? (
          <RiCloseLine className="w-7 h-7 text-[#FF7A00]" />
        ) : (
          <div className="relative">
            <BlazzyIcon className="w-9 h-9" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
          </div>
        )}
      </button>
    </div>
  );
};
