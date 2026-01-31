import { useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

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

export default function RiskEngineeringForm({
  moduleInstance,
  document,
  onSaved,
}: {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);

  const initial = useMemo(() => {
    const d = moduleInstance.data || {};
    return {
      occupancy: d.occupancy ?? "",
      construction: d.construction ?? "",
      protection: d.protection ?? "",
    };
  }, [moduleInstance.data]);

  const [occupancy, setOccupancy] = useState(initial.occupancy);
  const [construction, setConstruction] = useState(initial.construction);
  const [protection, setProtection] = useState(initial.protection);

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
        .from("module_instances")
        .update({
          data: nextData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", moduleInstance.id);

      if (error) throw error;

      onSaved();
    } catch (e) {
      console.error("Error saving Risk Engineering:", e);
      alert("Failed to save Risk Engineering. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Risk Engineering</h2>
          <p className="text-neutral-600 text-sm">
            Minimal wiring form (save → reload → reopen)
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 p-6 space-y-4">
        <label className="block">
          <div className="text-sm font-medium text-neutral-700 mb-1">Occupancy</div>
          <input
            className="w-full border border-neutral-300 rounded-lg px-3 py-2"
            value={occupancy}
            onChange={(e) => setOccupancy(e.target.value)}
          />
        </label>

        <label className="block">
          <div className="text-sm font-medium text-neutral-700 mb-1">Construction</div>
          <input
            className="w-full border border-neutral-300 rounded-lg px-3 py-2"
            value={construction}
            onChange={(e) => setConstruction(e.target.value)}
          />
        </label>

        <label className="block">
          <div className="text-sm font-medium text-neutral-700 mb-1">Protection</div>
          <input
            className="w-full border border-neutral-300 rounded-lg px-3 py-2"
            value={protection}
            onChange={(e) => setProtection(e.target.value)}
          />
        </label>

        <div className="text-xs text-neutral-500 pt-2 border-t border-neutral-200">
          <strong>Module Key:</strong> {moduleInstance.module_key} &nbsp;|&nbsp;
          <strong>Doc Type:</strong> {document.document_type}
        </div>
      </div>
    </div>
  );
}
