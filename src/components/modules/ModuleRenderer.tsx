import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getModuleName } from '../../lib/modules/moduleCatalog';
import A1DocumentControlForm from './forms/A1DocumentControlForm';
import OutcomePanel from './OutcomePanel';
import ModuleActions from './ModuleActions';

interface Document {
  id: string;
  document_type: string;
  title: string;
  assessment_date: string;
  assessor_name: string | null;
  assessor_role: string | null;
  responsible_person: string | null;
  scope_description: string | null;
  limitations_assumptions: string | null;
  standards_selected: string[];
}

interface ModuleInstance {
  id: string;
  module_key: string;
  outcome: string | null;
  completed_at: string | null;
  assessor_notes: string;
  data: Record<string, any>;
  updated_at: string;
}

interface ModuleRendererProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

export default function ModuleRenderer({
  moduleInstance,
  document,
  onSaved,
}: ModuleRendererProps) {
  if (moduleInstance.module_key === 'A1_DOC_CONTROL') {
    return (
      <>
        <A1DocumentControlForm
          moduleInstance={moduleInstance}
          document={document}
          onSaved={onSaved}
        />
        <div className="px-6 pb-6 max-w-5xl mx-auto">
          <ModuleActions
            documentId={document.id}
            moduleInstanceId={moduleInstance.id}
          />
        </div>
      </>
    );
  }

  return <PlaceholderModuleForm moduleInstance={moduleInstance} document={document} onSaved={onSaved} />;
}

function PlaceholderModuleForm({
  moduleInstance,
  document,
  onSaved,
}: ModuleRendererProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const completedAt =
        outcome && outcome !== 'info_gap' ? new Date().toISOString() : null;

      const { error } = await supabase
        .from('module_instances')
        .update({
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
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">
          {getModuleName(moduleInstance.module_key)}
        </h2>
        <p className="text-neutral-600">
          Module editor coming soon
        </p>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
        <div className="flex items-start gap-4 mb-4">
          <AlertCircle className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-bold text-neutral-900 mb-2">
              Module Editor Under Construction
            </h3>
            <p className="text-neutral-600 mb-4">
              The detailed form for this module is being developed. For now, you can:
            </p>
            <ul className="list-disc list-inside space-y-1 text-neutral-600 text-sm">
              <li>Set the module outcome below</li>
              <li>Add assessor notes</li>
              <li>Create actions that need to be addressed</li>
              <li>Mark the module as complete</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-neutral-200">
          <p className="text-sm text-neutral-500">
            <strong>Module Key:</strong> {moduleInstance.module_key}
          </p>
          <p className="text-sm text-neutral-500 mt-1">
            <strong>Document Type:</strong> {document.document_type}
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

      <ModuleActions
        documentId={document.id}
        moduleInstanceId={moduleInstance.id}
      />
    </div>
  );
}
