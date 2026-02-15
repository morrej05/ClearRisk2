import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { getActionsRefreshKey } from '../../../utils/actionsRefreshKey';
import AutoExpandTextarea from '../../AutoExpandTextarea';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';

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

export default function DSEAR5ExplosionProtectionForm({
  moduleInstance,
  document,
  onSaved
}: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const actionsRefreshKey = getActionsRefreshKey(document.id, moduleInstance.id);

  const [preventionMeasures, setPreventionMeasures] = useState(moduleInstance.data.prevention_measures || '');
  const [explosionVenting, setExplosionVenting] = useState(moduleInstance.data.explosion_venting || '');
  const [suppressionSystems, setSuppressionSystems] = useState(moduleInstance.data.suppression_systems || '');
  const [explosionIsolation, setExplosionIsolation] = useState(moduleInstance.data.explosion_isolation || '');
  const [segregationControls, setSegregationControls] = useState(moduleInstance.data.segregation_distance_controls || '');

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const getSuggestedOutcome = () => {
    const hasUnknowns = (
      explosionVenting === 'unknown' ||
      suppressionSystems === 'unknown' ||
      explosionIsolation === 'unknown'
    );

    if (hasUnknowns) {
      return 'info_gap';
    }

    const hasMitigation = (
      explosionVenting === 'yes' ||
      suppressionSystems === 'yes' ||
      explosionIsolation === 'yes'
    );

    if (hasMitigation) {
      return 'compliant';
    }

    return 'acceptable';
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = sanitizeModuleInstancePayload({
        data: {
          prevention_measures: preventionMeasures,
          explosion_venting: explosionVenting,
          suppression_systems: suppressionSystems,
          explosion_isolation: explosionIsolation,
          segregation_distance_controls: segregationControls
        },
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
          DSEAR-5 - Explosion Protection & Mitigation
        </h2>
        <p className="text-neutral-600">
          Document explosion protection and mitigation measures
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
          Document explosion protection and mitigation measures to minimize consequences of an explosion.
          Consider prevention (avoiding ignition), venting (pressure relief), suppression (chemical/water systems),
          and isolation (preventing propagation).
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Primary Prevention Measures
          </label>
          <AutoExpandTextarea
            value={preventionMeasures}
            onChange={(e) => setPreventionMeasures(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="e.g., Inerting with nitrogen, oxygen monitoring, continuous ventilation, ATEX equipment"
          />
          <p className="text-xs text-gray-500 mt-1">
            Measures to prevent formation of explosive atmosphere or prevent ignition
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Explosion Venting Present?
            </label>
            <select
              value={explosionVenting}
              onChange={(e) => setExplosionVenting(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="unknown">Unknown</option>
              <option value="na">Not Applicable</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Pressure relief panels/vents sized per BS EN 14491
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Suppression Systems Present?
            </label>
            <select
              value={suppressionSystems}
              onChange={(e) => setSuppressionSystems(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="unknown">Unknown</option>
              <option value="na">Not Applicable</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Chemical/water suppression activated by pressure sensors
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Explosion Isolation Present?
            </label>
            <select
              value={explosionIsolation}
              onChange={(e) => setExplosionIsolation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="unknown">Unknown</option>
              <option value="na">Not Applicable</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Fast-acting valves, rotary airlocks, flame diverters
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Segregation & Distance Controls
          </label>
          <AutoExpandTextarea
            value={segregationControls}
            onChange={(e) => setSegregationControls(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="e.g., Hazardous processes in separate building, 10m separation from ignition sources, blast walls between units"
          />
          <p className="text-xs text-gray-500 mt-1">
            Physical separation to minimize explosion consequences on people/assets
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
