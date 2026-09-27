import React, { useState, useRef, useEffect } from 'react';
import {
  RiCustomerService2Line,
  RiSendPlaneFill,
  RiAttachmentLine,
  RiLock2Line,
  RiCloseLine,
  RiStarFill,
  RiPulseLine,
  RiUserVoiceLine,
  RiSparklingLine,
  RiCheckLine,
  RiShieldCheckLine
} from 'react-icons/ri';
import { BlazzyIcon } from './BlazzyMascot.js';
import type { SupportTicket, SupportMessage, SupportCannedResponse, TicketRating } from './types.js';

interface TicketChatThreadProps {
  selectedTicket: SupportTicket | null;
  messages: SupportMessage[];
  ticketRating: TicketRating | null;
  isLoadingMessages: boolean;
  cannedResponses: SupportCannedResponse[];
  onUpdateTicket: (updates: Partial<SupportTicket>) => Promise<void>;
  onToggleTakeover: (enabled: boolean) => Promise<void>;
  onGenerateBlazzyDraft: (prompt?: string) => Promise<string | null>;
  onOpenEscalate: () => void;
  onOpenCloseTicket: () => void;
  onSendMessage: (payload: {
    body: string;
    file: File | null;
    isInternalNote: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
}

const BLAZZY_PRESETS = [
  {
    label: 'Immediate Policy Credit',
    prompt: 'Draft an instant refund or wallet credit authorization with policy reference.'
  },
  {
    label: 'Kitchen Delay Apology',
    prompt: 'Apologize politely and reassure customer on kitchen quality and priority dispatch.'
  },
  {
    label: 'Summarize Triage & Root Cause',
    prompt: 'Summarize the issue concisely with identified intent and next resolution steps.'
  },
  {
    label: 'Ask for Clarification',
    prompt: 'Politely ask the customer for missing details or photos to proceed.'
  }
];

export const TicketChatThread: React.FC<TicketChatThreadProps> = ({
  selectedTicket,
  messages,
  ticketRating,
  isLoadingMessages,
  cannedResponses,
  onUpdateTicket,
  onToggleTakeover,
  onGenerateBlazzyDraft,
  onOpenEscalate,
  onOpenCloseTicket,
  onSendMessage
}) => {
  const [inputBody, setInputBody] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  // Blazzy Copilot Draft state
  const [isDrafting, setIsDrafting] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedDraft, setGeneratedDraft] = useState<string | null>(null);
  const [showCopilot, setShowCopilot] = useState(true);
  const [isTogglingTakeover, setIsTogglingTakeover] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const prevTicketIdRef = useRef<string | null>(null);
  const prevMsgLengthRef = useRef<number>(0);

  useEffect(() => {
    const isNewTicket = selectedTicket?.id !== prevTicketIdRef.current;
    const isNewMessage = messages.length > prevMsgLengthRef.current;

    prevTicketIdRef.current = selectedTicket?.id || null;
    prevMsgLengthRef.current = messages.length;

    if (isNewTicket) {
      setGeneratedDraft(null);
      setCustomPrompt('');
    }

    if (!selectedTicket || !chatContainerRef.current) return;
    const container = chatContainerRef.current;

    if (isNewTicket) {
      const timer = setTimeout(() => {
        container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
      }, 50);
      return () => clearTimeout(timer);
    }

    if (isNewMessage) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 300;
      if (isNearBottom) {
        const timer = setTimeout(() => {
          container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [messages.length, selectedTicket?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputBody.trim() && !file) || !selectedTicket) return;

    const result = await onSendMessage({
      body: inputBody,
      file,
      isInternalNote
    });

    if (result.success) {
      setInputBody('');
      setFile(null);
      setIsInternalNote(false);
      setAttachmentError(null);
      setGeneratedDraft(null);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } else if (result.error) {
      setAttachmentError(result.error);
    }
  };

  const handleRunBlazzyDraft = async (promptText?: string) => {
    if (!selectedTicket) return;
    setIsDrafting(true);
    try {
      const draft = await onGenerateBlazzyDraft(promptText || customPrompt);
      if (draft) {
        setGeneratedDraft(draft);
      }
    } catch (err) {
      console.error('Blazzy draft generation failed:', err);
    } finally {
      setIsDrafting(false);
    }
  };

  const handleToggleTakeoverClick = async () => {
    if (!selectedTicket || isTogglingTakeover) return;
    setIsTogglingTakeover(true);
    try {
      await onToggleTakeover(!selectedTicket.isHumanTakeover);
    } finally {
      setIsTogglingTakeover(false);
    }
  };

  if (!selectedTicket) {
    return (
      <div className="flex-1 bg-white flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-300 mb-3">
            <RiCustomerService2Line className="w-8 h-8" />
          </div>
          <p className="font-semibold text-sm text-gray-700">Select a Support Ticket</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">
            Choose a ticket from the left feed to inspect live conversation, AI diagnostics, and customer 360 context.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white flex flex-col min-h-0 overflow-hidden border-r border-gray-200">
      {/* Top Action Bar */}
      <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-gray-500 bg-white px-1.5 py-0.5 rounded border border-gray-200">
              {selectedTicket.ticketNumber || selectedTicket.id.slice(0, 8)}
            </span>
            <h3 className="font-bold text-sm text-gray-900 line-clamp-1">{selectedTicket.subject}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Customer:{' '}
            <span className="font-semibold text-gray-800">{selectedTicket.customerName || 'Customer'}</span>
            {selectedTicket.orderNumber && (
              <>
                {' '}
                • Order:{' '}
                <span className="font-mono font-semibold text-gray-800">
                  #{selectedTicket.orderNumber}
                </span>
              </>
            )}
            {selectedTicket.outletName && (
              <>
                {' '}
                • Outlet: <span className="font-medium text-gray-700">{selectedTicket.outletName}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={selectedTicket.priority}
            onChange={(e) => onUpdateTicket({ priority: e.target.value as any })}
            className="text-xs p-1.5 rounded-lg border border-gray-300 bg-white font-medium text-gray-800"
          >
            <option value="low">Priority: Low</option>
            <option value="normal">Priority: Normal</option>
            <option value="high">Priority: High</option>
            <option value="urgent">Priority: Urgent</option>
          </select>

          <select
            value={selectedTicket.status}
            onChange={(e) => onUpdateTicket({ status: e.target.value as any })}
            disabled={selectedTicket.status === 'closed'}
            className="text-xs p-1.5 rounded-lg border border-gray-300 bg-white font-semibold text-gray-900"
          >
            <option value="open">Status: Open</option>
            <option value="closed">Status: Closed</option>
          </select>

          {selectedTicket.isEscalated ? (
            <span
              className="px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-100 rounded-lg border border-purple-300 flex items-center gap-1"
              title={`Pulse dev status: ${selectedTicket.pulseStatus}`}
            >
              <RiPulseLine className="w-3.5 h-3.5" />
              Escalated ({selectedTicket.pulseStatus || 'backlog'})
            </span>
          ) : (
            <button
              onClick={onOpenEscalate}
              className="px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200 flex items-center gap-1"
              title="Escalate ticket to Pulse dev fix pipeline"
            >
              <RiPulseLine className="w-3.5 h-3.5" />
              Send to Dev
            </button>
          )}

          {selectedTicket.status !== 'closed' ? (
            <button
              onClick={onOpenCloseTicket}
              className="px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
            >
              Close Ticket
            </button>
          ) : (
            <span className="px-2.5 py-1 text-xs font-bold text-gray-600 bg-gray-200 rounded-lg border border-gray-300">
              Closed
            </span>
          )}
        </div>
      </div>

      {/* Human Takeover / Blazzy AI Status Banner */}
      {selectedTicket.status !== 'closed' && (
        <div
          className={`px-4 py-2 border-b flex items-center justify-between text-xs transition-colors shrink-0 ${
            selectedTicket.isHumanTakeover
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-orange-50 border-orange-200 text-orange-950'
          }`}
        >
          <div className="flex items-center gap-2">
            {selectedTicket.isHumanTakeover ? (
              <>
                <RiUserVoiceLine className="w-4 h-4 text-amber-700 shrink-0" />
                <div>
                  <span className="font-bold text-amber-900">Human Support Active</span>
                  <span className="text-[11px] text-amber-800 ml-1.5 hidden sm:inline">
                    Blazzy AI automated responses paused. Staff is in control.
                  </span>
                </div>
              </>
            ) : (
              <>
                <BlazzyIcon className="w-4 h-4 shrink-0" color="#EA580C" />
                <div>
                  <span className="font-bold text-orange-900">Blazzy AI Auto-Pilot Active</span>
                  <span className="text-[11px] text-orange-800 ml-1.5 hidden sm:inline">
                    Blazzy responds automatically and executes policy checks.
                  </span>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleToggleTakeoverClick}
            disabled={isTogglingTakeover}
            className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all border shrink-0 ${
              selectedTicket.isHumanTakeover
                ? 'bg-white text-orange-700 border-orange-300 hover:bg-orange-50'
                : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
            }`}
          >
            {selectedTicket.isHumanTakeover ? 'Hand Back to Blazzy AI' : 'Take Over Conversation'}
          </button>
        </div>
      )}

      {/* Chat Messages Container */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-gray-50/50"
      >
        {ticketRating && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col gap-1 text-xs shadow-2xs my-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-amber-900 text-xs">Customer CSAT Rating:</span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <RiStarFill
                      key={star}
                      className={`w-4 h-4 ${star <= ticketRating.rating ? 'text-amber-500' : 'text-amber-200'}`}
                    />
                  ))}
                </div>
                <span className="font-bold text-amber-800 text-xs">({ticketRating.rating}/5)</span>
              </div>
              <span className="text-[9px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Customer Feedback
              </span>
            </div>
            {ticketRating.comment && (
              <p className="text-amber-950 text-xs bg-white/80 p-2.5 rounded-xl border border-amber-200/60 mt-1 whitespace-pre-wrap font-medium">
                &ldquo;{ticketRating.comment}&rdquo;
              </p>
            )}
          </div>
        )}

        {isLoadingMessages ? (
          <div className="text-center py-12 text-xs text-gray-400">Loading conversation...</div>
        ) : (
          messages.map((m) => {
            const isInternal = m.internalNote;
            const isSystem = m.role === 'system' || m.senderType === 'system';
            const isBot = m.senderType === 'bot' || m.authorName === 'Blazzy AI';
            const isAgent = (m.senderType === 'agent' || m.role === 'agent') && !isBot;

            if (isSystem) {
              return (
                <div key={m.id} className="self-center my-1 text-center max-w-lg">
                  <span className="inline-block px-3 py-1 rounded-full bg-gray-200/90 text-gray-700 text-[10.5px] font-medium border border-gray-300/60">
                    {m.body || m.content}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={m.id}
                className={`flex flex-col ${
                  isInternal
                    ? 'self-center w-full max-w-full my-1'
                    : isAgent || isBot
                      ? 'self-end items-end max-w-[85%]'
                      : 'self-start items-start max-w-[85%]'
                }`}
              >
                {isInternal ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2 shadow-2xs w-full">
                    <RiLock2Line className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[10px] uppercase tracking-wider text-amber-700">
                          Internal Staff Note
                        </span>
                        <span className="text-[10px] text-amber-600 font-medium">
                          {new Date(m.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap font-medium">
                        {m.body || m.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="text-[10px] text-gray-400 px-1 mb-0.5 flex items-center gap-1">
                      {isBot ? (
                        <>
                          <BlazzyIcon className="w-3 h-3 inline shrink-0" color="#EA580C" />
                          <strong className="text-orange-700">Blazzy AI (Assistant)</strong>
                        </>
                      ) : isAgent ? (
                        <strong className="text-gray-900">You (Support Staff)</strong>
                      ) : (
                        <span>{m.senderName || selectedTicket.customerName || 'Customer'}</span>
                      )}{' '}
                      •{' '}
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>

                    <div
                      className={`p-3 rounded-2xl text-xs leading-relaxed ${
                        isBot
                          ? 'bg-orange-50/95 border border-orange-200 text-gray-900 rounded-br-none shadow-2xs'
                          : isAgent
                            ? 'bg-gray-900 text-white rounded-br-none'
                            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-2xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.body || m.content}</p>

                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200/40 flex flex-col gap-2">
                          {m.attachments.map((att, idx) => {
                            const isImg =
                              att.mimeType?.startsWith('image/') ||
                              /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(att.name || att.url || '');

                            if (isImg) {
                              return (
                                <a
                                  key={idx}
                                  href={att.url || '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block my-1"
                                >
                                  <img
                                    src={att.url}
                                    alt={att.name || 'Attachment'}
                                    className="max-w-[240px] max-h-[180px] rounded-lg border border-gray-200 object-cover shadow-2xs hover:opacity-95 transition-opacity"
                                  />
                                </a>
                              );
                            }

                            return (
                              <a
                                key={idx}
                                href={att.url || '#'}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 text-[11px] underline hover:opacity-80"
                              >
                                <RiAttachmentLine className="w-3.5 h-3.5" />
                                <span>{att.name}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Blazzy Copilot / Smart Reply Assistant */}
      {selectedTicket.status !== 'closed' && (
        <div className="border-t border-orange-200/80 bg-orange-50/40 p-3 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
              <BlazzyIcon className="w-4 h-4 shrink-0" color="#EA580C" />
              <span>Blazzy Copilot Assistant</span>
              <span className="text-[10px] font-normal text-gray-500">(Fast Policy-Aware AI)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowCopilot(!showCopilot)}
              className="text-[11px] text-gray-500 hover:text-gray-900 font-medium"
            >
              {showCopilot ? 'Hide Copilot' : 'Show Copilot'}
            </button>
          </div>

          {showCopilot && (
            <>
              {/* Presets chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {BLAZZY_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isDrafting}
                    onClick={() => handleRunBlazzyDraft(preset.prompt)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white hover:bg-orange-50 text-gray-800 border border-gray-200 hover:border-orange-300 transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <RiSparklingLine className="w-3 h-3 text-orange-600" />
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>

              {/* Generated Draft Box if active */}
              {isDrafting && (
                <div className="p-2.5 rounded-xl bg-white border border-orange-200 text-xs text-gray-600 flex items-center gap-2 animate-pulse">
                  <BlazzyIcon className="w-4 h-4 animate-spin shrink-0" color="#EA580C" />
                  <span>Blazzy is crafting a tailored response at lightning speed...</span>
                </div>
              )}

              {generatedDraft && !isDrafting && (
                <div className="p-3 rounded-xl bg-white border border-orange-300 shadow-2xs flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-orange-950 flex items-center gap-1">
                      <BlazzyIcon className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                      <span>Suggested Draft:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setGeneratedDraft(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <RiCloseLine className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed bg-orange-50/30 p-2 rounded-lg border border-orange-100 font-medium">
                    {generatedDraft}
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setInputBody((prev) => (prev ? `${prev}\n${generatedDraft}` : generatedDraft));
                        setGeneratedDraft(null);
                      }}
                      className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 flex items-center gap-1"
                    >
                      <RiCheckLine className="w-3.5 h-3.5 text-gray-700" />
                      <span>Insert into Composer</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await onSendMessage({
                          body: generatedDraft,
                          file: null,
                          isInternalNote: false
                        });
                        setGeneratedDraft(null);
                      }}
                      className="px-3 py-1 rounded-lg text-[11px] font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white flex items-center gap-1"
                    >
                      <RiSendPlaneFill className="w-3.5 h-3.5" />
                      <span>Send Immediately</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Compose Box */}
      {selectedTicket.status === 'closed' ? (
        <div className="p-3.5 border-t border-gray-200 bg-gray-100 text-center text-xs text-gray-600 font-semibold flex items-center justify-center gap-2 select-none shrink-0">
          <RiLock2Line className="w-4 h-4 text-gray-500 shrink-0" />
          <span>This ticket is closed. Re-open ticket status to send new messages.</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 bg-white flex flex-col gap-2 shrink-0">
          {/* File input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setFile(e.target.files[0]);
                setAttachmentError(null);
              }
            }}
            className="hidden"
          />

          {/* File Attachment Pill */}
          {file && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 text-gray-900 border border-gray-200 rounded-md text-[11px] font-medium w-fit">
              <RiAttachmentLine className="w-3.5 h-3.5 text-gray-700" />
              <span className="truncate max-w-[180px]">{file.name}</span>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setAttachmentError(null);
                }}
                className="hover:text-red-600 ml-1"
              >
                <RiCloseLine className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {attachmentError && <div className="text-[11px] font-semibold text-red-600">{attachmentError}</div>}

          {/* Note Toggle & Canned Quick Picker */}
          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isInternalNote}
                onChange={(e) => setIsInternalNote(e.target.checked)}
                className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <span className={`font-semibold text-xs ${isInternalNote ? 'text-amber-700' : 'text-gray-600'}`}>
                Internal Staff Note (Hidden from customer)
              </span>
            </label>

            {cannedResponses.length > 0 && (
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    setInputBody((prev) => (prev ? `${prev}\n${e.target.value}` : e.target.value));
                    e.target.value = '';
                  }
                }}
                className="text-[11px] p-1 border border-gray-200 rounded-md bg-gray-50 text-gray-700 font-medium cursor-pointer"
              >
                <option value="">Insert Canned Response...</option>
                {cannedResponses.map((c) => (
                  <option key={c.id} value={c.body}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors shrink-0"
              title="Attach image or file"
            >
              <RiAttachmentLine className="w-4 h-4" />
            </button>

            <input
              type="text"
              placeholder={isInternalNote ? 'Write internal staff note...' : 'Reply to customer directly...'}
              value={inputBody}
              onChange={(e) => setInputBody(e.target.value)}
              className={`flex-1 text-xs p-2.5 rounded-xl border focus:outline-none focus:ring-2 ${
                isInternalNote
                  ? 'bg-amber-50/50 border-amber-200 focus:ring-amber-500/20 focus:border-amber-500'
                  : 'bg-gray-50 border-gray-200 focus:ring-orange-400/20 focus:border-orange-500'
              }`}
            />

            <button
              type="submit"
              disabled={!inputBody.trim() && !file}
              className={`p-2.5 text-white rounded-xl transition-colors ${
                isInternalNote ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#FF7A00] hover:bg-[#E66E00]'
              }`}
            >
              <RiSendPlaneFill className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
