import { useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';

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

interface RiskEngineeringFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

/**
 * Minimal wiring form for Risk Engineering:
 * - Renders 3 placeholder fields
 * - Saves to module_instances.data
 * - Reload/reopen persists
 *
 * This is intentionally minimal. Help text / HRG / scoring comes later.
 */
export default function RiskEngineeringForm({
  moduleInstance,
  document,
  onSaved,
}: RiskEngineeringFormProps) {
  const [isSaving, setIsSaving] = useState(false);

  // Read initial values from the existing module JSON data
  const initial = useMemo(() => {
    const d = moduleInstance.data || {};
    return {
      occupancy: d.occupancy ?? '',
      construction: d.construction ?? '',
      protection: d.protection ?? '',
    };
  }, [moduleInstance.data]);

  const [occupancy, setOccupancy] = useState<string>(initial.occupancy);
  const [construction, setConstruction] = useState<string>(initial.construction);
  const [protection, setProtection] = useState<string>(initial.protection);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const nextData = {
        ...(moduleInstance.data || {}),
        occupancy,
        construction,
        protection,
      };

      const { error } = await supabase
        .from('module_instances')
        .update({
          data: nextData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', moduleInstance.id);

      if (error) throw error;

      onSaved();
    } catch (err) {
      console.error('Error saving Risk Engineering module:', err);
      alert('Failed to save Risk Engineering. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Risk Engineering</h2>
          <p className="text-sm text-neutral-600">
            Minimal wiring form (save → reload → reopen)
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition-colors"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 p-6 space-y-4">
        <label className="block">
          <div className="text-sm font-medium text-neutral-700 mb-1">Occupancy</div>
          <input
            className="w-full border border-neutral-300 rounded-lg px-3 py-2"
            value={occupancy}
            onChange={(e) => setOccupancy(e.target.value)}
            placeholder="e.g. Warehouse / Office / Manufacturing"
          />
        </label>

        <label className="block">
          <div className="text-sm font-medium text-neutral-700 mb-1">Construction</div>
          <input
            className="w-full border border-neutral-300 rounded-lg px-3 py-2"
            value={construction}
            onChange={(e) => setConstruction(e.target.value)}
            placeholder="e.g. Steel frame / RC / Timber"
          />
        </label>

        <label className="block">
          <div className="text-sm font-medium text-neutral-700 mb-1">Protection</div>
          <input
            className="w-full border border-neutral-300 rounded-lg px-3 py-2"
            value={protection}
            onChange={(e) => setProtection(e.target.value)}
            placeholder="e.g. Sprinklers / Hydrants / Detection"
          />
        </label>

        <div className="pt-4 border-t border-neutral-200 text-xs text-neutral-500 space-y-1">
          <div>
            <strong>Module Key:</strong> {moduleInstance.module_key}
          </div>
          <div>
            <strong>Document Type:</strong> {document.document_type}
          </div>
          <div>
            <strong>Document:</strong> {document.title}
          </div>
        </div>
      </div>
    </div>
  );
}
