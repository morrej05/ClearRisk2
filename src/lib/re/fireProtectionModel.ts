// src/lib/re/fireProtectionModel.ts

export type WaterReliability = 'Reliable' | 'Unreliable' | 'Unknown';
export type PumpArrangement = 'None' | 'Single' | 'Duty+Standby' | 'Unknown';
export type PowerResilience = 'Good' | 'Mixed' | 'Poor' | 'Unknown';
export type TestingRegime = 'Documented' | 'Some evidence' | 'None' | 'Unknown';
export type MaintenanceStatus = 'Good' | 'Mixed' | 'Poor' | 'Unknown';
export type SprinklerAdequacy = 'Adequate' | 'Inadequate' | 'Unknown';
export type SprinklerSystemType = 'wet' | 'dry' | 'esfr' | 'other' | 'unknown';
export type WaterSupplyType = 'mains' | 'tank' | 'dual' | 'unknown';

export interface SiteWaterData {
  water_reliability?: WaterReliability;
  supply_type?: string;
  pumps_present?: boolean;
  pump_arrangement?: PumpArrangement;
  power_resilience?: PowerResilience;
  testing_regime?: TestingRegime;
  key_weaknesses?: string;
  // Phase 1: Derived scores placeholder (no computation yet)
  derived?: {
    site_fire_protection_score?: 1 | 2 | 3 | 4 | 5;
  };
}

export interface SiteWaterRecord {
  id: string;
  document_id: string;
  data: SiteWaterData;
  water_score_1_5?: number;
  comments?: string;
  created_at: string;
  updated_at: string;
}

export interface BuildingSprinklerData {
  sprinkler_coverage_installed_pct?: number;
  sprinkler_coverage_required_pct?: number;
  sprinkler_standard?: string;
  hazard_class?: string;
  maintenance_status?: MaintenanceStatus;
  sprinkler_adequacy?: SprinklerAdequacy;
  justification_if_required_lt_100?: string;
  // Phase 1: New optional technical fields
  design_standard?: string;
  hazard_density?: string;
  system_type?: SprinklerSystemType;
  water_supply_type?: WaterSupplyType;
  // Phase 1: Derived scores placeholder (no computation yet)
  derived?: {
    building_fire_protection_score?: 1 | 2 | 3 | 4 | 5;
  };
}

export interface BuildingSprinklerRecord {
  id: string;
  document_id: string;
  building_id: string;
  data: BuildingSprinklerData;
  sprinkler_score_1_5?: number;
  final_active_score_1_5?: number;
  comments?: string;
  created_at: string;
  updated_at: string;
}

export function createDefaultSiteWater(documentId: string): Partial<SiteWaterRecord> {
  return {
    document_id: documentId,
    data: {
      water_reliability: 'Unknown',
      supply_type: '',
      pumps_present: false,
      pump_arrangement: 'Unknown',
      power_resilience: 'Unknown',
      testing_regime: 'Unknown',
      key_weaknesses: '',
    },
    water_score_1_5: 3,
    comments: '',
  };
}

export function createDefaultBuildingSprinkler(
  documentId: string,
  buildingId: string
): Partial<BuildingSprinklerRecord> {
  return {
    document_id: documentId,
    building_id: buildingId,
    data: {
      sprinkler_coverage_installed_pct: 0,
      sprinkler_coverage_required_pct: 0,
      sprinkler_standard: '',
      hazard_class: '',
      maintenance_status: 'Unknown',
      sprinkler_adequacy: 'Unknown',
      justification_if_required_lt_100: '',
    },
    sprinkler_score_1_5: 3,
    final_active_score_1_5: 3,
    comments: '',
  };
}

/**
 * Calculate suggested water score based on reliability factors
 * Returns 1-5 score based on:
 * 5: Reliable (robust + evidenced)
 * 4: Generally reliable (minor gaps)
 * 3: Uncertain / mixed
 * 2: Likely unreliable
 * 1: Unreliable
 */
export function calculateWaterScore(data: SiteWaterData): number {
  const { water_reliability, pump_arrangement, power_resilience, testing_regime } = data;

  // If explicitly marked as reliable with good supporting factors
  if (water_reliability === 'Reliable') {
    if (testing_regime === 'Documented' && power_resilience === 'Good') {
      return 5; // Robust and evidenced
    }
    if (testing_regime === 'Documented' || power_resilience === 'Good') {
      return 4; // Generally reliable
    }
    return 4; // Reliable but minor gaps
  }

  // If explicitly marked as unreliable
  if (water_reliability === 'Unreliable') {
    return 1;
  }

  // Unknown or mixed - look at other factors
  if (water_reliability === 'Unknown') {
    // If we have concerning indicators
    if (power_resilience === 'Poor' || testing_regime === 'None') {
      return 2;
    }
    // If we have some positive indicators
    if (pump_arrangement === 'Duty+Standby' && testing_regime !== 'None') {
      return 3;
    }
    // Default for unknown with no clear indicators
    return 3;
  }

  // Default
  return 3;
}

/**
 * Calculate suggested sprinkler score based on coverage and adequacy
 * Returns 1-5 score, or null if N/A (required = 0)
 */
export function calculateSprinklerScore(data: BuildingSprinklerData): number | null {
  console.log('[fireProtectionModel] calculateSprinklerScore called');
  const {
    sprinklers_installed,
    sprinkler_coverage_installed_pct,
    sprinkler_coverage_required_pct,
    sprinkler_adequacy,
    maintenance_status,
  } = data;

  // If sprinklers not installed or unknown, return null (not rated)
  if (sprinklers_installed === 'No' || sprinklers_installed === 'Unknown') {
    return null;
  }

  // If required coverage is not set or 0, sprinklers not required - return null
  if (!sprinkler_coverage_required_pct || sprinkler_coverage_required_pct === 0) {
    return null;
  }

  // If adequacy is unknown, return null (not enough data to rate)
  if (sprinkler_adequacy === 'Unknown') {
    return null;
  }

  const coverageRatio =
    sprinkler_coverage_required_pct > 0
      ? Math.min(1.0, (sprinkler_coverage_installed_pct ?? 0) / sprinkler_coverage_required_pct)
      : 0;

  if (sprinkler_adequacy === 'Inadequate') {
    return coverageRatio < 0.3 ? 1 : 2;
  }

  if (sprinkler_adequacy === 'Adequate') {
    if (coverageRatio >= 0.95 && maintenance_status === 'Good') {
      return 5;
    }
    if (coverageRatio >= 0.95) {
      return 4;
    }
    if (coverageRatio >= 0.8) {
      return 4;
    }
    return 3;
  }

  // Default for partial data
  if (coverageRatio >= 0.95) {
    return maintenance_status === 'Good' ? 4 : 3;
  }
  if (coverageRatio >= 0.8) {
    return 3;
  }
  if (coverageRatio >= 0.6) {
    return 3;
  }
  if (coverageRatio >= 0.3) {
    return 2;
  }
  return 1;
}

/**
 * Calculate final active score combining sprinkler, water, and detection scores
 * - Sprinkler score is capped by water score (min) when both exist
 * - Detection score is combined with 80/20 weighting when present
 * - Returns null if no scores are available
 */
export function calculateFinalActiveScore(
  sprinklerScore: number | null,
  waterScore: number | null,
  suggestedWaterScore: number,
  detectionScore: number | null = null
): number | null {
  console.log('[fireProtectionModel] calculateFinalActiveScore called');
  // Calculate sprinkler final score
  let sprinklerFinalScore: number | null = null;

  if (sprinklerScore !== null) {
    // If both sprinkler and water exist, cap sprinkler by water (min)
    if (waterScore !== null) {
      sprinklerFinalScore = Math.min(sprinklerScore, waterScore);
    } else {
      // If only sprinkler exists, use it as-is
      sprinklerFinalScore = sprinklerScore;
    }
  }

  // Combine with detection using 80/20 weighting
  if (sprinklerFinalScore !== null && detectionScore !== null) {
    return Math.round((0.8 * sprinklerFinalScore + 0.2 * detectionScore) * 10) / 10;
  } else if (sprinklerFinalScore !== null) {
    return sprinklerFinalScore;
  } else if (detectionScore !== null) {
    return detectionScore;
  }

  return null;
}

/**
 * Generate auto-flags for a building sprinkler record
 */
export function generateAutoFlags(
  sprinklerData: BuildingSprinklerData,
  sprinklerScore: number | null,
  waterScore: number
): Array<{ severity: 'warning' | 'info'; message: string }> {
  const flags: Array<{ severity: 'warning' | 'info'; message: string }> = [];
  const {
    sprinklers_installed,
    sprinkler_coverage_installed_pct,
    sprinkler_coverage_required_pct,
  } = sprinklerData;

  // Skip coverage flags if sprinklers not installed
  if (sprinklers_installed !== 'No' && sprinklers_installed !== 'Unknown') {
    const installedPct = sprinkler_coverage_installed_pct ?? 0;
    const requiredPct = sprinkler_coverage_required_pct ?? 0;

    if (requiredPct > installedPct) {
      flags.push({
        severity: 'warning',
        message: `Coverage gap: ${requiredPct}% required but only ${installedPct}% installed`,
      });
    }

    if (requiredPct === 0 && installedPct > 0) {
      flags.push({
        severity: 'info',
        message: 'Sprinklers installed but marked as not required - verify rationale',
      });
    }
  }

  if (sprinklerScore !== null && sprinklerScore >= 4 && waterScore <= 2) {
    flags.push({
      severity: 'warning',
      message: `Sprinkler system rated highly (${sprinklerScore}/5) but water supply is unreliable (${waterScore}/5)`,
    });
  }

  return flags;
}

/**
 * Calculate site-level roll-up: area-weighted average of final_active_score_1_5
 * across buildings where sprinkler_coverage_required_pct > 0
 */
export interface SiteRollup {
  averageScore: number;
  buildingsAssessed: number;
  totalArea: number;
}

export function calculateSiteRollup(
  buildingSprinklers: BuildingSprinklerRecord[],
  buildings: Array<{ id: string; footprint_m2?: number | null }>
): SiteRollup {
  let totalWeightedScore = 0;
  let totalArea = 0;
  let buildingsAssessed = 0;

  for (const sprinkler of buildingSprinklers) {
    const requiredPct = sprinkler.data.sprinkler_coverage_required_pct || 0;

    // Only include buildings where sprinklers are required
    if (requiredPct === 0) continue;

    const building = buildings.find(b => b.id === sprinkler.building_id);
    const area = building?.footprint_m2 || 0;

    if (area > 0 && sprinkler.final_active_score_1_5) {
      totalWeightedScore += sprinkler.final_active_score_1_5 * area;
      totalArea += area;
      buildingsAssessed++;
    }
  }

  const averageScore = totalArea > 0 ? totalWeightedScore / totalArea : 0;

  return {
    averageScore: Math.round(averageScore * 10) / 10, // 1 decimal place
    buildingsAssessed,
    totalArea,
  };
}
