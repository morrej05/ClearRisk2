import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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

interface RE02ConstructionFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

export default function RE02ConstructionForm({
  moduleInstance,
  document,
  onSaved,
}: RE02ConstructionFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const d = moduleInstance.data || {};

  const [formData, setFormData] = useState({
    ratings: d.ratings || { site_rating_1_5: null, site_rating_notes: '' },
    buildings: d.buildings || [],
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const addBuilding = () => {
    setFormData({
      ...formData,
      buildings: [
        ...formData.buildings,
        {
          id: Date.now().toString(),
          name: '',
          frame: '',
          roof_ceiling: '',
          walls: '',
          combustibility_score: null,
          notes: '',
        },
      ],
    });
  };

  const removeBuilding = (id: string) => {
    setFormData({
      ...formData,
      buildings: formData.buildings.filter((b: any) => b.id !== id),
    });
  };

  const updateBuilding = (id: string, field: string, value: any) => {
    setFormData({
      ...formData,
      buildings: formData.buildings.map((b: any) =>
        b.id === id ? { ...b, [field]: value } : b
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
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-2 - Construction</h2>
        <p className="text-slate-600">Building construction elements and combustibility assessment</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Site Rating</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Overall Construction Rating (1-5)</label>
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Buildings</h3>
            <button
              onClick={addBuilding}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-900 text-white rounded-md hover:bg-slate-800"
            >
              <Plus className="w-4 h-4" />
              Add Building
            </button>
          </div>

          {formData.buildings.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
              <p className="text-slate-600">No buildings added yet. Click &quot;Add Building&quot; to start.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {formData.buildings.map((building: any) => (
                <div key={building.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-4">
                    <input
                      type="text"
                      value={building.name}
                      onChange={(e) => updateBuilding(building.id, 'name', e.target.value)}
                      placeholder="Building name"
                      className="text-lg font-semibold border-0 border-b border-slate-300 focus:border-slate-900 outline-none"
                    />
                    <button
                      onClick={() => removeBuilding(building.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Frame</label>
                      <input
                        type="text"
                        value={building.frame}
                        onChange={(e) => updateBuilding(building.id, 'frame', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Roof/Ceiling</label>
                      <input
                        type="text"
                        value={building.roof_ceiling}
                        onChange={(e) => updateBuilding(building.id, 'roof_ceiling', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Walls</label>
                      <input
                        type="text"
                        value={building.walls}
                        onChange={(e) => updateBuilding(building.id, 'walls', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                    <textarea
                      value={building.notes}
                      onChange={(e) => updateBuilding(building.id, 'notes', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
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
