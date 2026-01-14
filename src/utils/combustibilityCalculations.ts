interface BuildingConstruction {
  heavy_non_combustible_pct: number;
  light_non_combustible_pct: number;
  foam_plastic_approved_pct: number;
  foam_plastic_unapproved_pct: number;
  other_combustible_pct: number;
}

interface BuildingForCalculation {
  construction: {
    walls: BuildingConstruction;
    roof_ceiling: BuildingConstruction;
  };
  floor_area_sqm: string;
}

export function calculateBuildingCombustibility(building: BuildingForCalculation): number {
  const { walls, roof_ceiling } = building.construction;

  const roof_combustible_pct =
    roof_ceiling.foam_plastic_unapproved_pct +
    roof_ceiling.other_combustible_pct;

  const roof_transitional_pct = roof_ceiling.foam_plastic_approved_pct;

  const roof_non_combustible_pct =
    roof_ceiling.heavy_non_combustible_pct +
    roof_ceiling.light_non_combustible_pct;

  const wall_combustible_pct =
    walls.foam_plastic_unapproved_pct +
    walls.other_combustible_pct;

  const wall_transitional_pct = walls.foam_plastic_approved_pct;

  const wall_non_combustible_pct =
    walls.heavy_non_combustible_pct +
    walls.light_non_combustible_pct;

  let raw_building_combustibility: number;

  if (roof_combustible_pct > 0 || roof_transitional_pct > 0) {
    raw_building_combustibility =
      (roof_combustible_pct * 1.0) +
      (roof_transitional_pct * 0.5) +
      (wall_combustible_pct * 0.4) +
      (wall_transitional_pct * 0.2);
  } else {
    raw_building_combustibility =
      (wall_combustible_pct * 0.6) +
      (wall_transitional_pct * 0.3);
  }

  const building_combustibility_pct =
    raw_building_combustibility > 100
      ? 100
      : Math.round(raw_building_combustibility);

  return building_combustibility_pct;
}

export function calculateSiteCombustibility(buildings: BuildingForCalculation[]): number {
  let totalWeightedCombustibility = 0;
  let totalFloorArea = 0;

  for (const building of buildings) {
    const floorArea = parseFloat(building.floor_area_sqm) || 0;

    if (floorArea > 0) {
      const buildingCombustibility = calculateBuildingCombustibility(building);
      totalWeightedCombustibility += buildingCombustibility * floorArea;
      totalFloorArea += floorArea;
    }
  }

  if (totalFloorArea === 0) {
    return 0;
  }

  return Math.round(totalWeightedCombustibility / totalFloorArea);
}
