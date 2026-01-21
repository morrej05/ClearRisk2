import { useState } from 'react';
import { Users2, CheckCircle, Plus } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import AddActionModal from '../../actions/AddActionModal';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';

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

interface FSD2EvacuationStrategyFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface QuickActionTemplate {
  action: string;
  likelihood: number;
  impact: number;
}

export default function FSD2EvacuationStrategyForm({
  moduleInstance,
  document,
  onSaved,
}: FSD2EvacuationStrategyFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [quickActionTemplate, setQuickActionTemplate] = useState<QuickActionTemplate | null>(null);

  const [formData, setFormData] = useState({
    evacuation_strategy: moduleInstance.data.evacuation_strategy || 'unknown',
    alarm_philosophy: moduleInstance.data.alarm_philosophy || '',
    cause_and_effect_summary: moduleInstance.data.cause_and_effect_summary || '',
    management_dependencies: moduleInstance.data.management_dependencies || [],
    management_dependencies_notes: moduleInstance.data.management_dependencies_notes || '',
    evacuation_lifts: moduleInstance.data.evacuation_lifts || 'unknown',
    evacuation_lifts_notes: moduleInstance.data.evacuation_lifts_notes || '',
    refuges_provided: moduleInstance.data.refuges_provided || 'unknown',
    refuges_notes: moduleInstance.data.refuges_notes || '',
    communication_method: moduleInstance.data.communication_method || 'unknown',
    notes: moduleInstance.data.notes || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const getSuggestedOutcome = (): { outcome: string; reason: string } | null => {
    if (formData.evacuation_strategy === 'unknown') {
      return {
        outcome: 'info_gap',
        reason: 'Evacuation strategy not defined - critical for design basis',
      };
    }

    const hasDependencies = formData.management_dependencies.length > 0;
    const dependenciesDocumented = formData.management_dependencies_notes && formData.management_dependencies_notes.trim().length > 20;

    if (hasDependencies && !dependenciesDocumented) {
      return {
        outcome: 'material_def',
        reason: 'Strategy relies on management dependencies but these are not adequately documented',
      };
    }

    if (!formData.alarm_philosophy || formData.alarm_philosophy.trim().length < 20) {
      return {
        outcome: 'minor_def',
        reason: 'Alarm philosophy should be documented',
      };
    }

    return {
      outcome: 'compliant',
      reason: 'Evacuation strategy adequately defined',
    };
  };

  const suggestedOutcome = !outcome ? getSuggestedOutcome() : null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = sanitizeModuleInstancePayload({
        data: formData,
        outcome,
        assessor_notes: assessorNotes,
        updated_at: new Date().toISOString(),
      });

      const { error } = await supabase
        .from('module_instances')
        .update(payload)
        .eq('id', moduleInstance.id);

      if (error) throw error;

      const now = new Date().toLocaleTimeString();
      setLastSaved(now);
      onSaved();
    } catch (error) {
      console.error('Error saving FSD-2 module:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAction = (template: QuickActionTemplate) => {
    setQuickActionTemplate(template);
    setShowActionModal(true);
  };

  const handleDependencyToggle = (dependency: string) => {
    const updated = formData.management_dependencies.includes(dependency)
      ? formData.management_dependencies.filter((d: string) => d !== dependency)
      : [...formData.management_dependencies, dependency];
    setFormData({ ...formData, management_dependencies: updated });
  };

  const strategyUnknown = formData.evacuation_strategy === 'unknown';
  const hasDependencies = formData.management_dependencies.length > 0;
  const dependenciesWeak = hasDependencies && (!formData.management_dependencies_notes || formData.management_dependencies_notes.trim().length < 20);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Users2 className="w-6 h-6 text-neutral-700" />
          <h2 className="text-2xl font-bold text-neutral-900">
            FSD-2 - Evacuation Strategy
          </h2>
        </div>
        <p className="text-neutral-600">
          Define intended evacuation strategy and management dependencies
        </p>
        {lastSaved && (
          <div className="flex items-center gap-2 mt-2 text-sm text-green-700">
            <CheckCircle className="w-4 h-4" />
            Last saved at {lastSaved}
          </div>
        )}
      </div>

      {suggestedOutcome && !outcome && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h3 className="text-sm font-bold text-amber-900 mb-1">Suggested Outcome</h3>
          <p className="text-sm text-amber-800">
            Based on your responses: <strong>{suggestedOutcome.outcome.replace('_', ' ')}</strong>
          </p>
          <p className="text-xs text-amber-700 mt-1">{suggestedOutcome.reason}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Evacuation Strategy */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Primary Evacuation Strategy
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Intended Strategy
              </label>
              <select
                value={formData.evacuation_strategy}
                onChange={(e) => setFormData({ ...formData, evacuation_strategy: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="simultaneous">Simultaneous Evacuation</option>
                <option value="phased">Phased Evacuation</option>
                <option value="stay_put">Stay Put</option>
                <option value="defend_in_place">Defend in Place</option>
                <option value="progressive_horizontal">Progressive Horizontal Evacuation</option>
                <option value="other">Other / Mixed Strategy</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Defines how occupants are intended to respond to fire alarm activation
              </p>
            </div>

            {strategyUnknown && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Define intended evacuation strategy and management dependencies (for design sign-off).',
                    likelihood: 4,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Define evacuation strategy
              </button>
            )}
          </div>
        </div>

        {/* Alarm & Communication */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Alarm & Communication
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Communication Method
              </label>
              <select
                value={formData.communication_method}
                onChange={(e) => setFormData({ ...formData, communication_method: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="alarm_only">Fire Alarm Only</option>
                <option value="pa">Public Address (PA) System</option>
                <option value="evac">EVAC (Voice Alarm) System</option>
                <option value="mixed">Mixed / Zone-specific</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Alarm Philosophy
              </label>
              <textarea
                value={formData.alarm_philosophy}
                onChange={(e) => setFormData({ ...formData, alarm_philosophy: e.target.value })}
                placeholder="Describe alarm activation philosophy (e.g., automatic detection on all floors, manual call points only, specific zones trigger specific alarms, etc.)"
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Cause & Effect Summary (optional)
              </label>
              <textarea
                value={formData.cause_and_effect_summary}
                onChange={(e) => setFormData({ ...formData, cause_and_effect_summary: e.target.value })}
                placeholder="Summarize key cause-and-effect relationships (e.g., detection in zone X triggers alarm in zones X+Y, activates smoke control, releases doors, etc.)"
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>
          </div>
        </div>

        {/* Management Dependencies */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Management Dependencies
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Select all that apply
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  'Trained staff',
                  '24/7 staffing',
                  'Fire wardens',
                  'PEEPs for vulnerable persons',
                  'Compartmentation integrity',
                  'Door closure discipline',
                  'Other'
                ].map((dependency) => (
                  <label key={dependency} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.management_dependencies.includes(dependency)}
                      onChange={() => handleDependencyToggle(dependency)}
                      className="w-4 h-4 text-neutral-900 border-neutral-300 rounded focus:ring-neutral-900"
                    />
                    <span>{dependency}</span>
                  </label>
                ))}
              </div>
            </div>

            {hasDependencies && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Dependency Details
                </label>
                <textarea
                  value={formData.management_dependencies_notes}
                  onChange={(e) => setFormData({ ...formData, management_dependencies_notes: e.target.value })}
                  placeholder="Provide details about management dependencies and how they are assured (e.g., training frequency, staffing levels, PEEP review process, etc.)"
                  rows={4}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                />
              </div>
            )}

            {dependenciesWeak && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Confirm management arrangements support the evacuation strategy (training/staffing/PEEPs).',
                    likelihood: 4,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Document management dependencies
              </button>
            )}
          </div>
        </div>

        {/* Assisted Evacuation Provisions */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Assisted Evacuation Provisions
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Evacuation Lifts Provided?
              </label>
              <select
                value={formData.evacuation_lifts}
                onChange={(e) => setFormData({ ...formData, evacuation_lifts: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent mb-2"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="na">Not Applicable</option>
              </select>
              {formData.evacuation_lifts === 'yes' && (
                <textarea
                  value={formData.evacuation_lifts_notes}
                  onChange={(e) => setFormData({ ...formData, evacuation_lifts_notes: e.target.value })}
                  placeholder="Describe evacuation lift provisions (number, location, controls, fire service override, etc.)"
                  rows={2}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Refuges Provided?
              </label>
              <select
                value={formData.refuges_provided}
                onChange={(e) => setFormData({ ...formData, refuges_provided: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent mb-2"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="na">Not Applicable</option>
              </select>
              {formData.refuges_provided === 'yes' && (
                <textarea
                  value={formData.refuges_notes}
                  onChange={(e) => setFormData({ ...formData, refuges_notes: e.target.value })}
                  placeholder="Describe refuge provisions (locations, capacity, communication, evacuation route from refuge, etc.)"
                  rows={2}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                />
              )}
            </div>

            {(formData.evacuation_lifts === 'unknown' || formData.refuges_provided === 'unknown') && hasDependencies && formData.management_dependencies.includes('PEEPs for vulnerable persons') && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Confirm provisions for assisted evacuation (refuges/evacuation lifts/PEEPs) consistent with strategy.',
                    likelihood: 4,
                    impact: 5,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Confirm assisted evacuation provisions (Critical)
              </button>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Additional Notes
          </h3>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Add any additional observations about the evacuation strategy, management dependencies, or special considerations..."
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

      <ModuleActions
        documentId={document.id}
        moduleInstanceId={moduleInstance.id}
      />

      {showActionModal && (
        <AddActionModal
          documentId={document.id}
          moduleInstanceId={moduleInstance.id}
          onClose={() => {
            setShowActionModal(false);
            setQuickActionTemplate(null);
          }}
          onActionCreated={() => {
            setShowActionModal(false);
            setQuickActionTemplate(null);
          }}
          defaultAction={quickActionTemplate?.action}
          defaultLikelihood={quickActionTemplate?.likelihood}
          defaultImpact={quickActionTemplate?.impact}
        />
      )}
    </div>
  );
}
