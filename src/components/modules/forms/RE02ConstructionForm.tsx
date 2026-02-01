import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';

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
    construction: d.construction || {
      primary_structure: '',
      roof: '',
      walls: '',
      compartmentation: '',
      fire_stopping: '',
      cladding: '',
      voids: '',
      comments: '',
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
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-2 - Construction</h2>
        <p className="text-slate-600">Building construction elements assessment</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Construction Details</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Primary Structure</label>
              <input
                type="text"
                value={formData.construction.primary_structure}
                onChange={(e) => setFormData({
                  ...formData,
                  construction: { ...formData.construction, primary_structure: e.target.value }
                })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="e.g., Steel frame, Reinforced concrete"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Roof</label>
              <input
                type="text"
                value={formData.construction.roof}
                onChange={(e) => setFormData({
                  ...formData,
                  construction: { ...formData.construction, roof: e.target.value }
                })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="e.g., Metal deck, Concrete slab"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Walls</label>
              <input
                type="text"
                value={formData.construction.walls}
                onChange={(e) => setFormData({
                  ...formData,
                  construction: { ...formData.construction, walls: e.target.value }
                })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="e.g., Masonry, Metal panels"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Compartmentation</label>
              <input
                type="text"
                value={formData.construction.compartmentation}
                onChange={(e) => setFormData({
                  ...formData,
                  construction: { ...formData.construction, compartmentation: e.target.value }
                })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Describe fire compartmentation strategy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fire Stopping</label>
              <input
                type="text"
                value={formData.construction.fire_stopping}
                onChange={(e) => setFormData({
                  ...formData,
                  construction: { ...formData.construction, fire_stopping: e.target.value }
                })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Describe fire stopping measures"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cladding</label>
              <input
                type="text"
                value={formData.construction.cladding}
                onChange={(e) => setFormData({
                  ...formData,
                  construction: { ...formData.construction, cladding: e.target.value }
                })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="External cladding materials"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Voids</label>
              <input
                type="text"
                value={formData.construction.voids}
                onChange={(e) => setFormData({
                  ...formData,
                  construction: { ...formData.construction, voids: e.target.value }
                })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Concealed spaces and void protection"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Comments</label>
              <textarea
                value={formData.construction.comments}
                onChange={(e) => setFormData({
                  ...formData,
                  construction: { ...formData.construction, comments: e.target.value }
                })}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Additional observations and notes"
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
