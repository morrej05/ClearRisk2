import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import FloatingSaveBar from './FloatingSaveBar';

interface Document {
  id: string;
  title: string;
}

interface ModuleInstance {
  id: string;
  document_id: string;
  data: Record<string, any>;
}

interface RE06FireProtectionFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

/**
 * Canonical Fire Protection shape
 * ONE source of truth: data.fire_protection
 */
interface FireProtectionData {
  buildings: Record<
    string,
    {
      notes: string;
      rating: number;
    }
  >;
  site_notes: string;
}

interface ConstructionBuilding {
  id: string;
  building_name: string;
}

function createEmptyFireProtection(): FireProtectionData {
  return {
    buildings: {},
    site_notes: ''
  };
}

export default function RE06FireProtectionForm({
  moduleInstance,
  document,
  onSaved
}: RE06FireProtectionFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [constructionBuildings, setConstructionBuildings] = useState<ConstructionBuilding[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);

  // ---- LOAD EXISTING FIRE PROTECTION DATA ----
  const initialFireProtection: FireProtectionData =
    moduleInstance.data?.fire_protection ?? createEmptyFireProtection();

  const [formData, setFormData] = useState<FireProtectionData>(initialFireProtection);

  // ---- STEP 5: LOAD RE-02 BUILDINGS (CANONICAL) ----
  useEffect(() => {
    async function loadConstructionBuildings() {
      try {
        console.log('[RE06] Step 5 — Fetch RE02 buildings');

        const { data: row, error } = await supabase
          .from('module_instances')
          .select('id, data')
          .eq('document_id', document.id)
          .eq('module_key', 'RE_02_CONSTRUCTION')
          .maybeSingle();

        if (error) throw error;

        const buildings: ConstructionBuilding[] =
          Array.isArray(row?.data?.construction?.buildings)
            ? row.data.construction.buildings
            : [];

        console.log('[RE06] Step 5 — OK', {
          row: row?.id,
          buildings: buildings.length
        });

        setConstructionBuildings(buildings);

        // Default selection
        if (buildings.length > 0) {
          setSelectedBuildingId(prev => prev ?? buildings[0].id);
        }

        // Ensure every building has a fire_protection entry
        setFormData(prev => {
          const nextBuildings = { ...prev.buildings };

          buildings.forEach(b => {
            if (!nextBuildings[b.id]) {
              nextBuildings[b.id] = {
                notes: '',
                rating: 3
              };
            }
          });

          return {
            ...prev,
            buildings: nextBuildings
          };
        });

      } catch (err) {
        console.error('[RE06] Step 5 FAILED', err);
        setConstructionBuildings([]);
      }
    }

    loadConstructionBuildings();
  }, [document.id]);

  // ---- SAVE ----
  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('module_instances')
        .update({
          data: {
            ...moduleInstance.data,
            fire_protection: formData
          }
        })
        .eq('id', moduleInstance.id);

      if (error) throw error;

      console.log('[RE06] Saved OK');
      onSaved();
    } catch (err) {
      console.error('[RE06] Save failed', err);
      alert('Failed to save Fire Protection module');
    } finally {
      setIsSaving(false);
    }
  };

  // ---- RENDER ----
  if (constructionBuildings.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h2 className="text-xl font-bold mb-2">RE-06 Fire Protection</h2>
        <p className="text-slate-600">
          No buildings found. Complete RE-02 Construction first.
        </p>
      </div>
    );
  }

  const selectedBuilding = constructionBuildings.find(b => b.id === selectedBuildingId);
  const selectedData = selectedBuildingId
    ? formData.buildings[selectedBuildingId]
    : null;

  return (
    <>
      <div className="p-6 max-w-4xl mx-auto pb-24">
        <h2 className="text-2xl font-bold mb-4">RE-06 Fire Protection</h2>

        {/* Building selector */}
        <div className="flex gap-2 mb-6">
          {constructionBuildings.map(b => (
            <button
              key={b.id}
              onClick={() => setSelectedBuildingId(b.id)}
              className={`px-4 py-2 rounded ${
                selectedBuildingId === b.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100'
              }`}
            >
              {b.building_name || 'Unnamed'}
            </button>
          ))}
        </div>

        {/* Building content */}
        {selectedBuilding && selectedData && (
          <div className="bg-white border rounded p-4 space-y-4">
            <h3 className="font-semibold">
              {selectedBuilding.building_name}
            </h3>

            <div>
              <label className="block text-sm font-medium mb-1">
                Fire Protection Rating (1–5)
              </label>
              <input
                type="number"
                min={1}
                max={5}
                value={selectedData.rating}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    buildings: {
                      ...prev.buildings,
                      [selectedBuilding.id]: {
                        ...prev.buildings[selectedBuilding.id],
                        rating: Number(e.target.value)
                      }
                    }
                  }))
                }
                className="border px-2 py-1 rounded w-20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Notes
              </label>
              <textarea
                rows={4}
                value={selectedData.notes}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    buildings: {
                      ...prev.buildings,
                      [selectedBuilding.id]: {
                        ...prev.buildings[selectedBuilding.id],
                        notes: e.target.value
                      }
                    }
                  }))
                }
                className="w-full border rounded p-2"
              />
            </div>
          </div>
        )}
      </div>

      <FloatingSaveBar onSave={handleSave} isSaving={isSaving} />
    </>
  );
}
