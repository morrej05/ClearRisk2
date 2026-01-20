import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import AutoExpandTextarea from '../../AutoExpandTextarea';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import AddActionModal from '../../actions/AddActionModal';

interface Substance {
  name: string;
  physical_state: string;
  SDS_available: string;
  flash_point: string;
  LFL_UFL: string;
  auto_ignition_temp: string;
  dust_params: string;
  quantity: string;
  storage_location: string;
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

const emptySubstance = (): Substance => ({
  name: '',
  physical_state: '',
  SDS_available: '',
  flash_point: '',
  LFL_UFL: '',
  auto_ignition_temp: '',
  dust_params: '',
  quantity: '',
  storage_location: ''
});

export default function DSEAR1DangerousSubstancesForm({
  moduleInstance,
  document,
  onSaved
}: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);

  const [substances, setSubstances] = useState<Substance[]>(
    moduleInstance.data.substances?.length > 0 ? moduleInstance.data.substances : [emptySubstance()]
  );

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const addSubstance = () => {
    setSubstances([...substances, emptySubstance()]);
  };

  const removeSubstance = (index: number) => {
    setSubstances(substances.filter((_, i) => i !== index));
  };

  const updateSubstance = (index: number, field: keyof Substance, value: string) => {
    const updated = [...substances];
    updated[index] = { ...updated[index], [field]: value };
    setSubstances(updated);
  };

  const getSuggestedOutcome = () => {
    const unknownCriticalCount = substances.filter(s =>
      s.name && (
        s.SDS_available === 'unknown' ||
        s.flash_point === 'unknown' ||
        s.LFL_UFL === 'unknown'
      )
    ).length;

    if (unknownCriticalCount >= 2) {
      return 'info_gap';
    }

    const hasFlammables = substances.some(s =>
      s.name && s.physical_state && s.SDS_available !== 'no'
    );

    if (hasFlammables) {
      return 'material_def';
    }

    return 'compliant';
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('module_instances')
        .update({
          data: { substances },
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
          DSEAR-1 - Dangerous Substances Register
        </h2>
        <p className="text-neutral-600">
          Register all dangerous substances that could form explosive atmospheres
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
          Register all dangerous substances present or used in the workplace that could form explosive atmospheres
          (gases, vapours, mists, dusts). Record key flammability/explosivity parameters.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Dangerous Substances Register</h3>
          <button
            onClick={addSubstance}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Substance
          </button>
        </div>

        {substances.map((substance, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4 bg-white">
            <div className="flex items-start justify-between">
              <h4 className="font-semibold text-gray-900">Substance {index + 1}</h4>
              {substances.length > 1 && (
                <button
                  onClick={() => removeSubstance(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Substance Name *
                </label>
                <input
                  type="text"
                  value={substance.name}
                  onChange={(e) => updateSubstance(index, 'name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., Acetone, Wood Dust"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Physical State *
                </label>
                <select
                  value={substance.physical_state}
                  onChange={(e) => updateSubstance(index, 'physical_state', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select...</option>
                  <option value="gas">Gas</option>
                  <option value="vapour">Vapour</option>
                  <option value="liquid">Liquid</option>
                  <option value="dust">Dust</option>
                  <option value="mist">Mist</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Safety Data Sheet Available?
                </label>
                <select
                  value={substance.SDS_available}
                  onChange={(e) => updateSubstance(index, 'SDS_available', e.target.value)}
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
                  Flash Point (°C)
                </label>
                <input
                  type="text"
                  value={substance.flash_point}
                  onChange={(e) => updateSubstance(index, 'flash_point', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., -20 or unknown"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lower/Upper Flammable Limits (LFL/UFL %)
                </label>
                <input
                  type="text"
                  value={substance.LFL_UFL}
                  onChange={(e) => updateSubstance(index, 'LFL_UFL', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., 2.5-13.0 or unknown"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Auto-Ignition Temperature (°C)
                </label>
                <input
                  type="text"
                  value={substance.auto_ignition_temp}
                  onChange={(e) => updateSubstance(index, 'auto_ignition_temp', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., 465 or unknown"
                />
              </div>

              {substance.physical_state === 'dust' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dust Parameters (Kst/Pmax/MEC/MIE)
                  </label>
                  <input
                    type="text"
                    value={substance.dust_params}
                    onChange={(e) => updateSubstance(index, 'dust_params', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., Kst=150, MEC=50g/m³ or unknown"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity Held
                </label>
                <input
                  type="text"
                  value={substance.quantity}
                  onChange={(e) => updateSubstance(index, 'quantity', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., 200L, 5 drums"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Storage Location
                </label>
                <input
                  type="text"
                  value={substance.storage_location}
                  onChange={(e) => updateSubstance(index, 'storage_location', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., External compound, Store room A"
                />
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

      <ModuleActions
        documentId={document.id}
        moduleInstanceId={moduleInstance.id}
      />

      {showActionModal && (
        <AddActionModal
          documentId={document.id}
          moduleInstanceId={moduleInstance.id}
          onClose={() => setShowActionModal(false)}
        />
      )}
    </div>
  );
}
