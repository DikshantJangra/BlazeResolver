import React from 'react';
import {
  RiSearchLine,
  RiPulseLine,
  RiUserVoiceLine,
  RiInboxLine,
  RiShieldFlashLine,
  RiAlertLine
} from 'react-icons/ri';
import { BlazzyIcon } from './BlazzyMascot.js';
import type { SupportTicket } from './types.js';

interface TicketFeedProps {
  tickets: SupportTicket[];
  selectedTicket: SupportTicket | null;
  onSelectTicket: (ticket: SupportTicket) => void;
  isLoading: boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (category: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (priority: string) => void;
}

export const TicketFeed: React.FC<TicketFeedProps> = ({
  tickets,
  selectedTicket,
  onSelectTicket,
  isLoading,
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  priorityFilter,
  onPriorityFilterChange
}) => {
  const filteredTickets = tickets.filter((t) => {
    if (statusFilter && t.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (priorityFilter && t.priority.toLowerCase() !== priorityFilter.toLowerCase()) return false;
    if (categoryFilter && t.category && t.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.subject.toLowerCase().includes(q) ||
        (t.ticketNumber && t.ticketNumber.toLowerCase().includes(q)) ||
        (t.customerName && t.customerName.toLowerCase().includes(q)) ||
        (t.orderNumber && t.orderNumber.toLowerCase().includes(q)) ||
        (t.outletName && t.outletName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="w-80 lg:w-96 bg-white border-r border-gray-200 flex flex-col min-h-0 overflow-hidden shrink-0">
      {/* Filters Bar */}
      <div className="p-3 border-b border-gray-100 flex flex-col gap-2 bg-gray-50/50">
        <div className="relative">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none z-10" />
          <input
            type="text"
            placeholder="Search tickets, customers, orders..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            style={{ paddingLeft: '2.25rem' }}
            className="w-full pr-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-500 bg-white"
          />
        </div>

        <div className="grid grid-cols-3 gap-1 text-xs">
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="p-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-medium"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => onPriorityFilterChange(e.target.value)}
            className="p-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-medium"
          >
            <option value="">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className="p-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-medium"
          >
            <option value="">All Categories</option>
            <option value="orders">Orders</option>
            <option value="kitchen">Kitchen</option>
            <option value="billing">Billing</option>
            <option value="refund">Refunds</option>
            <option value="technical">Technical</option>
          </select>
        </div>
      </div>

      {/* Ticket List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 p-2 space-y-1">
        {isLoading ? (
          <div className="text-center py-12 text-xs text-gray-400">Loading support tickets...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-12 px-4 flex flex-col items-center justify-center text-gray-400">
            <RiInboxLine className="w-10 h-10 text-gray-300 mb-2" />
            <p className="font-semibold text-xs text-gray-600">No support tickets found</p>
            <p className="text-[11px] text-gray-400 mt-1 max-w-[220px]">
              Customer queries submitted from user portal or inbound APIs appear here in real-time.
            </p>
          </div>
        ) : (
          filteredTickets.map((t) => {
            const isSelected = selectedTicket?.id === t.id;
            const isUrgent = t.priority === 'urgent' || t.priority === 'high';

            return (
              <div
                key={t.id}
                onClick={() => onSelectTicket(t)}
                className={`p-3 rounded-xl cursor-pointer transition-all flex flex-col gap-1.5 ${
                  isSelected
                    ? 'bg-orange-50/70 border border-orange-200 shadow-2xs'
                    : 'bg-white hover:bg-gray-50 border border-gray-100/80'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-[10px] font-bold text-gray-500 shrink-0">
                      {t.ticketNumber || t.id.slice(0, 8)}
                    </span>
                    <span className="font-bold text-xs text-gray-900 truncate">
                      {t.customerName || t.outletName || 'Customer'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isUrgent && (
                      <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 text-[9px] font-bold flex items-center gap-0.5">
                        <RiAlertLine className="w-3 h-3 text-red-600" />
                        {t.priority.toUpperCase()}
                      </span>
                    )}
                    {t.isEscalated && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-0.5"
                        title={`Pulse status: ${t.pulseStatus || 'backlog'}`}
                      >
                        <RiPulseLine className="w-3 h-3 text-purple-600" /> Dev
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        t.status === 'open'
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                </div>

                <p className="text-xs font-medium text-gray-700 line-clamp-1">{t.subject}</p>

                {/* AI / Human status pill & timestamp */}
                <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5">
                  <div className="flex items-center gap-1.5">
                    {t.status !== 'closed' &&
                      (t.isHumanTakeover ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[9.5px] font-semibold">
                          <RiUserVoiceLine className="w-3 h-3 text-amber-600" />
                          <span>Human Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200 text-[9.5px] font-semibold">
                          <BlazzyIcon className="w-3 h-3 shrink-0" color="#EA580C" />
                          <span>Blazzy AI</span>
                        </span>
                      ))}
                    <span className="capitalize text-gray-600 font-medium px-1.5 py-0.5 bg-gray-100 rounded text-[9.5px]">
                      {t.category || 'General'}
                    </span>
                  </div>

                  <span className="tabular-nums text-gray-500 font-mono text-[10px]">
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
  );
};
