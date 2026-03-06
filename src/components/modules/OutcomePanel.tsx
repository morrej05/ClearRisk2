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
  optionSet?: 'auto' | 'critical' | 'governance';
}

function Badge({ children, variant = 'outline' }: { children: React.ReactNode; variant?: 'outline' }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border border-neutral-300 bg-neutral-50 text-neutral-700">
      {children}
    </span>
  );
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
  // Guard against undefined/empty moduleKey to prevent crashes
  const moduleKeySafe = typeof moduleKey === 'string' && moduleKey.length > 0 ? moduleKey : '';

  const outcomeCategory = optionSet === 'auto' ? getModuleOutcomeCategory(moduleKeySafe) : optionSet;
  const isCritical = outcomeCategory === 'critical';

  const criticalOptionsWithRefinedLabels = [
    { value: 'Compliant', label: 'Compliant' },
    { value: 'Minor Deficiency', label: 'Minor Deficiency' },
    { value: 'Material Deficiency', label: 'Material Deficiency' },
    { value: 'Information Gap', label: 'Information Incomplete' },
    { value: 'Not Applicable', label: 'Not Applicable' },
  ];

  const governanceOptionsWithRefinedLabels = [
    { value: 'Adequate', label: 'Adequate' },
    { value: 'Improvement Recommended', label: 'Improvement Recommended' },
    { value: 'Significant Improvement Required', label: 'Significant Improvement Required' },
    { value: 'Information Incomplete', label: 'Information Incomplete' },
    { value: 'Not Applicable', label: 'Not Applicable' },
  ];

  const options = isCritical ? criticalOptionsWithRefinedLabels : governanceOptionsWithRefinedLabels;

  const normalizedOutcome = outcome?.toLowerCase().replace(/[^a-z_]/g, '_') || '';
  const isMaterialDef = normalizedOutcome.includes('material') || normalizedOutcome.includes('significant');
  const isInfoGap = normalizedOutcome.includes('info') || normalizedOutcome.includes('gap') || normalizedOutcome.includes('incomplete');

  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-6 mt-6">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-base font-semibold text-neutral-900">
          {isCritical
            ? 'Section Assessment (Life Safety Impact)'
            : 'Section Assessment (Management & Systems)'}
        </h3>
        {outcome && (
          <Badge variant="outline">
            {options.find(opt => opt.value === outcome)?.label || outcome}
          </Badge>
        )}
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
