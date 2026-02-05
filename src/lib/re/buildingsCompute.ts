// src/lib/re/buildingsCompute.ts
import type { BuildingInput } from './buildingsModel';

export interface BuildingComputed {
  has_combustible_cladding: boolean;
  construction_flags: string[];
  protection_flags: string[];
  re02_construction_score: 1 | 2 | 3 | 4 | 5;
  re06_protection_score: 1 | 2 | 3 | 4 | 5;
}

export interface ConstructionComputed {
  score: 1 | 2 | 3 | 4 | 5;
  flags: string[];
  explanation: string;
  combustiblePercent: number;
  roofCombustiblePercent: number;
  wallCombustiblePercent: number;
  mezzCombustiblePercent: number;
}

// Material combustibility weights (0–4)
const ROOF_COMBUSTIBILITY: Record<string, number> = {
  heavy_noncombustible_concrete: 0,
  metal_deck_noncomb_insul: 0,
  fibre_cement: 0,
  built_up_felt: 1,
  single_ply: 1,
  metal_deck_comb_insul: 2,
  sandwich_phenolic: 2,
  sandwich_pir: 3,
  sandwich_pur: 3,
  sandwich_eps: 4,
  timber_deck: 4,
  // unknown: ignore
};

const WALL_COMBUSTIBILITY: Record<string, number> = {
  masonry: 0,
  precast_concrete: 0,
  metal_cladding_noncomb: 0,
  curtain_wall_glazing: 1,
  metal_cladding_comb_core: 3,
  sandwich_phenolic: 2,
  sandwich_pir: 3,
  sandwich_pur: 3,
  sandwich_eps: 4,
  timber_cladding: 3,
  composite_panels_comb: 3,
  // unknown: ignore
};

const MEZZ_COMBUSTIBILITY: Record<string, number> = {
  reinforced_concrete: 0,
  precast_concrete: 0,
  steel_concrete_deck: 0,
  steel_timber_deck: 2,
  timber_joists_deck: 3,
  grp_composite_deck: 3,
  // unknown: ignore
};

function computeCombustiblePercent(
  composition: Record<string, number> | null | undefined,
  combustibilityMap: Record<string, number>
): number {
  if (!composition || typeof composition !== 'object') {
    return NaN;
  }

  const entries = Object.entries(composition).filter(
    ([material, percent]) => material !== 'unknown' && typeof percent === 'number' && percent > 0
  );

  if (entries.length === 0) {
    return NaN;
  }

  let weightedSum = 0;
  let totalPercent = 0;

  for (const [material, percent] of entries) {
    const weight = combustibilityMap[material];
    if (weight !== undefined) {
      weightedSum += weight * percent;
      totalPercent += percent;
    }
  }

  if (totalPercent === 0) {
    return NaN;
  }

  const avgWeight = weightedSum / totalPercent;
  return Math.round((avgWeight / 4) * 100);
}

function computeAvgWeight(
  composition: Record<string, number> | null | undefined,
  combustibilityMap: Record<string, number>
): number {
  if (!composition || typeof composition !== 'object') {
    return NaN;
  }

  const entries = Object.entries(composition).filter(
    ([material, percent]) => material !== 'unknown' && typeof percent === 'number' && percent > 0
  );

  if (entries.length === 0) {
    return NaN;
  }

  let weightedSum = 0;
  let totalPercent = 0;

  for (const [material, percent] of entries) {
    const weight = combustibilityMap[material];
    if (weight !== undefined) {
      weightedSum += weight * percent;
      totalPercent += percent;
    }
  }

  if (totalPercent === 0) {
    return NaN;
  }

  return weightedSum / totalPercent;
}

export function computeConstruction(building: any, extra: any): ConstructionComputed {
  const roofComposition = extra?.roof_construction_percent;
  const wallComposition = extra?.wall_construction_percent;
  const mezzComposition = extra?.mezzanine_construction_percent;

  // Compute combustible percentages
  const roofCombustiblePercent = computeCombustiblePercent(roofComposition, ROOF_COMBUSTIBILITY);
  const wallCombustiblePercent = computeCombustiblePercent(wallComposition, WALL_COMBUSTIBILITY);
  const mezzCombustiblePercent = computeCombustiblePercent(mezzComposition, MEZZ_COMBUSTIBILITY);

  // Compute overall combustible percent (weighted: Roof 60%, Walls 20%, Mezz 20%)
  let combustiblePercent = NaN;
  const weights = { roof: 0.6, wall: 0.2, mezz: 0.2 };
  const knowns: { key: 'roof' | 'wall' | 'mezz'; value: number }[] = [];

  if (!isNaN(roofCombustiblePercent)) knowns.push({ key: 'roof', value: roofCombustiblePercent });
  if (!isNaN(wallCombustiblePercent)) knowns.push({ key: 'wall', value: wallCombustiblePercent });
  if (!isNaN(mezzCombustiblePercent)) knowns.push({ key: 'mezz', value: mezzCombustiblePercent });

  if (knowns.length > 0) {
    const totalWeight = knowns.reduce((sum, { key }) => sum + weights[key], 0);
    const weightedSum = knowns.reduce((sum, { key, value }) => sum + weights[key] * value, 0);
    combustiblePercent = Math.round(weightedSum / totalWeight);
  }

  // Compute avg weights for scoring
  const roofIndex = computeAvgWeight(roofComposition, ROOF_COMBUSTIBILITY);
  const wallIndex = computeAvgWeight(wallComposition, WALL_COMBUSTIBILITY);
  const mezzIndex = computeAvgWeight(mezzComposition, MEZZ_COMBUSTIBILITY);

  // ROOF-dominant scoring
  let score: number = 3;
  const flags: string[] = [];
  const drivers: string[] = [];

  // 1) Roof dominates
  if (!isNaN(roofIndex)) {
    if (roofIndex >= 3.0) {
      score += 2;
      flags.push('Highly combustible roof/ceiling');
      drivers.push('highly combustible roof/ceiling construction');
    } else if (roofIndex >= 2.0) {
      score += 1;
      flags.push('Combustible roof/ceiling');
      drivers.push('combustible roof/ceiling construction');
    } else if (roofIndex <= 0.5) {
      score -= 1;
      flags.push('Predominantly non-combustible roof/ceiling');
      drivers.push('predominantly non-combustible roof/ceiling');
    }
  }

  // 2) Mezzanine/floors
  if (!isNaN(mezzIndex)) {
    if (mezzIndex >= 2.5) {
      score += 1;
      flags.push('Combustible mezzanine/upper floors');
      drivers.push('combustible upper floors');
    } else if (mezzIndex <= 0.5) {
      score -= 1;
      flags.push('Predominantly non-combustible upper floors');
      drivers.push('predominantly non-combustible upper floors');
    }
  }

  // 3) Frame type
  const frameType = building.frame_type;
  if (frameType === 'reinforced_concrete' || frameType === 'masonry') {
    score -= 1;
    flags.push('Robust non-combustible frame');
    drivers.push('robust non-combustible frame');
  } else if (frameType === 'protected_steel') {
    flags.push('Protected steel frame');
    drivers.push('protected steel frame');
  } else if (frameType === 'steel') {
    score += 1;
    flags.push('Unprotected steel frame');
    drivers.push('unprotected steel frame increases collapse risk');
  } else if (frameType === 'timber') {
    score += 2;
    flags.push('Combustible structural frame');
    drivers.push('combustible structural frame');
  }

  // 4) Compartmentation
  const compartmentation = building.compartmentation_minutes;
  if (compartmentation !== null && compartmentation !== undefined) {
    if (compartmentation === 0) {
      score += 1;
      flags.push('No/limited compartmentation');
      drivers.push('no/limited compartmentation');
    } else if (compartmentation >= 240) {
      score -= 2;
      flags.push('High compartmentation (4h)');
      drivers.push('high compartmentation (4h)');
    } else if (compartmentation >= 180) {
      score -= 1;
      flags.push('Enhanced compartmentation');
      drivers.push('enhanced compartmentation');
    }
  }

  // 5) External envelope/cladding
  const claddingPresent = building.cladding_present;
  const claddingCombustible = building.cladding_combustible;
  if (claddingPresent && claddingCombustible) {
    score += 1;
    flags.push('Combustible cladding/external envelope');
    drivers.push('combustible cladding/external envelope');
  }

  // Walls index impact (capped)
  if (!isNaN(wallIndex)) {
    if (wallIndex >= 3.0) {
      score += 1;
      flags.push('Combustible external walls');
      drivers.push('combustible external walls');
    }
  }

  // 6) Basements
  const basements = building.basements;
  if (basements !== null && basements !== undefined && basements >= 1) {
    flags.push('Basement(s) present (firefighting complexity)');
  }

  // Clamp score 1..5
  score = Math.max(1, Math.min(5, Math.round(score))) as 1 | 2 | 3 | 4 | 5;

  // Deduplicate flags
  const uniqueFlags = Array.from(new Set(flags));

  // Build explanation
  let explanation = '';
  if (drivers.length > 0) {
    explanation = `Score driven primarily by ${drivers.join('; ')}.`;
  } else {
    explanation = 'Moderate construction with no significant risk drivers identified.';
  }

  return {
    score,
    flags: uniqueFlags,
    explanation,
    combustiblePercent,
    roofCombustiblePercent,
    wallCombustiblePercent,
    mezzCombustiblePercent,
  };
}

export function computeBuilding(b: BuildingInput): BuildingComputed {
  const construction_flags: string[] = [];
  const protection_flags: string[] = [];

  // --- Deterministic flags (simple starter rules) ---
  const has_combustible_cladding = Boolean(b.cladding_present && b.cladding_combustible === true);
  if (has_combustible_cladding) {
    construction_flags.push('Combustible external wall / cladding present');
  }

  if (b.frame_type === 'steel' && b.frame_fire_protection === 'none') {
    construction_flags.push('Steel frame appears unprotected');
  }

  if (b.sprinklers_present === false) {
    protection_flags.push('No sprinkler protection');
  } else if (b.sprinkler_coverage !== 'full') {
    protection_flags.push('Sprinkler coverage is not full');
  }

  if (b.detection_present === false) {
    protection_flags.push('No automatic fire detection');
  }

  // --- Placeholder scores (stable + deterministic) ---
  // For now: default to 3, then nudge worse if big issues exist.
  let re02: 1 | 2 | 3 | 4 | 5 = 3;
  if (has_combustible_cladding || construction_flags.length >= 2) re02 = 4;

  let re06: 1 | 2 | 3 | 4 | 5 = 3;
  if (b.sprinklers_present === false) re06 = 4;
  if (b.sprinklers_present === false && b.detection_present === false) re06 = 5;

  return {
    has_combustible_cladding,
    construction_flags,
    protection_flags,
    re02_construction_score: re02,
    re06_protection_score: re06,
  };
}
