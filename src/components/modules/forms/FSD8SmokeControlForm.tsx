import { useState } from 'react';
import { Wind, CheckCircle, Plus } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import AddActionModal from '../../actions/AddActionModal';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import { getActionsRefreshKey } from '../../../utils/actionsRefreshKey';

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

interface FSD8SmokeControlFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface QuickActionTemplate {
  action: string;
  likelihood: number;
  impact: number;
}

export default function FSD8SmokeControlForm({
  moduleInstance,
  document,
  onSaved,
}: FSD8SmokeControlFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const actionsRefreshKey = getActionsRefreshKey(document.id, moduleInstance.id);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [quickActionTemplate, setQuickActionTemplate] = useState<QuickActionTemplate | null>(null);

  const [formData, setFormData] = useState({
    smoke_control_present: moduleInstance.data.smoke_control_present || 'unknown',
    system_type: moduleInstance.data.system_type || 'unknown',
    coverage_areas: moduleInstance.data.coverage_areas || [],
    coverage_areas_notes: moduleInstance.data.coverage_areas_notes || '',
    design_standard_or_basis: moduleInstance.data.design_standard_or_basis || 'unknown',
    activation_and_controls: moduleInstance.data.activation_and_controls || '',
    maintenance_testing_assumptions: moduleInstance.data.maintenance_testing_assumptions || '',
    notes: moduleInstance.data.notes || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const getSuggestedOutcome = (): { outcome: string; reason: string } | null => {
    const unknowns = [
      formData.smoke_control_present === 'unknown',
      formData.system_type === 'unknown',
      formData.design_standard_or_basis === 'unknown',
      !formData.activation_and_controls || formData.activation_and_controls.trim().length < 20,
    ].filter(Boolean).length;

    if (formData.smoke_control_present === 'unknown') {
      return {
        outcome: 'info_gap',
        reason: 'Smoke control provision not confirmed',
      };
    }

    if (formData.smoke_control_present === 'yes' && (!formData.activation_and_controls || formData.activation_and_controls.trim().length < 20)) {
      return {
        outcome: 'material_def',
        reason: 'Smoke control present but activation/control not documented',
      };
    }

    if (unknowns >= 2) {
      return {
        outcome: 'minor_def',
        reason: 'Some smoke control details require clarification',
      };
    }

    return {
      outcome: 'compliant',
      reason: 'Smoke control adequately specified',
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
      console.error('Error saving FSD-8 module:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAction = (template: QuickActionTemplate) => {
    setQuickActionTemplate(template);
    setShowActionModal(true);
  };

  const handleCoverageToggle = (area: string) => {
    const updated = formData.coverage_areas.includes(area)
      ? formData.coverage_areas.filter((a: string) => a !== area)
      : [...formData.coverage_areas, area];
    setFormData({ ...formData, coverage_areas: updated });
  };

  const smokeControlUnknown = formData.smoke_control_present === 'unknown';
  const activationWeak = formData.smoke_control_present === 'yes' && (!formData.activation_and_controls || formData.activation_and_controls.trim().length < 20);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Wind className="w-6 h-6 text-neutral-700" />
          <h2 className="text-2xl font-bold text-neutral-900">
            FSD-8 - Smoke Control
          </h2>
        </div>
        <p className="text-neutral-600">
          Define smoke control and ventilation systems for fire strategy
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
        {/* Smoke Control Presence */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Smoke Control Provision
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Smoke Control System Present?
              </label>
              <select
                value={formData.smoke_control_present}
                onChange={(e) => setFormData({ ...formData, smoke_control_present: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - smoke control provided</option>
                <option value="no">No - not provided</option>
                <option value="na">Not Applicable</option>
              </select>
            </div>

            {smokeControlUnknown && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Confirm smoke ventilation/smoke control provisions and design basis.',
                    likelihood: 4,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Confirm smoke control provision
              </button>
            )}
          </div>
        </div>

        {formData.smoke_control_present === 'yes' && (
          <>
            {/* System Type */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">
                System Type & Coverage
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    System Type
                  </label>
                  <select
                    value={formData.system_type}
                    onChange={(e) => setFormData({ ...formData, system_type: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="natural">Natural Ventilation / AOV</option>
                    <option value="mechanical">Mechanical Extraction</option>
                    <option value="pressurisation">Pressurisation System</option>
                    <option value="mixed">Mixed / Hybrid</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Coverage Areas
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {[
                      'Stairs',
                      'Corridors',
                      'Lobbies',
                      'Atrium',
                      'Basement',
                      'Car park',
                      'Other'
                    ].map((area) => (
                      <label key={area} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.coverage_areas.includes(area)}
                          onChange={() => handleCoverageToggle(area)}
                          className="w-4 h-4 text-neutral-900 border-neutral-300 rounded focus:ring-neutral-900"
                        />
                        <span>{area}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {formData.coverage_areas.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Coverage Details
                    </label>
                    <textarea
                      value={formData.coverage_areas_notes}
                      onChange={(e) => setFormData({ ...formData, coverage_areas_notes: e.target.value })}
                      placeholder="Provide details about smoke control coverage in each area"
                      rows={3}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Design Basis */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">
                Design Standard & Basis
              </h3>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Design Standard or Basis
                </label>
                <select
                  value={formData.design_standard_or_basis}
                  onChange={(e) => setFormData({ ...formData, design_standard_or_basis: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                >
                  <option value="unknown">Unknown</option>
                  <option value="ADB">Approved Document B</option>
                  <option value="BS9999">BS 9999</option>
                  <option value="BS9991">BS 9991</option>
                  <option value="BS7346">BS 7346 (AOV)</option>
                  <option value="BS_EN_12101">BS EN 12101 (Smoke control)</option>
                  <option value="engineered">CFD / Fire Engineered</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Activation & Controls */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">
                Activation & Controls
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Activation & Control Strategy
                  </label>
                  <textarea
                    value={formData.activation_and_controls}
                    onChange={(e) => setFormData({ ...formData, activation_and_controls: e.target.value })}
                    placeholder="Describe activation triggers (fire alarm zones, smoke detection), control methods (automatic/manual), firefighter override, interfaces with other systems"
                    rows={4}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                  />
                </div>

                {activationWeak && (
                  <button
                    onClick={() =>
                      handleQuickAction({
                        action: 'Document smoke control activation, interfaces and firefighter override provisions.',
                        likelihood: 4,
                        impact: 4,
                      })
                    }
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Quick Add: Document activation & controls
                  </button>
                )}
              </div>
            </div>

            {/* Maintenance & Testing */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">
                Maintenance & Testing
              </h3>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Maintenance & Testing Assumptions
                </label>
                <textarea
                  value={formData.maintenance_testing_assumptions}
                  onChange={(e) => setFormData({ ...formData, maintenance_testing_assumptions: e.target.value })}
                  placeholder="Document maintenance and testing regime assumptions (frequency, standards, competence requirements)"
                  rows={3}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                />
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
            placeholder="Add any additional observations about smoke control systems, design assumptions, or special considerations..."
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
