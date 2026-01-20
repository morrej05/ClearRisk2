import { useState, useEffect } from 'react';
import { FileText, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import OutcomePanel from '../OutcomePanel';

interface Document {
  id: string;
  title: string;
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
  action: string;
  likelihood: number;
  impact: number;
  priority_score: number;
  priority_band: string;
  status: string;
  module_instance_id: string;
  target_date: string | null;
  created_at: string;
}

interface ModuleSummary {
  module_key: string;
  outcome: string | null;
}

function sortActionsByPriority(actions: Action[]): Action[] {
  const priorityMap: Record<string, number> = {
    P1: 1,
    P2: 2,
    P3: 3,
    P4: 4,
  };

  return [...actions].sort((a, b) => {
    const aPriority = priorityMap[a.priority_band] || 999;
    const bPriority = priorityMap[b.priority_band] || 999;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    if (a.target_date && b.target_date) {
      return new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
    }
    if (a.target_date && !b.target_date) return -1;
    if (!a.target_date && b.target_date) return 1;

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
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
  const [modules, setModules] = useState<ModuleSummary[]>([]);

  const [formData, setFormData] = useState({
    executive_summary: moduleInstance.data.executive_summary || '',
    overall_risk_rating: moduleInstance.data.overall_risk_rating || '',
    override_justification: moduleInstance.data.override_justification || '',
    key_assumptions: moduleInstance.data.key_assumptions || '',
    review_recommendation: moduleInstance.data.review_recommendation || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  useEffect(() => {
    loadActionsAndModules();
  }, [document.id]);

  const loadActionsAndModules = async () => {
    setIsLoadingActions(true);
    try {
      const { data: moduleInstances, error: moduleError } = await supabase
        .from('module_instances')
        .select('id, module_key, outcome')
        .eq('document_id', document.id);

      if (moduleError) throw moduleError;

      setModules(moduleInstances || []);

      const moduleIds = moduleInstances?.map((m) => m.id) || [];

      if (moduleIds.length === 0) {
        setActions([]);
        return;
      }

      const { data: actionsData, error: actionsError } = await supabase
        .from('actions')
        .select('*')
        .in('module_instance_id', moduleIds)
        .neq('status', 'completed')
        .order('created_at', { ascending: true });

      if (actionsError) throw actionsError;

      const sortedActions = sortActionsByPriority(actionsData || []);
      setActions(sortedActions);
    } catch (error) {
      console.error('Error loading actions:', error);
    } finally {
      setIsLoadingActions(false);
    }
  };

  const getSuggestedRating = (): { rating: string; reason: string } => {
    const p1Actions = actions.filter((a) => a.priority_band === 'P1');
    const p2Actions = actions.filter((a) => a.priority_band === 'P2');

    const materialDefCount = modules.filter((m) => m.outcome === 'material_def').length;

    if (p1Actions.length > 0) {
      return {
        rating: 'intolerable',
        reason: `${p1Actions.length} P1 (immediate priority) action${p1Actions.length > 1 ? 's' : ''} outstanding`,
      };
    }

    if (p2Actions.length >= 3 || materialDefCount > 0) {
      return {
        rating: 'high',
        reason: p2Actions.length >= 3
          ? `${p2Actions.length} P2 actions outstanding`
          : `${materialDefCount} module${materialDefCount > 1 ? 's' : ''} with material deficiencies`,
      };
    }

    const minorDefCount = modules.filter((m) => m.outcome === 'minor_def').length;

    if (p2Actions.length > 0 || minorDefCount >= 2) {
      return {
        rating: 'medium',
        reason: p2Actions.length > 0
          ? `${p2Actions.length} P2 action${p2Actions.length > 1 ? 's' : ''} outstanding`
          : `${minorDefCount} modules with minor deficiencies`,
      };
    }

    return {
      rating: 'low',
      reason: 'No significant deficiencies identified, routine management controls in place',
    };
  };

  const suggestedRating = getSuggestedRating();

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const completedAt = outcome ? new Date().toISOString() : null;

      const { error } = await supabase
        .from('module_instances')
        .update({
          outcome: outcome || null,
          assessor_notes: assessorNotes,
          data: formData,
          completed_at: completedAt,
        })
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

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'low':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'medium':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'high':
        return 'text-orange-700 bg-orange-50 border-orange-200';
      case 'intolerable':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-neutral-700 bg-neutral-50 border-neutral-200';
    }
  };

  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case 'low':
        return <CheckCircle className="w-5 h-5" />;
      case 'medium':
        return <Info className="w-5 h-5" />;
      case 'high':
        return <AlertTriangle className="w-5 h-5" />;
      case 'intolerable':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getPriorityBadge = (score: number) => {
    if (score >= 20)
      return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded">P1</span>;
    if (score >= 12)
      return <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-bold rounded">P2</span>;
    if (score >= 6)
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded">P3</span>;
    return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded">P4</span>;
  };

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
          Executive summary, overall risk rating, and key findings from the fire risk assessment
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
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Overall Fire Risk Rating
          </h3>

          {!formData.overall_risk_rating && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                {getRatingIcon(suggestedRating.rating)}
                <div>
                  <h4 className="text-sm font-bold text-blue-900 mb-1">
                    Suggested Rating: {suggestedRating.rating.toUpperCase()}
                  </h4>
                  <p className="text-sm text-blue-800">{suggestedRating.reason}</p>
                  <button
                    onClick={() =>
                      setFormData({ ...formData, overall_risk_rating: suggestedRating.rating })
                    }
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Accept Suggested Rating
                  </button>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Overall fire risk rating
            </label>
            <select
              value={formData.overall_risk_rating}
              onChange={(e) =>
                setFormData({ ...formData, overall_risk_rating: e.target.value })
              }
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            >
              <option value="">Select rating...</option>
              <option value="low">Low - Acceptable routine controls</option>
              <option value="medium">Medium - Enhanced controls required</option>
              <option value="high">High - Significant remedial action required</option>
              <option value="intolerable">Intolerable - Immediate action required</option>
            </select>
          </div>

          {formData.overall_risk_rating && (
            <div className={`mt-4 p-4 border rounded-lg flex items-center gap-3 ${getRatingColor(formData.overall_risk_rating)}`}>
              {getRatingIcon(formData.overall_risk_rating)}
              <div>
                <h4 className="font-bold text-sm">
                  Selected Rating: {formData.overall_risk_rating.toUpperCase()}
                </h4>
                <p className="text-xs mt-1">
                  {formData.overall_risk_rating === 'low' &&
                    'Fire risk is acceptable with routine management controls'}
                  {formData.overall_risk_rating === 'medium' &&
                    'Fire risk requires enhanced controls and monitoring'}
                  {formData.overall_risk_rating === 'high' &&
                    'Fire risk requires significant remedial action within defined timescales'}
                  {formData.overall_risk_rating === 'intolerable' &&
                    'Fire risk is unacceptable - immediate action required, consider closure until remedied'}
                </p>
              </div>
            </div>
          )}

          {formData.overall_risk_rating &&
            formData.overall_risk_rating !== suggestedRating.rating && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Override justification (required)
              </label>
              <textarea
                value={formData.override_justification}
                onChange={(e) =>
                  setFormData({ ...formData, override_justification: e.target.value })
                }
                placeholder={`Explain why you have selected '${formData.overall_risk_rating}' instead of the suggested '${suggestedRating.rating}' rating. Consider compensating controls, mitigating factors, or additional context...`}
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Professional judgment override must be clearly justified and defensible
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Priority Actions Overview
          </h3>

          {isLoadingActions ? (
            <div className="text-center py-8 text-neutral-500">
              <p className="text-sm">Loading actions...</p>
            </div>
          ) : actions.length === 0 ? (
            <div className="text-center py-8 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm text-green-800 font-medium">No outstanding actions</p>
              <p className="text-xs text-green-700 mt-1">All identified actions have been completed</p>
            </div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-4 gap-4">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-2xl font-bold text-red-700">
                    {actions.filter((a) => a.priority_score >= 20).length}
                  </div>
                  <div className="text-xs text-red-600">P1 Actions</div>
                </div>
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="text-2xl font-bold text-orange-700">
                    {actions.filter((a) => a.priority_score >= 12 && a.priority_score < 20).length}
                  </div>
                  <div className="text-xs text-orange-600">P2 Actions</div>
                </div>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-700">
                    {actions.filter((a) => a.priority_score >= 6 && a.priority_score < 12).length}
                  </div>
                  <div className="text-xs text-yellow-600">P3 Actions</div>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-2xl font-bold text-blue-700">
                    {actions.filter((a) => a.priority_score < 6).length}
                  </div>
                  <div className="text-xs text-blue-600">P4 Actions</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-bold text-neutral-700 mb-2">
                  Top {Math.min(10, actions.length)} Priority Actions
                </h4>
                {actions.slice(0, 10).map((action, index) => (
                  <div
                    key={action.id}
                    className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-neutral-500">#{index + 1}</span>
                          {getPriorityBadge(action.priority_score)}
                          <span className="text-xs text-neutral-500">
                            L{action.likelihood} × I{action.impact} = {action.priority_score}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-700">{action.action}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {actions.length > 10 && (
                  <p className="text-xs text-neutral-500 text-center pt-2">
                    +{actions.length - 10} more actions (see Actions Dashboard for full list)
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Module Outcomes Summary
          </h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-2xl font-bold text-red-700">
                {modules.filter((m) => m.outcome === 'material_def').length}
              </div>
              <div className="text-xs text-red-600">Material Deficiencies</div>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="text-2xl font-bold text-amber-700">
                {modules.filter((m) => m.outcome === 'info_gap').length}
              </div>
              <div className="text-xs text-amber-600">Information Gaps</div>
            </div>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-2xl font-bold text-yellow-700">
                {modules.filter((m) => m.outcome === 'minor_def').length}
              </div>
              <div className="text-xs text-yellow-600">Minor Deficiencies</div>
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            Total modules assessed: {modules.length}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Executive Summary
          </h3>
          <p className="text-sm text-neutral-600 mb-3">
            Provide a high-level summary of the assessment findings suitable for non-technical stakeholders
          </p>
          <textarea
            value={formData.executive_summary}
            onChange={(e) =>
              setFormData({ ...formData, executive_summary: e.target.value })
            }
            placeholder="Summarize the key findings of this fire risk assessment. Include: building description, significant fire risks identified, overall level of risk, priority actions required, and general recommendations. This section should be understandable by building owners and duty holders without technical fire safety knowledge."
            rows={8}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
          />
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Key Assumptions & Limitations
          </h3>
          <textarea
            value={formData.key_assumptions}
            onChange={(e) =>
              setFormData({ ...formData, key_assumptions: e.target.value })
            }
            placeholder="Document key assumptions made during assessment and any limitations. Examples: areas not inspected, information not available, destructive testing not undertaken, concealed construction assumed based on visible elements..."
            rows={4}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
          />
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Review Recommendation
          </h3>
          <textarea
            value={formData.review_recommendation}
            onChange={(e) =>
              setFormData({ ...formData, review_recommendation: e.target.value })
            }
            placeholder="Recommend when this fire risk assessment should be reviewed. Consider: nature of findings, changes to building use, completion of remedial works, regulatory requirements (typically 12 months for normal risk, 6 months if significant deficiencies)..."
            rows={3}
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
