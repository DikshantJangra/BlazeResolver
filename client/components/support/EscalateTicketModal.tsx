import React, { useState, useEffect } from 'react';
import { RiPulseLine, RiCloseLine } from 'react-icons/ri';
import type { SupportTicket } from './types.js';

interface EscalateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTicket: SupportTicket | null;
  onConfirmEscalate: (data: {
    title: string;
    type: 'bug' | 'feature' | 'note';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    note: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export const EscalateTicketModal: React.FC<EscalateTicketModalProps> = ({
  isOpen,
  onClose,
  selectedTicket,
  onConfirmEscalate
}) => {
  const [escalateTitle, setEscalateTitle] = useState('');
  const [escalateType, setEscalateType] = useState<'bug' | 'feature' | 'note'>('bug');
  const [escalatePriority, setEscalatePriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('high');
  const [escalateNote, setEscalateNote] = useState('');
  const [escalateError, setEscalateError] = useState<string | null>(null);
  const [isEscalating, setIsEscalating] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (selectedTicket && isOpen) {
      setEscalateTitle(`[Ticket ${selectedTicket.id.substring(0, 8)}] ${selectedTicket.subject}`);
      setEscalateType(
        selectedTicket.category === 'technical'
          ? 'bug'
          : selectedTicket.category === 'feature_request'
            ? 'feature'
            : 'note'
      );
      setEscalatePriority(
        selectedTicket.priority === 'urgent'
          ? 'urgent'
          : selectedTicket.priority === 'high'
            ? 'high'
            : 'medium'
      );
      setEscalateNote('');
      setEscalateError(null);
    }
  }, [selectedTicket, isOpen]);

  if (!isOpen || !selectedTicket) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEscalating || !escalateTitle.trim()) return;

    setIsEscalating(true);
    setEscalateError(null);

    try {
      const result = await onConfirmEscalate({
        title: escalateTitle.trim(),
        type: escalateType,
        priority: escalatePriority,
        note: escalateNote.trim()
      });

      if (result.success) {
        onClose();
      } else {
        setEscalateError(result.error || 'Failed to escalate ticket to dev pipeline.');
      }
    } catch (err) {
      console.error('Failed to escalate ticket:', err);
      setEscalateError('Connection error while escalating ticket.');
    } finally {
      setIsEscalating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-200 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2 text-purple-700">
            <RiPulseLine className="w-5 h-5" /> Escalate Ticket to Pulse Dev Pipeline
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        <div className="p-2.5 bg-purple-50 border border-purple-100 rounded-xl text-xs flex items-center justify-between text-purple-900">
          <div>
            <span className="font-bold">{selectedTicket.customerName || selectedTicket.outletName || 'Customer'}</span>
            <span className="text-purple-600 ml-1.5">• ID: {selectedTicket.id.substring(0, 8)}</span>
          </div>
          <span className="px-2 py-0.5 bg-purple-200 text-purple-900 text-[10px] font-bold rounded-full uppercase">
            {selectedTicket.category || 'General'}
          </span>
        </div>

        {escalateError && (
          <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
            {escalateError}
          </div>
        )}

        <div>
          <label className="font-semibold block mb-1 text-xs text-gray-700">Dev Item Title</label>
          <input
            type="text"
            value={escalateTitle}
            onChange={(e) => setEscalateTitle(e.target.value)}
            className="w-full p-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-semibold block mb-1 text-xs text-gray-700">Item Type</label>
            <select
              value={escalateType}
              onChange={(e) => setEscalateType(e.target.value as 'bug' | 'feature' | 'note')}
              className="w-full p-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none bg-white font-medium"
            >
              <option value="bug">Bug (Fix needed)</option>
              <option value="feature">Feature Request</option>
              <option value="note">Internal Dev Note</option>
            </select>
          </div>

          <div>
            <label className="font-semibold block mb-1 text-xs text-gray-700">Priority</label>
            <select
              value={escalatePriority}
              onChange={(e) => setEscalatePriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')}
              className="w-full p-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none bg-white font-medium"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div>
          <label className="font-semibold block mb-1 text-xs text-gray-700">
            Developer Notes & Context <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <textarea
            placeholder="Add reproduction details, code references, or notes for the engineering fix..."
            value={escalateNote}
            onChange={(e) => setEscalateNote(e.target.value)}
            rows={3}
            className="w-full p-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isEscalating || !escalateTitle.trim()}
            className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
          >
            <RiPulseLine className="w-4 h-4" />
            {isEscalating ? 'Escalating...' : 'Send to Dev Backlog'}
          </button>
        </div>
      </form>
    </div>
  );
};
