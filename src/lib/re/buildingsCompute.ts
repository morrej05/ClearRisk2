// src/lib/re/buildingsCompute.ts
import type { BuildingInput } from './buildingsModel';

export interface BuildingComputed {
  has_combustible_cladding: boolean;
  construction_flags: string[];
  protection_flags: string[];
  re02_construction_score: 1 | 2 | 3 | 4 | 5;
  re06_protection_score: 1 | 2 | 3 | 4 | 5;
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
