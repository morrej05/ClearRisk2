import { Trash2, Plus } from 'lucide-react';
import { calculateBuildingCombustibility, calculateSiteCombustibility } from '../utils/combustibilityCalculations';

interface BuildingConstruction {
  heavy_non_combustible_pct: number;
  light_non_combustible_pct: number;
  foam_plastic_approved_pct: number;
  foam_plastic_unapproved_pct: number;
  other_combustible_pct: number;
}

interface Building {
  id: string;
  building_name: string;
  year_built: string;
  building_frame: string;
  number_of_floors: string;
  building_height_m: string;
  floor_area_sqm: string;
  roof_area_sqm: string;
  construction: {
    walls: BuildingConstruction;
    roof_ceiling: BuildingConstruction;
  };
  fire_protection: {
    sprinkler_coverage_pct: number;
    detection_coverage_pct: number;
  };
  construction_description: string;
  fire_compartmentation_description: string;
}

interface BuildingFormProps {
  buildings: Building[];
  onAddBuilding: () => void;
  onRemoveBuilding: (id: string) => void;
  onUpdateBuilding: (id: string, updates: Partial<Building>) => void;
  onUpdateConstruction: (
    buildingId: string,
    type: 'walls' | 'roof_ceiling',
    field: keyof BuildingConstruction,
    value: number
  ) => void;
  onUpdateFireProtection: (
    buildingId: string,
    field: 'sprinkler_coverage_pct' | 'detection_coverage_pct',
    value: number
  ) => void;
}

export default function BuildingForm({
  buildings,
  onAddBuilding,
  onRemoveBuilding,
  onUpdateBuilding,
  onUpdateConstruction,
  onUpdateFireProtection,
}: BuildingFormProps) {
  const calculateTotalPct = (construction: BuildingConstruction): number => {
    return (
      construction.heavy_non_combustible_pct +
      construction.light_non_combustible_pct +
      construction.foam_plastic_approved_pct +
      construction.foam_plastic_unapproved_pct +
      construction.other_combustible_pct
    );
  };

  const calculateBuildingTotalArea = (building: Building): number => {
    const floorArea = parseFloat(building.floor_area_sqm) || 0;
    const roofArea = parseFloat(building.roof_area_sqm) || 0;
    return floorArea + roofArea;
  };

  const calculateSiteTotalArea = (): number => {
    return buildings.reduce((total, building) => {
      return total + calculateBuildingTotalArea(building);
    }, 0);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <h2 className="text-2xl font-semibold text-slate-900 mb-6 pb-3 border-b border-slate-200">
        Section 3: Construction & Layout
      </h2>

      <div className="space-y-8">
        {buildings.map((building, index) => (
          <div
            key={building.id}
            className="relative p-6 border-2 border-slate-200 rounded-lg bg-slate-50"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-slate-900">
                Building #{index + 1}
              </h3>
              {buildings.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveBuilding(building.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all"
                  title="Remove building"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-md font-semibold text-slate-900 mb-4">
                  A. Building Identification
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Building / Unit Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={building.building_name}
                      onChange={(e) =>
                        onUpdateBuilding(building.id, { building_name: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all bg-white"
                      placeholder="Single Building"
                    />
                    <p className="text-sm text-slate-500 mt-1">
                      If only one key building exists on site, this can be left as 'Single Building'.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Year Built
                      </label>
                      <input
                        type="number"
                        min="1800"
                        max="2100"
                        step="1"
                        value={building.year_built}
                        onChange={(e) =>
                          onUpdateBuilding(building.id, { year_built: e.target.value })
                        }
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all bg-white"
                        placeholder="e.g., 1988"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Building Frame
                      </label>
                      <select
                        value={building.building_frame}
                        onChange={(e) =>
                          onUpdateBuilding(building.id, { building_frame: e.target.value })
                        }
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all bg-white"
                      >
                        <option value="">Select frame type</option>
                        <option value="Steel">Steel</option>
                        <option value="Concrete">Concrete</option>
                        <option value="Timber">Timber</option>
                        <option value="Mixed">Mixed</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Number of Floors
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={building.number_of_floors}
                        onChange={(e) =>
                          onUpdateBuilding(building.id, { number_of_floors: e.target.value })
                        }
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all bg-white"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Building Height (m)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={building.building_height_m}
                        onChange={(e) =>
                          onUpdateBuilding(building.id, { building_height_m: e.target.value })
                        }
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all bg-white"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-300">
                <h4 className="text-md font-semibold text-slate-900 mb-4">
                  B. Areas
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Floor / Upper Floors / Mezzanines Area (sqm)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={building.floor_area_sqm}
                      onChange={(e) =>
                        onUpdateBuilding(building.id, { floor_area_sqm: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all bg-white"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Roof / Ceiling Area (sqm)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={building.roof_area_sqm}
                      onChange={(e) =>
                        onUpdateBuilding(building.id, { roof_area_sqm: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all bg-white"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-300">
                <h4 className="text-md font-semibold text-slate-900 mb-4">
                  C. Walls – Construction Breakdown (%)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Heavy non-combustible %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={building.construction.walls.heavy_non_combustible_pct}
                      onChange={(e) =>
                        onUpdateConstruction(
                          building.id,
                          'walls',
                          'heavy_non_combustible_pct',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all bg-white"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Light non-combustible %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={building.construction.walls.light_non_combustible_pct}
                      onChange={(e) =>
                        onUpdateConstruction(
                          building.id,
                          'walls',
                          'light_non_combustible_pct',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all bg-white"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Foam / plastic (approved) %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={building.construction.walls.foam_plastic_approved_pct}
                      onChange={(e) =>
                        onUpdateConstruction(
                          building.id,
                          'walls',
                          'foam_plastic_approved_pct',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all bg-white"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Foam / plastic (unapproved) %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={building.construction.walls.foam_plastic_unapproved_pct}
                      onChange={(e) =>
                        onUpdateConstruction(
                          building.id,
                          'walls',
                          'foam_plastic_unapproved_pct',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all bg-white"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Other combustible materials %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={building.construction.walls.other_combustible_pct}
                      onChange={(e) =>
                        onUpdateConstruction(
                          building.id,
                          'walls',
                          'other_combustible_pct',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all bg-white"
                      placeholder="0"
                    />
                  </div>
                </div>
                {calculateTotalPct(building.construction.walls) !== 100 && (
                  <div className="mt-3 bg-amber-50 border border-amber-300 rounded-lg p-3">
                    <p className="text-sm text-amber-800">
                      ⚠️ Wall construction percentages should total 100%. Current total: {calculateTotalPct(building.construction.walls).toFixed(1)}%.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-300">
                <h4 className="text-md font-semibold text-slate-900 mb-4">
                  D. Roof / Ceiling – Construction Breakdown (%)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Heavy non-combustible %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={building.construction.roof_ceiling.heavy_non_combustible_pct}
                      onChange={(e) =>
                        onUpdateConstruction(
                          building.id,
                          'roof_ceiling',
                          'heavy_non_combustible_pct',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all bg-white"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Light non-combustible %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={building.construction.roof_ceiling.light_non_combustible_pct}
                      onChange={(e) =>
                        onUpdateConstruction(
                          building.id,
                          'roof_ceiling',
                          'light_non_combustible_pct',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all bg-white"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Foam / plastic (approved) %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={building.construction.roof_ceiling.foam_plastic_approved_pct}
                      onChange={(e) =>
                        onUpdateConstruction(
                          building.id,
                          'roof_ceiling',
                          'foam_plastic_approved_pct',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all bg-white"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Foam / plastic (unapproved) %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={building.construction.roof_ceiling.foam_plastic_unapproved_pct}
                      onChange={(e) =>
                        onUpdateConstruction(
                          building.id,
                          'roof_ceiling',
                          'foam_plastic_unapproved_pct',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all bg-white"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Other combustible materials %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={building.construction.roof_ceiling.other_combustible_pct}
                      onChange={(e) =>
                        onUpdateConstruction(
                          building.id,
                          'roof_ceiling',
                          'other_combustible_pct',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all bg-white"
                      placeholder="0"
                    />
                  </div>
                </div>
                {calculateTotalPct(building.construction.roof_ceiling) !== 100 && (
                  <div className="mt-3 bg-amber-50 border border-amber-300 rounded-lg p-3">
                    <p className="text-sm text-amber-800">
                      ⚠️ Roof / ceiling construction percentages should total 100%. Current total: {calculateTotalPct(building.construction.roof_ceiling).toFixed(1)}%.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-300">
                <h4 className="text-md font-semibold text-slate-900 mb-4">
                  E. Fire Protection Coverage
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Sprinkler Coverage (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={building.fire_protection.sprinkler_coverage_pct}
                      onChange={(e) =>
                        onUpdateFireProtection(
                          building.id,
                          'sprinkler_coverage_pct',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all bg-white"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Fire Detection Coverage (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={building.fire_protection.detection_coverage_pct}
                      onChange={(e) =>
                        onUpdateFireProtection(
                          building.id,
                          'detection_coverage_pct',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all bg-white"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-300">
                <h4 className="text-md font-semibold text-slate-900 mb-4">
                  F. Construction Description
                </h4>
                <textarea
                  value={building.construction_description}
                  onChange={(e) =>
                    onUpdateBuilding(building.id, {
                      construction_description: e.target.value,
                    })
                  }
                  rows={4}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all resize-none bg-white"
                  placeholder="Describe the construction details"
                />
              </div>

              <div className="pt-4 border-t border-slate-300">
                <h4 className="text-md font-semibold text-slate-900 mb-4">
                  Fire Compartmentation Description
                </h4>
                <textarea
                  value={building.fire_compartmentation_description}
                  onChange={(e) =>
                    onUpdateBuilding(building.id, {
                      fire_compartmentation_description: e.target.value,
                    })
                  }
                  rows={6}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all resize-y bg-white"
                  placeholder="Describe fire compartmentation arrangements, including fire walls, fire doors, fire-rated barriers, and compartmentation strategies..."
                />
              </div>

              <div className="pt-4 border-t border-slate-300">
                <div className="space-y-3">
                  <div className="bg-slate-100 border border-slate-300 rounded-lg p-4">
                    <p className="text-sm font-medium text-slate-700">
                      Total construction area: <span className="text-lg font-semibold text-slate-900">{calculateBuildingTotalArea(building).toFixed(2)} sqm</span>
                    </p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-blue-900">
                      Calculated Building Combustibility: <span className="text-lg">{calculateBuildingCombustibility(building)}%</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="space-y-4 p-6 bg-slate-100 border-2 border-slate-300 rounded-lg">
          <div className="pb-4 border-b border-slate-400">
            <p className="text-sm font-medium text-slate-700 mb-1">
              Total site construction area:
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {calculateSiteTotalArea().toFixed(2)} sqm
            </p>
          </div>

          <div className="pb-4 border-b border-slate-400">
            <p className="text-sm font-medium text-slate-700 mb-1">
              Calculated Site Combustibility:
            </p>
            <p className="text-2xl font-bold text-green-700">
              {calculateSiteCombustibility(buildings)}%
            </p>
          </div>

          <div>
            <h3 className="text-md font-semibold text-slate-900 mb-3">
              Construction Summary
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              The site comprises <span className="font-semibold">{buildings.length}</span> principal building(s) with a combined construction area of approximately <span className="font-semibold">{calculateSiteTotalArea().toFixed(2)} sqm</span>. The calculated site combustibility indicator is <span className="font-semibold">{calculateSiteCombustibility(buildings)}%</span>, derived using roof-led weighting and area-based aggregation.
            </p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-300 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">
            Combustibility Calculation Methodology
          </h3>
          <div className="text-sm text-slate-700 space-y-3">
            <p>
              Heavy and light non-combustible materials are treated as non-combustible.
              Approved foam and plastic materials are treated as transitional, reflecting
              variable fire performance depending on certification and installation.
              Unapproved foam, plastics, and other combustible materials are treated as combustible.
            </p>
            <p>
              Roof and ceiling construction is weighted more heavily than wall construction
              due to its greater influence on fire development and vertical fire spread.
              Where roof and ceiling construction is fully non-combustible, wall construction
              has a proportionally greater influence.
            </p>
            <p>
              Site-wide combustibility is calculated on an area-weighted basis where multiple
              buildings are present.
            </p>
            <p className="italic text-slate-600">
              Note: Combustibility indicators are for comparative purposes only and should not be interpreted as definitive fire safety ratings or compliance assessments.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onAddBuilding}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Another Building
        </button>
      </div>
    </div>
  );
}
