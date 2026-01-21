import { useState, useEffect } from 'react';
import { Shield, CheckCircle, Plus } from 'lucide-react';
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

interface A4ManagementControlsFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface QuickActionTemplate {
  action: string;
  likelihood: number;
  impact: number;
}

export default function A4ManagementControlsForm({
  moduleInstance,
  document,
  onSaved,
}: A4ManagementControlsFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [quickActionTemplate, setQuickActionTemplate] = useState<QuickActionTemplate | null>(null);
  const [actionsRefreshKey, setActionsRefreshKey] = useState(0);

  const [formData, setFormData] = useState({
    responsibilities_defined: moduleInstance.data.responsibilities_defined || 'unknown',
    fire_safety_policy_exists: moduleInstance.data.fire_safety_policy_exists || 'unknown',
    training_induction_provided: moduleInstance.data.training_induction_provided || 'unknown',
    training_refresher_frequency: moduleInstance.data.training_refresher_frequency || 'none',
    fire_warden_marshal_provision: moduleInstance.data.fire_warden_marshal_provision || 'unknown',
    contractor_induction: moduleInstance.data.contractor_induction || 'unknown',
    contractor_supervision: moduleInstance.data.contractor_supervision || 'unknown',
    ptw_hot_work: moduleInstance.data.ptw_hot_work || 'unknown',
    ptw_electrical_isolation_loto: moduleInstance.data.ptw_electrical_isolation_loto || 'unknown',
    ptw_confined_space: moduleInstance.data.ptw_confined_space || 'unknown',
    ptw_other_permits: moduleInstance.data.ptw_other_permits || '',
    inspection_alarm_weekly_test: moduleInstance.data.inspection_alarm_weekly_test || 'unknown',
    inspection_emergency_lighting_monthly: moduleInstance.data.inspection_emergency_lighting_monthly || 'unknown',
    inspection_extinguishers_annual_service: moduleInstance.data.inspection_extinguishers_annual_service || 'unknown',
    inspection_fire_doors_frequency: moduleInstance.data.inspection_fire_doors_frequency || 'unknown',
    inspection_records_available: moduleInstance.data.inspection_records_available || 'unknown',
    housekeeping_waste_control: moduleInstance.data.housekeeping_waste_control || 'unknown',
    housekeeping_storage_control: moduleInstance.data.housekeeping_storage_control || 'unknown',
    housekeeping_combustible_accumulation_risk: moduleInstance.data.housekeeping_combustible_accumulation_risk || 'unknown',
    change_management_process_exists: moduleInstance.data.change_management_process_exists || 'unknown',
    change_management_review_triggers_defined: moduleInstance.data.change_management_review_triggers_defined || 'unknown',
    management_notes: moduleInstance.data.management_notes || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const getSuggestedOutcome = (): { outcome: string; reason: string } | null => {
    const unknowns = Object.entries(formData).filter(
      ([key, value]) => value === 'unknown' && !key.includes('notes') && !key.includes('other')
    ).length;

    if (unknowns >= 5) {
      return {
        outcome: 'info_gap',
        reason: `${unknowns} items marked as unknown - significant information gaps identified`,
      };
    }

    const criticalIssues = [];

    if (formData.fire_safety_policy_exists === 'no') {
      criticalIssues.push('No fire safety policy');
    }
    if (formData.training_induction_provided === 'no') {
      criticalIssues.push('No staff induction');
    }
    if (formData.ptw_hot_work === 'no' && formData.contractor_supervision === 'no') {
      criticalIssues.push('No hot work permit system with contractor works');
    }
    if (formData.inspection_alarm_weekly_test === 'no') {
      criticalIssues.push('Fire alarm not tested weekly');
    }

    if (criticalIssues.length >= 2) {
      return {
        outcome: 'material_def',
        reason: `Multiple material deficiencies: ${criticalIssues.join(', ')}`,
      };
    }

    if (unknowns >= 3 || criticalIssues.length === 1) {
      return {
        outcome: 'minor_def',
        reason: unknowns >= 3
          ? 'Some information gaps remain'
          : criticalIssues[0],
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
          <Shield className="w-6 h-6 text-neutral-700" />
          <h2 className="text-2xl font-bold text-neutral-900">
            A4 - Management Systems & Controls
          </h2>
        </div>
        <p className="text-neutral-600">
          Assess the adequacy of management arrangements for fire safety
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
            Responsibilities & Policy
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Fire safety responsibilities clearly defined?
              </label>
              <select
                value={formData.responsibilities_defined}
                onChange={(e) =>
                  setFormData({ ...formData, responsibilities_defined: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - fully documented</option>
                <option value="partial">Partial - some gaps</option>
                <option value="no">No - not defined</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                If unknown → set outcome to info_gap and raise an action
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Written fire safety policy exists?
              </label>
              <select
                value={formData.fire_safety_policy_exists}
                onChange={(e) =>
                  setFormData({ ...formData, fire_safety_policy_exists: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            {formData.fire_safety_policy_exists === 'no' && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Develop and implement a written fire safety policy statement, communicate to all staff, and display in prominent locations',
                    likelihood: 4,
                    impact: 3,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Implement fire safety policy
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Training & Competence
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Fire safety induction provided to staff?
              </label>
              <select
                value={formData.training_induction_provided}
                onChange={(e) =>
                  setFormData({ ...formData, training_induction_provided: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - comprehensive</option>
                <option value="no">No</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Fire safety refresher training frequency
              </label>
              <select
                value={formData.training_refresher_frequency}
                onChange={(e) =>
                  setFormData({ ...formData, training_refresher_frequency: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="none">None / Ad-hoc</option>
                <option value="annual">Annual</option>
                <option value="6-monthly">6-monthly</option>
                <option value="other">Other (specify in notes)</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Fire wardens/marshals provision
              </label>
              <select
                value={formData.fire_warden_marshal_provision}
                onChange={(e) =>
                  setFormData({ ...formData, fire_warden_marshal_provision: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="adequate">Adequate - trained and appointed</option>
                <option value="inadequate">Inadequate - insufficient coverage</option>
              </select>
            </div>

            {(formData.training_induction_provided === 'no' ||
              formData.training_refresher_frequency === 'none' ||
              formData.fire_warden_marshal_provision === 'inadequate') && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Develop and implement comprehensive fire safety training programme including staff induction, refresher training schedule, and fire warden appointments with training matrix',
                    likelihood: 4,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Formalise training programme
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Contractor Control
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Contractor fire safety induction?
              </label>
              <select
                value={formData.contractor_induction}
                onChange={(e) =>
                  setFormData({ ...formData, contractor_induction: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - formal process</option>
                <option value="no">No</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Contractor supervision adequate?
              </label>
              <select
                value={formData.contractor_supervision}
                onChange={(e) =>
                  setFormData({ ...formData, contractor_supervision: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Permit to Work Systems
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Hot work permit system in place?
              </label>
              <select
                value={formData.ptw_hot_work}
                onChange={(e) =>
                  setFormData({ ...formData, ptw_hot_work: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - formal system</option>
                <option value="no">No</option>
              </select>
            </div>

            {formData.ptw_hot_work === 'no' && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Implement hot work permit to work system including risk assessment, fire watch requirements, and post-work inspection procedures',
                    likelihood: 5,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Implement hot work permit system
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Electrical isolation/LOTO procedures?
              </label>
              <select
                value={formData.ptw_electrical_isolation_loto}
                onChange={(e) =>
                  setFormData({ ...formData, ptw_electrical_isolation_loto: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Confined space entry procedures?
              </label>
              <select
                value={formData.ptw_confined_space}
                onChange={(e) =>
                  setFormData({ ...formData, ptw_confined_space: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="na">N/A - no confined spaces</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Other permit systems (optional)
              </label>
              <input
                type="text"
                value={formData.ptw_other_permits}
                onChange={(e) =>
                  setFormData({ ...formData, ptw_other_permits: e.target.value })
                }
                placeholder="e.g., roof work, excavation"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Inspection & Testing Regime
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Fire alarm weekly test conducted?
              </label>
              <select
                value={formData.inspection_alarm_weekly_test}
                onChange={(e) =>
                  setFormData({ ...formData, inspection_alarm_weekly_test: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - documented</option>
                <option value="no">No</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Emergency lighting monthly test?
              </label>
              <select
                value={formData.inspection_emergency_lighting_monthly}
                onChange={(e) =>
                  setFormData({ ...formData, inspection_emergency_lighting_monthly: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Fire extinguishers annual service?
              </label>
              <select
                value={formData.inspection_extinguishers_annual_service}
                onChange={(e) =>
                  setFormData({ ...formData, inspection_extinguishers_annual_service: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - up to date</option>
                <option value="no">No</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Fire door inspection frequency
              </label>
              <select
                value={formData.inspection_fire_doors_frequency}
                onChange={(e) =>
                  setFormData({ ...formData, inspection_fire_doors_frequency: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="none">None - no formal inspections</option>
                <option value="6-monthly">6-monthly</option>
                <option value="annual">Annual</option>
                <option value="other">Other (specify in notes)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Testing/inspection records available?
              </label>
              <select
                value={formData.inspection_records_available}
                onChange={(e) =>
                  setFormData({ ...formData, inspection_records_available: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - comprehensive</option>
                <option value="partial">Partial records only</option>
                <option value="no">No records</option>
              </select>
            </div>

            {(formData.inspection_alarm_weekly_test === 'no' ||
              formData.inspection_fire_doors_frequency === 'none' ||
              formData.inspection_records_available === 'no') && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Establish comprehensive inspection and testing logbook/schedule covering fire alarm weekly tests, emergency lighting, extinguishers, and fire doors with record-keeping system',
                    likelihood: 4,
                    impact: 3,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Create inspection/testing programme
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Housekeeping & General Fire Safety
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Waste control and disposal
              </label>
              <select
                value={formData.housekeeping_waste_control}
                onChange={(e) =>
                  setFormData({ ...formData, housekeeping_waste_control: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="adequate">Adequate</option>
                <option value="inadequate">Inadequate</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Storage arrangements
              </label>
              <select
                value={formData.housekeeping_storage_control}
                onChange={(e) =>
                  setFormData({ ...formData, housekeeping_storage_control: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="adequate">Adequate - controlled</option>
                <option value="inadequate">Inadequate - obstructions present</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Combustible material accumulation risk
              </label>
              <select
                value={formData.housekeeping_combustible_accumulation_risk}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    housekeeping_combustible_accumulation_risk: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="low">Low</option>
                <option value="med">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {(formData.housekeeping_waste_control === 'inadequate' ||
              formData.housekeeping_storage_control === 'inadequate' ||
              formData.housekeeping_combustible_accumulation_risk === 'high') && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Improve housekeeping standards including waste management procedures, storage controls, and removal of combustible material accumulations. Establish routine housekeeping inspections.',
                    likelihood: 4,
                    impact: 3,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Improve housekeeping controls
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Change Management
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Change management process exists?
              </label>
              <select
                value={formData.change_management_process_exists}
                onChange={(e) =>
                  setFormData({ ...formData, change_management_process_exists: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - formal process</option>
                <option value="no">No</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Review triggers defined? (occupancy change, alterations, etc.)
              </label>
              <select
                value={formData.change_management_review_triggers_defined}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    change_management_review_triggers_defined: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - documented</option>
                <option value="no">No</option>
              </select>
            </div>

            {(formData.change_management_process_exists === 'no' ||
              formData.change_management_review_triggers_defined === 'no') && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Introduce change management process to review fire risk assessment when significant changes occur (occupancy, layout, materials, processes). Document review triggers and responsibilities.',
                    likelihood: 3,
                    impact: 3,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Introduce change control review process
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Additional Management Notes
          </h3>
          <textarea
            value={formData.management_notes}
            onChange={(e) =>
              setFormData({ ...formData, management_notes: e.target.value })
            }
            placeholder="Add any additional observations about management systems, controls, or specific issues identified..."
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
        const infoGapDetection = detectInfoGaps('A4_MANAGEMENT_CONTROLS', formData, outcome);
        return infoGapDetection.hasInfoGap ? (
          <div className="mt-6">
            <InfoGapQuickActions
              detection={infoGapDetection}
              moduleKey="A4_MANAGEMENT_CONTROLS"
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
        key={actionsRefreshKey}
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
            setActionsRefreshKey((prev) => prev + 1);
          }}
          defaultAction={quickActionTemplate?.action}
          defaultLikelihood={quickActionTemplate?.likelihood}
          defaultImpact={quickActionTemplate?.impact}
        />
      )}
    </div>
  );
}
