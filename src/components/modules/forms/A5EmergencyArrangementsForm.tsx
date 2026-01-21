import { useState } from 'react';
import { Siren, CheckCircle, Plus } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import AddActionModal from '../../actions/AddActionModal';
import InfoGapQuickActions from '../InfoGapQuickActions';
import { detectInfoGaps } from '../../../utils/infoGapQuickActions';
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

interface A5EmergencyArrangementsFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface QuickActionTemplate {
  action: string;
  likelihood: number;
  impact: number;
}

export default function A5EmergencyArrangementsForm({
  moduleInstance,
  document,
  onSaved,
}: A5EmergencyArrangementsFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [quickActionTemplate, setQuickActionTemplate] = useState<QuickActionTemplate | null>(null);

  const [formData, setFormData] = useState({
    emergency_plan_exists: moduleInstance.data.emergency_plan_exists || 'unknown',
    alarm_raising_procedure_defined: moduleInstance.data.alarm_raising_procedure_defined || 'unknown',
    calling_fire_service_procedure: moduleInstance.data.calling_fire_service_procedure || 'unknown',
    assembly_points_defined: moduleInstance.data.assembly_points_defined || 'unknown',
    evacuation_drills_frequency: moduleInstance.data.evacuation_drills_frequency || 'unknown',
    fire_wardens_present: moduleInstance.data.fire_wardens_present || 'unknown',
    peeps_in_place: moduleInstance.data.peeps_in_place || 'unknown',
    emergency_services_access_info_available: moduleInstance.data.emergency_services_access_info_available || 'unknown',
    utilities_isolation_known: moduleInstance.data.utilities_isolation_known || 'unknown',
    out_of_hours_arrangements: moduleInstance.data.out_of_hours_arrangements || '',
    notes: moduleInstance.data.notes || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const getSuggestedOutcome = (): { outcome: string; reason: string } | null => {
    const unknowns = Object.entries(formData).filter(
      ([key, value]) => value === 'unknown' && !key.includes('notes') && !key.includes('arrangements')
    ).length;

    if (unknowns >= 4) {
      return {
        outcome: 'info_gap',
        reason: `${unknowns} items marked as unknown - significant information gaps`,
      };
    }

    const criticalIssues = [];

    if (formData.emergency_plan_exists === 'no') {
      criticalIssues.push('No emergency plan');
    }
    if (formData.assembly_points_defined === 'no') {
      criticalIssues.push('No assembly points');
    }
    if (formData.evacuation_drills_frequency === 'none') {
      criticalIssues.push('No evacuation drills');
    }
    if (formData.peeps_in_place === 'no') {
      criticalIssues.push('No PEEPs where required');
    }

    if (criticalIssues.length >= 2) {
      return {
        outcome: 'material_def',
        reason: `Multiple material deficiencies: ${criticalIssues.join(', ')}`,
      };
    }

    if (criticalIssues.length === 1 || unknowns >= 2) {
      return {
        outcome: 'minor_def',
        reason: criticalIssues[0] || 'Some information gaps remain',
      };
    }

    return null;
  };

  const suggestedOutcome = getSuggestedOutcome();

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

      setLastSaved(new Date().toLocaleTimeString());
      onSaved();
    } catch (error) {
      console.error('Error saving module:', error);
      alert('Failed to save module. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAction = (template: QuickActionTemplate) => {
    setQuickActionTemplate(template);
    setShowActionModal(true);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Siren className="w-6 h-6 text-neutral-700" />
          <h2 className="text-2xl font-bold text-neutral-900">
            A5 - Emergency Arrangements
          </h2>
        </div>
        <p className="text-neutral-600">
          Assess emergency planning, evacuation procedures, and preparedness
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
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Emergency Plan & Procedures
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Written emergency plan exists?
              </label>
              <select
                value={formData.emergency_plan_exists}
                onChange={(e) =>
                  setFormData({ ...formData, emergency_plan_exists: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - documented and communicated</option>
                <option value="no">No</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                If unknown → set outcome to info_gap and raise an action
              </p>
            </div>

            {formData.emergency_plan_exists === 'no' && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Develop comprehensive emergency fire action plan including alarm response, evacuation procedures, roll call, and communication with emergency services. Ensure plan is communicated to all staff and displayed prominently.',
                    likelihood: 5,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Create emergency plan
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Alarm raising procedure clearly defined?
              </label>
              <select
                value={formData.alarm_raising_procedure_defined}
                onChange={(e) =>
                  setFormData({ ...formData, alarm_raising_procedure_defined: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - procedure documented</option>
                <option value="no">No</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Procedure for calling fire service defined?
              </label>
              <select
                value={formData.calling_fire_service_procedure}
                onChange={(e) =>
                  setFormData({ ...formData, calling_fire_service_procedure: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - responsibilities assigned</option>
                <option value="no">No - unclear</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Assembly Points & Evacuation
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Assembly point(s) defined and signposted?
              </label>
              <select
                value={formData.assembly_points_defined}
                onChange={(e) =>
                  setFormData({ ...formData, assembly_points_defined: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - clearly marked</option>
                <option value="no">No</option>
              </select>
            </div>

            {formData.assembly_points_defined === 'no' && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Define suitable assembly point(s) at safe distance from building. Install assembly point signage and ensure location is communicated to all occupants.',
                    likelihood: 5,
                    impact: 3,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Define assembly points
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Evacuation drill frequency
              </label>
              <select
                value={formData.evacuation_drills_frequency}
                onChange={(e) =>
                  setFormData({ ...formData, evacuation_drills_frequency: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="none">None conducted</option>
                <option value="annual">Annual</option>
                <option value="6-monthly">6-monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>

            {(formData.evacuation_drills_frequency === 'none' ||
              formData.evacuation_drills_frequency === 'unknown') && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Establish evacuation drill programme with minimum 6-monthly drills (or as required by risk profile). Maintain records of drills including timing, participation, and lessons learned.',
                    likelihood: 4,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Establish drill programme
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Fire Wardens & PEEPs
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Fire wardens/marshals appointed and present?
              </label>
              <select
                value={formData.fire_wardens_present}
                onChange={(e) =>
                  setFormData({ ...formData, fire_wardens_present: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - adequate coverage</option>
                <option value="no">No - insufficient</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Personal Emergency Evacuation Plans (PEEPs) in place?
              </label>
              <select
                value={formData.peeps_in_place}
                onChange={(e) =>
                  setFormData({ ...formData, peeps_in_place: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - documented for those who need them</option>
                <option value="no">No - required but not in place</option>
                <option value="na">N/A - no vulnerable occupants identified</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Required for persons who may need assistance during evacuation
              </p>
            </div>

            {formData.peeps_in_place === 'no' && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Implement Personal Emergency Evacuation Plan (PEEP) process including identification of vulnerable persons, individual risk assessment, buddy system assignment, and documentation of assistance requirements.',
                    likelihood: 4,
                    impact: 5,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Implement PEEP process
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Emergency Services & Utilities
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Emergency services access information available?
              </label>
              <select
                value={formData.emergency_services_access_info_available}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    emergency_services_access_info_available: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - readily available</option>
                <option value="no">No</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Building plans, hazard info, key holder details
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Utilities isolation points known and labelled?
              </label>
              <select
                value={formData.utilities_isolation_known}
                onChange={(e) =>
                  setFormData({ ...formData, utilities_isolation_known: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - clearly labelled</option>
                <option value="no">No</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Gas, electric, water isolation points
              </p>
            </div>

            {(formData.emergency_services_access_info_available === 'no' ||
              formData.utilities_isolation_known === 'no') && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Create emergency information pack for fire service including building plans, hazard information, key holder contacts, and utilities isolation plan. Label all isolation points clearly.',
                    likelihood: 3,
                    impact: 3,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Create emergency services info pack
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Out of Hours Arrangements
          </h3>
          <textarea
            value={formData.out_of_hours_arrangements}
            onChange={(e) =>
              setFormData({ ...formData, out_of_hours_arrangements: e.target.value })
            }
            placeholder="Describe arrangements for emergencies outside normal working hours (key holders, security, alarm monitoring, etc.)..."
            rows={4}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
          />
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Additional Emergency Notes
          </h3>
          <textarea
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            placeholder="Add any additional observations about emergency arrangements, specific issues, or improvement opportunities..."
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

      {(() => {
        const infoGapDetection = detectInfoGaps('A5_EMERGENCY_ARRANGEMENTS', formData, outcome);
        return infoGapDetection.hasInfoGap ? (
          <div className="mt-6">
            <InfoGapQuickActions
              detection={infoGapDetection}
              moduleKey="A5_EMERGENCY_ARRANGEMENTS"
              onCreateAction={(actionText, defaultL, defaultI) => {
                setQuickActionTemplate({
                  action: actionText,
                  likelihood: defaultL,
                  impact: defaultI,
                });
                setShowActionModal(true);
              }}
              showCreateButtons={true}
            />
          </div>
        ) : null;
      })()}

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
