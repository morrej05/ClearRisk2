import { useState, useEffect, useMemo } from 'react';
import { FileText, CheckCircle, AlertTriangle, AlertCircle, Info, RefreshCw, Shield } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import OutcomePanel from '../OutcomePanel';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import { computeFraSummary, type FraComputedSummary } from '../../../lib/modules/fra/significantFindingsEngine';
import { deriveStoreysForScoring, type FraComplexityBand } from '../../../lib/modules/fra/complexityEngine';
import type { FraContext, FraPriority, FraFindingCategory } from '../../../lib/modules/fra/severityEngine';

interface Document {
  id: string;
  title: string;
  scs_band?: FraComplexityBand;
}

interface ModuleInstance {
  id: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
}

interface FRA4SignificantFindingsFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface Action {
  id: string;
  title: string;
  priority?: FraPriority;
  category?: FraFindingCategory;
  trigger_text?: string;
  status: string;
  created_at: string;
}

export default function FRA4SignificantFindingsForm({
  moduleInstance,
  document,
  onSaved,
}: FRA4SignificantFindingsFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isLoadingActions, setIsLoadingActions] = useState(true);
  const [actions, setActions] = useState<Action[]>([]);
  const [buildingProfile, setBuildingProfile] = useState<any>(null);

  const [overrideEnabled, setOverrideEnabled] = useState(
    moduleInstance.data.override?.enabled || false
  );
  const [overrideOutcome, setOverrideOutcome] = useState(
    moduleInstance.data.override?.outcome || ''
  );
  const [overrideReason, setOverrideReason] = useState(
    moduleInstance.data.override?.reason || ''
  );

  const [executiveCommentary, setExecutiveCommentary] = useState(
    moduleInstance.data.commentary?.executiveCommentary || ''
  );
  const [limitationsAssumptions, setLimitationsAssumptions] = useState(
    moduleInstance.data.commentary?.limitationsAssumptions || ''
  );

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  useEffect(() => {
    loadData();
  }, [document.id]);

  const loadData = async () => {
    setIsLoadingActions(true);
    try {
      const { data: moduleInstances, error: moduleError } = await supabase
        .from('module_instances')
        .select('id, module_key, data')
        .eq('document_id', document.id);

      if (moduleError) throw moduleError;

      const buildingProfileModule = moduleInstances?.find(
        (m) => m.module_key === 'A2_BUILDING_PROFILE'
      );
      setBuildingProfile(buildingProfileModule || null);

      const moduleIds = moduleInstances?.map((m) => m.id) || [];

      if (moduleIds.length === 0) {
        setActions([]);
        return;
      }

      const { data: actionsData, error: actionsError } = await supabase
        .from('actions')
        .select('id, title, priority, category, trigger_text, status, created_at')
        .in('module_instance_id', moduleIds)
        .order('created_at', { ascending: true });

      if (actionsError) throw actionsError;

      setActions(actionsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoadingActions(false);
    }
  };

  const computedSummary: FraComputedSummary | null = useMemo(() => {
    if (isLoadingActions || !buildingProfile) return null;

    const scsBand = document.scs_band || 'Moderate';

    const derivedStoreys = deriveStoreysForScoring({
      storeysBand: buildingProfile.data.storeys_band,
      storeysExact: buildingProfile.data.storeys_exact || buildingProfile.data.number_of_storeys
    });

    const fraContext: FraContext = {
      occupancyRisk: (buildingProfile.data.occupancy_risk || 'NonSleeping') as 'NonSleeping' | 'Sleeping' | 'Vulnerable',
      storeys: derivedStoreys,
    };

    return computeFraSummary({
      actions,
      scsBand,
      fraContext,
    });
  }, [actions, buildingProfile, document.scs_band, isLoadingActions]);

  const handleSave = async () => {
    if (overrideEnabled && !overrideReason.trim()) {
      alert('Override reason is required when overriding the computed outcome.');
      return;
    }

    setIsSaving(true);

    try {
      const payload = sanitizeModuleInstancePayload({
        data: {
          computed: computedSummary,
          override: {
            enabled: overrideEnabled,
            outcome: overrideEnabled ? overrideOutcome : null,
            reason: overrideEnabled ? overrideReason : null,
          },
          commentary: {
            executiveCommentary,
            limitationsAssumptions,
          },
        },
        outcome,
        assessor_notes: assessorNotes,
        updated_at: new Date().toISOString(),
      });

      const { error } = await supabase
        .from('module_instances')
        .update(payload)
        .eq('id', moduleInstance.id);

      if (error) throw error;

      setLastSaved(new Date().toLocaleTimeString());
      onSaved();
    } catch (error) {
      console.error('Error saving module:', error);
      alert('Failed to save module. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getOutcomeLabel = (outcome: string) => {
    switch (outcome) {
      case 'MaterialLifeSafetyRiskPresent':
        return 'Material Life Safety Risk Present';
      case 'SignificantDeficiencies':
        return 'Significant Deficiencies';
      case 'ImprovementsRequired':
        return 'Improvements Required';
      case 'SatisfactoryWithImprovements':
        return 'Satisfactory with Improvements';
      default:
        return outcome;
    }
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'MaterialLifeSafetyRiskPresent':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'SignificantDeficiencies':
        return 'text-orange-700 bg-orange-50 border-orange-200';
      case 'ImprovementsRequired':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'SatisfactoryWithImprovements':
        return 'text-green-700 bg-green-50 border-green-200';
      default:
        return 'text-neutral-700 bg-neutral-50 border-neutral-200';
    }
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'MaterialLifeSafetyRiskPresent':
        return <AlertCircle className="w-5 h-5" />;
      case 'SignificantDeficiencies':
        return <AlertTriangle className="w-5 h-5" />;
      case 'ImprovementsRequired':
        return <Info className="w-5 h-5" />;
      case 'SatisfactoryWithImprovements':
        return <CheckCircle className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P1':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'P2':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'P3':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'P4':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-neutral-100 text-neutral-800 border-neutral-300';
    }
  };

  if (isLoadingActions || !computedSummary) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-neutral-400 animate-spin" />
          <span className="ml-3 text-neutral-600">Loading computed summary...</span>
        </div>
      </div>
    );
  }

  const displayOutcome = overrideEnabled && overrideOutcome
    ? overrideOutcome
    : computedSummary.computedOutcome;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-6 h-6 text-neutral-700" />
          <h2 className="text-2xl font-bold text-neutral-900">
            FRA-4 - Significant Findings Summary
          </h2>
        </div>
        <p className="text-neutral-600">
          Computed executive summary based on action priorities and building complexity
        </p>
        {lastSaved && (
          <div className="flex items-center gap-2 mt-2 text-sm text-green-700">
            <CheckCircle className="w-4 h-4" />
            Last saved at {lastSaved}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-neutral-900">
              Computed Summary (Auto-generated)
            </h3>
          </div>

          <div className="space-y-4">
            <div className={`p-4 border rounded-lg flex items-start gap-3 ${getOutcomeColor(displayOutcome)}`}>
              {getOutcomeIcon(displayOutcome)}
              <div className="flex-1">
                <h4 className="font-bold text-sm mb-1">
                  Overall Outcome: {getOutcomeLabel(displayOutcome)}
                </h4>
                {computedSummary.materialDeficiency && (
                  <p className="text-xs font-medium mt-1">
                    Material deficiency identified - immediate attention required
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-2xl font-bold text-red-700">
                  {computedSummary.counts.p1}
                </div>
                <div className="text-xs text-red-600">P1 Actions</div>
              </div>
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="text-2xl font-bold text-orange-700">
                  {computedSummary.counts.p2}
                </div>
                <div className="text-xs text-orange-600">P2 Actions</div>
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="text-2xl font-bold text-yellow-700">
                  {computedSummary.counts.p3}
                </div>
                <div className="text-xs text-yellow-600">P3 Actions</div>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">
                  {computedSummary.counts.p4}
                </div>
                <div className="text-xs text-blue-600">P4 Actions</div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-neutral-700 mb-2">
                Top Priority Issues
              </h4>
              {computedSummary.topIssues.length === 0 ? (
                <div className="text-center py-6 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-green-800 font-medium">No outstanding issues</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {computedSummary.topIssues.map((issue, index) => (
                    <div
                      key={index}
                      className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg"
                    >
                      <div className="flex items-start gap-3">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded border ${getPriorityColor(issue.priority)}`}>
                          {issue.priority}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-neutral-900">{issue.title}</p>
                          {issue.triggerText && (
                            <p className="text-xs text-neutral-600 mt-1 italic">
                              Trigger: {issue.triggerText}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-bold text-blue-900 mb-2">Complexity Context</h4>
              <p className="text-sm text-blue-800 leading-relaxed">
                {computedSummary.toneParagraph}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Override Computed Outcome (Optional)
          </h3>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={overrideEnabled}
                onChange={(e) => {
                  setOverrideEnabled(e.target.checked);
                  if (!e.target.checked) {
                    setOverrideOutcome('');
                    setOverrideReason('');
                  }
                }}
                className="w-4 h-4 text-neutral-900 border-neutral-300 rounded focus:ring-neutral-900"
              />
              <span className="text-sm font-medium text-neutral-700">
                Override computed outcome with professional judgment
              </span>
            </label>

            {overrideEnabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Overridden outcome
                  </label>
                  <select
                    value={overrideOutcome}
                    onChange={(e) => setOverrideOutcome(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="">Select outcome...</option>
                    <option value="SatisfactoryWithImprovements">
                      Satisfactory with Improvements
                    </option>
                    <option value="ImprovementsRequired">
                      Improvements Required
                    </option>
                    <option value="SignificantDeficiencies">
                      Significant Deficiencies
                    </option>
                    <option value="MaterialLifeSafetyRiskPresent">
                      Material Life Safety Risk Present
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Override reason (required) <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Provide a clear, professional justification for overriding the computed outcome. Examples: compensating controls in place, additional context not captured by automatic assessment, recent remedial works completed..."
                    rows={3}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Override must be clearly justified and defensible. Maximum 300 characters.
                  </p>
                </div>

                {overrideReason.trim() && overrideOutcome && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800">
                      <strong>Note:</strong> The PDF report will clearly indicate that the outcome
                      was overridden by the assessor and include your justification.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Assessor Executive Commentary
          </h3>
          <p className="text-sm text-neutral-600 mb-3">
            Provide additional context, professional observations, and executive-level commentary
            beyond the auto-generated summary
          </p>
          <textarea
            value={executiveCommentary}
            onChange={(e) => setExecutiveCommentary(e.target.value)}
            placeholder="Add your professional commentary on the overall fire safety position. Include context such as: building management arrangements, recent improvements, planned works, particular concerns, compensating controls, or any factors that provide important context for stakeholders..."
            rows={6}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
          />
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Limitations and Assumptions
          </h3>
          <p className="text-sm text-neutral-600 mb-3">
            Document key assumptions made during assessment and any limitations
          </p>
          <textarea
            value={limitationsAssumptions}
            onChange={(e) => setLimitationsAssumptions(e.target.value)}
            placeholder="Document key assumptions and limitations of this assessment. Examples: areas not inspected, information not available, destructive testing not undertaken, concealed construction assumed based on visible elements, weather conditions limiting external inspection..."
            rows={4}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
          />
        </div>
      </div>

      <OutcomePanel
        outcome={outcome}
        assessorNotes={assessorNotes}
        onOutcomeChange={setOutcome}
        onNotesChange={setAssessorNotes}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </div>
  );
}
