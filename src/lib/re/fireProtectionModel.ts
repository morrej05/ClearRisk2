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
  const { sprinkler_coverage_installed_pct = 0, sprinkler_coverage_required_pct = 0, sprinkler_adequacy, maintenance_status } = data;

  // If no sprinklers required, return null (N/A)
  if (sprinkler_coverage_required_pct === 0) {
    return null;
  }

  // Calculate coverage ratio C = installed / required (capped at 1.0)
  const coverageRatio = sprinkler_coverage_required_pct > 0
    ? Math.min(1.0, sprinkler_coverage_installed_pct / sprinkler_coverage_required_pct)
    : 0;

  // Explicit inadequacy
  if (sprinkler_adequacy === 'Inadequate') {
    return coverageRatio < 0.3 ? 1 : 2;
  }

  // Explicit adequacy
  if (sprinkler_adequacy === 'Adequate') {
    if (coverageRatio >= 0.95 && maintenance_status === 'Good') {
      return 5; // Adequate with good coverage and maintenance
    }
    if (coverageRatio >= 0.95) {
      return 4; // Adequate with good coverage
    }
    if (coverageRatio >= 0.80) {
      return 4; // Largely adequate
    }
    return 3; // Adequate but coverage gaps
  }

  // Unknown adequacy - rely on coverage ratio
  if (coverageRatio >= 0.95) {
    return maintenance_status === 'Good' ? 4 : 3;
  }
  if (coverageRatio >= 0.80) {
    return 3;
  }
  if (coverageRatio >= 0.60) {
    return 3;
  }
  if (coverageRatio >= 0.30) {
    return 2;
  }
  return 1; // < 30% coverage
}

/**
 * Calculate final active score as min(sprinkler_score, water_score)
 * Returns 5 if sprinklers not required (N/A)
 */
export function calculateFinalActiveScore(
  sprinklerScore: number | null,
  waterScore: number
): number {
  // If sprinklers not required, return 5 (N/A - excluded from roll-up)
  if (sprinklerScore === null) {
    return 5;
  }

  // Final score is the minimum of sprinkler and water
  return Math.min(sprinklerScore, waterScore);
}

export interface AutoFlag {
  type: 'coverage_gap' | 'inconsistency' | 'rationale_check';
  severity: 'warning' | 'info';
  message: string;
}

/**
 * Generate auto-flags for a building sprinkler record
 */
export function generateAutoFlags(
  sprinklerData: BuildingSprinklerData,
  sprinklerScore: number | null,
  waterScore: number
): AutoFlag[] {
  const flags: AutoFlag[] = [];
  const { sprinkler_coverage_installed_pct = 0, sprinkler_coverage_required_pct = 0 } = sprinklerData;

  // Flag 1: Coverage gap
  if (sprinkler_coverage_required_pct > sprinkler_coverage_installed_pct) {
    flags.push({
      type: 'coverage_gap',
      severity: 'warning',
      message: `Coverage gap: ${sprinkler_coverage_required_pct}% required but only ${sprinkler_coverage_installed_pct}% installed`,
    });
  }

  // Flag 2: Inconsistency (high sprinkler score but low water score)
  if (sprinklerScore !== null && sprinklerScore >= 4 && waterScore <= 2) {
    flags.push({
      type: 'inconsistency',
      severity: 'warning',
      message: `Sprinkler system rated highly (${sprinklerScore}/5) but water supply is unreliable (${waterScore}/5)`,
    });
  }

  // Flag 3: Check rationale if required = 0 (optional, info only)
  if (sprinkler_coverage_required_pct === 0 && sprinkler_coverage_installed_pct > 0) {
    flags.push({
      type: 'rationale_check',
      severity: 'info',
      message: 'Sprinklers installed but marked as not required - verify rationale',
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
