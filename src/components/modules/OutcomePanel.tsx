import { Save } from 'lucide-react';

interface OutcomePanelProps {
  outcome: string | null;
  assessorNotes: string;
  onOutcomeChange: (outcome: string) => void;
  onNotesChange: (notes: string) => void;
  onSave: () => void;
  isSaving?: boolean;
}

export default function OutcomePanel({
  outcome,
  assessorNotes,
  onOutcomeChange,
  onNotesChange,
  onSave,
  isSaving = false,
}: OutcomePanelProps) {
  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-6 mt-6">
      <h3 className="text-lg font-bold text-neutral-900 mb-4">Module Outcome</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Outcome Assessment
          </label>
          <select
            value={outcome || ''}
            onChange={(e) => onOutcomeChange(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
          >
            <option value="">— Select Outcome —</option>
            <option value="compliant">Compliant</option>
            <option value="minor_def">Minor Deficiency</option>
            <option value="material_def">Material Deficiency</option>
            <option value="info_gap">Information Gap</option>
            <option value="na">Not Applicable</option>
          </select>
          <p className="text-xs text-neutral-500 mt-1">
            Select the overall assessment outcome for this module
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Assessor Notes
          </label>
          <textarea
            value={assessorNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Add any notes, observations, or context relevant to this module assessment..."
            rows={4}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
          />
          <p className="text-xs text-neutral-500 mt-1">
            These notes will be included in the assessment report
          </p>
        </div>

        <div className="pt-4 border-t border-neutral-200">
          <button
            onClick={onSave}
            disabled={isSaving}
            className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
              isSaving
                ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                : 'bg-neutral-900 text-white hover:bg-neutral-800'
            }`}
          >
            <Save className="w-5 h-5" />
            {isSaving ? 'Saving...' : 'Save Module'}
          </button>
        </div>
      </div>
    </div>
  );
}
