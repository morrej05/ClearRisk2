import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import RatingRadio from '../../RatingRadio';

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
    ratings: d.ratings || { site_rating_1_5: null, site_rating_notes: '' },
    systems: d.systems || {
      sprinklers: { present: null, type: '', design_standard: '', itm_notes: '', impairment_notes: '' },
      detection_alarm: { present: null, coverage_notes: '', monitoring_to_arc: null },
      hydrants: { on_site: null, coverage_notes: '', maintenance_notes: '' },
      smoke_control: { present: null, notes: '' },
      passive_protection: { notes: '' },
    },
    water_supply: d.water_supply || {
      reliability: null,
      primary_source: '',
      redundancy: '',
      test_history_notes: '',
    },
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

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

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Site Rating</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Overall Fire Protection Rating (1-5)</label>
            <RatingRadio
              value={formData.ratings.site_rating_1_5}
              onChange={(value) => setFormData({ ...formData, ratings: { ...formData.ratings, site_rating_1_5: value } })}
              name="site_rating"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Rating Notes</label>
            <textarea
              value={formData.ratings.site_rating_notes}
              onChange={(e) => setFormData({ ...formData, ratings: { ...formData.ratings, site_rating_notes: e.target.value } })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Sprinkler System</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Sprinklers Present</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={formData.systems.sprinklers.present === true}
                    onChange={() => setFormData({
                      ...formData,
                      systems: { ...formData.systems, sprinklers: { ...formData.systems.sprinklers, present: true } }
                    })}
                    className="mr-2"
                  />
                  Yes
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={formData.systems.sprinklers.present === false}
                    onChange={() => setFormData({
                      ...formData,
                      systems: { ...formData.systems, sprinklers: { ...formData.systems.sprinklers, present: false } }
                    })}
                    className="mr-2"
                  />
                  No
                </label>
              </div>
            </div>
            {formData.systems.sprinklers.present && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <input
                    type="text"
                    value={formData.systems.sprinklers.type}
                    onChange={(e) => setFormData({
                      ...formData,
                      systems: { ...formData.systems, sprinklers: { ...formData.systems.sprinklers, type: e.target.value } }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="e.g., Wet pipe, ESFR"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Design Standard</label>
                  <input
                    type="text"
                    value={formData.systems.sprinklers.design_standard}
                    onChange={(e) => setFormData({
                      ...formData,
                      systems: { ...formData.systems, sprinklers: { ...formData.systems.sprinklers, design_standard: e.target.value } }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="e.g., NFPA 13, BS EN 12845"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">ITM Notes</label>
                  <textarea
                    value={formData.systems.sprinklers.itm_notes}
                    onChange={(e) => setFormData({
                      ...formData,
                      systems: { ...formData.systems, sprinklers: { ...formData.systems.sprinklers, itm_notes: e.target.value } }
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
                    checked={formData.systems.detection_alarm.present === true}
                    onChange={() => setFormData({
                      ...formData,
                      systems: { ...formData.systems, detection_alarm: { ...formData.systems.detection_alarm, present: true } }
                    })}
                    className="mr-2"
                  />
                  Yes
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={formData.systems.detection_alarm.present === false}
                    onChange={() => setFormData({
                      ...formData,
                      systems: { ...formData.systems, detection_alarm: { ...formData.systems.detection_alarm, present: false } }
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
                value={formData.systems.detection_alarm.coverage_notes}
                onChange={(e) => setFormData({
                  ...formData,
                  systems: { ...formData.systems, detection_alarm: { ...formData.systems.detection_alarm, coverage_notes: e.target.value } }
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
                value={formData.water_supply.primary_source}
                onChange={(e) => setFormData({
                  ...formData,
                  water_supply: { ...formData.water_supply, primary_source: e.target.value }
                })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="e.g., Municipal mains, onsite tanks"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Redundancy</label>
              <textarea
                value={formData.water_supply.redundancy}
                onChange={(e) => setFormData({
                  ...formData,
                  water_supply: { ...formData.water_supply, redundancy: e.target.value }
                })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Describe backup water supplies or redundancy measures"
              />
            </div>
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
