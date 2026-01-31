import { useState } from 'react';
import { Zap, CheckCircle, Plus } from 'lucide-react';
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

interface FSD5ActiveFireSystemsDesignFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface QuickActionTemplate {
  action: string;
  likelihood: number;
  impact: number;
}

export default function FSD5ActiveFireSystemsDesignForm({
  moduleInstance,
  document,
  onSaved,
}: FSD5ActiveFireSystemsDesignFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [quickActionTemplate, setQuickActionTemplate] = useState<QuickActionTemplate | null>(null);

  const [formData, setFormData] = useState({
    detection_alarm_design_category: moduleInstance.data.detection_alarm_design_category || 'unknown',
    alarm_cause_and_effect_summary: moduleInstance.data.alarm_cause_and_effect_summary || '',
    emergency_lighting_design_principles: moduleInstance.data.emergency_lighting_design_principles || '',
    sprinkler_provision: moduleInstance.data.sprinkler_provision || 'unknown',
    sprinkler_standard: moduleInstance.data.sprinkler_standard || 'unknown',
    sprinkler_notes: moduleInstance.data.sprinkler_notes || '',
    suppression_other: moduleInstance.data.suppression_other || 'na',
    suppression_other_notes: moduleInstance.data.suppression_other_notes || '',
    fire_fighting_equipment_strategy: moduleInstance.data.fire_fighting_equipment_strategy || '',
    interface_dependencies: moduleInstance.data.interface_dependencies || '',
    notes: moduleInstance.data.notes || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const getSuggestedOutcome = (): { outcome: string; reason: string } | null => {
    const unknowns = [
      formData.detection_alarm_design_category === 'unknown',
      !formData.alarm_cause_and_effect_summary || formData.alarm_cause_and_effect_summary.trim().length < 20,
      formData.sprinkler_provision === 'unknown',
      !formData.emergency_lighting_design_principles || formData.emergency_lighting_design_principles.trim().length < 20,
    ].filter(Boolean).length;

    if (formData.detection_alarm_design_category === 'unknown') {
      return {
        outcome: 'material_def',
        reason: 'Fire detection/alarm category not defined - critical for design',
      };
    }

    if (unknowns >= 3) {
      return {
        outcome: 'info_gap',
        reason: `${unknowns} key active system parameters unknown`,
      };
    }

    if (!formData.alarm_cause_and_effect_summary || formData.alarm_cause_and_effect_summary.trim().length < 20) {
      return {
        outcome: 'minor_def',
        reason: 'Alarm cause & effect should be documented',
      };
    }

    if (unknowns >= 1) {
      return {
        outcome: 'minor_def',
        reason: 'Some active system details require clarification',
      };
    }

    return {
      outcome: 'compliant',
      reason: 'Active fire systems adequately specified',
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
      console.error('Error saving FSD-5 module:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAction = (template: QuickActionTemplate) => {
    setQuickActionTemplate(template);
    setShowActionModal(true);
  };

  const detectionUnknown = formData.detection_alarm_design_category === 'unknown';
  const alarmCauseEffectWeak = !formData.alarm_cause_and_effect_summary || formData.alarm_cause_and_effect_summary.trim().length < 20;
  const sprinklerUnknown = formData.sprinkler_provision === 'unknown';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Zap className="w-6 h-6 text-neutral-700" />
          <h2 className="text-2xl font-bold text-neutral-900">
            FSD-5 - Active Fire Systems (Design)
          </h2>
        </div>
        <p className="text-neutral-600">
          Define active fire protection systems including detection, alarm, sprinklers, and suppression
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
        {/* Fire Detection & Alarm */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Fire Detection & Alarm System
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Detection/Alarm Design Category
              </label>
              <select
                value={formData.detection_alarm_design_category}
                onChange={(e) => setFormData({ ...formData, detection_alarm_design_category: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="L1">L1 - Full detection throughout</option>
                <option value="L2">L2 - Detection in defined areas</option>
                <option value="L3">L3 - Escape routes only</option>
                <option value="L4">L4 - Escape routes within dwelling</option>
                <option value="L5">L5 - Tailored system</option>
                <option value="P1">P1 - Manual call points only</option>
                <option value="P2">P2 - Manual + limited detection</option>
                <option value="other">Other / Mixed</option>
              </select>
            </div>

            {detectionUnknown && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Define fire detection/alarm design category and zoning/cause & effect basis.',
                    likelihood: 4,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Define detection/alarm category
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Alarm Cause & Effect Summary
              </label>
              <textarea
                value={formData.alarm_cause_and_effect_summary}
                onChange={(e) => setFormData({ ...formData, alarm_cause_and_effect_summary: e.target.value })}
                placeholder="Summarize cause & effect relationships (e.g., detection zones, alarm activation, interfaces to doors/lifts/smoke control)"
                rows={4}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>

            {alarmCauseEffectWeak && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Provide alarm cause & effect summary (interfaces to doors, lifts, smoke control).',
                    likelihood: 4,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Document alarm cause & effect
              </button>
            )}
          </div>
        </div>

        {/* Emergency Lighting */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Emergency Lighting
          </h3>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Emergency Lighting Design Principles
            </label>
            <textarea
              value={formData.emergency_lighting_design_principles}
              onChange={(e) => setFormData({ ...formData, emergency_lighting_design_principles: e.target.value })}
              placeholder="Describe emergency lighting design basis (e.g., BS 5266, coverage areas, duration, maintained/non-maintained, etc.)"
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Sprinkler System */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Sprinkler/Suppression Systems
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Sprinkler Provision
              </label>
              <select
                value={formData.sprinkler_provision}
                onChange={(e) => setFormData({ ...formData, sprinkler_provision: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - full sprinkler coverage</option>
                <option value="partial">Partial - specific areas only</option>
                <option value="no">No - not provided</option>
                <option value="na">Not Applicable</option>
              </select>
            </div>

            {(formData.sprinkler_provision === 'yes' || formData.sprinkler_provision === 'partial') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Sprinkler Standard
                  </label>
                  <select
                    value={formData.sprinkler_standard}
                    onChange={(e) => setFormData({ ...formData, sprinkler_standard: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="BSEN12845">BS EN 12845</option>
                    <option value="BS9251">BS 9251 (Domestic)</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Sprinkler System Notes
                  </label>
                  <textarea
                    value={formData.sprinkler_notes}
                    onChange={(e) => setFormData({ ...formData, sprinkler_notes: e.target.value })}
                    placeholder="Provide details about sprinkler coverage, hazard class, water supply, interfaces, etc."
                    rows={3}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                  />
                </div>
              </>
            )}

            {sprinklerUnknown && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Confirm sprinkler provision requirement and document standard/design intent.',
                    likelihood: 4,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Confirm sprinkler provision
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Other Suppression Systems
              </label>
              <select
                value={formData.suppression_other}
                onChange={(e) => setFormData({ ...formData, suppression_other: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent mb-2"
              >
                <option value="na">Not Applicable</option>
                <option value="mist">Water Mist</option>
                <option value="gas">Gaseous Suppression</option>
                <option value="foam">Foam</option>
                <option value="other">Other</option>
              </select>
              {formData.suppression_other !== 'na' && (
                <textarea
                  value={formData.suppression_other_notes}
                  onChange={(e) => setFormData({ ...formData, suppression_other_notes: e.target.value })}
                  placeholder="Describe other suppression systems (locations, standards, etc.)"
                  rows={2}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                />
              )}
            </div>
          </div>
        </div>

        {/* Fire Fighting Equipment */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Fire Fighting Equipment
          </h3>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Fire Fighting Equipment Strategy
            </label>
            <textarea
              value={formData.fire_fighting_equipment_strategy}
              onChange={(e) => setFormData({ ...formData, fire_fighting_equipment_strategy: e.target.value })}
              placeholder="Describe portable fire extinguisher provision, hose reels, fire blankets, etc."
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* System Interfaces */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            System Interfaces & Dependencies
          </h3>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Interface Dependencies
            </label>
            <textarea
              value={formData.interface_dependencies}
              onChange={(e) => setFormData({ ...formData, interface_dependencies: e.target.value })}
              placeholder="Document interfaces between active systems (e.g., alarm triggers smoke control, detection releases doors, sprinkler activation interfaces, lift recall, etc.)"
              rows={4}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
            />
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
            placeholder="Add any additional observations about active fire systems, standards, or special considerations..."
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
