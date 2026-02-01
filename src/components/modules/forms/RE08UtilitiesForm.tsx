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

interface RE08UtilitiesFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

export default function RE08UtilitiesForm({
  moduleInstance,
  document,
  onSaved,
}: RE08UtilitiesFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const d = moduleInstance.data || {};

  const [formData, setFormData] = useState({
    ratings: d.ratings || { site_rating_1_5: null, site_rating_notes: '' },
    power_resilience: d.power_resilience || {
      notes: '',
      backup_power_present: null,
      generator_capacity_notes: '',
    },
    shutdown_strategy: d.shutdown_strategy || { notes: '' },
    critical_services: d.critical_services || {
      fuel_gas: { present: null, notes: '' },
      refrigeration: { present: null, notes: '' },
      compressed_air_steam: { present: null, notes: '' },
      water_supplies: { present: null, notes: '' },
    },
    single_points_of_failure: d.single_points_of_failure || [],
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
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-6 - Utilities & Critical Services</h2>
        <p className="text-slate-600">Assessment of power, utilities, and critical service dependencies</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Site Rating</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Overall Utilities Rating (1-5)</label>
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
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Power Resilience</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Backup Power Present</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={formData.power_resilience.backup_power_present === true}
                    onChange={() => setFormData({
                      ...formData,
                      power_resilience: { ...formData.power_resilience, backup_power_present: true }
                    })}
                    className="mr-2"
                  />
                  Yes
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={formData.power_resilience.backup_power_present === false}
                    onChange={() => setFormData({
                      ...formData,
                      power_resilience: { ...formData.power_resilience, backup_power_present: false }
                    })}
                    className="mr-2"
                  />
                  No
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Power Resilience Notes</label>
              <textarea
                value={formData.power_resilience.notes}
                onChange={(e) => setFormData({
                  ...formData,
                  power_resilience: { ...formData.power_resilience, notes: e.target.value }
                })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Describe power supply arrangements, redundancy, and backup systems"
              />
            </div>
            {formData.power_resilience.backup_power_present && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Generator Capacity Notes</label>
                <textarea
                  value={formData.power_resilience.generator_capacity_notes}
                  onChange={(e) => setFormData({
                    ...formData,
                    power_resilience: { ...formData.power_resilience, generator_capacity_notes: e.target.value }
                  })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="Generator capacity, fuel supply, and load coverage"
                />
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Critical Services</h3>
          <div className="space-y-4">
            {Object.entries(formData.critical_services).map(([key, service]: [string, any]) => (
              <div key={key} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-slate-900 capitalize">
                    {key.replace(/_/g, ' ')}
                  </h4>
                  <div className="flex gap-4">
                    <label className="flex items-center text-sm">
                      <input
                        type="radio"
                        checked={service.present === true}
                        onChange={() => setFormData({
                          ...formData,
                          critical_services: {
                            ...formData.critical_services,
                            [key]: { ...service, present: true }
                          }
                        })}
                        className="mr-2"
                      />
                      Present
                    </label>
                    <label className="flex items-center text-sm">
                      <input
                        type="radio"
                        checked={service.present === false}
                        onChange={() => setFormData({
                          ...formData,
                          critical_services: {
                            ...formData.critical_services,
                            [key]: { ...service, present: false }
                          }
                        })}
                        className="mr-2"
                      />
                      Not Present
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea
                    value={service.notes}
                    onChange={(e) => setFormData({
                      ...formData,
                      critical_services: {
                        ...formData.critical_services,
                        [key]: { ...service, notes: e.target.value }
                      }
                    })}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Shutdown Strategy</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Emergency Shutdown Notes</label>
            <textarea
              value={formData.shutdown_strategy.notes}
              onChange={(e) => setFormData({
                ...formData,
                shutdown_strategy: { ...formData.shutdown_strategy, notes: e.target.value }
              })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              placeholder="Describe emergency shutdown procedures and critical process isolation"
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
