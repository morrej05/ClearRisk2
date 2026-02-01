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

interface RE09ManagementFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  housekeeping: 'Housekeeping',
  hot_work: 'Hot Work Controls',
  impairment_management: 'Impairment Management',
  contractor_control: 'Contractor Control',
  maintenance: 'Maintenance Programs',
  emergency_planning: 'Emergency Planning',
  change_management: 'Change Management',
};

export default function RE09ManagementForm({
  moduleInstance,
  document,
  onSaved,
}: RE09ManagementFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const d = moduleInstance.data || {};

  const [formData, setFormData] = useState({
    ratings: d.ratings || { site_rating_1_5: null, site_rating_notes: '' },
    categories: d.categories || [
      { key: 'housekeeping', rating_1_5: null, notes: '' },
      { key: 'hot_work', rating_1_5: null, notes: '' },
      { key: 'impairment_management', rating_1_5: null, notes: '' },
      { key: 'contractor_control', rating_1_5: null, notes: '' },
      { key: 'maintenance', rating_1_5: null, notes: '' },
      { key: 'emergency_planning', rating_1_5: null, notes: '' },
      { key: 'change_management', rating_1_5: null, notes: '' },
    ],
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const updateCategory = (key: string, field: string, value: any) => {
    setFormData({
      ...formData,
      categories: formData.categories.map((c: any) =>
        c.key === key ? { ...c, [field]: value } : c
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
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-7 - Management Systems</h2>
        <p className="text-slate-600">Assessment of operational management and control systems</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Site Rating</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Overall Management Systems Rating (1-5)</label>
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
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Management Categories</h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-900">
              <strong>Rating Guidance:</strong> Rate each category 1–5 where 1 is excellent and 5 is poor/inadequate.
              Poor ratings should typically trigger recommendations for improvement.
            </p>
          </div>
          <div className="space-y-6">
            {formData.categories.map((category: any) => (
              <div key={category.key} className="border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-3">{CATEGORY_LABELS[category.key]}</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Rating (1-5)</label>
                    <RatingRadio
                      value={category.rating_1_5}
                      onChange={(value) => updateCategory(category.key, 'rating_1_5', value)}
                      name={`category_${category.key}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                    <textarea
                      value={category.notes}
                      onChange={(e) => updateCategory(category.key, 'notes', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      placeholder="Describe current practices, gaps, and observations"
                    />
                  </div>
                </div>
              </div>
            ))}
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
