import React, { useState, useEffect } from 'react';
import { RiLock2Line, RiCloseLine } from 'react-icons/ri';

interface CloseTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmClose: (password: string) => Promise<{ success: boolean; error?: string }>;
}

export const CloseTicketModal: React.FC<CloseTicketModalProps> = ({
  isOpen,
  onClose,
  onConfirmClose
}) => {
  const [closePassword, setClosePassword] = useState('');
  const [closePasswordError, setClosePasswordError] = useState<string | null>(null);
  const [isClosingTicket, setIsClosingTicket] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setClosePassword('');
        setClosePasswordError(null);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closePassword.trim() || isClosingTicket) return;

    setIsClosingTicket(true);
    setClosePasswordError(null);

    try {
      const result = await onConfirmClose(closePassword);
      if (result.success) {
        setClosePassword('');
        onClose();
      } else {
        setClosePasswordError(result.error || 'Failed to close ticket. Please verify password.');
      }
    } catch (err) {
      console.error('Failed to close ticket:', err);
      setClosePasswordError('An error occurred while confirming password.');
    } finally {
      setIsClosingTicket(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5 text-red-600">
            <RiLock2Line className="w-4 h-4" /> Close Ticket Confirmation
          </h3>
          <button
            type="button"
            onClick={() => {
              setClosePassword('');
              setClosePasswordError(null);
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed">
          Closing a ticket archives the conversation and disables further customer replies. Please enter admin password to confirm.
        </p>

        {closePasswordError && (
          <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
            {closePasswordError}
          </div>
        )}

        <div>
          <label className="font-semibold block mb-1 text-xs text-gray-700">Admin Password</label>
          <input
            type="password"
            placeholder="Enter password (or 'admin')..."
            value={closePassword}
            onChange={(e) => setClosePassword(e.target.value)}
            className="w-full p-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-red-500/20 focus:border-red-600 outline-none"
            required
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => {
              setClosePassword('');
              setClosePasswordError(null);
              onClose();
            }}
            className="px-3.5 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isClosingTicket || !closePassword.trim()}
            className="px-3.5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-2xs disabled:opacity-50"
          >
            {isClosingTicket ? 'Confirming...' : 'Permanently Close Ticket'}
          </button>
        </div>
      </form>
    </div>
  );
};
