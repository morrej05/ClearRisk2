import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import ModuleActions from '../ModuleActions';
import FloatingSaveBar from './FloatingSaveBar';
import { Plus, Trash2, Edit2, X, Info } from 'lucide-react';

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

interface MaterialBreakdown {
  material: string;
  percent: number;
}

interface CalculatedMetrics {
  construction_score: number; // 0-100 internal score
  construction_rating: number; // 1-5 derived rating
  combustible_percent: number; // 0-100 percentage
}

interface Building {
  id: string;
  building_name: string;
  roof: {
    area_sqm: number | null;
    breakdown: MaterialBreakdown[];
    total_percent: number;
  };
  walls: {
    breakdown: MaterialBreakdown[];
    total_percent: number;
  };
  upper_floors_mezzanine: {
    area_sqm: number | null;
    breakdown: MaterialBreakdown[];
    total_percent: number;
  };
  geometry: {
    floors: number | null;
    basements: number | null;
    height_m: number | null;
  };
  combustible_cladding: {
    present: boolean;
    details: string;
  };
  compartmentation: 'low' | 'medium' | 'high' | 'unknown';
  frame_type: 'steel' | 'protected_steel' | 'timber' | 'reinforced_concrete' | 'masonry' | 'other';
  notes: string;
  calculated?: CalculatedMetrics;
}

const CONSTRUCTION_MATERIALS = [
  'Heavy Non-Combustible',
  'Light Non-Combustible',
  'Foam Plastic (Approved)',
  'Foam Plastic (Unapproved)',
  'Combustible (Other)',
  'Unknown',
];

// Mezzanine / upper floors options should be different from roof/walls
const MEZZANINE_MATERIALS = [
  'Reinforced Concrete',
  'Composite Steel Deck + Concrete',
  'Protected Steel Mezzanine',
  'Unprotected Steel Mezzanine',
  'Timber Floor / Timber Mezzanine',
  'Unknown',
];

const FRAME_TYPES = [
  { value: 'steel', label: 'Steel' },
  { value: 'protected_steel', label: 'Protected Steel' },
  { value: 'timber', label: 'Timber' },
  { value: 'reinforced_concrete', label: 'Reinforced Concrete' },
  { value: 'masonry', label: 'Masonry' },
  { value: 'other', label: 'Other' },
];

const getMaterialOptionsForType = (type: 'roof' | 'walls' | 'mezzanine') => {
  if (type === 'mezzanine') return MEZZANINE_MATERIALS;
  return CONSTRUCTION_MATERIALS;
};

function createEmptyBuilding(): Building {
  return {
    id: crypto.randomUUID(),
    building_name: '',
    roof: {
      area_sqm: null,
      breakdown: [],
      total_percent: 0,
    },
    walls: {
      breakdown: [],
      total_percent: 0,
    },
    upper_floors_mezzanine: {
      area_sqm: null,
      breakdown: [],
      total_percent: 0,
    },
    geometry: {
      floors: null,
      basements: null,
      height_m: null,
    },
    combustible_cladding: {
      present: false,
      details: '',
    },
    compartmentation: 'unknown',
    frame_type: 'steel',
    notes: '',
  };
}

/**
 * Get human-readable label for construction rating
 */
function getRatingLabel(rating: number): string {
  switch (rating) {
    case 5:
      return 'Excellent';
    case 4:
      return 'Good';
    case 3:
      return 'Average';
    case 2:
      return 'Below Average';
    case 1:
      return 'Poor';
    default:
      return 'Unknown';
  }
}

/**
 * Convert roof/walls label to a simple factor (0..2-ish) used by existing scoring.
 * This keeps behaviour stable while still allowing breakdown scoring.
 */
function getGenericMaterialFactor(label: string): number {
  const m = (label || '').toLowerCase();
  if (m.includes('combustible')) return 2;
  if (m.includes('unapproved')) return 2;
  if (m.includes('approved')) return 1;
  if (m.includes('light non-combustible')) return 0;
  if (m.includes('heavy non-combustible')) return 0;
  if (m.includes('unknown')) return 1; // conservative mid
  return 1;
}

/**
 * Mezzanine factor (0.1..0.9) used to apply a penalty and influence combustible %
 * This is separate from roof/walls because mezzanine options are different.
 */
function getMezzanineFactor(material: string): number {
  const m = (material || '').toLowerCase();

  // Low combustibility / robust
  if (m.includes('reinforced concrete')) return 0.1;
  if (m.includes('composite')) return 0.2; // steel deck + concrete topping

  // Steel mezzanine
  if (m.includes('protected steel')) return 0.5;
  if (m.includes('unprotected steel')) return 0.8;

  // High combustibility
  if (m.includes('timber')) return 0.9;

  // Unknown / default conservative mid
  return 0.6;
}

/**
 * Get combustible factor for area-weighted combustible % calculation.
 * Returns 0 (non-combustible), 0.5 (partial/unknown), or 1 (fully combustible).
 */
function getMaterialCombustibleFactor(material: string): number {
  const m = (material || '').toLowerCase();

  // Non-combustible materials
  if (m.includes('heavy non-combustible')) return 0;
  if (m.includes('light non-combustible')) return 0;

  // Partial combustibility
  if (m.includes('foam plastic') && m.includes('approved')) return 0.5;

  // Fully combustible
  if (m.includes('foam plastic') && m.includes('unapproved')) return 1;
  if (m.includes('combustible')) return 1;

  // Unknown - conservative default
  if (m.includes('unknown')) return 0.5;

  // Default conservative
  return 0.5;
}

/**
 * Calculate weighted combustible fraction from breakdown.
 * Returns 0-1 representing the combustible fraction of the breakdown.
 */
function getBreakdownCombustibleFraction(
  breakdown: Array<{ material: string; percent: number }>,
  total_percent: number
): number {
  // No breakdown or incomplete - return conservative default
  if (!breakdown || breakdown.length === 0 || total_percent <= 0) {
    return 0.5;
  }

  // Calculate weighted average of combustible factors
  let weightedSum = 0;
  for (const item of breakdown) {
    const factor = getMaterialCombustibleFactor(item.material);
    weightedSum += factor * (item.percent / 100);
  }

  return weightedSum;
}

/**
 * Calculate comprehensive construction metrics for a building
 * Returns score (0-100), rating (1-5), and combustible percentage.
 *
 * NOTE: This is a deterministic rubric (not user-scored).
 */
function calculateConstructionMetrics(building: Building): CalculatedMetrics {
  let rawScore = 100; // Start with perfect score, deduct for risks
  let combustiblePoints = 0; // Track combustible elements
  let totalPoints = 0; // Track total elements for percentage

  // --- Roof material analysis (dominant driver)
  if (building.roof.breakdown.length > 0 && building.roof.total_percent > 0) {
    for (const roofMat of building.roof.breakdown) {
      const roofFactor = getGenericMaterialFactor(roofMat.material); // 0,1,2
      const roofPenalty =
        roofFactor *
        (roofMat.percent / 100) *
        (building.roof.area_sqm && building.roof.area_sqm > 0 ? 12 : 8);

      rawScore -= roofPenalty;

      // combustible contribution (roof is important)
      combustiblePoints += roofFactor * (roofMat.percent / 100) * 2;
    }
  }
  totalPoints += 2;

  // --- Walls analysis
  if (building.walls.breakdown.length > 0 && building.walls.total_percent > 0) {
    for (const wall of building.walls.breakdown) {
      const wallFactor = getGenericMaterialFactor(wall.material); // 0,1,2
      const wallPenalty = wallFactor * (wall.percent / 100) * 15;
      rawScore -= wallPenalty;

      combustiblePoints += wallFactor * (wall.percent / 100) * 3;
    }
    totalPoints += 3;
  } else {
    totalPoints += 3;
  }

  // --- Upper floors / mezzanine analysis (MISSING BEFORE — now included)
  if (
    building.upper_floors_mezzanine?.breakdown?.length > 0 &&
    building.upper_floors_mezzanine.total_percent > 0
  ) {
    // Scale based on mezzanine extent: small mezzanine has limited impact, large mezzanine matters more.
    const mezzArea = building.upper_floors_mezzanine.area_sqm ?? 0;
    const roofArea = building.roof.area_sqm ?? 0;
    const refArea = roofArea > 0 ? roofArea : 1000; // safe fallback
    const mezzRatio = Math.max(0, Math.min(1, mezzArea / refArea));
    const mezzScale = 0.6 + 0.6 * mezzRatio; // 0.6..1.2

    let mezzWeightedFactor = 0; // 0.1..0.9 weighted
    for (const item of building.upper_floors_mezzanine.breakdown) {
      const factor = getMezzanineFactor(item.material);
      mezzWeightedFactor += factor * (item.percent / 100);
    }

    // Penalty sits below roof but meaningfully above walls when mezzanine is large.
    const mezzPenalty = mezzWeightedFactor * 20 * mezzScale; // max ~24
    rawScore -= mezzPenalty;

    // Add to combustible metric (significant, but not as dominant as roof)
    combustiblePoints += mezzWeightedFactor * 2;
  }
  totalPoints += 2;

  // --- Combustible cladding
  if (building.combustible_cladding.present) {
    rawScore -= 10;
    combustiblePoints += 1;
  }
  totalPoints += 1;

  // --- Frame type and protection
  if (building.frame_type === 'timber') {
    rawScore -= 15;
    combustiblePoints += 2;
  } else if (building.frame_type === 'steel') {
    rawScore -= 8;
    combustiblePoints += 0.5;
  } else if (building.frame_type === 'protected_steel') {
    rawScore += 5; // Bonus for protected steel
  } else if (building.frame_type === 'reinforced_concrete' || building.frame_type === 'masonry') {
    rawScore += 5; // Bonus for non-combustible frame
  }
  totalPoints += 2;

  // --- Compartmentation bonus/penalty
  if (building.compartmentation === 'high') {
    rawScore += 10;
  } else if (building.compartmentation === 'medium') {
    rawScore += 5;
  } else if (building.compartmentation === 'low') {
    rawScore -= 5;
  }

  // Clamp score to 0-100
  const construction_score = Math.min(100, Math.max(0, Math.round(rawScore)));

  // Derive rating from score (1-5 scale)
  let construction_rating: number;
  if (construction_score >= 85) {
    construction_rating = 5;
  } else if (construction_score >= 70) {
    construction_rating = 4;
  } else if (construction_score >= 50) {
    construction_rating = 3;
  } else if (construction_score >= 30) {
    construction_rating = 2;
  } else {
    construction_rating = 1;
  }

  // Calculate area-weighted combustible percentage (0-100)
  let combustible_percent = 0;

  // Get actual areas
  const roofArea = building.roof.area_sqm ?? 0;
  const mezzArea = building.upper_floors_mezzanine.area_sqm ?? 0;

  // Calculate combustible fractions for each component
  const roofFrac = getBreakdownCombustibleFraction(building.roof.breakdown, building.roof.total_percent);
  const wallFrac = getBreakdownCombustibleFraction(building.walls.breakdown, building.walls.total_percent);
  const mezzFrac = getBreakdownCombustibleFraction(
    building.upper_floors_mezzanine.breakdown,
    building.upper_floors_mezzanine.total_percent
  );

  // Wall proxy area (walls scale with building footprint)
  const wallProxyArea = roofArea > 0 ? roofArea * 0.6 : 0;

  // Cladding proxy area (envelope uplift if combustible cladding present)
const claddingArea = building.combustible_cladding.present ? wallProxyArea * 0.25 : 0;

  // Total reference area
  const totalRefArea = roofArea + mezzArea + wallProxyArea + claddingArea;

  if (totalRefArea > 0) {
    // Calculate combustible area (weighted by combustible fraction)
    const combustibleArea =
      roofArea * roofFrac + mezzArea * mezzFrac + wallProxyArea * wallFrac + claddingArea * 1;

    // Calculate percentage and clamp to 0-100
    combustible_percent = Math.min(100, Math.max(0, Math.round((combustibleArea / totalRefArea) * 100)));
  } else {
    // No area data - default to 0
    combustible_percent = 0;
  }

  return {
    construction_score,
    construction_rating,
    combustible_percent,
  };
}
function hasAreaData(building: Building): boolean {
  return (
    (building.roof?.area_sqm ?? 0) > 0 ||
    (building.upper_floors_mezzanine?.area_sqm ?? 0) > 0
  );
}

export default function RE02ConstructionForm({ moduleInstance, document, onSaved }: RE02ConstructionFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const d = moduleInstance.data || {};

  const safeBuildings: Building[] = Array.isArray(d.construction?.buildings)
    ? d.construction.buildings.map((b: any) => {
        // Migrate old cladding to combustible_cladding
        const combustible_cladding = b.combustible_cladding
          ? { ...createEmptyBuilding().combustible_cladding, ...b.combustible_cladding }
          : b.cladding
          ? { ...createEmptyBuilding().combustible_cladding, ...b.cladding }
          : createEmptyBuilding().combustible_cladding;

        // Migrate roof: old {material, area_sqm} => new {area_sqm, breakdown[], total_percent}
        let roof: Building['roof'];
        if (b.roof?.breakdown && Array.isArray(b.roof.breakdown)) {
          roof = {
            area_sqm: b.roof.area_sqm ?? null,
            breakdown: b.roof.breakdown,
            total_percent: b.roof.total_percent || 0,
          };
        } else if (b.roof?.material) {
          roof = {
            area_sqm: b.roof.area_sqm ?? null,
            breakdown: [{ material: b.roof.material, percent: 100 }],
            total_percent: 100,
          };
        } else {
          roof = createEmptyBuilding().roof;
        }

        // Migrate walls
        const walls: Building['walls'] = {
          breakdown: Array.isArray(b.walls?.breakdown) ? b.walls.breakdown : [],
          total_percent: b.walls?.total_percent || 0,
        };

        // Migrate upper_floors_mezzanine: old upper_floors_mezz_sqm => new {area_sqm, breakdown[], total_percent}
        let upper_floors_mezzanine: Building['upper_floors_mezzanine'];
        if (b.upper_floors_mezzanine?.breakdown && Array.isArray(b.upper_floors_mezzanine.breakdown)) {
          upper_floors_mezzanine = {
            area_sqm: b.upper_floors_mezzanine.area_sqm ?? null,
            breakdown: b.upper_floors_mezzanine.breakdown,
            total_percent: b.upper_floors_mezzanine.total_percent || 0,
          };
        } else if (typeof b.upper_floors_mezz_sqm === 'number') {
          upper_floors_mezzanine = {
            area_sqm: b.upper_floors_mezz_sqm,
            breakdown: [{ material: 'Unknown', percent: 100 }],
            total_percent: 100,
          };
        } else {
          upper_floors_mezzanine = createEmptyBuilding().upper_floors_mezzanine;
        }

        // Migrate frame: old {type, protection} => new frame_type
        let frame_type: Building['frame_type'] = 'steel';
        if (typeof b.frame_type === 'string') {
          frame_type = b.frame_type;
        } else if (b.frame?.type) {
          const oldType = String(b.frame.type || '').toLowerCase();
          const oldProtection = b.frame.protection;

          if (oldType.includes('steel')) {
            frame_type = oldProtection === 'protected' ? 'protected_steel' : 'steel';
          } else if (oldType.includes('timber')) {
            frame_type = 'timber';
          } else if (oldType.includes('concrete')) {
            frame_type = 'reinforced_concrete';
          } else if (oldType.includes('masonry')) {
            frame_type = 'masonry';
          } else {
            frame_type = 'other';
          }
        }

        return {
          ...createEmptyBuilding(),
          ...b,
          roof,
          walls,
          upper_floors_mezzanine,
          geometry: { ...createEmptyBuilding().geometry, ...(b.geometry || {}) },
          combustible_cladding,
          frame_type,
          notes: b.notes || '',
        };
      })
    : [];

  const [formData, setFormData] = useState({
    buildings: safeBuildings.map((b) => ({
      ...b,
      calculated: calculateConstructionMetrics(b),
    })),
    site_notes: d.construction?.site_notes || '',
  });

  const [editingBreakdown, setEditingBreakdown] = useState<{
    buildingId: string;
    type: 'roof' | 'walls' | 'mezzanine';
  } | null>(null);

  const updateBuilding = (id: string, updates: Partial<Building>) => {
    setFormData((prev) => ({
      ...prev,
      buildings: prev.buildings.map((b) => {
        if (b.id === id) {
          const updated: Building = { ...b, ...updates } as Building;
          const calculated = calculateConstructionMetrics(updated);
          return { ...updated, calculated };
        }
        return b;
      }),
    }));
  };

  const addBuilding = () => {
    const newBuilding = createEmptyBuilding();
    const calculated = calculateConstructionMetrics(newBuilding);
    setFormData((prev) => ({
      ...prev,
      buildings: [...prev.buildings, { ...newBuilding, calculated }],
    }));
  };

  const removeBuilding = (id: string) => {
    if (formData.buildings.length === 1) {
      alert('At least one building must remain');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      buildings: prev.buildings.filter((b) => b.id !== id),
    }));
  };

  const handleSave = async () => {
    // Validate breakdown percentages
    for (const building of formData.buildings) {
      if (building.roof.breakdown.length > 0 && building.roof.total_percent !== 100) {
        alert(
          `Building "${building.building_name || 'Unnamed'}": Roof percentages must total 100% (currently ${building.roof.total_percent}%)`
        );
        return;
      }
      if (building.walls.breakdown.length > 0 && building.walls.total_percent !== 100) {
        alert(
          `Building "${building.building_name || 'Unnamed'}": Wall percentages must total 100% (currently ${building.walls.total_percent}%)`
        );
        return;
      }
      if (building.upper_floors_mezzanine.breakdown.length > 0 && building.upper_floors_mezzanine.total_percent !== 100) {
        alert(
          `Building "${building.building_name || 'Unnamed'}": Mezzanine percentages must total 100% (currently ${building.upper_floors_mezzanine.total_percent}%)`
        );
        return;
      }
    }

    setIsSaving(true);
    try {
      // Remove calculated fields before saving
      const buildingsWithoutCalculated = formData.buildings.map(({ calculated, ...building }) => building);

      // Build payload directly - save as jsonb without sanitization
      const payload = {
        construction: {
          ...formData,
          buildings: buildingsWithoutCalculated
        }
      };

      const { error } = await supabase
        .from('module_instances')
        .update({
          data: payload,
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

  const editingBuilding = editingBreakdown ? formData.buildings.find((b) => b.id === editingBreakdown.buildingId) : null;

  const getBreakdownData = (building: Building, type: 'roof' | 'walls' | 'mezzanine') => {
    switch (type) {
      case 'roof':
        return building.roof;
      case 'walls':
        return building.walls;
      case 'mezzanine':
        return building.upper_floors_mezzanine;
    }
  };

  const getBreakdownTitle = (type: 'roof' | 'walls' | 'mezzanine') => {
    switch (type) {
      case 'roof':
        return 'Roof Materials';
      case 'walls':
        return 'Walls';
      case 'mezzanine':
        return 'Upper Floors / Mezzanine';
    }
  };

  const updateBreakdownData = (
    buildingId: string,
    type: 'roof' | 'walls' | 'mezzanine',
    data: { breakdown: MaterialBreakdown[]; total_percent: number }
  ) => {
    const updates: Partial<Building> = {};
    if (type === 'roof') {
      const building = formData.buildings.find((b) => b.id === buildingId);
      if (building) updates.roof = { ...building.roof, ...data };
    } else if (type === 'walls') {
      updates.walls = data;
    } else if (type === 'mezzanine') {
      const building = formData.buildings.find((b) => b.id === buildingId);
      if (building) updates.upper_floors_mezzanine = { ...building.upper_floors_mezzanine, ...data };
    }
    updateBuilding(buildingId, updates);
  };

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
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Roof</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Walls</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Upper floors / mezzanine</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Geometry</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Comb. Cladding</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Compart.</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Frame</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Calculated Metrics</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {formData.buildings.map((bldg) => (
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

                    {/* Roof */}
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1 min-w-[110px]">
                        <input
                          type="number"
                          value={bldg.roof.area_sqm || ''}
                          onChange={(e) =>
                            updateBuilding(bldg.id, {
                              roof: { ...bldg.roof, area_sqm: e.target.value ? parseFloat(e.target.value) : null },
                            })
                          }
                          className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                          placeholder="Area m²"
                        />
                        <button
                          onClick={() => setEditingBreakdown({ buildingId: bldg.id, type: 'roof' })}
                          className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs"
                        >
                          <Edit2 className="w-3 h-3" />
                          {bldg.roof.breakdown.length > 0 ? `${bldg.roof.total_percent}%` : 'Edit'}
                        </button>
                      </div>
                    </td>

                    {/* Walls */}
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setEditingBreakdown({ buildingId: bldg.id, type: 'walls' })}
                        className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-sm"
                      >
                        <Edit2 className="w-3 h-3" />
                        {bldg.walls.breakdown.length > 0 ? `${bldg.walls.total_percent}%` : 'Edit'}
                      </button>
                    </td>

                    {/* Mezzanine */}
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1 min-w-[140px]">
                        <input
                          type="number"
                          value={bldg.upper_floors_mezzanine.area_sqm || ''}
                          onChange={(e) =>
                            updateBuilding(bldg.id, {
                              upper_floors_mezzanine: {
                                ...bldg.upper_floors_mezzanine,
                                area_sqm: e.target.value ? parseFloat(e.target.value) : null,
                              },
                            })
                          }
                          className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                          placeholder="Area m²"
                        />
                        <button
                          onClick={() => setEditingBreakdown({ buildingId: bldg.id, type: 'mezzanine' })}
                          className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs"
                        >
                          <Edit2 className="w-3 h-3" />
                          {bldg.upper_floors_mezzanine.breakdown.length > 0
                            ? `${bldg.upper_floors_mezzanine.total_percent}%`
                            : 'Edit'}
                        </button>
                      </div>
                    </td>

                    {/* Geometry */}
                    <td className="px-3 py-2">
                      <div className="flex gap-1 min-w-[120px]">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={bldg.geometry.floors || ''}
                          onChange={(e) => {
                            const val = e.target.value ? Math.max(0, parseInt(e.target.value)) : null;
                            updateBuilding(bldg.id, { geometry: { ...bldg.geometry, floors: val } });
                          }}
                          className="w-12 px-1 py-1 border border-slate-300 rounded text-xs"
                          placeholder="F"
                          title="Floors (positive)"
                        />
                        <input
                          type="number"
                          max="-1"
                          step="1"
                          value={bldg.geometry.basements || ''}
                          onChange={(e) => {
                            if (!e.target.value) {
                              updateBuilding(bldg.id, { geometry: { ...bldg.geometry, basements: null } });
                            } else {
                              const val = Math.min(-1, parseInt(e.target.value));
                              updateBuilding(bldg.id, { geometry: { ...bldg.geometry, basements: val } });
                            }
                          }}
                          className="w-12 px-1 py-1 border border-slate-300 rounded text-xs"
                          placeholder="B"
                          title="Basements (negative)"
                        />
                        <input
                          type="number"
                          value={bldg.geometry.height_m || ''}
                          onChange={(e) =>
                            updateBuilding(bldg.id, {
                              geometry: { ...bldg.geometry, height_m: e.target.value ? parseFloat(e.target.value) : null },
                            })
                          }
                          className="w-12 px-1 py-1 border border-slate-300 rounded text-xs"
                          placeholder="H"
                          title="Height (m)"
                        />
                      </div>
                    </td>

                    {/* Combustible cladding */}
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={bldg.combustible_cladding.present}
                        onChange={(e) =>
                          updateBuilding(bldg.id, {
                            combustible_cladding: { ...bldg.combustible_cladding, present: e.target.checked },
                          })
                        }
                        className="rounded"
                        title="Combustible cladding"
                      />
                    </td>

                    {/* Compartmentation */}
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

                    {/* Frame */}
                    <td className="px-3 py-2">
                      <select
                        value={bldg.frame_type}
                        onChange={(e) => updateBuilding(bldg.id, { frame_type: e.target.value as any })}
                        className="w-full min-w-[120px] px-2 py-1 border border-slate-300 rounded text-sm"
                      >
                        {FRAME_TYPES.map((ft) => (
                          <option key={ft.value} value={ft.value}>
                            {ft.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Metrics */}
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1 min-w-[140px]">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              (bldg.calculated?.construction_rating ?? 3) >= 4
                                ? 'bg-green-100 text-green-800'
                                : (bldg.calculated?.construction_rating ?? 3) === 3
                                ? 'bg-blue-100 text-blue-800'
                                : (bldg.calculated?.construction_rating ?? 3) === 2
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {bldg.calculated?.construction_rating ?? 3} – {getRatingLabel(bldg.calculated?.construction_rating ?? 3)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasAreaData(bldg) ? (
                          <span
                            className={`text-xs font-bold ${
                            (bldg.calculated?.combustible_percent ?? 0) > 50
                            ? 'text-red-600'
                            : (bldg.calculated?.combustible_percent ?? 0) > 25
                            ? 'text-amber-600'
                            : 'text-green-600'
                        }`}
                        >
                            {bldg.calculated?.combustible_percent ?? 0}%
                        </span>
                      ) : (
                          <span className="text-xs text-slate-400 italic">—</span>
                      )}

                        </div>
                      </div>
                    </td>

                    {/* Row actions */}
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

        {/* Compartmentation Definitions */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Compartmentation Guidance</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="font-medium text-slate-700">Low:</span>
              <p className="text-slate-600 mt-1">
                Large open spaces with minimal fire separation. Few fire-rated barriers or compartment walls. Significant potential for fire
                spread.
              </p>
            </div>
            <div>
              <span className="font-medium text-slate-700">Medium:</span>
              <p className="text-slate-600 mt-1">
                Moderate compartmentation with some fire-rated walls and floors. Partial separation of areas. Some barriers to limit fire spread.
              </p>
            </div>
            <div>
              <span className="font-medium text-slate-700">High:</span>
              <p className="text-slate-600 mt-1">
                Well-defined fire compartments with proper fire-rated walls, floors, and doors. Effective fire separation limiting spread.
              </p>
            </div>
          </div>
        </div>

        {/* Calculation Explanation Panel */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Automated Construction Assessment</h3>
              <p className="text-sm text-blue-800 mb-3">
                Construction ratings are automatically calculated based on the building characteristics you enter. The system evaluates:
              </p>
              <ul className="text-sm text-blue-800 space-y-1 mb-3 list-disc list-inside">
                <li>Roof material type and area</li>
                <li>Wall construction materials and percentages</li>
                <li>Upper floors / mezzanine construction and extent</li>
                <li>Presence of combustible cladding</li>
                <li>Structural frame type and fire protection</li>
                <li>Compartmentation quality</li>
              </ul>
              <p className="text-sm text-blue-800">
                <strong>Rating Scale:</strong> 1 = Poor, 2 = Below Average, 3 = Average, 4 = Good, 5 = Excellent
              </p>
              <p className="text-sm text-blue-700 mt-2 italic">
                Engineers should use the notes fields to provide context, observations, and professional judgment. The calculated rating reflects
                an objective construction quality assessment.
              </p>
            </div>
          </div>
        </div>

        {/* Site-Level Notes */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Site-Level Notes</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Overall Site Construction Observations</label>
            <textarea
              value={formData.site_notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, site_notes: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              placeholder="Document overall site construction observations, context, common patterns across buildings, or summary notes..."
            />
          </div>
        </div>

        {document?.id && moduleInstance?.id && <ModuleActions documentId={document.id} moduleInstanceId={moduleInstance.id} />}
      </div>

      <FloatingSaveBar onSave={handleSave} isSaving={isSaving} />

      {/* Material Breakdown Editor Modal */}
      {editingBreakdown &&
        editingBuilding &&
        (() => {
          const breakdownData = getBreakdownData(editingBuilding, editingBreakdown.type);
          const options = getMaterialOptionsForType(editingBreakdown.type);

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Edit {getBreakdownTitle(editingBreakdown.type)} Breakdown</h3>
                      <p className="text-sm text-slate-600 mt-1">{editingBuilding.building_name || 'Unnamed Building'}</p>
                    </div>
                    <button onClick={() => setEditingBreakdown(null)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {breakdownData.breakdown.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-slate-700 mb-1">Material</label>
                          <select
                            value={item.material}
                            onChange={(e) => {
                              const newBreakdown = [...breakdownData.breakdown];
                              newBreakdown[idx] = { ...item, material: e.target.value };
                              const total = newBreakdown.reduce((sum, w) => sum + w.percent, 0);
                              updateBreakdownData(editingBuilding.id, editingBreakdown.type, { breakdown: newBreakdown, total_percent: total });
                            }}
                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                          >
                            {options.map((mat) => (
                              <option key={mat} value={mat}>
                                {mat}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="w-24">
                          <label className="block text-xs font-medium text-slate-700 mb-1">Percent</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.percent}
                            onChange={(e) => {
                              const newBreakdown = [...breakdownData.breakdown];
                              newBreakdown[idx] = { ...item, percent: parseFloat(e.target.value) || 0 };
                              const total = newBreakdown.reduce((sum, w) => sum + w.percent, 0);
                              updateBreakdownData(editingBuilding.id, editingBreakdown.type, { breakdown: newBreakdown, total_percent: total });
                            }}
                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                          />
                        </div>

                        <button
                          onClick={() => {
                            const newBreakdown = breakdownData.breakdown.filter((_, i) => i !== idx);
                            const total = newBreakdown.reduce((sum, w) => sum + w.percent, 0);
                            updateBreakdownData(editingBuilding.id, editingBreakdown.type, { breakdown: newBreakdown, total_percent: total });
                          }}
                          className="mt-6 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    <button
                      onClick={() => {
                        const newBreakdown = [...breakdownData.breakdown, { material: options[0], percent: 0 }];
                        const total = newBreakdown.reduce((sum, w) => sum + w.percent, 0);
                        updateBreakdownData(editingBuilding.id, editingBreakdown.type, { breakdown: newBreakdown, total_percent: total });
                      }}
                      className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-slate-400 hover:text-slate-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Material
                    </button>

                    <div
                      className={`p-3 rounded-lg ${
                        breakdownData.total_percent === 100
                          ? 'bg-green-50 border border-green-200'
                          : breakdownData.total_percent === 0
                          ? 'bg-slate-50 border border-slate-200'
                          : 'bg-red-50 border border-red-200'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700">Total:</span>
                        <span
                          className={`text-lg font-bold ${
                            breakdownData.total_percent === 100
                              ? 'text-green-700'
                              : breakdownData.total_percent === 0
                              ? 'text-slate-700'
                              : 'text-red-700'
                          }`}
                        >
                          {breakdownData.total_percent}%
                        </span>
                      </div>
                      {breakdownData.total_percent !== 100 && breakdownData.total_percent !== 0 && (
                        <p className="text-xs text-red-600 mt-1">Must total 100% before saving</p>
                      )}
                    </div>

                    {/* Combustible Cladding Details (if present) */}
                    {editingBuilding.combustible_cladding.present && (
                      <div className="pt-4 border-t border-slate-200">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Combustible Cladding Details</label>
                        <textarea
                          value={editingBuilding.combustible_cladding.details}
                          onChange={(e) =>
                            updateBuilding(editingBuilding.id, {
                              combustible_cladding: { ...editingBuilding.combustible_cladding, details: e.target.value },
                            })
                          }
                          rows={2}
                          className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                          placeholder="Describe combustible cladding type, material, compliance status, and any mitigation measures"
                        />
                      </div>
                    )}

                    {/* Notes */}
                    <div className="pt-4 border-t border-slate-200">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Building Notes</label>
                      <textarea
                        value={editingBuilding.notes}
                        onChange={(e) => updateBuilding(editingBuilding.id, { notes: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                        placeholder="Additional observations about this building..."
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      onClick={() => {
                        if (breakdownData.breakdown.length > 0 && breakdownData.total_percent !== 100) {
                          alert(`Material percentages must total 100% (currently ${breakdownData.total_percent}%)`);
                          return;
                        }
                        setEditingBreakdown(null);
                      }}
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </>
  );
}
