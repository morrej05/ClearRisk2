/**
 * Construction Rating Utility
 *
 * Provides access to calculated construction ratings for use by
 * the RE scoring engine and other modules.
 */

interface Building {
  calculated?: {
    construction_score: number;
    construction_rating: number;
    combustible_percent: number;
  };
}

/**
 * Get the construction rating for a building
 * Returns the calculated rating (1-5) or 3 (average) if not calculated
 */
export function getConstructionRating(building: Building): number {
  return building.calculated?.construction_rating ?? 3;
}

/**
 * Get the construction score (0-100) for a building
 */
export function getConstructionScore(building: Building): number {
  return building.calculated?.construction_score ?? 50;
}

/**
 * Get the combustible percentage (0-100) for a building
 */
export function getCombustiblePercent(building: Building): number {
  return building.calculated?.combustible_percent ?? 0;
}

/**
 * Get average construction rating across multiple buildings
 */
export function getAverageConstructionRating(buildings: Building[]): number {
  if (!buildings || buildings.length === 0) return 3;

  const ratings = buildings.map(b => getConstructionRating(b));
  const sum = ratings.reduce((acc, r) => acc + r, 0);
  return Math.round(sum / ratings.length);
}

/**
 * Check if any building has a poor construction rating (1-2)
 * This can trigger auto-recommendations
 */
export function hasPoorConstructionRating(buildings: Building[]): boolean {
  return buildings.some(b => getConstructionRating(b) <= 2);
}

/**
 * Get rating label text
 */
export function getConstructionRatingLabel(rating: number): string {
  switch (rating) {
    case 5: return 'Excellent';
    case 4: return 'Good';
    case 3: return 'Average';
    case 2: return 'Below Average';
    case 1: return 'Poor';
    default: return 'Unknown';
  }
}
