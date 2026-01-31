import { useState } from 'react';
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import AutoExpandTextarea from '../../AutoExpandTextarea';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';

interface Zone {
  zone_type: string;
  extent_description: string;
  basis_of_classification: string;
  dependent_on_housekeeping: string;
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

const emptyZone = (): Zone => ({
  zone_type: '',
  extent_description: '',
  basis_of_classification: '',
  dependent_on_housekeeping: ''
});

export default function DSEAR3HazardousAreaClassificationForm({
  moduleInstance,
  document,
  onSaved
}: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [zones, setZones] = useState<Zone[]>(
    moduleInstance.data.zones?.length > 0 ? moduleInstance.data.zones : [emptyZone()]
  );
  const [drawingsReference, setDrawingsReference] = useState(moduleInstance.data.drawings_reference || '');

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const addZone = () => {
    setZones([...zones, emptyZone()]);
  };

  const removeZone = (index: number) => {
    setZones(zones.filter((_, i) => i !== index));
  };

  const updateZone = (index: number, field: keyof Zone, value: string) => {
    const updated = [...zones];
    updated[index] = { ...updated[index], [field]: value };
    setZones(updated);
  };

  const getSuggestedOutcome = () => {
    const hasZones = zones.some(z => z.zone_type);

    if (hasZones && !drawingsReference) {
      return 'info_gap';
    }

    const hasHighRiskZones = zones.some(z =>
      z.zone_type === '0' || z.zone_type === '20'
    );

    if (hasHighRiskZones) {
      return 'material_def';
    }

    if (hasZones) {
      return 'acceptable';
    }

    return 'compliant';
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = sanitizeModuleInstancePayload({
        data: { zones, drawings_reference: drawingsReference },
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
          DSEAR-3 - Hazardous Area Classification
        </h2>
        <p className="text-neutral-600">
          Classify areas where explosive atmospheres may occur into zones
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
          Classify areas where explosive atmospheres may occur into zones (0/1/2 for gases, 20/21/22 for dusts).
          Document zone extents, basis of classification, and any dependency on operational controls.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Hazardous Area Zones</h3>
          <button
            onClick={addZone}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Zone
          </button>
        </div>

        {zones.map((zone, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4 bg-white">
            <div className="flex items-start justify-between">
              <h4 className="font-semibold text-gray-900">Zone {index + 1}</h4>
              {zones.length > 1 && (
                <button
                  onClick={() => removeZone(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zone Type *
                </label>
                <select
                  value={zone.zone_type}
                  onChange={(e) => updateZone(index, 'zone_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select...</option>
                  <optgroup label="Gas/Vapour/Mist">
                    <option value="0">Zone 0 (Continuous)</option>
                    <option value="1">Zone 1 (Primary)</option>
                    <option value="2">Zone 2 (Secondary)</option>
                  </optgroup>
                  <optgroup label="Dust">
                    <option value="20">Zone 20 (Continuous)</option>
                    <option value="21">Zone 21 (Primary)</option>
                    <option value="22">Zone 22 (Secondary)</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Basis of Classification
                </label>
                <select
                  value={zone.basis_of_classification}
                  onChange={(e) => updateZone(index, 'basis_of_classification', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select...</option>
                  <option value="standard">BS EN 60079-10-1/-2 (Standard)</option>
                  <option value="calculation">Calculation (volume/ventilation)</option>
                  <option value="assumption">Conservative Assumption</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zone Extent Description *
                </label>
                <AutoExpandTextarea
                  value={zone.extent_description}
                  onChange={(e) => updateZone(index, 'extent_description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., 3m radius around drum filling point, Inside extraction hood, Within enclosed vessel"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dependent on Housekeeping?
                </label>
                <select
                  value={zone.dependent_on_housekeeping}
                  onChange={(e) => updateZone(index, 'dependent_on_housekeeping', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Does this zone classification rely on regular cleaning/dust removal?
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Hazardous Area Drawings Reference
        </label>
        <AutoExpandTextarea
          value={drawingsReference}
          onChange={(e) => setDrawingsReference(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          placeholder="e.g., Drawing HAC-001 Rev B, dated 15/01/2025, attached to DSEAR assessment"
        />
        <p className="text-xs text-gray-500 mt-1">
          Reference to formal HAC drawings showing zone extents on site plans
        </p>
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
