import { Save } from 'lucide-react';
import { getModuleOutcomeCategory } from '../../lib/modules/moduleCatalog';

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
  optionSet?: 'auto' | 'critical' | 'governance';
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border border-neutral-300 bg-neutral-50 text-neutral-700">
      {children}
    </span>
  );
}

const CRITICAL_OPTIONS = [
  { value: 'compliant', label: 'Compliant' },
  { value: 'minor_def', label: 'Minor Deficiency' },
  { value: 'material_def', label: 'Material Deficiency' },
  { value: 'info_gap', label: 'Information Gap' },
  { value: 'na', label: 'Not Applicable' },
] as const;

const GOVERNANCE_OPTIONS = [
  { value: 'compliant', label: 'Adequate' },
  { value: 'minor_def', label: 'Improvement Recommended' },
  { value: 'material_def', label: 'Significant Improvement Required' },
  { value: 'info_gap', label: 'Information Incomplete' },
  { value: 'na', label: 'Not Applicable' },
] as const;

function normalizeOutcomeValue(value: string | null | undefined): string {
  if (!value) return '';

  const normalized = value.toLowerCase().trim();

  if (normalized === 'compliant' || normalized === 'adequate') return 'compliant';

  if (
    normalized === 'minor_def' ||
    normalized === 'minor deficiency' ||
    normalized === 'minor_deficiency' ||
    normalized === 'improvement recommended'
  ) {
    return 'minor_def';
  }

  if (
    normalized === 'material_def' ||
    normalized === 'material deficiency' ||
    normalized === 'material_deficiency' ||
    normalized === 'significant improvement required'
  ) {
    return 'material_def';
  }

  if (
    normalized === 'info_gap' ||
    normalized === 'information gap' ||
    normalized === 'information incomplete'
  ) {
    return 'info_gap';
  }

  if (
    normalized === 'na' ||
    normalized === 'n/a' ||
    normalized === 'not applicable' ||
    normalized === 'not_applicable'
  ) {
    return 'na';
  }

  return normalized.replace(/[^a-z_]/g, '_');
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
  optionSet = 'auto',
}: OutcomePanelProps) {
  const moduleKeySafe = typeof moduleKey === 'string' && moduleKey.length > 0 ? moduleKey : '';
  const outcomeCategory =
    optionSet === 'auto' ? getModuleOutcomeCategory(moduleKeySafe) : optionSet;
  const isCritical = outcomeCategory === 'critical';

  const options = isCritical ? CRITICAL_OPTIONS : GOVERNANCE_OPTIONS;
  const normalizedOutcome = normalizeOutcomeValue(outcome);
  const selectedOption = options.find((opt) => opt.value === normalizedOutcome);

  const isMaterialDef = normalizedOutcome === 'material_def';
  const isInfoGap = normalizedOutcome === 'info_gap';

  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-6 mt-6">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-base font-semibold text-neutral-900">
          {isCritical
            ? 'Section Assessment (Life Safety Impact)'
            : 'Section Assessment (Management & Systems)'}
        </h3>
        {normalizedOutcome && <Badge>{selectedOption?.label || normalizedOutcome}</Badge>}
      </div>

      <p className="text-sm text-neutral-600 mb-4">
        {isCritical
          ? 'Assessment of physical fire safety measures and their impact on risk to life.'
          : 'Assessment of fire safety management arrangements and procedural controls.'}
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            {isCritical ? 'Outcome' : 'Assessment'}
          </label>
          <select
            value={normalizedOutcome}
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
            {isCritical
              ? 'Select "Material Deficiency" only where life safety may be significantly compromised.'
              : 'Select "Significant Improvement Required" where management arrangements materially affect fire safety performance.'}
          </p>
        </div>

        {isCritical && isMaterialDef && onScoringChange && (
          <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Extent of Deficiency
            </label>
            <select
              value={scoringData.extent || ''}
              onChange={(e) => onScoringChange({ ...scoringData, extent: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white"
            >
              <option value="">— Select extent —</option>
              <option value="localised">Localised (isolated issue)</option>
              <option value="repeated">Repeated (multiple similar issues)</option>
              <option value="systemic">Systemic (widespread or strategic failure)</option>
            </select>
          </div>
        )}

        {isInfoGap && onScoringChange && (
          <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Information Gap Type
            </label>
            <select
              value={scoringData.gapType || ''}
              onChange={(e) => onScoringChange({ ...scoringData, gapType: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white"
            >
              <option value="">— Select gap type —</option>
              <option value="non_critical">Non-critical information missing</option>
              <option value="critical">Critical life safety information missing</option>
            </select>
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