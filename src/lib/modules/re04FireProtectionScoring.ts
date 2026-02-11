/**
 * RE-04 Fire Protection - Derived Scoring (Phase 2)
 *
 * Pure, deterministic scoring functions for building and site-level fire protection.
 * All functions are null-safe and handle missing data gracefully.
 */

type Rating = 1 | 2 | 3 | 4 | 5;
type WaterSupplyReliability = 'reliable' | 'unreliable' | 'unknown';

interface SuppressionData {
  rating?: Rating;
}

interface DetectionData {
  rating?: Rating;
}

interface BuildingFireProtectionData {
  suppression?: {
    sprinklers?: SuppressionData;
    water_mist?: SuppressionData;
  };
  detection_alarm?: DetectionData;
}

interface SiteData {
  water_supply_reliability?: WaterSupplyReliability;
}

interface BuildingMetadata {
  id: string;
  floor_area_sqm?: number | null;
  footprint_m2?: number | null;
}

/**
 * Clamp a number between min and max
 */
function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute building-level fire protection score (1-5)
 *
 * Algorithm:
 * - Suppression weight: 70%
 * - Detection weight: 30%
 * - If both present: raw = 0.7*supp + 0.3*det
 * - If only one present: raw = that rating
 * - If neither present: return null
 *
 * @param buildingFp - Building fire protection data
 * @returns Score 1-5, or null if insufficient data
 */
export function computeBuildingFireProtectionScore(
  buildingFp: BuildingFireProtectionData | undefined
): Rating | null {
  if (!buildingFp) return null;

  // Extract suppression rating (prefer sprinklers, fallback to water_mist)
  let suppressionRating: number | null = null;
  if (buildingFp.suppression?.sprinklers?.rating) {
    suppressionRating = buildingFp.suppression.sprinklers.rating;
  } else if (buildingFp.suppression?.water_mist?.rating) {
    suppressionRating = buildingFp.suppression.water_mist.rating;
  }

  // Extract detection rating
  const detectionRating = buildingFp.detection_alarm?.rating ?? null;

  // Calculate raw score based on available inputs
  let raw: number | null = null;

  if (suppressionRating !== null && detectionRating !== null) {
    // Both present: weighted average
    raw = 0.7 * suppressionRating + 0.3 * detectionRating;
  } else if (suppressionRating !== null) {
    // Only suppression present
    raw = suppressionRating;
  } else if (detectionRating !== null) {
    // Only detection present
    raw = detectionRating;
  } else {
    // Neither present
    return null;
  }

  // Round and clamp to 1-5 range
  const score = clamp(1, 5, Math.round(raw));
  return score as Rating;
}

/**
 * Compute site-level fire protection score (1-5)
 *
 * Algorithm:
 * 1. Aggregate building scores using floor area weighting if available
 * 2. Round to nearest integer
 * 3. Apply water supply reliability cap:
 *    - reliable: no cap
 *    - unknown: cap at 4
 *    - unreliable: cap at 3
 *
 * @param buildings - Map of building ID to fire protection data
 * @param siteData - Site-level data including water supply reliability
 * @param buildingsMeta - Optional building metadata for floor area weighting
 * @returns Score 1-5, or null if no building scores
 */
export function computeSiteFireProtectionScore(
  buildings: Record<string, BuildingFireProtectionData> | undefined,
  siteData: SiteData | undefined,
  buildingsMeta?: BuildingMetadata[]
): Rating | null {
  if (!buildings) return null;

  // Compute all building scores
  interface WeightedScore {
    score: number;
    weight: number;
  }

  const weightedScores: WeightedScore[] = [];

  for (const [buildingId, buildingFp] of Object.entries(buildings)) {
    const buildingScore = computeBuildingFireProtectionScore(buildingFp);
    if (buildingScore === null) continue; // Skip buildings with no score

    // Find floor area from metadata
    let floorArea: number | null = null;
    if (buildingsMeta) {
      const meta = buildingsMeta.find(b => b.id === buildingId);
      if (meta) {
        floorArea = meta.floor_area_sqm ?? meta.footprint_m2 ?? null;
      }
    }

    // Use floor area as weight, or default to 1 (equal weighting)
    const weight = (floorArea && floorArea > 0) ? floorArea : 1;

    weightedScores.push({ score: buildingScore, weight });
  }

  // If no building scores, return null
  if (weightedScores.length === 0) return null;

  // Calculate weighted average
  const totalWeight = weightedScores.reduce((sum, ws) => sum + ws.weight, 0);
  const weightedSum = weightedScores.reduce((sum, ws) => sum + ws.score * ws.weight, 0);
  const siteRaw = weightedSum / totalWeight;

  // Round to nearest integer
  let siteScore = clamp(1, 5, Math.round(siteRaw));

  // Apply water supply reliability cap
  const waterReliability = siteData?.water_supply_reliability ?? 'unknown';

  if (waterReliability === 'unknown') {
    siteScore = Math.min(siteScore, 4);
  } else if (waterReliability === 'unreliable') {
    siteScore = Math.min(siteScore, 3);
  }
  // 'reliable' has no cap

  return siteScore as Rating;
}

/**
 * Compute all derived scores for an RE-04 module
 *
 * @param moduleData - Complete RE-04 module data
 * @param buildingsMeta - Optional building metadata for floor area weighting
 * @returns Object with building and site derived scores
 */
export function computeAllDerivedScores(
  moduleData: {
    buildings?: Record<string, BuildingFireProtectionData>;
    site?: SiteData;
  },
  buildingsMeta?: BuildingMetadata[]
): {
  buildingScores: Record<string, Rating | null>;
  siteScore: Rating | null;
} {
  const buildingScores: Record<string, Rating | null> = {};

  // Compute each building score
  if (moduleData.buildings) {
    for (const [buildingId, buildingFp] of Object.entries(moduleData.buildings)) {
      buildingScores[buildingId] = computeBuildingFireProtectionScore(buildingFp);
    }
  }

  // Compute site score
  const siteScore = computeSiteFireProtectionScore(
    moduleData.buildings,
    moduleData.site,
    buildingsMeta
  );

  return { buildingScores, siteScore };
}
