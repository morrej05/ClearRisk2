import { useState } from 'react';
import { HardHat, CheckCircle, Plus } from 'lucide-react';
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

interface FSD9ConstructionPhaseFireSafetyFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface QuickActionTemplate {
  action: string;
  likelihood: number;
  impact: number;
}

export default function FSD9ConstructionPhaseFireSafetyForm({
  moduleInstance,
  document,
  onSaved,
}: FSD9ConstructionPhaseFireSafetyFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [quickActionTemplate, setQuickActionTemplate] = useState<QuickActionTemplate | null>(null);

  const [formData, setFormData] = useState({
    construction_phase_applicable: moduleInstance.data.construction_phase_applicable || 'unknown',
    fire_plan_exists: moduleInstance.data.fire_plan_exists || 'unknown',
    hot_work_controls: moduleInstance.data.hot_work_controls || 'unknown',
    temporary_detection_alarm: moduleInstance.data.temporary_detection_alarm || 'unknown',
    temporary_means_of_escape: moduleInstance.data.temporary_means_of_escape || 'unknown',
    combustible_storage_controls: moduleInstance.data.combustible_storage_controls || 'unknown',
    site_security_arson_controls: moduleInstance.data.site_security_arson_controls || 'unknown',
    emergency_access_maintained: moduleInstance.data.emergency_access_maintained || 'unknown',
    notes: moduleInstance.data.notes || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const getSuggestedOutcome = (): { outcome: string; reason: string } | null => {
    if (formData.construction_phase_applicable === 'no') {
      return {
        outcome: 'compliant',
        reason: 'Construction phase fire safety not applicable',
      };
    }

    if (formData.construction_phase_applicable === 'unknown') {
      return {
        outcome: 'info_gap',
        reason: 'Applicability of construction phase fire safety not confirmed',
      };
    }

    const unknowns = [
      formData.fire_plan_exists === 'unknown',
      formData.hot_work_controls === 'unknown',
      formData.temporary_detection_alarm === 'unknown',
      formData.temporary_means_of_escape === 'unknown',
      formData.combustible_storage_controls === 'unknown',
      formData.site_security_arson_controls === 'unknown',
      formData.emergency_access_maintained === 'unknown',
    ].filter(Boolean).length;

    const criticalMissing = [
      formData.fire_plan_exists === 'no' || formData.fire_plan_exists === 'unknown',
      formData.temporary_means_of_escape === 'inadequate' || formData.temporary_means_of_escape === 'unknown',
    ].filter(Boolean).length;

    if (criticalMissing > 0) {
      return {
        outcome: 'material_def',
        reason: 'Critical construction phase fire safety provisions missing or unknown',
      };
    }

    if (unknowns >= 3) {
      return {
        outcome: 'info_gap',
        reason: `${unknowns} construction phase fire safety parameters unknown`,
      };
    }

    if (unknowns >= 1) {
      return {
        outcome: 'minor_def',
        reason: 'Some construction phase fire safety details require clarification',
      };
    }

    return {
      outcome: 'compliant',
      reason: 'Construction phase fire safety adequately addressed',
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
      console.error('Error saving FSD-9 module:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAction = (template: QuickActionTemplate) => {
    setQuickActionTemplate(template);
    setShowActionModal(true);
  };

  const isApplicable = formData.construction_phase_applicable === 'yes';
  const firePlanMissing = isApplicable && (formData.fire_plan_exists === 'no' || formData.fire_plan_exists === 'unknown');
  const hotWorksMissing = isApplicable && (formData.hot_work_controls === 'no' || formData.hot_work_controls === 'unknown');
  const tempEscapeIssue = isApplicable && (formData.temporary_means_of_escape === 'inadequate' || formData.temporary_means_of_escape === 'unknown');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <HardHat className="w-6 h-6 text-neutral-700" />
          <h2 className="text-2xl font-bold text-neutral-900">
            FSD-9 - Construction Phase Fire Safety
          </h2>
        </div>
        <p className="text-neutral-600">
          Document construction phase fire safety provisions including site plans, hot works, temporary systems, and site security
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
        {/* Applicability */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Construction Phase Applicability
          </h3>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Is construction phase fire safety applicable to this strategy?
            </label>
            <select
              value={formData.construction_phase_applicable}
              onChange={(e) => setFormData({ ...formData, construction_phase_applicable: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            >
              <option value="unknown">Unknown</option>
              <option value="yes">Yes - construction work planned/ongoing</option>
              <option value="no">No - not applicable</option>
            </select>
            <p className="text-xs text-neutral-600 mt-2">
              Construction phase fire safety applies to new builds, major refurbishments, or alterations during occupied use
            </p>
          </div>
        </div>

        {isApplicable && (
          <>
            {/* Fire Safety Plan */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">
                Construction Fire Safety Plan
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Does a construction-phase fire safety plan exist?
                  </label>
                  <select
                    value={formData.fire_plan_exists}
                    onChange={(e) => setFormData({ ...formData, fire_plan_exists: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="yes">Yes - plan exists and is current</option>
                    <option value="no">No - plan not yet created</option>
                  </select>
                  <p className="text-xs text-neutral-600 mt-2">
                    Plan should cover roles/responsibilities, alarms, escape routes, hot works, storage, emergency access, and coordination
                  </p>
                </div>

                {firePlanMissing && (
                  <button
                    onClick={() =>
                      handleQuickAction({
                        action: 'Implement a construction-phase fire safety plan (roles, alarms, escape, hot works, storage, emergency access).',
                        likelihood: 4,
                        impact: 4,
                      })
                    }
                    className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Quick Add: Implement construction fire safety plan (Critical)
                  </button>
                )}
              </div>
            </div>

            {/* Hot Works Controls */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">
                Hot Works & Ignition Source Control
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Are hot works controls / permit system in place?
                  </label>
                  <select
                    value={formData.hot_work_controls}
                    onChange={(e) => setFormData({ ...formData, hot_work_controls: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="yes">Yes - permit system operational</option>
                    <option value="no">No - not yet implemented</option>
                  </select>
                  <p className="text-xs text-neutral-600 mt-2">
                    Covers welding, cutting, grinding, and other hot work activities with permit-to-work system
                  </p>
                </div>

                {hotWorksMissing && (
                  <button
                    onClick={() =>
                      handleQuickAction({
                        action: 'Implement construction-phase hot works controls / permit system.',
                        likelihood: 4,
                        impact: 4,
                      })
                    }
                    className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Quick Add: Implement hot works controls (Critical)
                  </button>
                )}
              </div>
            </div>

            {/* Temporary Fire Safety Systems */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">
                Temporary Fire Safety Systems
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Temporary Fire Detection & Alarm Provision
                  </label>
                  <select
                    value={formData.temporary_detection_alarm}
                    onChange={(e) => setFormData({ ...formData, temporary_detection_alarm: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="yes">Yes - temporary system in place</option>
                    <option value="no">No - not provided</option>
                    <option value="na">Not Applicable</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Temporary Means of Escape Status
                  </label>
                  <select
                    value={formData.temporary_means_of_escape}
                    onChange={(e) => setFormData({ ...formData, temporary_means_of_escape: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="adequate">Adequate - maintained during works</option>
                    <option value="inadequate">Inadequate - requires improvement</option>
                  </select>
                  <p className="text-xs text-neutral-600 mt-2">
                    Temporary escape routes should be maintained, signed, and kept clear during all phases of construction
                  </p>
                </div>

                {tempEscapeIssue && (
                  <button
                    onClick={() =>
                      handleQuickAction({
                        action: 'Confirm and maintain temporary means of escape during works.',
                        likelihood: 4,
                        impact: 5,
                      })
                    }
                    className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Quick Add: Address temporary means of escape (Critical)
                  </button>
                )}
              </div>
            </div>

            {/* Site Controls */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">
                Site Management & Security
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Combustible Material Storage Controls
                  </label>
                  <select
                    value={formData.combustible_storage_controls}
                    onChange={(e) => setFormData({ ...formData, combustible_storage_controls: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="yes">Yes - controls in place</option>
                    <option value="no">No - not yet implemented</option>
                  </select>
                  <p className="text-xs text-neutral-600 mt-2">
                    Proper segregation and storage of combustible materials, waste management, and housekeeping
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Site Security & Arson Controls
                  </label>
                  <select
                    value={formData.site_security_arson_controls}
                    onChange={(e) => setFormData({ ...formData, site_security_arson_controls: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="yes">Yes - security measures in place</option>
                    <option value="no">No - not yet implemented</option>
                  </select>
                  <p className="text-xs text-neutral-600 mt-2">
                    Site perimeter security, access control, and measures to prevent unauthorized access/arson
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Emergency Fire & Rescue Service Access
                  </label>
                  <select
                    value={formData.emergency_access_maintained}
                    onChange={(e) => setFormData({ ...formData, emergency_access_maintained: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="yes">Yes - access maintained</option>
                    <option value="no">No - access currently obstructed</option>
                  </select>
                  <p className="text-xs text-neutral-600 mt-2">
                    Fire service access routes and water supplies should be maintained throughout construction
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Notes */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Additional Notes
          </h3>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Add any additional observations about construction phase fire safety, phasing plans, contractor coordination, or special considerations..."
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
