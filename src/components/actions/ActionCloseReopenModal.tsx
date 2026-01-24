/**
 * Action Close/Reopen Modal
 *
 * Modal for closing or reopening actions/recommendations with optional notes.
 */

import { X } from 'lucide-react';
import { useState } from 'react';

interface ActionCloseReopenModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (note: string) => Promise<void>;
  action: 'close' | 'reopen';
  actionTitle: string;
  isLoading: boolean;
}

export default function ActionCloseReopenModal({
  open,
  onClose,
  onConfirm,
  action,
  actionTitle,
  isLoading,
}: ActionCloseReopenModalProps) {
  const [note, setNote] = useState('');

  if (!open) return null;

  const handleConfirm = async () => {
    await onConfirm(note);
    setNote('');
  };

  const handleClose = () => {
    setNote('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {action === 'close' ? 'Close Action' : 'Reopen Action'}
          </h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <p className="text-sm text-slate-700 mb-2">
              <span className="font-medium">Action:</span> {actionTitle}
            </p>
            <p className="text-sm text-slate-600">
              {action === 'close'
                ? 'Mark this action as closed/resolved. You can add notes to document the resolution.'
                : 'Reopen this action. You can add notes to explain why this action is being reopened.'}
            </p>
          </div>

          <div>
            <label htmlFor="action-note" className="block text-sm font-medium text-slate-700 mb-2">
              Notes <span className="text-slate-500">(optional)</span>
            </label>
            <textarea
              id="action-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder={
                action === 'close'
                  ? 'e.g., Issue resolved, controls implemented...'
                  : 'e.g., Issue recurred, needs further action...'
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-slate-700 hover:text-slate-900 transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg text-white transition-colors ${
              action === 'close'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-blue-600 hover:bg-blue-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? 'Processing...' : action === 'close' ? 'Close Action' : 'Reopen Action'}
          </button>
        </div>
      </div>
    </div>
  );
}
