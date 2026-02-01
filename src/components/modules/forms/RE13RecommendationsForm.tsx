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

interface RE13RecommendationsFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

export default function RE13RecommendationsForm({
  moduleInstance,
  document,
  onSaved,
}: RE13RecommendationsFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const d = moduleInstance.data || {};

  const [formData, setFormData] = useState({
    settings: d.settings || {
      numbering_prefix: '',
      numbering_includes_year_month: true,
      max_images_per_recommendation: 3,
    },
    summary_table: d.summary_table || [],
    report_tail_uploads: d.report_tail_uploads || {
      site_images: [],
      site_plans_process_drawings: [],
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
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-9 - Recommendations</h2>
        <p className="text-slate-600">Recommendation settings and summary</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Recommendation Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Numbering Prefix (optional)
              </label>
              <input
                type="text"
                value={formData.settings.numbering_prefix}
                onChange={(e) => setFormData({
                  ...formData,
                  settings: { ...formData.settings, numbering_prefix: e.target.value }
                })}
                className="w-full max-w-xs px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="e.g., REC, ACT"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="include_year_month"
                checked={formData.settings.numbering_includes_year_month}
                onChange={(e) => setFormData({
                  ...formData,
                  settings: { ...formData.settings, numbering_includes_year_month: e.target.checked }
                })}
                className="rounded border-slate-300"
              />
              <label htmlFor="include_year_month" className="text-sm font-medium text-slate-700">
                Include year/month in recommendation numbers
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Maximum Images per Recommendation
              </label>
              <input
                type="number"
                value={formData.settings.max_images_per_recommendation}
                onChange={(e) => setFormData({
                  ...formData,
                  settings: { ...formData.settings, max_images_per_recommendation: parseInt(e.target.value) || 3 }
                })}
                className="w-full max-w-xs px-3 py-2 border border-slate-300 rounded-md text-sm"
                min="0"
                max="10"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Summary</h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              Recommendations are managed through the Action Register. This module configures how recommendations
              are numbered and displayed in reports. View and manage specific recommendations in the Action Register tab.
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Report Attachments</h3>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-sm text-slate-600 mb-2">
              Site images and drawings can be attached via the Evidence tab to be included in the final report appendices.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-sm font-medium text-slate-700">Site Images</p>
                <p className="text-xs text-slate-500 mt-1">
                  {formData.report_tail_uploads.site_images?.length || 0} images attached
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Site Plans & Drawings</p>
                <p className="text-xs text-slate-500 mt-1">
                  {formData.report_tail_uploads.site_plans_process_drawings?.length || 0} files attached
                </p>
              </div>
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
