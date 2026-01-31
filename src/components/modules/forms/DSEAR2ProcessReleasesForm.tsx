import { useState } from 'react';
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import AutoExpandTextarea from '../../AutoExpandTextarea';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';

interface ProcessDescription {
  activity: string;
  normal_operation: string;
  abnormal_operation: string;
  release_sources: string;
  grade_of_release: string;
  ventilation_type: string;
}

interface ModuleInstance {
  id: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
}

interface Document {
  id: string;
  title: string;
}

interface Props {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

const emptyProcess = (): ProcessDescription => ({
  activity: '',
  normal_operation: '',
  abnormal_operation: '',
  release_sources: '',
  grade_of_release: '',
  ventilation_type: ''
});

export default function DSEAR2ProcessReleasesForm({
  moduleInstance,
  document,
  onSaved
}: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [processes, setProcesses] = useState<ProcessDescription[]>(
    moduleInstance.data.process_descriptions?.length > 0 ? moduleInstance.data.process_descriptions : [emptyProcess()]
  );

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const addProcess = () => {
    setProcesses([...processes, emptyProcess()]);
  };

  const removeProcess = (index: number) => {
    setProcesses(processes.filter((_, i) => i !== index));
  };

  const updateProcess = (index: number, field: keyof ProcessDescription, value: string) => {
    const updated = [...processes];
    updated[index] = { ...updated[index], [field]: value };
    setProcesses(updated);
  };

  const getSuggestedOutcome = () => {
    const hasUnknowns = processes.some(p =>
      p.activity && (p.grade_of_release === 'unknown' || p.ventilation_type === 'unknown')
    );

    if (hasUnknowns) {
      return 'info_gap';
    }

    const hasContinuousRelease = processes.some(p =>
      p.grade_of_release === 'continuous'
    );

    if (hasContinuousRelease) {
      return 'material_def';
    }

    return 'compliant';
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = sanitizeModuleInstancePayload({
        data: { process_descriptions: processes },
        outcome,
        assessor_notes: assessorNotes,
        updated_at: new Date().toISOString(),
      });

      const { error } = await supabase
        .from('module_instances')
        .update(payload)
        .eq('id', moduleInstance.id);

      if (error) throw error;

      const now = new Date().toLocaleTimeString();
      setLastSaved(now);
      onSaved();
    } catch (error) {
      console.error('Error saving module:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">
          DSEAR-2 - Process & Release Assessment
        </h2>
        <p className="text-neutral-600">
          Identify processes and activities that could release dangerous substances
        </p>
        {lastSaved && (
          <div className="flex items-center gap-2 mt-2 text-sm text-green-700">
            <CheckCircle className="w-4 h-4" />
            Last saved at {lastSaved}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">Purpose</h3>
        <p className="text-sm text-blue-800">
          Identify processes and activities that could release dangerous substances and form explosive atmospheres.
          Document release sources, grade of release (continuous, primary, secondary) and ventilation provisions.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Process & Release Assessment</h3>
          <button
            onClick={addProcess}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Process
          </button>
        </div>

        {processes.map((process, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4 bg-white">
            <div className="flex items-start justify-between">
              <h4 className="font-semibold text-gray-900">Process {index + 1}</h4>
              {processes.length > 1 && (
                <button
                  onClick={() => removeProcess(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Activity/Process Description *
                </label>
                <AutoExpandTextarea
                  value={process.activity}
                  onChange={(e) => updateProcess(index, 'activity', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., Decanting solvents, Spray painting, Milling wood"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Normal Operation?
                  </label>
                  <select
                    value={process.normal_operation}
                    onChange={(e) => updateProcess(index, 'normal_operation', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select...</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Abnormal Operation?
                  </label>
                  <select
                    value={process.abnormal_operation}
                    onChange={(e) => updateProcess(index, 'abnormal_operation', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select...</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Release Sources
                </label>
                <AutoExpandTextarea
                  value={process.release_sources}
                  onChange={(e) => updateProcess(index, 'release_sources', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., Drum lid, pump seals, open vessel, dust generation"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Grade of Release
                  </label>
                  <select
                    value={process.grade_of_release}
                    onChange={(e) => updateProcess(index, 'grade_of_release', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select...</option>
                    <option value="continuous">Continuous</option>
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="unknown">Unknown</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Continuous: release expected continuously/long periods. Primary: expected periodically/occasionally.
                    Secondary: not expected, only due to malfunction.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ventilation Type
                  </label>
                  <select
                    value={process.ventilation_type}
                    onChange={(e) => updateProcess(index, 'ventilation_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select...</option>
                    <option value="natural">Natural</option>
                    <option value="mechanical">Mechanical (LEV/MEV)</option>
                    <option value="none">None</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <OutcomePanel
        outcome={outcome}
        assessorNotes={assessorNotes}
        onOutcomeChange={setOutcome}
        onNotesChange={setAssessorNotes}
        onSave={handleSave}
        isSaving={isSaving}
        suggestedOutcome={getSuggestedOutcome()}
      />

      {document?.id && moduleInstance?.id && (


        <ModuleActions


          key={actionsRefreshKey}


          documentId={document.id}


          moduleInstanceId={moduleInstance.id}


        />


      )}
    </div>
  );
}
