import React, { useState } from 'react';
import {
  RiBookmarkLine,
  RiCloseLine,
  RiAddLine,
  RiEditLine,
  RiDeleteBinLine,
  RiSendPlaneFill,
  RiCheckLine
} from 'react-icons/ri';
import type { SupportCannedResponse } from './types.js';

interface CannedResponsesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cannedResponses: SupportCannedResponse[];
  onAddCannedResponse: (title: string, body: string) => Promise<void>;
  onUpdateCannedResponse: (id: string, title: string, body: string) => Promise<void>;
  onDeleteCannedResponse: (id: string) => Promise<void>;
  onSetAutoReply: (id: string) => Promise<void>;
  onSendDirectly: (body: string) => void;
  onInsertText: (body: string) => void;
}

export const CannedResponsesDrawer: React.FC<CannedResponsesDrawerProps> = ({
  isOpen,
  onClose,
  cannedResponses,
  onAddCannedResponse,
  onUpdateCannedResponse,
  onDeleteCannedResponse,
  onSetAutoReply,
  onSendDirectly,
  onInsertText
}) => {
  const [showAddCanned, setShowAddCanned] = useState(false);
  const [newCannedTitle, setNewCannedTitle] = useState('');
  const [newCannedBody, setNewCannedBody] = useState('');

  const [editingCannedId, setEditingCannedId] = useState<string | null>(null);
  const [editCannedTitle, setEditCannedTitle] = useState('');
  const [editCannedBody, setEditCannedBody] = useState('');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setEditingCannedId(null);
        setShowAddCanned(false);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCannedTitle.trim() || !newCannedBody.trim()) return;
    await onAddCannedResponse(newCannedTitle.trim(), newCannedBody.trim());
    setNewCannedTitle('');
    setNewCannedBody('');
    setShowAddCanned(false);
  };

  const handleUpdate = async (id: string) => {
    if (!editCannedTitle.trim() || !editCannedBody.trim()) return;
    await onUpdateCannedResponse(id, editCannedTitle.trim(), editCannedBody.trim());
    setEditingCannedId(null);
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 w-96 bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RiBookmarkLine className="w-5 h-5 text-gray-800" />
          <h3 className="font-bold text-sm text-gray-900">Canned Responses Library</h3>
        </div>
        <button
          onClick={() => {
            onClose();
            setEditingCannedId(null);
            setShowAddCanned(false);
          }}
          className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/50 transition-colors"
        >
          <RiCloseLine className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
        {showAddCanned ? (
          <form
            onSubmit={handleCreate}
            className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 flex flex-col gap-3"
          >
            <h4 className="font-bold text-xs text-gray-900">Add New Canned Response</h4>
            <div>
              <label className="font-semibold block mb-1 text-gray-700 text-[11px]">Title</label>
              <input
                type="text"
                placeholder="e.g. Refund Policy Explanation"
                value={newCannedTitle}
                onChange={(e) => setNewCannedTitle(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-xl bg-white text-xs focus:ring-2 focus:ring-orange-400/20 focus:border-orange-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-gray-700 text-[11px]">Response Body</label>
              <textarea
                placeholder="Standard message text to insert..."
                value={newCannedBody}
                onChange={(e) => setNewCannedBody(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-xl bg-white h-24 resize-none text-xs focus:ring-2 focus:ring-orange-400/20 focus:border-orange-500 outline-none"
                required
              />
            </div>
            <div className="flex items-center gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowAddCanned(false)}
                className="px-3 py-1.5 text-gray-600 bg-white border border-gray-200 rounded-xl font-medium text-xs hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 text-white bg-[#FF7A00] hover:bg-[#E66E00] rounded-xl font-semibold text-xs transition-colors shadow-2xs"
              >
                Save Response
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowAddCanned(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 bg-gray-100 p-2.5 rounded-xl border border-gray-200 justify-center hover:bg-gray-200 transition-colors shadow-2xs"
          >
            <RiAddLine className="w-4 h-4" /> Add Canned Response
          </button>
        )}

        <div className="flex flex-col gap-2 divide-y divide-gray-100">
          {cannedResponses.map((cr) => {
            const isEditing = editingCannedId === cr.id;

            if (isEditing) {
              return (
                <div
                  key={cr.id}
                  className="py-3 flex flex-col gap-2 bg-amber-50/50 p-3 rounded-2xl border border-amber-200"
                >
                  <h5 className="font-bold text-xs text-amber-900">Edit Canned Response</h5>
                  <input
                    type="text"
                    value={editCannedTitle}
                    onChange={(e) => setEditCannedTitle(e.target.value)}
                    className="w-full p-2 border border-amber-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-amber-500/20 outline-none"
                    placeholder="Title"
                  />
                  <textarea
                    value={editCannedBody}
                    onChange={(e) => setEditCannedBody(e.target.value)}
                    className="w-full p-2 border border-amber-300 rounded-xl text-xs bg-white h-24 resize-none focus:ring-2 focus:ring-amber-500/20 outline-none"
                    placeholder="Response Body"
                  />
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingCannedId(null)}
                      className="px-2.5 py-1 text-gray-600 bg-white border rounded-xl text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdate(cr.id)}
                      className="px-2.5 py-1 text-white bg-amber-600 hover:bg-amber-700 rounded-xl text-xs font-bold"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={cr.id}
                className="py-2.5 flex flex-col gap-1.5 hover:bg-gray-50 p-2.5 rounded-2xl transition-colors border border-transparent hover:border-gray-200"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <h5 className="font-bold text-gray-900 text-xs">{cr.title}</h5>
                    {cr.isAutoReply && (
                      <span className="text-[9px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        ⚡ Auto-Reply
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingCannedId(cr.id);
                        setEditCannedTitle(cr.title);
                        setEditCannedBody(cr.body);
                      }}
                      className="p-1 text-gray-400 hover:text-amber-600 rounded-md transition-colors"
                      title="Edit response"
                    >
                      <RiEditLine className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteCannedResponse(cr.id)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded-md transition-colors"
                      title="Delete response"
                    >
                      <RiDeleteBinLine className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-gray-600 text-[11px] leading-relaxed whitespace-pre-wrap">
                  {cr.body}
                </p>

                <div className="flex items-center gap-2 pt-1 border-t border-gray-100 text-[10px]">
                  <button
                    onClick={() => onSendDirectly(cr.body)}
                    className="font-bold text-white bg-[#FF7A00] hover:bg-[#E66E00] px-2 py-1 rounded-lg flex items-center gap-1 transition-colors shadow-2xs"
                    title="Send this response into current chat thread immediately"
                  >
                    <RiSendPlaneFill className="w-3 h-3" /> Send Now
                  </button>
                  <button
                    onClick={() => onInsertText(cr.body)}
                    className="font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg transition-colors"
                  >
                    Insert Text
                  </button>
                  <button
                    onClick={() => onSetAutoReply(cr.id)}
                    className={`font-semibold px-2 py-1 rounded-lg transition-colors ml-auto ${
                      cr.isAutoReply
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'text-gray-500 hover:text-gray-800 bg-gray-50 hover:bg-gray-100'
                    }`}
                    title="Toggle as auto-reply for incoming customer requests"
                  >
                    {cr.isAutoReply ? 'Active Auto-Reply' : 'Set Auto-Reply'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
