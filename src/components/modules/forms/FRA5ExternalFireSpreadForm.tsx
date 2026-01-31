import { useState } from 'react';
import { Building2, CheckCircle, Plus } from 'lucide-react';
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

interface FRA5ExternalFireSpreadFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface QuickActionTemplate {
  action: string;
  likelihood: number;
  impact: number;
}

export default function FRA5ExternalFireSpreadForm({
  moduleInstance,
  document,
  onSaved,
}: FRA5ExternalFireSpreadFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [quickActionTemplate, setQuickActionTemplate] = useState<QuickActionTemplate | null>(null);

  const [formData, setFormData] = useState({
    external_wall_system_applicable: moduleInstance.data.external_wall_system_applicable || 'unknown',
    building_height_relevant: moduleInstance.data.building_height_relevant || '',
    cladding_present: moduleInstance.data.cladding_present || 'unknown',
    insulation_combustibility_known: moduleInstance.data.insulation_combustibility_known || 'unknown',
    cavity_barriers_status: moduleInstance.data.cavity_barriers_status || 'unknown',
    balconies_present: moduleInstance.data.balconies_present || 'unknown',
    external_openings_fire_stopping: moduleInstance.data.external_openings_fire_stopping || 'unknown',
    fire_spread_routes_notes: moduleInstance.data.fire_spread_routes_notes || '',
    pas9980_or_equivalent_appraisal: moduleInstance.data.pas9980_or_equivalent_appraisal || 'unknown',
    appraisal_reference: moduleInstance.data.appraisal_reference || '',
    interim_measures: moduleInstance.data.interim_measures || '',
    notes: moduleInstance.data.notes || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const getSuggestedOutcome = (): { outcome: string; reason: string } | null => {
    if (formData.external_wall_system_applicable === 'no') {
      return {
        outcome: 'compliant',
        reason: 'External wall system assessment not applicable to this building',
      };
    }

    const heightValue = parseFloat(formData.building_height_relevant);
    const isHighRise = heightValue >= 18;

    const keyUnknowns = [
      formData.cladding_present === 'unknown' && 'cladding',
      formData.insulation_combustibility_known === 'unknown' && 'insulation',
      formData.cavity_barriers_status === 'unknown' && 'cavity_barriers',
    ].filter(Boolean);

    if (keyUnknowns.length > 0) {
      if (isHighRise) {
        return {
          outcome: 'material_def',
          reason: `Building ≥18m with unknown ${keyUnknowns.join(', ')} - significant information gaps pose potential life safety risk`,
        };
      } else {
        return {
          outcome: 'info_gap',
          reason: `Unknown ${keyUnknowns.join(', ')} - requires verification`,
        };
      }
    }

    if (formData.pas9980_or_equivalent_appraisal === 'required' ||
        formData.pas9980_or_equivalent_appraisal === 'underway') {
      return {
        outcome: 'info_gap',
        reason: 'External wall system appraisal required or underway - awaiting completion',
      };
    }

    if (formData.pas9980_or_equivalent_appraisal === 'completed' &&
        formData.external_openings_fire_stopping === 'adequate' &&
        formData.cavity_barriers_status === 'known') {
      return {
        outcome: 'compliant',
        reason: 'External wall system appraisal completed with adequate findings',
      };
    }

    if (formData.external_openings_fire_stopping === 'inadequate' ||
        formData.cavity_barriers_status === 'inadequate') {
      return {
        outcome: 'minor_def',
        reason: 'Deficiencies identified in external fire spread protection',
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
          <Building2 className="w-6 h-6 text-neutral-700" />
          <h2 className="text-2xl font-bold text-neutral-900">
            FRA-5 - External Fire Spread
          </h2>
        </div>
        <p className="text-neutral-600">
          Post-Grenfell assessment of external wall systems, cladding, and vertical fire spread routes
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
            Applicability Assessment
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Is external wall system assessment applicable?
              </label>
              <select
                value={formData.external_wall_system_applicable}
                onChange={(e) =>
                  setFormData({ ...formData, external_wall_system_applicable: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - multi-storey with external walls</option>
                <option value="no">No - not applicable (single storey, traditional construction)</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Consider building height, construction type, and presence of external wall systems
              </p>
            </div>

            {formData.external_wall_system_applicable === 'yes' && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Building height (metres)
                </label>
                <input
                  type="text"
                  value={formData.building_height_relevant}
                  onChange={(e) =>
                    setFormData({ ...formData, building_height_relevant: e.target.value })
                  }
                  placeholder="e.g., 12.5"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Buildings ≥18m require enhanced scrutiny post-Grenfell. Measure to top floor level.
                </p>
                {parseFloat(formData.building_height_relevant) >= 18 && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-bold text-red-900">High-rise building ≥18m</p>
                    <p className="text-xs text-red-700 mt-1">
                      Enhanced external wall system assessment required. Unknowns in this module constitute material deficiencies.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {formData.external_wall_system_applicable === 'yes' && (
          <>
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">
                External Wall Construction
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Cladding system present?
                  </label>
                  <select
                    value={formData.cladding_present}
                    onChange={(e) =>
                      setFormData({ ...formData, cladding_present: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="yes">Yes - cladding system identified</option>
                    <option value="no">No - traditional masonry/render</option>
                  </select>
                  <p className="text-xs text-neutral-500 mt-1">
                    Rainscreen cladding, composite panels, curtain walling, etc.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Insulation combustibility known?
                  </label>
                  <select
                    value={formData.insulation_combustibility_known}
                    onChange={(e) =>
                      setFormData({ ...formData, insulation_combustibility_known: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="unknown">Unknown - not verified</option>
                    <option value="yes">Yes - insulation type and class known</option>
                    <option value="no">No - assumed only</option>
                  </select>
                  <p className="text-xs text-neutral-500 mt-1">
                    Critical for buildings ≥18m. Class A1/A2-s1,d0 required for high-rise residential.
                  </p>
                </div>

                {(formData.cladding_present === 'unknown' ||
                  formData.insulation_combustibility_known === 'unknown' ||
                  formData.insulation_combustibility_known === 'no') && (
                  <button
                    onClick={() =>
                      handleQuickAction({
                        action: 'Commission external wall system information review and appraisal: obtain original construction drawings, product datasheets, and fire test certificates. Where unavailable, commission intrusive investigation to identify cladding materials, insulation type and class, cavity barriers, and fire-stopping details. Consider PAS 9980 appraisal for buildings ≥18m.',
                        likelihood: 4,
                        impact: 5,
                      })
                    }
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Quick Add: Commission external wall appraisal
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">
                Cavity Barriers & Fire Stopping
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Cavity barriers status
                  </label>
                  <select
                    value={formData.cavity_barriers_status}
                    onChange={(e) =>
                      setFormData({ ...formData, cavity_barriers_status: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="unknown">Unknown - not verified</option>
                    <option value="known">Known - surveyed and compliant</option>
                    <option value="assumed">Assumed - no verification</option>
                    <option value="inadequate">Inadequate - breaches identified</option>
                    <option value="na">N/A - no cavities</option>
                  </select>
                  <p className="text-xs text-neutral-500 mt-1">
                    Cavity barriers prevent vertical fire spread in rainscreen and cavity wall systems
                  </p>
                </div>

                {(formData.cavity_barriers_status === 'unknown' ||
                  formData.cavity_barriers_status === 'inadequate') && (
                  <button
                    onClick={() =>
                      handleQuickAction({
                        action: 'Investigate cavity barrier provision and integrity: commission intrusive survey of external wall cavities to verify presence, location, and condition of cavity barriers at compartment floor levels and around openings. Remediate any missing or damaged barriers to restore compartmentation.',
                        likelihood: 4,
                        impact: 5,
                      })
                    }
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Quick Add: Investigate cavity barriers
                  </button>
                )}

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    External openings fire stopping
                  </label>
                  <select
                    value={formData.external_openings_fire_stopping}
                    onChange={(e) =>
                      setFormData({ ...formData, external_openings_fire_stopping: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="adequate">Adequate - penetrations sealed</option>
                    <option value="inadequate">Inadequate - unsealed penetrations</option>
                  </select>
                  <p className="text-xs text-neutral-500 mt-1">
                    Services penetrating external walls at compartment boundaries
                  </p>
                </div>

                {(formData.external_openings_fire_stopping === 'unknown' ||
                  formData.external_openings_fire_stopping === 'inadequate') && (
                  <button
                    onClick={() =>
                      handleQuickAction({
                        action: 'Survey and remediate fire-stopping at external wall penetrations and openings: identify all service penetrations (mechanical, electrical, drainage) through external walls at compartment boundaries. Install appropriate fire-stopping to maintain compartmentation integrity.',
                        likelihood: 4,
                        impact: 5,
                      })
                    }
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Quick Add: Survey external penetrations
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">
                Balconies & Fire Spread Routes
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Balconies present?
                  </label>
                  <select
                    value={formData.balconies_present}
                    onChange={(e) =>
                      setFormData({ ...formData, balconies_present: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="yes">Yes - balconies present</option>
                    <option value="no">No</option>
                  </select>
                  <p className="text-xs text-neutral-500 mt-1">
                    Consider balcony stacking, combustible furniture, and vertical fire spread risk
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Fire spread routes description
                  </label>
                  <textarea
                    value={formData.fire_spread_routes_notes}
                    onChange={(e) =>
                      setFormData({ ...formData, fire_spread_routes_notes: e.target.value })
                    }
                    placeholder="Describe potential external fire spread routes: window-to-window, balcony stacking, cladding pathways, combustible materials on facades, separation distances..."
                    rows={3}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">
                External Wall System Appraisal
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    PAS 9980 or equivalent appraisal status
                  </label>
                  <select
                    value={formData.pas9980_or_equivalent_appraisal}
                    onChange={(e) =>
                      setFormData({ ...formData, pas9980_or_equivalent_appraisal: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="not_required">Not required - traditional construction or low-rise</option>
                    <option value="required">Required - not yet commissioned</option>
                    <option value="underway">Underway - appraisal in progress</option>
                    <option value="completed">Completed - appraisal on file</option>
                  </select>
                  <p className="text-xs text-neutral-500 mt-1">
                    PAS 9980 appraisals typically required for residential buildings ≥18m with external wall systems
                  </p>
                </div>

                {formData.pas9980_or_equivalent_appraisal === 'completed' && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Appraisal reference / date
                    </label>
                    <input
                      type="text"
                      value={formData.appraisal_reference}
                      onChange={(e) =>
                        setFormData({ ...formData, appraisal_reference: e.target.value })
                      }
                      placeholder="e.g., 'EWS1 dated 15/03/2024 by ABC Fire Engineers'"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                    />
                  </div>
                )}

                {(formData.pas9980_or_equivalent_appraisal === 'required' ||
                  formData.pas9980_or_equivalent_appraisal === 'unknown') && (
                  <button
                    onClick={() =>
                      handleQuickAction({
                        action: 'Confirm requirement for PAS 9980 style external wall system appraisal and commission report: engage competent fire engineer to assess external wall construction, cladding materials, insulation type, cavity barriers, and fire spread risk. Obtain formal appraisal report with recommended actions.',
                        likelihood: 4,
                        impact: 5,
                      })
                    }
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Quick Add: Commission PAS 9980 appraisal
                  </button>
                )}

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Interim measures in place
                  </label>
                  <textarea
                    value={formData.interim_measures}
                    onChange={(e) =>
                      setFormData({ ...formData, interim_measures: e.target.value })
                    }
                    placeholder="Describe any interim measures: waking watch, enhanced alarm detection, evacuation strategy changes, signage, simultaneous evacuation, stay-put modifications..."
                    rows={3}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Temporary measures pending completion of remediation works
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Additional External Fire Spread Notes
          </h3>
          <textarea
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            placeholder="Add any additional observations about external wall systems, appraisal findings, remediation works, or other relevant details..."
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
