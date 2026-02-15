import { useState } from 'react';
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

interface FRA3FireProtectionFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface QuickActionTemplate {
  action: string;
  likelihood: number;
  impact: number;
}

export default function FRA3FireProtectionForm({
  moduleInstance,
  document,
  onSaved,
}: FRA3FireProtectionFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [quickActionTemplate, setQuickActionTemplate] = useState<QuickActionTemplate | null>(null);
  const [actionsRefreshKey, setActionsRefreshKey] = useState(0);

  const [formData, setFormData] = useState({
    fire_alarm_present: moduleInstance.data.fire_alarm_present || 'unknown',
    fire_alarm_category: moduleInstance.data.fire_alarm_category || 'unknown',
    alarm_testing_evidence: moduleInstance.data.alarm_testing_evidence || 'unknown',
    emergency_lighting_present: moduleInstance.data.emergency_lighting_present || 'unknown',
    emergency_lighting_testing_evidence: moduleInstance.data.emergency_lighting_testing_evidence || 'unknown',
    fire_doors_condition: moduleInstance.data.fire_doors_condition || 'unknown',
    fire_doors_inspection_regime: moduleInstance.data.fire_doors_inspection_regime || 'unknown',
    compartmentation_condition: moduleInstance.data.compartmentation_condition || 'unknown',
    fire_stopping_confidence: moduleInstance.data.fire_stopping_confidence || 'unknown',
    extinguishers_present: moduleInstance.data.extinguishers_present || 'unknown',
    extinguisher_servicing_evidence: moduleInstance.data.extinguisher_servicing_evidence || 'unknown',
    sprinkler_present: moduleInstance.data.sprinkler_present || 'unknown',
    notes: moduleInstance.data.notes || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const getSuggestedOutcome = (): { outcome: string; reason: string } | null => {
    const unknowns = Object.entries(formData).filter(
      ([key, value]) => value === 'unknown' && !key.includes('notes') && !key.includes('sprinkler')
    ).length;

    if (unknowns >= 4) {
      return {
        outcome: 'info_gap',
        reason: `${unknowns} items marked as unknown - significant information gaps`,
      };
    }

    const criticalIssues = [];

    if (formData.fire_alarm_present === 'no') {
      criticalIssues.push('No fire alarm system');
    }
    if (formData.emergency_lighting_present === 'no') {
      criticalIssues.push('No emergency lighting on escape routes');
    }
    if (formData.compartmentation_condition === 'inadequate') {
      criticalIssues.push('Inadequate compartmentation');
    }
    if (formData.fire_doors_condition === 'inadequate') {
      criticalIssues.push('Fire doors in poor condition');
    }

    if (criticalIssues.length > 0) {
      return {
        outcome: 'material_def',
        reason: `Material deficiencies identified: ${criticalIssues.join(', ')}`,
      };
    }

    const minorIssues = [
      formData.alarm_testing_evidence === 'no' && 'No alarm testing evidence',
      formData.fire_stopping_confidence === 'unknown' && 'Fire stopping not verified',
      formData.extinguishers_present === 'no' && 'No extinguishers',
    ].filter(Boolean);

    if (minorIssues.length > 0 || unknowns >= 2) {
      return {
        outcome: 'minor_def',
        reason: minorIssues.length > 0 ? minorIssues.join(', ') : 'Some information gaps remain',
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
            FRA-3 - Fire Protection Measures
          </h2>
        </div>
        <p className="text-neutral-600">
          Assess fire detection, alarm, emergency lighting, fire doors, and compartmentation
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
            Fire Alarm System
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Fire alarm system present?
              </label>
              <select
                value={formData.fire_alarm_present}
                onChange={(e) =>
                  setFormData({ ...formData, fire_alarm_present: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - system installed</option>
                <option value="no">No - no alarm system</option>
              </select>
            </div>

            {(formData.fire_alarm_present === 'no' || formData.fire_alarm_present === 'unknown') && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Install or verify suitable fire detection and alarm system to appropriate category (BS 5839-1). System should provide adequate warning time for safe evacuation based on building use and occupancy.',
                    likelihood: 4,
                    impact: 5,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Install/verify fire alarm system
              </button>
            )}

            {formData.fire_alarm_present === 'yes' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Fire alarm category (BS 5839-1)
                  </label>
                  <select
                    value={formData.fire_alarm_category}
                    onChange={(e) =>
                      setFormData({ ...formData, fire_alarm_category: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="L1">L1 - Full coverage automatic</option>
                    <option value="L2">L2 - Automatic in defined areas</option>
                    <option value="L3">L3 - Escape routes only</option>
                    <option value="L4">L4 - Manual call points only</option>
                    <option value="L5">L5 - As designed (custom)</option>
                    <option value="P1">P1 - Property protection (full)</option>
                    <option value="P2">P2 - Property protection (defined areas)</option>
                  </select>
                  <p className="text-xs text-neutral-500 mt-1">
                    Category determines extent of detection coverage
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Weekly testing evidence available?
                  </label>
                  <select
                    value={formData.alarm_testing_evidence}
                    onChange={(e) =>
                      setFormData({ ...formData, alarm_testing_evidence: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="yes">Yes - documented weekly tests</option>
                    <option value="partial">Partial - some records</option>
                    <option value="no">No - no testing evidence</option>
                  </select>
                </div>

                {(formData.alarm_testing_evidence === 'no' ||
                  formData.alarm_testing_evidence === 'partial') && (
                  <button
                    onClick={() =>
                      handleQuickAction({
                        action: 'Implement documented weekly fire alarm testing regime (BS 5839-1 Clause 45): test different call point each week, maintain logbook, arrange quarterly inspection by competent person',
                        likelihood: 4,
                        impact: 4,
                      })
                    }
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Quick Add: Implement alarm testing regime
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Emergency Lighting
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Emergency lighting present on escape routes?
              </label>
              <select
                value={formData.emergency_lighting_present}
                onChange={(e) =>
                  setFormData({ ...formData, emergency_lighting_present: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - emergency lighting installed</option>
                <option value="no">No - no emergency lighting</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Required where escape routes lack adequate borrowed light
              </p>
            </div>

            {(formData.emergency_lighting_present === 'no' ||
              formData.emergency_lighting_present === 'unknown') && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Install or verify emergency lighting to BS 5266 standard on all escape routes, stairways, changes in level, final exits, and fire safety equipment locations. Ensure 3-hour duration where required.',
                    likelihood: 4,
                    impact: 5,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Install/verify emergency lighting
              </button>
            )}

            {formData.emergency_lighting_present === 'yes' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Monthly testing evidence available?
                  </label>
                  <select
                    value={formData.emergency_lighting_testing_evidence}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergency_lighting_testing_evidence: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="yes">Yes - documented monthly tests</option>
                    <option value="partial">Partial - some records</option>
                    <option value="no">No - no testing evidence</option>
                  </select>
                </div>

                {(formData.emergency_lighting_testing_evidence === 'no' ||
                  formData.emergency_lighting_testing_evidence === 'partial') && (
                  <button
                    onClick={() =>
                      handleQuickAction({
                        action: 'Implement documented emergency lighting testing regime (BS 5266): monthly function tests, annual 3-hour duration test, maintain logbook, arrange periodic inspection by competent person',
                        likelihood: 4,
                        impact: 4,
                      })
                    }
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Quick Add: Implement emergency lighting testing
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Fire Doors
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Fire doors condition
              </label>
              <select
                value={formData.fire_doors_condition}
                onChange={(e) =>
                  setFormData({ ...formData, fire_doors_condition: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="adequate">Adequate - good condition and maintained</option>
                <option value="inadequate">Inadequate - poor condition or missing</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Consider leaf fit, seals, glazing, closers, latches, signage, and furniture
              </p>
            </div>

            {(formData.fire_doors_condition === 'inadequate' ||
              formData.fire_doors_condition === 'unknown') && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Inspect all fire doors and remediate defects: repair/replace damaged leaves, seals, and glazing; install/repair self-closers; replace inadequate ironmongery; install appropriate signage; implement 6-monthly inspection programme',
                    likelihood: 4,
                    impact: 5,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Inspect & remediate fire doors
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Fire door inspection regime
              </label>
              <select
                value={formData.fire_doors_inspection_regime}
                onChange={(e) =>
                  setFormData({ ...formData, fire_doors_inspection_regime: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="none">None - no formal inspections</option>
                <option value="6-monthly">6-monthly inspections</option>
                <option value="annual">Annual inspections</option>
                <option value="other">Other frequency (specify in notes)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Compartmentation & Fire Stopping
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Compartmentation condition
              </label>
              <select
                value={formData.compartmentation_condition}
                onChange={(e) =>
                  setFormData({ ...formData, compartmentation_condition: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="adequate">Adequate - no significant breaches</option>
                <option value="inadequate">Inadequate - breaches identified</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Consider walls, floors, penetrations, and service routes
              </p>
            </div>

            {(formData.compartmentation_condition === 'inadequate' ||
              formData.compartmentation_condition === 'unknown') && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Commission comprehensive compartmentation survey to identify all breaches in fire-resisting construction. Remediate all identified breaches using appropriate fire-rated materials and third-party certified products.',
                    likelihood: 4,
                    impact: 5,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Survey & remediate compartmentation
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Fire stopping confidence level
              </label>
              <select
                value={formData.fire_stopping_confidence}
                onChange={(e) =>
                  setFormData({ ...formData, fire_stopping_confidence: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown - not verified</option>
                <option value="known">Known - intrusive survey completed</option>
                <option value="assumed">Assumed - visual assessment only</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Critical for concealed penetrations and service routes
              </p>
            </div>

            {formData.fire_stopping_confidence === 'unknown' && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Commission intrusive fire stopping survey to verify integrity of concealed penetrations, service routes through compartment boundaries, and above ceiling voids. Establish fire stopping register.',
                    likelihood: 4,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Commission fire stopping survey
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Firefighting Equipment
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Fire extinguishers present?
              </label>
              <select
                value={formData.extinguishers_present}
                onChange={(e) =>
                  setFormData({ ...formData, extinguishers_present: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - extinguishers provided</option>
                <option value="no">No - no extinguishers</option>
              </select>
            </div>

            {formData.extinguishers_present === 'yes' && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Annual servicing evidence?
                </label>
                <select
                  value={formData.extinguisher_servicing_evidence}
                  onChange={(e) =>
                    setFormData({ ...formData, extinguisher_servicing_evidence: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                >
                  <option value="unknown">Unknown</option>
                  <option value="yes">Yes - up to date servicing</option>
                  <option value="partial">Partial - some serviced</option>
                  <option value="no">No - no servicing evidence</option>
                </select>
              </div>
            )}

            {(formData.extinguishers_present === 'no' ||
              formData.extinguisher_servicing_evidence === 'no' ||
              formData.extinguisher_servicing_evidence === 'unknown') && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Provide suitable and sufficient portable fire extinguishers (BS EN 3) at appropriate locations: final exits, high-risk areas, and within travel distance limits. Arrange annual servicing by competent engineer.',
                    likelihood: 3,
                    impact: 3,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Provide/service extinguishers
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Sprinkler system present? (optional context)
              </label>
              <select
                value={formData.sprinkler_present}
                onChange={(e) =>
                  setFormData({ ...formData, sprinkler_present: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - sprinkler system installed</option>
                <option value="no">No - no sprinklers</option>
                <option value="na">N/A - not applicable to building type</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                For information only - sprinkler assessment requires dedicated module
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Additional Fire Protection Notes
          </h3>
          <textarea
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            placeholder="Add any additional observations about fire protection measures, system specifications, maintenance arrangements, or other relevant details..."
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
        const infoGapDetection = detectInfoGaps(moduleInstance.module_key, formData, outcome);
        return infoGapDetection.hasInfoGap ? (
          <div className="mt-6">
            <InfoGapQuickActions
              detection={infoGapDetection}
              moduleKey={moduleInstance.module_key}
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
