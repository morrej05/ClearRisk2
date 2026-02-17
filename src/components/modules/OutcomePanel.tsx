import { Save } from 'lucide-react';
import {
  getModuleOutcomeCategory,
  CRITICAL_OUTCOME_OPTIONS,
  GOVERNANCE_OUTCOME_OPTIONS,
} from '../../lib/modules/moduleCatalog';

interface OutcomePanelProps {
  outcome: string | null;
  assessorNotes: string;
  onOutcomeChange: (outcome: string) => void;
  onNotesChange: (notes: string) => void;
  onSave: () => void;
  isSaving?: boolean;
  moduleKey: string;
  scoringData?: {
    extent?: string;
    gapType?: string;
  };
  onScoringChange?: (scoring: { extent?: string; gapType?: string }) => void;
}

export default function OutcomePanel({
  outcome,
  assessorNotes,
  onOutcomeChange,
  onNotesChange,
  onSave,
  isSaving = false,
  moduleKey,
  scoringData = {},
  onScoringChange,
}: OutcomePanelProps) {
  const outcomeCategory = getModuleOutcomeCategory(moduleKey);
  const isCritical = outcomeCategory === 'critical';
  const options = isCritical ? CRITICAL_OUTCOME_OPTIONS : GOVERNANCE_OUTCOME_OPTIONS;

  const labelText = isCritical
    ? 'Outcome (life safety impact)'
    : 'Assessment (management & governance)';

  const helperText = isCritical
    ? 'Use "Material Deficiency" only where life safety is significantly compromised.'
    : 'Use this to record adequacy of management arrangements; these do not directly determine Consequence.';

  const normalizedOutcome = outcome?.toLowerCase().replace(/[^a-z_]/g, '_') || '';
  const isMaterialDef = normalizedOutcome.includes('material') || normalizedOutcome.includes('significant');
  const isInfoGap = normalizedOutcome.includes('info') || normalizedOutcome.includes('gap');

  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-6 mt-6">
      <h3 className="text-lg font-bold text-neutral-900 mb-4">
        {isCritical ? 'Module Outcome' : 'Module Assessment'}
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            {labelText}
          </label>
          <select
            value={outcome || ''}
            onChange={(e) => onOutcomeChange(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
          >
            <option value="">— Select {isCritical ? 'Outcome' : 'Assessment'} —</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-neutral-500 mt-1">
            {helperText}
          </p>
        </div>

        {isMaterialDef && onScoringChange && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <label className="block text-sm font-medium text-amber-900 mb-2">
              Extent of Material Deficiency
            </label>
            <select
              value={scoringData.extent || ''}
              onChange={(e) => onScoringChange({ ...scoringData, extent: e.target.value })}
              className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
            >
              <option value="">— Select extent —</option>
              <option value="localised">Localised</option>
              <option value="repeated">Repeated</option>
              <option value="systemic">Systemic</option>
            </select>
            <p className="text-xs text-amber-700 mt-1">
              Systemic or repeated deficiencies may escalate Consequence. Localised issues typically affect Likelihood only.
            </p>
          </div>
        )}

        {isInfoGap && onScoringChange && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <label className="block text-sm font-medium text-blue-900 mb-2">
              Information Gap Type
            </label>
            <select
              value={scoringData.gapType || ''}
              onChange={(e) => onScoringChange({ ...scoringData, gapType: e.target.value })}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">— Select gap type —</option>
              <option value="non_critical">Non-critical</option>
              <option value="critical">Critical</option>
            </select>
            <p className="text-xs text-blue-700 mt-1">
              Critical information gaps block Low/Trivial risk ratings and set assessment to provisional.
            </p>
          </div>
        )}

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
