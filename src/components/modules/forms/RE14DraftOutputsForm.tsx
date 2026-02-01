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

interface RE14DraftOutputsFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

export default function RE14DraftOutputsForm({
  moduleInstance,
  document,
  onSaved,
}: RE14DraftOutputsFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const d = moduleInstance.data || {};

  const [formData, setFormData] = useState({
    draft_survey_report: d.draft_survey_report || { content: '' },
    draft_loss_prevention_report: d.draft_loss_prevention_report || { content: '' },
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
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-10 - Draft Outputs</h2>
        <p className="text-slate-600">Draft report content and executive summaries</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Draft Survey Report</h3>
          <p className="text-sm text-slate-600 mb-3">
            Use this space to draft key report sections, executive summary, or narrative content.
          </p>
          <textarea
            value={formData.draft_survey_report.content}
            onChange={(e) => setFormData({
              ...formData,
              draft_survey_report: { content: e.target.value }
            })}
            rows={12}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
            placeholder="Draft survey report content..."
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Draft Loss Prevention Report</h3>
          <p className="text-sm text-slate-600 mb-3">
            Draft content specific to loss prevention recommendations and risk mitigation strategies.
          </p>
          <textarea
            value={formData.draft_loss_prevention_report.content}
            onChange={(e) => setFormData({
              ...formData,
              draft_loss_prevention_report: { content: e.target.value }
            })}
            rows={12}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
            placeholder="Draft loss prevention report content..."
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> This module is for working drafts. Final reports are generated from the structured
            data entered in other modules. Use this space for narrative content, executive summaries, and custom sections.
          </p>
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
