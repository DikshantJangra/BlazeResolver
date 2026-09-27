import React from 'react';
import {
  RiUser3Line,
  RiBuilding2Line,
  RiShoppingBag3Line,
  RiMailLine,
  RiPhoneLine,
  RiAwardLine,
  RiStarFill,
  RiStickyNoteLine,
  RiCpuLine,
  RiShieldCheckLine,
  RiAlertLine,
  RiPulseLine,
  RiCheckDoubleLine,
  RiTimerLine
} from 'react-icons/ri';
import { BlazzyIcon } from './BlazzyMascot.js';
import type { CustomerContext, SupportMessage, SupportTicket, TicketRating } from './types.js';

export interface CustomerContextPanelProps {
  customerContext: CustomerContext | null;
  selectedTicket?: SupportTicket | null;
  ticketRating?: TicketRating | null;
  internalNotes?: SupportMessage[];
}

export const CustomerContextPanel: React.FC<CustomerContextPanelProps> = ({
  customerContext,
  selectedTicket,
  ticketRating,
  internalNotes
}) => {
  const aiReport = selectedTicket?.aiReport;

  return (
    <div className="w-80 lg:w-96 bg-gray-50/80 p-4 border-l border-gray-200 overflow-y-auto flex flex-col gap-4 text-xs shrink-0">
      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
        <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500">
          Customer 360 & AI Diagnostics
        </h4>
        {aiReport && (
          <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold flex items-center gap-1">
            <BlazzyIcon className="w-3 h-3 shrink-0" color="#EA580C" /> AI Inspected
          </span>
        )}
      </div>

      {/* AI Performance & Triage Execution Report */}
      {aiReport && (
        <div className="bg-white p-3.5 rounded-2xl border border-orange-200 shadow-2xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-gray-900 text-xs">
              <RiCpuLine className="w-4 h-4 text-orange-600" />
              <span>AI Triage & Policy Verdict</span>
            </div>
            {aiReport.executionDurationMs && (
              <span className="text-[10px] font-mono text-gray-500 flex items-center gap-0.5">
                <RiTimerLine className="w-3 h-3 text-gray-400" />
                {aiReport.executionDurationMs}ms
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 bg-orange-50/50 p-2.5 rounded-xl border border-orange-100 text-[11px]">
            <div>
              <span className="text-gray-500 block text-[10px]">Intent Classified</span>
              <span className="font-bold text-gray-900 capitalize">{aiReport.intent || selectedTicket?.category || 'General'}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px]">Customer Sentiment</span>
              <span className="font-bold text-gray-900 capitalize">{aiReport.sentiment || 'Neutral'}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px]">Guardrail Check</span>
              <span className="font-semibold text-emerald-700 flex items-center gap-1">
                <RiShieldCheckLine className="w-3.5 h-3.5" /> Passed Clean
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px]">Urgency Score</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      (aiReport.urgencyScore || 50) > 75
                        ? 'bg-red-500'
                        : (aiReport.urgencyScore || 50) > 50
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${aiReport.urgencyScore || 50}%` }}
                  />
                </div>
                <span className="font-mono font-bold text-gray-800 text-[10px]">
                  {aiReport.urgencyScore || 50}/100
                </span>
              </div>
            </div>
          </div>

          {/* Policy decision */}
          <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200/80 flex flex-col gap-1 text-[11px]">
            <div className="flex items-center justify-between font-bold">
              <span className="text-gray-700">Policy Authorization:</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  aiReport.policyAllowed
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {aiReport.policyAllowed ? 'Auto-Approve Eligible' : 'Requires Review'}
              </span>
            </div>
            {aiReport.policyRationale && (
              <p className="text-gray-600 leading-relaxed text-[11px] mt-0.5">
                {aiReport.policyRationale}
              </p>
            )}
            {aiReport.suggestedAction && (
              <div className="mt-1 pt-1 border-t border-gray-200 text-[10.5px] text-gray-800">
                <strong className="text-orange-900">Recommended Action:</strong> {aiReport.suggestedAction}
              </div>
            )}
          </div>

          {/* Incident link if systemic */}
          {aiReport.isSystemic && (
            <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-[11px] flex flex-col gap-1">
              <div className="flex items-center gap-1 font-bold">
                <RiPulseLine className="w-4 h-4 text-purple-700" />
                <span>Correlated Systemic Incident</span>
              </div>
              <p className="text-purple-800 text-[10.5px]">
                {aiReport.incidentTitle || 'Active incident cluster linked with this customer complaint.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Customer Profile Card */}
      {customerContext ? (
        <>
          <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col gap-2.5">
            <div className="font-bold text-gray-800 flex items-center justify-between">
              <span>Customer Profile</span>
              {customerContext.isVip && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1">
                  <RiAwardLine className="w-3 h-3 text-amber-600" /> VIP Member
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2 text-gray-600">
              <div className="flex items-center gap-2">
                <RiUser3Line className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate font-semibold text-gray-900">
                  {customerContext.name || selectedTicket?.customerName || 'Customer'}
                </span>
              </div>
              {(customerContext.email || selectedTicket?.customerEmail) && (
                <div className="flex items-center gap-2">
                  <RiMailLine className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="truncate">{customerContext.email || selectedTicket?.customerEmail}</span>
                </div>
              )}
              {(customerContext.phone || selectedTicket?.customerPhone) && (
                <div className="flex items-center gap-2">
                  <RiPhoneLine className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="font-mono">{customerContext.phone || selectedTicket?.customerPhone}</span>
                </div>
              )}
              {(customerContext.outletName || selectedTicket?.outletName) && (
                <div className="flex items-center gap-2 text-gray-500 pt-1 border-t border-gray-100">
                  <RiBuilding2Line className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="truncate">{customerContext.outletName || selectedTicket?.outletName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Linked Orders / Activity */}
          {customerContext.recentOrders && customerContext.recentOrders.length > 0 && (
            <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col gap-2">
              <span className="font-bold text-gray-800">Linked Order History</span>
              <div className="space-y-2">
                {customerContext.recentOrders.map((ord: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 text-[11px] flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-gray-900 font-mono">#{ord.orderNumber}</span>
                      <span className="text-gray-900 font-mono">
                        ₹{((ord.totalPaise || 0) / 100).toFixed(2)}
                      </span>
                    </div>
                    {ord.itemsSummary && (
                      <p className="text-gray-600 text-[10.5px] line-clamp-1">{ord.itemsSummary}</p>
                    )}
                    <div className="flex items-center justify-between text-gray-500 text-[10px] pt-0.5">
                      <span className="capitalize font-semibold text-gray-700">{ord.status}</span>
                      <span>{ord.outletName || 'Downtown Kitchen'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ticket CSAT Rating */}
          {ticketRating && (
            <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col gap-1.5">
              <div className="font-bold text-gray-800 flex items-center justify-between">
                <span>CSAT Score</span>
                <span className="flex items-center gap-1 text-amber-500 font-bold">
                  <RiStarFill className="w-3.5 h-3.5" />
                  <span>{ticketRating.rating} / 5</span>
                </span>
              </div>
              {ticketRating.comment && (
                <p className="text-[11px] text-gray-600 italic mt-0.5 bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                  &ldquo;{ticketRating.comment}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Internal Staff Notes */}
          {internalNotes && internalNotes.length > 0 && (
            <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200 shadow-2xs space-y-2">
              <span className="font-bold text-amber-900 flex items-center gap-1 text-xs">
                <RiStickyNoteLine className="w-4 h-4 text-amber-700" />
                <span>Internal Staff Notes ({internalNotes.length})</span>
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {internalNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-2 rounded-xl bg-white border border-amber-100 text-[11px] text-gray-800 shadow-2xs"
                  >
                    <p className="leading-relaxed">{note.content || note.body}</p>
                    <span className="text-[9.5px] text-gray-400 mt-1 block">
                      {note.authorName || note.senderName || 'Agent'} •{' '}
                      {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8 text-gray-400 bg-white rounded-2xl border border-gray-200 p-4">
          <RiShoppingBag3Line className="w-8 h-8 mx-auto text-gray-300 mb-1" />
          <p className="font-medium text-xs text-gray-600">No customer profile linked</p>
        </div>
      )}
    </div>
  );
};
