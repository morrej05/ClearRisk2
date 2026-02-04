import { useState, useEffect, Fragment } from 'react';
import { supabase } from '../../../lib/supabase';
import FloatingSaveBar from './FloatingSaveBar';
import { Plus, Trash2 } from 'lucide-react';

/* =====================
   Types
===================== */

interface Document {
  id: string;
}

interface ModuleInstance {
  id: string;
  document_id: string;
  module_key: string;
  data: Record<string, any>;
}

interface Props {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface Building {
  id: string;
  building_name: string;
  roof_area_sqm: number | null;
}

/* =====================
   Helpers
===================== */

function createEmptyBuilding(): Building {
  return {
    id: crypto.randomUUID(),
    building_name: '',
    roof_area_sqm: null,
  };
}

/* =====================
   Component
===================== */

export default function RE02ConstructionForm({
  moduleInstance,
  document,
  onSaved,
}: Props) {
  /* ---------- Load canonical data ---------- */

  const canonicalBuildings: Building[] = Array.isArray(
    moduleInstance.data?.construction?.buildings
  )
    ? moduleInstance.data.construction.buildings
    : [];

  const [buildings, setBuildings] = useState<Building[]>(
    canonicalBuildings.length ? canonicalBuildings : [createEmptyBuilding()]
  );

  /* ---------- Rehydrate if module changes ---------- */

  useEffect(() => {
    setBuildings(
      canonicalBuildings.length ? canonicalBuildings : [createEmptyBuilding()]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleInstance.id]);

  /* ---------- Mutators ---------- */

  const updateBuilding = (id: string, patch: Partial<Building>) => {
    setBuildings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b))
    );
  };

  const addBuilding = () => {
    setBuildings((prev) => [...prev, createEmptyBuilding()]);
  };

  const removeBuilding = (id: string) => {
    if (buildings.length === 1) return;
    setBuildings((prev) => prev.filter((b) => b.id !== id));
  };

  /* ---------- Save ---------- */

  const handleSave = async () => {
    const payload = {
      construction: {
        buildings,
      },
    };

    const { data, error } = await supabase
      .from('module_instances')
      .update({ data: payload })
      .eq('document_id', document.id)
      .eq('module_key', 'RE_02_CONSTRUCTION')
      .select('id');

    if (error) {
      console.error('[RE02] SAVE FAILED', error);
      alert('Save failed');
      return;
    }

    if (!data || data.length === 0) {
      alert('Save failed: no row updated');
      return;
    }

    console.log('[RE02] SAVE OK →', {
      document_id: document.id,
      buildings: buildings.length,
    });

    onSaved();
  };

  /* ---------- Render ---------- */

  return (
    <>
      <div className="p-6 max-w-4xl mx-auto pb-24">
        <h2 className="text-xl font-bold mb-4">RE-02 Construction</h2>

        <table className="w-full text-sm border">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">Building</th>
              <th className="p-2 text-left">Roof area (m²)</th>
              <th className="p-2" />
            </tr>
          </thead>

          <tbody>
            {buildings.map((b) => (
              <Fragment key={b.id}>
                <tr className="border-t">
                  <td className="p-2">
                    <input
                      className="border px-2 py-1 w-full"
                      value={b.building_name}
                      onChange={(e) =>
                        updateBuilding(b.id, {
                          building_name: e.target.value,
                        })
                      }
                      placeholder="Building name"
                    />
                  </td>

                  <td className="p-2">
                    <input
                      className="border px-2 py-1 w-full"
                      value={b.roof_area_sqm ?? ''}
                      onChange={(e) =>
                        updateBuilding(b.id, {
                          roof_area_sqm: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                      placeholder="m²"
                    />
                  </td>

                  <td className="p-2 text-right">
                    <button
                      onClick={() => removeBuilding(b.id)}
                      disabled={buildings.length === 1}
                      className="text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>

        <button
          onClick={addBuilding}
          className="mt-4 flex items-center gap-2 text-sm text-slate-600"
        >
          <Plus size={16} /> Add building
        </button>
      </div>

      <FloatingSaveBar onSave={handleSave} />
    </>
  );
}
