import { useState, useEffect } from 'react';
import { AlertTriangle, Flame } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import FloatingSaveBar from './FloatingSaveBar';
import SectionGrade from '../../SectionGrade';
import { updateSectionGrade } from '../../../utils/sectionGrades';

interface Document {
  id: string;
  title: string;
  document_type: string;
}

interface ModuleInstance {
  id: string;
  document_id: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
}

interface RE06FireProtectionFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

type WaterSupplyReliability = 'reliable' | 'unreliable' | 'unknown';

interface BuildingFireProtection {
  notes: string;
}

interface SiteData {
  water_supply_reliability: WaterSupplyReliability;
  water_supply_notes: string;
}

interface FireProtectionModule {
  buildings: Record<string, BuildingFireProtection>;
  site: SiteData;
}

interface ConstructionBuilding {
  id: string;
  building_name: string;
}

function createDefaultBuildingProtection(): BuildingFireProtection {
  return { notes: '' };
}

function createDefaultSiteData(): SiteData {
  return {
    water_supply_reliability: 'unknown',
    water_supply_notes: '',
  };
}

export default function RE06FireProtectionForm({ moduleInstance, document, onSaved }: RE06FireProtectionFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [constructionBuildings, setConstructionBuildings] = useState<ConstructionBuilding[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [sectionGrade, setSectionGrade] = useState<number>(3);

  const d = moduleInstance.data || {};
  const initial: FireProtectionModule = {
    buildings: (d.fire_protection && d.fire_protection.buildings) ? d.fire_protection.buildings : {},
    site: (d.fire_protection && d.fire_protection.site) ? d.fire_protection.site : createDefaultSiteData(),
  };

  const [formData, setFormData] = useState<{ fire_protection: FireProtectionModule }>({
    fire_protection: initial,
  });

  // Load buildings from RE-02 Construction
  useEffect(() => {
    let cancelled = false;

    async function loadConstructionBuildings() {
      try {
        const res = await supabase
          .from('module_instances')
          .select('id, updated_at, data')
          .eq('document_id', document.id)
          .eq('module_key', 'RE_02_CONSTRUCTION')
          .order('updated_at', { ascending: false })
          .limit(1);

        if (res.error) throw res.error;

        const row = (res.data && res.data.length > 0) ? res.data[0] : null;

        const canonical = row && row.data && row.data.construction ? row.data.construction.buildings : null;
        const legacy = row && row.data ? row.data.buildings : null;

        const buildings = Array.isArray(canonical)
          ? canonical
          : Array.isArray(legacy)
          ? legacy
          : [];

        if (cancelled) return;

        setConstructionBuildings(buildings);

        setSelectedBuildingId((prev) => {
          if (prev && buildings.some((b: any) => b && b.id === prev)) return prev;
          return buildings[0] ? buildings[0].id : null;
        });

        // Ensure every building has a fire_protection record
        setFormData((prev) => {
          const updatedBuildings = { ...prev.fire_protection.buildings };
          for (const b of buildings) {
            if (b && b.id && !updatedBuildings[b.id]) {
              updatedBuildings[b.id] = createDefaultBuildingProtection();
            }
          }
          return {
            ...prev,
            fire_protection: {
              ...prev.fire_protection,
              buildings: updatedBuildings,
            },
          };
        });
      } catch (err) {
        console.error('[RE06] loadConstructionBuildings failed:', err);
        if (!cancelled) setConstructionBuildings([]);
      }
    }

    loadConstructionBuildings();

    return () => {
      cancelled = true;
    };
  }, [document.id]);

  // Load section grade from document
  useEffect(() => {
    async function loadSectionGrade() {
      try {
        const { data: docRow, error } = await supabase
          .from('documents')
          .select('section_grades')
          .eq('id', document.id)
          .maybeSingle();

        if (error) return;

        const grade = docRow && docRow.section_grades ? docRow.section_grades.fire_protection : undefined;
        if (grade !== undefined) setSectionGrade(grade);
      } catch (e) {
        console.error('[RE06] loadSectionGrade failed:', e);
      }
    }

    loadSectionGrade();
  }, [document.id]);

  const handleSectionGradeChange = async (value: number) => {
    setSectionGrade(value);
    const { error } = await updateSectionGrade(document.id, 'fire_protection', value);
    if (error) console.error('[RE06] Failed to update section grade:', error);
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('module_instances')
        .update({ data: formData })
        .eq('id', moduleInstance.id);

      if (error) throw error;
      onSaved();
    } catch (err) {
      console.error('[RE06] save failed:', err);
      alert('Failed to save module. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedBuilding = selectedBuildingId
    ? constructionBuildings.find((b) => b.id === selectedBuildingId)
    : null;

  const selectedBuildingData =
    selectedBuildingId && formData.fire_protection.buildings[selectedBuildingId]
      ? formData.fire_protection.buildings[selectedBuildingId]
      : null;

  const updateBuildingNotes = (buildingId: string, notes: string) => {
    setFormData((prev) => ({
      ...prev,
      fire_protection: {
        ...prev.fire_protection,
        buildings: {
          ...prev.fire_protection.buildings,
          [buildingId]: {
            ...(prev.fire_protection.buildings[buildingId] || createDefaultBuildingProtection()),
            notes,
          },
        },
      },
    }));
  };

  if (constructionBuildings.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-06 - Fire Protection</h2>
          <p className="text-slate-600">Active fire protection effectiveness assessment</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">No Buildings Found</h3>
            <p className="text-sm text-blue-800">
              Complete RE-02 Construction module first to define buildings before assessing fire protection.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 md:p-6 max-w-5xl mx-auto pb-24">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-06 - Fire Protection</h2>
          <p className="text-slate-600">Active fire protection effectiveness assessment</p>
        </div>

        {/* Building Tabs */}
        <div className="mb-6 -mx-4 md:mx-0">
          <div className="overflow-x-auto px-4 md:px-0">
            <div className="flex gap-2 pb-2 min-w-max md:min-w-0">
              {constructionBuildings.map((building) => (
                <button
                  key={building.id}
                  onClick={() => setSelectedBuildingId(building.id)}
                  className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-colors ${
                    selectedBuildingId === building.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {building.building_name || 'Unnamed Building'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Building */}
        {selectedBuilding && selectedBuildingData && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              Building Notes
            </h3>

            <label className="block text-sm font-medium text-slate-700 mb-2">
              Fire protection observations for this building
            </label>
            <textarea
              value={selectedBuildingData.notes}
              onChange={(e) => updateBuildingNotes(selectedBuilding.id, e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              placeholder="Add fire protection observations..."
            />
          </div>
        )}
      </div>

      {/* Section Grade */}
      <div className="max-w-5xl mx-auto px-6 pb-6">
        <SectionGrade
          sectionKey="fire_protection"
          sectionTitle="Fire Protection"
          value={sectionGrade}
          onChange={handleSectionGradeChange}
        />
      </div>

      <FloatingSaveBar onSave={handleSave} isSaving={isSaving} />
    </>
  );
}
