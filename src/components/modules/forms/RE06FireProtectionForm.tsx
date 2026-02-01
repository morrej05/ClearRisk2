import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import ReRatingPanel from '../../re/ReRatingPanel';
import { HRG_MASTER_MAP } from '../../../lib/re/reference/hrgMasterMap';
import { getRating, setRating } from '../../../lib/re/scoring/riskEngineeringHelpers';

interface Document {
  id: string;
  title: string;
  document_type: string;
}

interface ModuleInstance {
  id: string;
  document_id: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
}

interface RE06FireProtectionFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

export default function RE06FireProtectionForm({
  moduleInstance,
  document,
  onSaved,
}: RE06FireProtectionFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const d = moduleInstance.data || {};

  const [formData, setFormData] = useState({
    fire_protection: d.fire_protection || {
      sprinklers: { present: null, type: '', design_standard: '', itm_notes: '', impairment_notes: '' },
      detection_alarm: { present: null, coverage_notes: '', monitoring_to_arc: null },
      hydrants: { on_site: null, coverage_notes: '', maintenance_notes: '' },
      smoke_control: { present: null, notes: '' },
      passive_protection: { notes: '' },
      water_supply: { reliability: null, primary_source: '', redundancy: '', test_history_notes: '' },
    },
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const [riskEngInstanceId, setRiskEngInstanceId] = useState<string | null>(null);
  const [riskEngData, setRiskEngData] = useState<Record<string, any>>({});
  const [industryKey, setIndustryKey] = useState<string | null>(null);

  useEffect(() => {
    async function loadRiskEngModule() {
      try {
        const { data: instances, error } = await supabase
          .from('module_instances')
          .select('id, data')
          .eq('document_id', moduleInstance.document_id)
          .eq('module_key', 'RISK_ENGINEERING')
          .single();

        if (error) throw error;

        if (instances) {
          setRiskEngInstanceId(instances.id);
          setRiskEngData(instances.data || {});
          setIndustryKey(instances.data?.industry_key || null);
        }
      } catch (err) {
        console.error('Error loading RISK_ENGINEERING module:', err);
      }
    }

    loadRiskEngModule();
  }, [moduleInstance.document_id]);

  const canonicalKey = 'safety_and_control_systems';
  const rating = getRating(riskEngData, canonicalKey);

  const getHelpText = (): string => {
    if (!industryKey) return 'Rate the overall fire protection and safety control systems for this facility.';
    const industryConfig = HRG_MASTER_MAP.industries[industryKey];
    return industryConfig?.modules?.[canonicalKey]?.help_text || 'Rate the overall fire protection and safety control systems.';
  };

  const getWeight = (): number => {
    if (!industryKey) return HRG_MASTER_MAP.meta.default_weight;
    const industryConfig = HRG_MASTER_MAP.industries[industryKey];
    return industryConfig?.modules?.[canonicalKey]?.weight || HRG_MASTER_MAP.meta.default_weight;
  };

  const handleRatingChange = async (newRating: number) => {
    if (!riskEngInstanceId) return;

    try {
      const updatedData = setRating(riskEngData, canonicalKey, newRating);
      const sanitized = sanitizeModuleInstancePayload({ data: updatedData });

      const { error } = await supabase
        .from('module_instances')
        .update({ data: sanitized.data })
        .eq('id', riskEngInstanceId);

      if (error) throw error;

      setRiskEngData(updatedData);
    } catch (err) {
      console.error('Error updating rating:', err);
      alert('Failed to update rating');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const completedAt = outcome ? new Date().toISOString() : null;
      const sanitized = sanitizeModuleInstancePayload({ data: formData });

      const { error } = await supabase
        .from('module_instances')
        .update({
          data: sanitized.data,
          outcome: outcome || null,
          assessor_notes: assessorNotes,
          completed_at: completedAt,
        })
        .eq('id', moduleInstance.id);

      if (error) throw error;
      onSaved();
    } catch (error) {
      console.error('Error saving module:', error);
      alert('Failed to save module. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-4 - Fire Protection</h2>
        <p className="text-slate-600">Active and passive fire protection systems assessment</p>
      </div>

      <div className="mb-6">
        <ReRatingPanel
          canonicalKey={canonicalKey}
          industryKey={industryKey}
          rating={rating}
          onChangeRating={handleRatingChange}
          helpText={getHelpText()}
          weight={getWeight()}
        />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Sprinkler System</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Sprinklers Present</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={formData.fire_protection.sprinklers.present === true}
                    onChange={() => setFormData({
                      ...formData,
                      fire_protection: { ...formData.fire_protection, sprinklers: { ...formData.fire_protection.sprinklers, present: true } }
                    })}
                    className="mr-2"
                  />
                  Yes
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={formData.fire_protection.sprinklers.present === false}
                    onChange={() => setFormData({
                      ...formData,
                      fire_protection: { ...formData.fire_protection, sprinklers: { ...formData.fire_protection.sprinklers, present: false } }
                    })}
                    className="mr-2"
                  />
                  No
                </label>
              </div>
            </div>
            {formData.fire_protection.sprinklers.present && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <input
                    type="text"
                    value={formData.fire_protection.sprinklers.type}
                    onChange={(e) => setFormData({
                      ...formData,
                      fire_protection: { ...formData.fire_protection, sprinklers: { ...formData.fire_protection.sprinklers, type: e.target.value } }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="e.g., Wet pipe, ESFR"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Design Standard</label>
                  <input
                    type="text"
                    value={formData.fire_protection.sprinklers.design_standard}
                    onChange={(e) => setFormData({
                      ...formData,
                      fire_protection: { ...formData.fire_protection, sprinklers: { ...formData.fire_protection.sprinklers, design_standard: e.target.value } }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="e.g., NFPA 13, BS EN 12845"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">ITM Notes</label>
                  <textarea
                    value={formData.fire_protection.sprinklers.itm_notes}
                    onChange={(e) => setFormData({
                      ...formData,
                      fire_protection: { ...formData.fire_protection, sprinklers: { ...formData.fire_protection.sprinklers, itm_notes: e.target.value } }
                    })}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="Inspection, testing, and maintenance notes"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Detection & Alarm</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Detection System Present</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={formData.fire_protection.detection_alarm.present === true}
                    onChange={() => setFormData({
                      ...formData,
                      fire_protection: { ...formData.fire_protection, detection_alarm: { ...formData.fire_protection.detection_alarm, present: true } }
                    })}
                    className="mr-2"
                  />
                  Yes
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={formData.fire_protection.detection_alarm.present === false}
                    onChange={() => setFormData({
                      ...formData,
                      fire_protection: { ...formData.fire_protection, detection_alarm: { ...formData.fire_protection.detection_alarm, present: false } }
                    })}
                    className="mr-2"
                  />
                  No
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Coverage Notes</label>
              <textarea
                value={formData.fire_protection.detection_alarm.coverage_notes}
                onChange={(e) => setFormData({
                  ...formData,
                  fire_protection: { ...formData.fire_protection, detection_alarm: { ...formData.fire_protection.detection_alarm, coverage_notes: e.target.value } }
                })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Water Supply</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Primary Source</label>
              <input
                type="text"
                value={formData.fire_protection.water_supply.primary_source}
                onChange={(e) => setFormData({
                  ...formData,
                  fire_protection: { ...formData.fire_protection, water_supply: { ...formData.fire_protection.water_supply, primary_source: e.target.value } }
                })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="e.g., Municipal mains, onsite tanks"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Redundancy</label>
              <textarea
                value={formData.fire_protection.water_supply.redundancy}
                onChange={(e) => setFormData({
                  ...formData,
                  fire_protection: { ...formData.fire_protection, water_supply: { ...formData.fire_protection.water_supply, redundancy: e.target.value } }
                })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Describe backup water supplies or redundancy measures"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Passive Fire Protection</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={formData.fire_protection.passive_protection.notes}
              onChange={(e) => setFormData({
                ...formData,
                fire_protection: { ...formData.fire_protection, passive_protection: { notes: e.target.value } }
              })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              placeholder="Fire walls, barriers, compartmentation, fire-rated doors and penetrations"
            />
          </div>
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
        <ModuleActions documentId={document.id} moduleInstanceId={moduleInstance.id} />
      )}
    </div>
  );
}
