import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import FloatingSaveBar from './FloatingSaveBar';
import { Plus, Trash2, Edit2, X } from 'lucide-react';

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

interface WallBreakdown {
  material: string;
  percent: number;
}

interface Building {
  id: string;
  building_name: string;
  roof: {
    material: string;
    area_sqm: number | null;
  };
  walls: {
    breakdown: WallBreakdown[];
    total_percent: number;
  };
  upper_floors_mezz_sqm: number | null;
  geometry: {
    floors: number | null;
    basements: number | null;
    height_m: number | null;
  };
  cladding: {
    present: boolean;
    details: string;
  };
  compartmentation: 'low' | 'medium' | 'high' | 'unknown';
  frame: {
    type: string;
    protection: 'protected' | 'unprotected' | 'unknown';
  };
  notes: string;
  combustibility_score: number;
  combustibility_band: 'Low' | 'Medium' | 'High';
  rating: number;
}

const ROOF_MATERIALS = [
  'Heavy Non-Combustible',
  'Light Non-Combustible',
  'Foam Plastic (Approved)',
  'Foam Plastic (Unapproved)',
  'Combustible (Other)',
];

const WALL_MATERIALS = [
  'Heavy Non-Combustible',
  'Light Non-Combustible',
  'Foam Plastic (Approved)',
  'Foam Plastic (Unapproved)',
  'Combustible (Other)',
];

const FRAME_TYPES = ['Steel', 'Timber', 'Reinforced Concrete', 'Masonry', 'Other'];

function createEmptyBuilding(): Building {
  return {
    id: crypto.randomUUID(),
    building_name: '',
    roof: {
      material: 'Heavy Non-Combustible',
      area_sqm: null,
    },
    walls: {
      breakdown: [],
      total_percent: 0,
    },
    upper_floors_mezz_sqm: null,
    geometry: {
      floors: null,
      basements: null,
      height_m: null,
    },
    cladding: {
      present: false,
      details: '',
    },
    compartmentation: 'unknown',
    frame: {
      type: 'Steel',
      protection: 'unknown',
    },
    notes: '',
    combustibility_score: 0,
    combustibility_band: 'Low',
    rating: 3,
  };
}

function computeCombustibility(building: Building): { score: number; band: 'Low' | 'Medium' | 'High' } {
  let score = 0;

  // Roof material scoring (0 = non-combustible, 1 = limited, 2 = combustible)
  const roofFactor =
    building.roof.material.includes('Combustible') ? 2 :
    building.roof.material.includes('Unapproved') ? 2 :
    building.roof.material.includes('Approved') ? 1 : 0;

  // Apply roof area multiplier if present
  const roofContribution = roofFactor * (building.roof.area_sqm && building.roof.area_sqm > 0 ? 1.5 : 1);
  score += roofContribution;

  // Walls scoring - weighted average by percent
  let wallsScore = 0;
  if (building.walls.breakdown.length > 0 && building.walls.total_percent > 0) {
    for (const wall of building.walls.breakdown) {
      const wallFactor =
        wall.material.includes('Combustible') ? 2 :
        wall.material.includes('Unapproved') ? 2 :
        wall.material.includes('Approved') ? 1 : 0;
      wallsScore += (wallFactor * wall.percent) / 100;
    }
  }
  score += wallsScore * 2; // Walls are significant contributor

  // Cladding adjustment
  if (building.cladding.present) {
    const isNonCombustible = building.cladding.details.toLowerCase().includes('non-combustible') ||
                             building.cladding.details.toLowerCase().includes('non combustible');
    if (!isNonCombustible) {
      score += 0.5;
    }
  }

  // Frame adjustment
  if (building.frame.type === 'Timber') {
    score += 1;
  }
  if (building.frame.protection === 'unprotected' && building.frame.type === 'Steel') {
    score += 0.3;
  }
  if (building.frame.protection === 'protected') {
    score -= 0.2;
  }

  // Normalize to 0-10 scale
  const normalizedScore = Math.min(10, Math.max(0, Math.round(score * 10) / 10));

  // Determine band
  let band: 'Low' | 'Medium' | 'High';
  if (normalizedScore <= 3) {
    band = 'Low';
  } else if (normalizedScore <= 6) {
    band = 'Medium';
  } else {
    band = 'High';
  }

  return { score: normalizedScore, band };
}

export default function RE02ConstructionForm({
  moduleInstance,
  document,
  onSaved,
}: RE02ConstructionFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const d = moduleInstance.data || {};

  const safeBuildings: Building[] = Array.isArray(d.construction?.buildings)
    ? d.construction.buildings.map((b: any) => ({
        ...createEmptyBuilding(),
        ...b,
        roof: { ...createEmptyBuilding().roof, ...(b.roof || {}) },
        walls: {
          breakdown: Array.isArray(b.walls?.breakdown) ? b.walls.breakdown : [],
          total_percent: b.walls?.total_percent || 0,
        },
        geometry: { ...createEmptyBuilding().geometry, ...(b.geometry || {}) },
        cladding: { ...createEmptyBuilding().cladding, ...(b.cladding || {}) },
        frame: { ...createEmptyBuilding().frame, ...(b.frame || {}) },
      }))
    : [];

  const [formData, setFormData] = useState({
    buildings: safeBuildings,
    site_rating: typeof d.construction?.site_rating === 'number' ? d.construction.site_rating : 3,
    site_notes: d.construction?.site_notes || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');
  const [editingWallsFor, setEditingWallsFor] = useState<string | null>(null);

  const updateBuilding = (id: string, updates: Partial<Building>) => {
    setFormData({
      ...formData,
      buildings: formData.buildings.map((b) => {
        if (b.id === id) {
          const updated = { ...b, ...updates };
          const combustibility = computeCombustibility(updated);
          return {
            ...updated,
            combustibility_score: combustibility.score,
            combustibility_band: combustibility.band,
          };
        }
        return b;
      }),
    });
  };

  const addBuilding = () => {
    setFormData({
      ...formData,
      buildings: [...formData.buildings, createEmptyBuilding()],
    });
  };

  const removeBuilding = (id: string) => {
    if (formData.buildings.length === 1) {
      alert('At least one building must remain');
      return;
    }
    setFormData({
      ...formData,
      buildings: formData.buildings.filter((b) => b.id !== id),
    });
  };

  const handleSave = async () => {
    // Validate wall percentages
    for (const building of formData.buildings) {
      if (building.walls.breakdown.length > 0 && building.walls.total_percent !== 100) {
        alert(`Building "${building.building_name || 'Unnamed'}": Wall percentages must total 100% (currently ${building.walls.total_percent}%)`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const completedAt = outcome ? new Date().toISOString() : null;
      const sanitized = sanitizeModuleInstancePayload({
        data: { construction: formData },
      });

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

  const building = editingWallsFor ? formData.buildings.find(b => b.id === editingWallsFor) : null;

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto pb-24">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-02 - Construction</h2>
          <p className="text-slate-600">Building construction assessment with combustibility analysis</p>
        </div>

        {/* Buildings Table */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Building Name</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Roof Material</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Roof Area (m²)</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Walls</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Upper Floors (m²)</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Geometry</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Cladding</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Compart.</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Frame</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Combustibility</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Rating</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {formData.buildings.map((bldg, idx) => (
                  <tr key={bldg.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={bldg.building_name}
                        onChange={(e) => updateBuilding(bldg.id, { building_name: e.target.value })}
                        className="w-full min-w-[120px] px-2 py-1 border border-slate-300 rounded text-sm"
                        placeholder="Building name"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={bldg.roof.material}
                        onChange={(e) => updateBuilding(bldg.id, { roof: { ...bldg.roof, material: e.target.value } })}
                        className="w-full min-w-[140px] px-2 py-1 border border-slate-300 rounded text-sm"
                      >
                        {ROOF_MATERIALS.map(mat => (
                          <option key={mat} value={mat}>{mat}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={bldg.roof.area_sqm || ''}
                        onChange={(e) => updateBuilding(bldg.id, { roof: { ...bldg.roof, area_sqm: e.target.value ? parseFloat(e.target.value) : null } })}
                        className="w-full min-w-[80px] px-2 py-1 border border-slate-300 rounded text-sm"
                        placeholder="Area"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setEditingWallsFor(bldg.id)}
                        className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-sm"
                      >
                        <Edit2 className="w-3 h-3" />
                        {bldg.walls.breakdown.length > 0 ? `${bldg.walls.total_percent}%` : 'Edit'}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={bldg.upper_floors_mezz_sqm || ''}
                        onChange={(e) => updateBuilding(bldg.id, { upper_floors_mezz_sqm: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-full min-w-[80px] px-2 py-1 border border-slate-300 rounded text-sm"
                        placeholder="Area"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 min-w-[120px]">
                        <input
                          type="number"
                          value={bldg.geometry.floors || ''}
                          onChange={(e) => updateBuilding(bldg.id, { geometry: { ...bldg.geometry, floors: e.target.value ? parseInt(e.target.value) : null } })}
                          className="w-12 px-1 py-1 border border-slate-300 rounded text-xs"
                          placeholder="F"
                          title="Floors"
                        />
                        <input
                          type="number"
                          value={bldg.geometry.basements || ''}
                          onChange={(e) => updateBuilding(bldg.id, { geometry: { ...bldg.geometry, basements: e.target.value ? parseInt(e.target.value) : null } })}
                          className="w-12 px-1 py-1 border border-slate-300 rounded text-xs"
                          placeholder="B"
                          title="Basements"
                        />
                        <input
                          type="number"
                          value={bldg.geometry.height_m || ''}
                          onChange={(e) => updateBuilding(bldg.id, { geometry: { ...bldg.geometry, height_m: e.target.value ? parseFloat(e.target.value) : null } })}
                          className="w-12 px-1 py-1 border border-slate-300 rounded text-xs"
                          placeholder="H"
                          title="Height (m)"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={bldg.cladding.present}
                        onChange={(e) => updateBuilding(bldg.id, { cladding: { ...bldg.cladding, present: e.target.checked } })}
                        className="rounded"
                        title="Cladding present"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={bldg.compartmentation}
                        onChange={(e) => updateBuilding(bldg.id, { compartmentation: e.target.value as any })}
                        className="w-full min-w-[90px] px-2 py-1 border border-slate-300 rounded text-sm"
                      >
                        <option value="unknown">Unknown</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1 min-w-[120px]">
                        <select
                          value={bldg.frame.type}
                          onChange={(e) => updateBuilding(bldg.id, { frame: { ...bldg.frame, type: e.target.value } })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                        >
                          {FRAME_TYPES.map(ft => (
                            <option key={ft} value={ft}>{ft}</option>
                          ))}
                        </select>
                        <select
                          value={bldg.frame.protection}
                          onChange={(e) => updateBuilding(bldg.id, { frame: { ...bldg.frame, protection: e.target.value as any } })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                        >
                          <option value="unknown">Unknown</option>
                          <option value="protected">Protected</option>
                          <option value="unprotected">Unprotected</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                          bldg.combustibility_band === 'High' ? 'bg-red-100 text-red-800' :
                          bldg.combustibility_band === 'Medium' ? 'bg-amber-100 text-amber-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {bldg.combustibility_band}
                        </span>
                        <span className="text-xs text-slate-500">{bldg.combustibility_score}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={bldg.rating}
                        onChange={(e) => updateBuilding(bldg.id, { rating: parseInt(e.target.value) })}
                        className="w-full min-w-[60px] px-2 py-1 border border-slate-300 rounded text-sm font-medium"
                      >
                        {[1, 2, 3, 4, 5].map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeBuilding(bldg.id)}
                        className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                        title="Delete building"
                        disabled={formData.buildings.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Building Button */}
          <div className="border-t border-slate-200 p-4">
            <button
              onClick={addBuilding}
              className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-slate-400 hover:text-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Building
            </button>
          </div>
        </div>

        {/* Site-Level Controls */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Site-Level Assessment</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Site Construction Rating (1-5)</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={formData.site_rating}
                  onChange={(e) => setFormData({ ...formData, site_rating: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 font-bold text-blue-900">
                  {formData.site_rating}
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                1 = Poor, 3 = Average, 5 = Excellent
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Site Notes</label>
              <textarea
                value={formData.site_notes}
                onChange={(e) => setFormData({ ...formData, site_notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Overall site construction observations, context, or summary..."
              />
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

      <FloatingSaveBar onSave={handleSave} isSaving={isSaving} />

      {/* Walls Editor Modal */}
      {editingWallsFor && building && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Edit Walls Breakdown</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {building.building_name || 'Unnamed Building'}
                  </p>
                </div>
                <button
                  onClick={() => setEditingWallsFor(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {building.walls.breakdown.map((wall, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Material</label>
                      <select
                        value={wall.material}
                        onChange={(e) => {
                          const newBreakdown = [...building.walls.breakdown];
                          newBreakdown[idx] = { ...wall, material: e.target.value };
                          const total = newBreakdown.reduce((sum, w) => sum + w.percent, 0);
                          updateBuilding(building.id, {
                            walls: { breakdown: newBreakdown, total_percent: total }
                          });
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                      >
                        {WALL_MATERIALS.map(mat => (
                          <option key={mat} value={mat}>{mat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Percent</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={wall.percent}
                        onChange={(e) => {
                          const newBreakdown = [...building.walls.breakdown];
                          newBreakdown[idx] = { ...wall, percent: parseFloat(e.target.value) || 0 };
                          const total = newBreakdown.reduce((sum, w) => sum + w.percent, 0);
                          updateBuilding(building.id, {
                            walls: { breakdown: newBreakdown, total_percent: total }
                          });
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const newBreakdown = building.walls.breakdown.filter((_, i) => i !== idx);
                        const total = newBreakdown.reduce((sum, w) => sum + w.percent, 0);
                        updateBuilding(building.id, {
                          walls: { breakdown: newBreakdown, total_percent: total }
                        });
                      }}
                      className="mt-6 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => {
                    const newBreakdown = [
                      ...building.walls.breakdown,
                      { material: WALL_MATERIALS[0], percent: 0 }
                    ];
                    const total = newBreakdown.reduce((sum, w) => sum + w.percent, 0);
                    updateBuilding(building.id, {
                      walls: { breakdown: newBreakdown, total_percent: total }
                    });
                  }}
                  className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-slate-400 hover:text-slate-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Material
                </button>

                <div className={`p-3 rounded-lg ${
                  building.walls.total_percent === 100 ? 'bg-green-50 border border-green-200' :
                  building.walls.total_percent === 0 ? 'bg-slate-50 border border-slate-200' :
                  'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700">Total:</span>
                    <span className={`text-lg font-bold ${
                      building.walls.total_percent === 100 ? 'text-green-700' :
                      building.walls.total_percent === 0 ? 'text-slate-700' :
                      'text-red-700'
                    }`}>
                      {building.walls.total_percent}%
                    </span>
                  </div>
                  {building.walls.total_percent !== 100 && building.walls.total_percent !== 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      Must total 100% before saving
                    </p>
                  )}
                </div>

                {/* Cladding Details (if present) */}
                {building.cladding.present && (
                  <div className="pt-4 border-t border-slate-200">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cladding Details</label>
                    <textarea
                      value={building.cladding.details}
                      onChange={(e) => updateBuilding(building.id, {
                        cladding: { ...building.cladding, details: e.target.value }
                      })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                      placeholder="Describe cladding type, material, compliance status (include 'non-combustible' if applicable)"
                    />
                  </div>
                )}

                {/* Notes */}
                <div className="pt-4 border-t border-slate-200">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Building Notes</label>
                  <textarea
                    value={building.notes}
                    onChange={(e) => updateBuilding(building.id, { notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    placeholder="Additional observations about this building..."
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setEditingWallsFor(null)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
