import { useState } from 'react';
import { Users, CheckCircle, Plus } from 'lucide-react';
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

interface A3PersonsAtRiskFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface QuickActionTemplate {
  action: string;
  likelihood: number;
  impact: number;
}

export default function A3PersonsAtRiskForm({
  moduleInstance,
  document,
  onSaved,
}: A3PersonsAtRiskFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [quickActionTemplate, setQuickActionTemplate] = useState<QuickActionTemplate | null>(null);

  const [formData, setFormData] = useState({
    max_occupancy: moduleInstance.data.max_occupancy || '',
    normal_occupancy: moduleInstance.data.normal_occupancy || '',
    occupancy_profile: moduleInstance.data.occupancy_profile || 'unknown',
    vulnerable_groups: moduleInstance.data.vulnerable_groups || [],
    vulnerable_groups_notes: moduleInstance.data.vulnerable_groups_notes || '',
    lone_working: moduleInstance.data.lone_working || 'unknown',
    out_of_hours_occupation: moduleInstance.data.out_of_hours_occupation || 'unknown',
    evacuation_assistance_required: moduleInstance.data.evacuation_assistance_required || 'unknown',
    peeps_dependency: moduleInstance.data.peeps_dependency || 'unknown',
    notes: moduleInstance.data.notes || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const getSuggestedOutcome = (): { outcome: string; reason: string } | null => {
    if (formData.evacuation_assistance_required === 'yes' && formData.peeps_dependency !== 'yes') {
      return {
        outcome: 'material_def',
        reason: 'Evacuation assistance required but PEEP process not confirmed',
      };
    }

    const unknowns = [
      formData.max_occupancy === '' || formData.max_occupancy === 'unknown',
      formData.occupancy_profile === 'unknown',
      formData.evacuation_assistance_required === 'unknown',
      formData.peeps_dependency === 'unknown',
      formData.out_of_hours_occupation === 'unknown',
    ].filter(Boolean).length;

    if (unknowns >= 3) {
      return {
        outcome: 'info_gap',
        reason: `${unknowns} key fields unknown - occupancy profile incomplete`,
      };
    }

    if (unknowns >= 1) {
      return {
        outcome: 'minor_def',
        reason: 'Some occupancy information gaps requiring clarification',
      };
    }

    return {
      outcome: 'compliant',
      reason: 'Occupancy profile sufficiently documented',
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
      console.error('Error saving A3 module:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAction = (template: QuickActionTemplate) => {
    setQuickActionTemplate(template);
    setShowActionModal(true);
  };

  const handleVulnerableGroupToggle = (group: string) => {
    const updated = formData.vulnerable_groups.includes(group)
      ? formData.vulnerable_groups.filter((g: string) => g !== group)
      : [...formData.vulnerable_groups, group];
    setFormData({ ...formData, vulnerable_groups: updated });
  };

  const needsPEEP = formData.evacuation_assistance_required === 'yes' && formData.peeps_dependency !== 'yes';
  const maxOccUnknown = formData.max_occupancy === '' || formData.max_occupancy === 'unknown';
  const outOfHours = formData.out_of_hours_occupation === 'yes';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-6 h-6 text-neutral-700" />
          <h2 className="text-2xl font-bold text-neutral-900">
            A3 - Persons at Risk
          </h2>
        </div>
        <p className="text-neutral-600">
          Document occupancy, vulnerable persons, and evacuation assistance requirements
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
        {/* Occupancy Numbers */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Occupancy Numbers
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Maximum Occupancy
                </label>
                <input
                  type="text"
                  value={formData.max_occupancy}
                  onChange={(e) => setFormData({ ...formData, max_occupancy: e.target.value })}
                  placeholder="e.g., 200 or unknown"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Maximum number of people expected
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Normal Occupancy
                </label>
                <input
                  type="text"
                  value={formData.normal_occupancy}
                  onChange={(e) => setFormData({ ...formData, normal_occupancy: e.target.value })}
                  placeholder="e.g., 150"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Typical day-to-day occupancy
                </p>
              </div>
            </div>

            {maxOccUnknown && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Confirm maximum occupancy (fire strategy and exit capacity dependency).',
                    likelihood: 3,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Confirm maximum occupancy
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Occupancy Profile
              </label>
              <select
                value={formData.occupancy_profile}
                onChange={(e) => setFormData({ ...formData, occupancy_profile: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="office">Office Workers (familiar)</option>
                <option value="industrial">Industrial Staff (familiar)</option>
                <option value="public_access">Public Access (unfamiliar)</option>
                <option value="sleeping">Sleeping Accommodation</option>
                <option value="healthcare">Healthcare / Care Home</option>
                <option value="education">Educational</option>
                <option value="other">Other</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Familiarity and awareness affects evacuation capability
              </p>
            </div>
          </div>
        </div>

        {/* Vulnerable Groups */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Vulnerable Groups
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Select all vulnerable groups present
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  'Mobility impaired',
                  'Visual impairment',
                  'Hearing impairment',
                  'Cognitive impairment',
                  'Elderly',
                  'Children',
                  'Visitors / Public',
                  'Other'
                ].map((group) => (
                  <label key={group} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.vulnerable_groups.includes(group)}
                      onChange={() => handleVulnerableGroupToggle(group)}
                      className="w-4 h-4 text-neutral-900 border-neutral-300 rounded focus:ring-neutral-900"
                    />
                    <span>{group}</span>
                  </label>
                ))}
              </div>
            </div>

            {formData.vulnerable_groups.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Vulnerable Groups Details
                </label>
                <textarea
                  value={formData.vulnerable_groups_notes}
                  onChange={(e) => setFormData({ ...formData, vulnerable_groups_notes: e.target.value })}
                  placeholder="Provide details about vulnerable groups, approximate numbers, and any specific provisions..."
                  rows={3}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Working Patterns */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Working Patterns
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Lone Working
              </label>
              <select
                value={formData.lone_working}
                onChange={(e) => setFormData({ ...formData, lone_working: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - lone working occurs</option>
                <option value="no">No - always multiple people</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Out of Hours Occupation
              </label>
              <select
                value={formData.out_of_hours_occupation}
                onChange={(e) => setFormData({ ...formData, out_of_hours_occupation: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - building occupied out of hours</option>
                <option value="no">No - standard hours only</option>
              </select>
            </div>

            {outOfHours && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Confirm out-of-hours procedures and staffing assumptions for evacuation strategy.',
                    likelihood: 3,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Confirm out-of-hours procedures
              </button>
            )}
          </div>
        </div>

        {/* Evacuation Assistance */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Evacuation Assistance Requirements
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Evacuation Assistance Required?
              </label>
              <select
                value={formData.evacuation_assistance_required}
                onChange={(e) => setFormData({ ...formData, evacuation_assistance_required: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - some occupants require assistance</option>
                <option value="no">No - all can self-evacuate</option>
              </select>
            </div>

            {formData.evacuation_assistance_required === 'yes' && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  PEEPs (Personal Emergency Evacuation Plans) in Place?
                </label>
                <select
                  value={formData.peeps_dependency}
                  onChange={(e) => setFormData({ ...formData, peeps_dependency: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                >
                  <option value="unknown">Unknown</option>
                  <option value="yes">Yes - PEEPs implemented</option>
                  <option value="no">No - PEEPs not in place</option>
                  <option value="partial">Partial - some PEEPs exist</option>
                </select>
              </div>
            )}

            {needsPEEP && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Implement/confirm PEEP process for those requiring assistance and align to evacuation strategy.',
                    likelihood: 4,
                    impact: 5,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Implement PEEP process (Critical)
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
            placeholder="Add any additional observations about occupancy, vulnerable persons, or evacuation considerations..."
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

      {document?.id && moduleInstance?.id && (


        <ModuleActions


          key={actionsRefreshKey}


          documentId={document.id}


          moduleInstanceId={moduleInstance.id}


        />


      )}

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
