/**
 * Issue Blockers Modal
 *
 * Displays blockers that prevent survey issuance, grouped by module.
 * Shows server-returned blockers (source of truth) or client-side validation results.
 */

import { X, AlertTriangle } from 'lucide-react';
import { groupBlockersByModule, type Blocker } from '../../utils/issueValidation';

interface IssueBlockersModalProps {
  open: boolean;
  onClose: () => void;
  blockers: Blocker[];
  moduleLabels: Record<string, string>;
}

export default function IssueBlockersModal({
  open,
  onClose,
  blockers,
  moduleLabels,
}: IssueBlockersModalProps) {
  if (!open) return null;

  const groupedBlockers = groupBlockersByModule(blockers);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Cannot Issue Survey</h2>
              <p className="text-sm text-slate-600">
                {blockers.length} issue{blockers.length !== 1 ? 's' : ''} must be resolved
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {Array.from(groupedBlockers.entries()).map(([moduleKey, moduleBlockers]) => {
            const moduleLabel = moduleLabels[moduleKey] || moduleKey;

            return (
              <div key={moduleKey} className="space-y-3">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 bg-slate-900 text-white text-xs rounded-full flex items-center justify-center">
                    {moduleBlockers.length}
                  </span>
                  {moduleLabel}
                </h3>

                <div className="space-y-2">
                  {moduleBlockers.map((blocker, idx) => (
                    <div
                      key={idx}
                      className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-slate-700">{blocker.message}</p>
                        {blocker.fieldKey && (
                          <p className="text-xs text-slate-500 mt-1">Field: {blocker.fieldKey}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {groupedBlockers.has('general') && (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 bg-slate-900 text-white text-xs rounded-full flex items-center justify-center">
                  {groupedBlockers.get('general')!.length}
                </span>
                General Requirements
              </h3>

              <div className="space-y-2">
                {groupedBlockers.get('general')!.map((blocker, idx) => (
                  <div
                    key={idx}
                    className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-slate-700">{blocker.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
