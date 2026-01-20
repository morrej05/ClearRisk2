import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import AutoExpandTextarea from '../../AutoExpandTextarea';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';

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

const IGNITION_SOURCES = [
  'electrical',
  'static',
  'hot_work',
  'mechanical',
  'other'
];

export default function DSEAR4IgnitionSourcesForm({
  moduleInstance,
  document,
  onSaved
}: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [ignitionSourcesAssessed, setIgnitionSourcesAssessed] = useState<string[]>(
    moduleInstance.data.ignition_sources_assessed || []
  );
  const [ATEXRequired, setATEXRequired] = useState(moduleInstance.data.ATEX_equipment_required || '');
  const [ATEXPresent, setATEXPresent] = useState(moduleInstance.data.ATEX_equipment_present || '');
  const [staticControls, setStaticControls] = useState(moduleInstance.data.static_control_measures || '');
  const [hotWorkControls, setHotWorkControls] = useState(moduleInstance.data.hot_work_controls || '');
  const [inspectionRegime, setInspectionRegime] = useState(moduleInstance.data.inspection_testing_regime || '');

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const toggleIgnitionSource = (source: string) => {
    const updated = ignitionSourcesAssessed.includes(source)
      ? ignitionSourcesAssessed.filter(s => s !== source)
      : [...ignitionSourcesAssessed, source];
    setIgnitionSourcesAssessed(updated);
  };

  const getSuggestedOutcome = () => {
    if (ATEXRequired === 'yes' && ATEXPresent !== 'yes') {
      return 'material_def';
    }

    if (ATEXRequired === 'unknown' || staticControls === 'unknown') {
      return 'info_gap';
    }

    return 'compliant';
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('module_instances')
        .update({
          data: {
            ignition_sources_assessed: ignitionSourcesAssessed,
            ATEX_equipment_required: ATEXRequired,
            ATEX_equipment_present: ATEXPresent,
            static_control_measures: staticControls,
            hot_work_controls: hotWorkControls,
            inspection_testing_regime: inspectionRegime
          },
          outcome,
          assessor_notes: assessorNotes,
          updated_at: new Date().toISOString(),
        })
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
          DSEAR-4 - Ignition Source Control
        </h2>
        <p className="text-neutral-600">
          Identify and control all potential ignition sources in hazardous areas
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
          Identify and control all potential ignition sources in hazardous areas. Ensure ATEX-compliant equipment
          is used where required and implement controls for hot work, static electricity, and mechanical sparks.
        </p>
      </div>

      <div className="space-y-6 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ignition Sources Assessed
          </label>
          <div className="space-y-2">
            {IGNITION_SOURCES.map(source => (
              <label key={source} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={ignitionSourcesAssessed.includes(source)}
                  onChange={() => toggleIgnitionSource(source)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm capitalize">{source.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ATEX Equipment Required?
            </label>
            <select
              value={ATEXRequired}
              onChange={(e) => setATEXRequired(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ATEX Equipment Present?
            </label>
            <select
              value={ATEXPresent}
              onChange={(e) => setATEXPresent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="partial">Partial</option>
              <option value="unknown">Unknown</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Equipment category must match zone (e.g., Cat 2G for Zone 1)
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Static Electricity Control Measures
          </label>
          <AutoExpandTextarea
            value={staticControls}
            onChange={(e) => setStaticControls(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="e.g., Bonding and earthing of containers, conductive footwear, controlled humidity, earthed fill pipes"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hot Work Controls in Place?
          </label>
          <select
            value={hotWorkControls}
            onChange={(e) => setHotWorkControls(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Select...</option>
            <option value="yes">Yes - Permit to Work system</option>
            <option value="no">No</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Inspection & Testing Regime
          </label>
          <AutoExpandTextarea
            value={inspectionRegime}
            onChange={(e) => setInspectionRegime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="e.g., Annual ATEX equipment inspection, portable appliance testing (PAT) for Zone 2 equipment, continuity testing of bonding"
          />
        </div>
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

      <ModuleActions
        documentId={document.id}
        moduleInstanceId={moduleInstance.id}
      />
    </div>
  );
}
