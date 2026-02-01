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

interface RE03OccupancyFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

export default function RE03OccupancyForm({
  moduleInstance,
  document,
  onSaved,
}: RE03OccupancyFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const d = moduleInstance.data || {};

  const [formData, setFormData] = useState({
    ratings: d.ratings || { site_rating_1_5: null, site_rating_notes: '' },
    occupancy_overview: d.occupancy_overview || {
      industry_key: null,
      process_overview: '',
      operating_hours: '',
      headcount: null,
      critical_dependencies: [],
    },
    special_hazards: d.special_hazards || {
      rating_1_5: null,
      notes: '',
      hazard_types: [
        { type: 'ignitable_liquids', present: null, details: '' },
        { type: 'flammable_gases_chemicals', present: null, details: '' },
        { type: 'dusts_explosive_atmospheres', present: null, details: '' },
        { type: 'specialised_industrial_equipment', present: null, details: '' },
        { type: 'emerging_risks', present: null, details: '' },
      ],
      custom_items: [],
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
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-3 - Occupancy</h2>
        <p className="text-slate-600">Occupancy classification and special hazards assessment</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Site Rating</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Overall Occupancy Rating (1-5)</label>
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
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Occupancy Overview</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Process Overview</label>
              <textarea
                value={formData.occupancy_overview.process_overview}
                onChange={(e) => setFormData({
                  ...formData,
                  occupancy_overview: { ...formData.occupancy_overview, process_overview: e.target.value }
                })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Describe the primary processes and operations at this site"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Operating Hours</label>
                <input
                  type="text"
                  value={formData.occupancy_overview.operating_hours}
                  onChange={(e) => setFormData({
                    ...formData,
                    occupancy_overview: { ...formData.occupancy_overview, operating_hours: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="e.g., 24/7, Mon-Fri 9-5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Headcount</label>
                <input
                  type="number"
                  value={formData.occupancy_overview.headcount || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    occupancy_overview: { ...formData.occupancy_overview, headcount: e.target.value ? parseInt(e.target.value) : null }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Special Hazards</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Special Hazards Rating (1-5)</label>
            <RatingRadio
              value={formData.special_hazards.rating_1_5}
              onChange={(value) => setFormData({
                ...formData,
                special_hazards: { ...formData.special_hazards, rating_1_5: value }
              })}
              name="special_hazards_rating"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Special Hazards Notes</label>
            <textarea
              value={formData.special_hazards.notes}
              onChange={(e) => setFormData({
                ...formData,
                special_hazards: { ...formData.special_hazards, notes: e.target.value }
              })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              placeholder="Document any special hazards, processes, or risk factors"
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
