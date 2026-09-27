import React from 'react';
import { RiBookmarkLine, RiAddLine, RiHistoryLine, RiShieldUserLine } from 'react-icons/ri';
import { BlazzyIcon, BlazzyBadge } from './BlazzyMascot.js';

interface SupportHeaderProps {
  mode: 'admin' | 'timeline';
  onModeChange: (mode: 'admin' | 'timeline') => void;
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
    <div
      style={{ backgroundColor: '#ffffff', borderColor: '#E5E7EB', color: '#111827' }}
      className="border-b px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0"
    >
      <div>
        <div className="flex items-center gap-2.5">
          <BlazzyIcon className="w-8 h-8 rounded-lg object-contain border border-orange-200 bg-orange-50 p-1 shadow-2xs" />
          <div>
            <h1 style={{ color: '#111827' }} className="text-lg font-bold tracking-tight flex items-center gap-2 m-0 leading-tight">
              <span>BlazeResolver Customer Resolution Desk</span>
              <BlazzyBadge text="AI Triage Active" />
            </h1>
            <p style={{ color: '#6B7280' }} className="text-xs mt-0.5">
              Autonomous AI Triage, policy auto-resolution, live git timeline & self-healing audit desk.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Mode Switcher */}
        <div style={{ backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }} className="p-1 rounded-xl flex items-center gap-1 border text-xs">
          <button
            type="button"
            onClick={() => onModeChange('admin')}
            style={
              mode === 'admin'
                ? { backgroundColor: '#ffffff', color: '#111827', borderColor: '#E5E7EB', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
                : { color: '#4B5563', borderColor: 'transparent' }
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all border cursor-pointer"
          >
            <RiShieldUserLine className="w-4 h-4 text-orange-600" />
            <span>Admin Helpdesk</span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange('timeline')}
            style={
              mode === 'timeline'
                ? { backgroundColor: '#ffffff', color: '#111827', borderColor: '#E5E7EB', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
                : { color: '#4B5563', borderColor: 'transparent' }
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all border cursor-pointer"
          >
            <RiHistoryLine className="w-4 h-4 text-purple-600" />
            <span>BlazeTimeline</span>
          </button>
        </div>

        {mode === 'admin' && (
          <button
            type="button"
            onClick={onOpenCannedModal}
            style={{ backgroundColor: '#ffffff', color: '#374151', borderColor: '#E5E7EB' }}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer"
          >
            <RiBookmarkLine className="w-4 h-4 text-gray-500" />
            <span>Canned Responses</span>
          </button>
        )}
      </div>
    </div>
  );
};
