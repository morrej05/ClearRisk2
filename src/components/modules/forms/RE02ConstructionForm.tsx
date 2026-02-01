import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import { calculateBuildingCombustibility } from '../../../utils/combustibilityCalculations';
import { Plus, Trash2 } from 'lucide-react';

interface Document {
  id: string;
  title: string;
}

interface ModuleInstance {
  id: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
}

interface RE02ConstructionFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface RoofCeilingMaterial {
  material: 'heavy_non_comb' | 'light_non_comb' | 'foam_plastic_approved' | 'foam_plastic_unapproved' | 'combustible_other';
}

interface WallsMaterial {
  heavy_non_comb: number;
  light_non_comb: number;
  foam_plastic_approved: number;
  foam_plastic_unapproved: number;
  combustible_other: number;
}

interface Building {
  id: string;
  building_name: string;
  roof_ceiling_material: RoofCeilingMaterial['material'];
  roof_ceiling_area_sqm: number | null;
  roof_ceiling_notes: string;
  walls: WallsMaterial;
  walls_notes: string;
  upper_floors_mezz_area_sqm: number | null;
  num_floors: number | null;
  num_basements: number | null;
  height_m: number | null;
  cladding_panels_present: boolean;
  cladding_panels_details: string;
  compartmentation_indicator: string;
  compartmentation_notes: string;
  frame_type: 'steel' | 'timber' | 'concrete' | 'other' | '';
  frame_protected: 'protected' | 'unprotected' | '';
  building_rating_1_to_5: number;
  combustibility_score: number;
  combustibility_band: string;
  calc_notes: string;
}

const ROOF_MATERIAL_LABELS: Record<RoofCeilingMaterial['material'], string> = {
  heavy_non_comb: 'Heavy Non-Combustible',
  light_non_comb: 'Light Non-Combustible',
  foam_plastic_approved: 'Foam Plastic (Approved)',
  foam_plastic_unapproved: 'Foam Plastic (Unapproved)',
  combustible_other: 'Combustible (Other)',
};

function createEmptyBuilding(): Building {
  return {
    id: crypto.randomUUID(),
    building_name: '',
    roof_ceiling_material: 'heavy_non_comb',
    roof_ceiling_area_sqm: null,
    roof_ceiling_notes: '',
    walls: {
      heavy_non_comb: 0,
      light_non_comb: 0,
      foam_plastic_approved: 0,
      foam_plastic_unapproved: 0,
      combustible_other: 0,
    },
    walls_notes: '',
    upper_floors_mezz_area_sqm: null,
    num_floors: null,
    num_basements: null,
    height_m: null,
    cladding_panels_present: false,
    cladding_panels_details: '',
    compartmentation_indicator: '',
    compartmentation_notes: '',
    frame_type: '',
    frame_protected: '',
    building_rating_1_to_5: 3,
    combustibility_score: 0,
    combustibility_band: 'low',
    calc_notes: '',
  };
}

function computeCombustibility(building: Building): { score: number; band: string; notes: string } {
  const roofCombustible = ['foam_plastic_unapproved', 'combustible_other'].includes(building.roof_ceiling_material);
  const roofTransitional = building.roof_ceiling_material === 'foam_plastic_approved';

  const wallCombustible = building.walls.foam_plastic_unapproved + building.walls.combustible_other;
  const wallTransitional = building.walls.foam_plastic_approved;

  let raw_score: number;

  if (roofCombustible || roofTransitional) {
    const roofContrib = roofCombustible ? 100 : (roofTransitional ? 50 : 0);
    const wallCombustibleContrib = wallCombustible * 0.4;
    const wallTransitionalContrib = wallTransitional * 0.2;
    raw_score = roofContrib + wallCombustibleContrib + wallTransitionalContrib;
  } else {
    const wallCombustibleContrib = wallCombustible * 0.6;
    const wallTransitionalContrib = wallTransitional * 0.3;
    raw_score = wallCombustibleContrib + wallTransitionalContrib;
  }

  const score = Math.min(100, Math.round(raw_score));

  let band: string;
  let notes: string;

  if (score >= 50) {
    band = 'high';
    notes = 'High combustibility - significant combustible construction elements present.';
  } else if (score >= 20) {
    band = 'medium';
    notes = 'Medium combustibility - some combustible or transitional elements present.';
  } else {
    band = 'low';
    notes = 'Low combustibility - predominantly non-combustible construction.';
  }

  return { score, band, notes };
}

export default function RE02ConstructionForm({
  moduleInstance,
  document,
  onSaved,
}: RE02ConstructionFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const d = moduleInstance.data || {};

  const safeBuildings = Array.isArray(d.construction?.buildings)
    ? d.construction.buildings.map((b: any) => ({
        ...createEmptyBuilding(),
        ...b,
        walls: {
          heavy_non_comb: 0,
          light_non_comb: 0,
          foam_plastic_approved: 0,
          foam_plastic_unapproved: 0,
          combustible_other: 0,
          ...(b.walls || {})
        }
      }))
    : [createEmptyBuilding()];

  const [formData, setFormData] = useState({
    construction: {
      buildings: safeBuildings,
      site_rating_1_to_5: typeof d.construction?.site_rating_1_to_5 === 'number' ? d.construction.site_rating_1_to_5 : 3,
    },
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const updateBuilding = (id: string, field: string, value: any) => {
    setFormData({
      ...formData,
      construction: {
        ...formData.construction,
        buildings: formData.construction.buildings.map((b) => {
          if (b.id === id) {
            const updated = { ...b, [field]: value };
            const combustibility = computeCombustibility(updated);
            return {
              ...updated,
              combustibility_score: combustibility.score,
              combustibility_band: combustibility.band,
              calc_notes: combustibility.notes,
            };
          }
          return b;
        }),
      },
    });
  };

  const updateBuildingWalls = (id: string, wallField: keyof WallsMaterial, value: number) => {
    setFormData({
      ...formData,
      construction: {
        ...formData.construction,
        buildings: formData.construction.buildings.map((b) => {
          if (b.id === id) {
            const updated = {
              ...b,
              walls: { ...b.walls, [wallField]: value },
            };
            const combustibility = computeCombustibility(updated);
            return {
              ...updated,
              combustibility_score: combustibility.score,
              combustibility_band: combustibility.band,
              calc_notes: combustibility.notes,
            };
          }
          return b;
        }),
      },
    });
  };

  const addBuilding = () => {
    setFormData({
      ...formData,
      construction: {
        ...formData.construction,
        buildings: [...formData.construction.buildings, createEmptyBuilding()],
      },
    });
  };

  const removeBuilding = (id: string) => {
    if (formData.construction.buildings.length === 1) {
      alert('At least one building must remain');
      return;
    }
    setFormData({
      ...formData,
      construction: {
        ...formData.construction,
        buildings: formData.construction.buildings.filter((b) => b.id !== id),
      },
    });
  };

  const wallsTotal = (walls: WallsMaterial) => {
    return walls.heavy_non_comb + walls.light_non_comb + walls.foam_plastic_approved + walls.foam_plastic_unapproved + walls.combustible_other;
  };

  const handleSave = async () => {
    for (const building of formData.construction.buildings) {
      const total = wallsTotal(building.walls);
      if (total !== 100 && total !== 0) {
        alert(`Building "${building.building_name || 'Unnamed'}": Wall percentages must total 100% (currently ${total}%)`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const completedAt = outcome ? new Date().toISOString() : null;
      const sanitized = sanitizeModuleInstancePayload({ data: formData });

      const { error } = await supabase
        .from('module_instances')
        .update({
          data: sanitized.data,
          outcome: outcome || null,
          assessor_notes: assessorNotes,
          completed_at: completedAt,
        })
        .eq('id', moduleInstance.id);

      if (error) throw error;
      onSaved();
    } catch (error) {
      console.error('Error saving module:', error);
      alert('Failed to save module. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-02 - Construction</h2>
        <p className="text-slate-600">Structured construction assessment with combustibility analysis</p>
      </div>

      <div className="space-y-6">
        {formData.construction.buildings.map((building, idx) => (
          <div key={building.id} className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Building {idx + 1}
              </h3>
              {formData.construction.buildings.length > 1 && (
                <button
                  onClick={() => removeBuilding(building.id)}
                  className="text-red-600 hover:text-red-700 p-1"
                  title="Remove building"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Building Name</label>
                <input
                  type="text"
                  value={building.building_name}
                  onChange={(e) => updateBuilding(building.id, 'building_name', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="e.g., Main Production Hall, Warehouse A"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Number of Floors</label>
                  <input
                    type="number"
                    value={building.num_floors || ''}
                    onChange={(e) => updateBuilding(building.id, 'num_floors', e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Number of Basements</label>
                  <input
                    type="number"
                    value={building.num_basements || ''}
                    onChange={(e) => updateBuilding(building.id, 'num_basements', e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Height (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={building.height_m || ''}
                    onChange={(e) => updateBuilding(building.id, 'height_m', e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h4 className="font-semibold text-slate-900 mb-3">Roof / Ceiling</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Material</label>
                    <select
                      value={building.roof_ceiling_material}
                      onChange={(e) => updateBuilding(building.id, 'roof_ceiling_material', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    >
                      {Object.entries(ROOF_MATERIAL_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Area (m²)</label>
                    <input
                      type="number"
                      value={building.roof_ceiling_area_sqm || ''}
                      onChange={(e) => updateBuilding(building.id, 'roof_ceiling_area_sqm', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                    <textarea
                      value={building.roof_ceiling_notes}
                      onChange={(e) => updateBuilding(building.id, 'roof_ceiling_notes', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      placeholder="Additional roof/ceiling observations"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h4 className="font-semibold text-slate-900 mb-3">
                  Walls (% split - must total 100%)
                  {wallsTotal(building.walls) > 0 && (
                    <span className={`ml-2 text-sm ${wallsTotal(building.walls) === 100 ? 'text-green-600' : 'text-red-600'}`}>
                      Total: {wallsTotal(building.walls)}%
                    </span>
                  )}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Heavy Non-Comb (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={building.walls.heavy_non_comb}
                      onChange={(e) => updateBuildingWalls(building.id, 'heavy_non_comb', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-2 border border-slate-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Light Non-Comb (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={building.walls.light_non_comb}
                      onChange={(e) => updateBuildingWalls(building.id, 'light_non_comb', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-2 border border-slate-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Foam Plastic Approved (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={building.walls.foam_plastic_approved}
                      onChange={(e) => updateBuildingWalls(building.id, 'foam_plastic_approved', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-2 border border-slate-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Foam Plastic Unapproved (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={building.walls.foam_plastic_unapproved}
                      onChange={(e) => updateBuildingWalls(building.id, 'foam_plastic_unapproved', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-2 border border-slate-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Combustible Other (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={building.walls.combustible_other}
                      onChange={(e) => updateBuildingWalls(building.id, 'combustible_other', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-2 border border-slate-300 rounded-md text-sm"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Walls Notes</label>
                  <textarea
                    value={building.walls_notes}
                    onChange={(e) => updateBuilding(building.id, 'walls_notes', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="Wall construction details and observations"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h4 className="font-semibold text-slate-900 mb-3">Frame</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Frame Type</label>
                    <select
                      value={building.frame_type}
                      onChange={(e) => updateBuilding(building.id, 'frame_type', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    >
                      <option value="">Select...</option>
                      <option value="steel">Steel</option>
                      <option value="timber">Timber</option>
                      <option value="concrete">Concrete</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Fire Protection</label>
                    <select
                      value={building.frame_protected}
                      onChange={(e) => updateBuilding(building.id, 'frame_protected', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    >
                      <option value="">Select...</option>
                      <option value="protected">Protected</option>
                      <option value="unprotected">Unprotected</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h4 className="font-semibold text-slate-900 mb-3">Other Elements</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Upper Floors / Mezzanine Area (m²)</label>
                    <input
                      type="number"
                      value={building.upper_floors_mezz_area_sqm || ''}
                      onChange={(e) => updateBuilding(building.id, 'upper_floors_mezz_area_sqm', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={building.cladding_panels_present}
                        onChange={(e) => updateBuilding(building.id, 'cladding_panels_present', e.target.checked)}
                        className="mr-2"
                      />
                      Cladding Panels Present
                    </label>
                    {building.cladding_panels_present && (
                      <textarea
                        value={building.cladding_panels_details}
                        onChange={(e) => updateBuilding(building.id, 'cladding_panels_details', e.target.value)}
                        rows={2}
                        className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="Describe cladding type, material, compliance status"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Compartmentation Indicator</label>
                    <input
                      type="text"
                      value={building.compartmentation_indicator}
                      onChange={(e) => updateBuilding(building.id, 'compartmentation_indicator', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      placeholder="e.g., Adequate, Partial, Inadequate"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Compartmentation Notes</label>
                    <textarea
                      value={building.compartmentation_notes}
                      onChange={(e) => updateBuilding(building.id, 'compartmentation_notes', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      placeholder="Fire walls, barriers, fire-rated doors, penetration sealing"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h4 className="font-semibold text-slate-900 mb-3">Combustibility Analysis</h4>
                <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-700">Combustibility Score:</span>
                    <span className="font-semibold text-slate-900">{building.combustibility_score}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-700">Band:</span>
                    <span className={`font-semibold px-3 py-1 rounded-full text-xs uppercase ${
                      building.combustibility_band === 'high' ? 'bg-red-100 text-red-800' :
                      building.combustibility_band === 'medium' ? 'bg-amber-100 text-amber-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {building.combustibility_band}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 pt-2 border-t border-slate-200">
                    {building.calc_notes}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h4 className="font-semibold text-slate-900 mb-3">Building Rating</h4>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={building.building_rating_1_to_5}
                    onChange={(e) => updateBuilding(building.id, 'building_rating_1_to_5', parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 font-bold text-slate-900">
                    {building.building_rating_1_to_5}
                  </div>
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  1 = Poor, 3 = Average, 5 = Excellent
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={addBuilding}
          className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-slate-400 hover:text-slate-700 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Another Building
        </button>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Site-Level Rating</h3>
          <p className="text-sm text-slate-600 mb-4">
            Overall site construction assessment based on computed combustibility and individual building ratings.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="1"
              max="5"
              value={formData.construction.site_rating_1_to_5}
              onChange={(e) => setFormData({
                ...formData,
                construction: { ...formData.construction, site_rating_1_to_5: parseInt(e.target.value) }
              })}
              className="flex-1"
            />
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 font-bold text-blue-900 text-xl">
              {formData.construction.site_rating_1_to_5}
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            1 = Poor, 3 = Average, 5 = Excellent
          </div>
        </div>
      </div>

      <OutcomePanel
        outcome={outcome}
        assessorNotes={assessorNotes}
        onOutcomeChange={setOutcome}
        onNotesChange={setAssessorNotes}
        onSave={handleSave}
        isSaving={isSaving}
      />

      {document?.id && moduleInstance?.id && (
        <ModuleActions documentId={document.id} moduleInstanceId={moduleInstance.id} />
      )}
    </div>
  );
}
