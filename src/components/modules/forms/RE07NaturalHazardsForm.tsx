import { useState, useEffect } from 'react';
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

interface RE07NaturalHazardsFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

const HAZARD_LABELS: Record<string, string> = {
  flood: 'Flood',
  wind: 'Wind/Storm',
  quake: 'Earthquake',
  wildfire: 'Wildfire',
  lightning: 'Lightning',
  subsidence: 'Subsidence',
};

const DEFAULT_HAZARDS = [
  { key: 'flood', exposure: '', controls: '', notes: '' },
  { key: 'wind', exposure: '', controls: '', notes: '' },
  { key: 'quake', exposure: '', controls: '', notes: '' },
  { key: 'wildfire', exposure: '', controls: '', notes: '' },
  { key: 'lightning', exposure: '', controls: '', notes: '' },
  { key: 'subsidence', exposure: '', controls: '', notes: '' },
];

export default function RE07NaturalHazardsForm({
  moduleInstance,
  document,
  onSaved,
}: RE07NaturalHazardsFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const d = moduleInstance.data || {};

  const safeHazards = Array.isArray(d.hazards) ? d.hazards : DEFAULT_HAZARDS;

  const [formData, setFormData] = useState({
    ratings: d.ratings || { site_rating_1_5: null, site_rating_notes: '' },
    hazards: safeHazards,
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  useEffect(() => {
    const healData = async () => {
      if (d.hazards !== undefined && !Array.isArray(d.hazards)) {
        console.warn('RE07: Healing non-array hazards data');
        try {
          const sanitized = sanitizeModuleInstancePayload({
            data: {
              ...d,
              hazards: DEFAULT_HAZARDS
            }
          });

          await supabase
            .from('module_instances')
            .update({ data: sanitized.data })
            .eq('id', moduleInstance.id);
        } catch (error) {
          console.error('Error healing hazards data:', error);
        }
      }
    };

    healData();
  }, []);

  const updateHazard = (key: string, field: string, value: string) => {
    const hazards = Array.isArray(formData?.hazards) ? formData.hazards : [];
    setFormData({
      ...formData,
      hazards: hazards.map((h: any) =>
        h.key === key ? { ...h, [field]: value } : h
      ),
    });
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
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-5 - Natural Hazards</h2>
        <p className="text-slate-600">Natural hazards exposure and controls assessment</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Site Rating</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Overall Natural Hazards Rating (1-5)</label>
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
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Hazard Assessment</h3>
          <div className="space-y-6">
            {(() => {
              const hazards = Array.isArray(formData?.hazards) ? formData.hazards : [];
              return hazards.map((hazard: any) => (
                <div key={hazard.key} className="border border-slate-200 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 mb-3">{HAZARD_LABELS[hazard.key]}</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Exposure</label>
                      <input
                        type="text"
                        value={hazard.exposure}
                        onChange={(e) => updateHazard(hazard.key, 'exposure', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="e.g., Low, Medium, High"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Controls</label>
                      <input
                        type="text"
                        value={hazard.controls}
                        onChange={(e) => updateHazard(hazard.key, 'controls', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="Describe existing controls or mitigation measures"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                      <textarea
                        value={hazard.notes}
                        onChange={(e) => updateHazard(hazard.key, 'notes', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="Additional notes and observations"
                      />
                    </div>
                  </div>
                </div>
              ));
            })()}
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
