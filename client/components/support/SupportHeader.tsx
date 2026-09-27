import React from 'react';
import { RiCustomerService2Line, RiBookmarkLine, RiAddLine, RiUserSmileLine, RiShieldUserLine } from 'react-icons/ri';
import { BlazzyBadge } from './BlazzyMascot.js';

interface SupportHeaderProps {
  mode: 'admin' | 'customer';
  onModeChange: (mode: 'admin' | 'customer') => void;
  onOpenCannedModal: () => void;
  onOpenNewTicketModal?: () => void;
}

export const SupportHeader: React.FC<SupportHeaderProps> = ({
  mode,
  onModeChange,
  onOpenCannedModal,
  onOpenNewTicketModal
}) => {
  return (
    <div className="bg-white border-b border-gray-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[#FF7A00]">
            <RiCustomerService2Line size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2 m-0 leading-tight">
              <span>BlazeResolver Customer Support</span>
              <BlazzyBadge text="AI Triage Active" />
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Autonomous AI Triage, policy auto-resolution, live human handoff & diagnostic audit desk.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Mode Switcher */}
        <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 border border-gray-200 text-xs">
          <button
            type="button"
            onClick={() => onModeChange('admin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
              mode === 'admin'
                ? 'bg-white text-gray-900 shadow-xs border border-gray-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <RiShieldUserLine className="w-4 h-4 text-orange-600" />
            <span>Admin Helpdesk</span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange('customer')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
              mode === 'customer'
                ? 'bg-white text-gray-900 shadow-xs border border-gray-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <RiUserSmileLine className="w-4 h-4 text-blue-600" />
            <span>User Support Portal</span>
          </button>
        </div>

        {mode === 'admin' ? (
          <button
            type="button"
            onClick={onOpenCannedModal}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-2xs"
          >
            <RiBookmarkLine className="w-4 h-4 text-gray-500" />
            <span>Canned Responses</span>
          </button>
        ) : onOpenNewTicketModal ? (
          <button
            type="button"
            onClick={onOpenNewTicketModal}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[#FF7A00] hover:bg-[#E66E00] transition-colors shadow-2xs"
          >
            <RiAddLine className="w-4 h-4" />
            <span>Submit New Ticket</span>
          </button>
        ) : null}
      </div>
    </div>
  );
};
