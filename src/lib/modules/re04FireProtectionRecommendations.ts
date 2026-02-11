/**
 * RE-04 Fire Protection - Recommendation Generator (Phase 3)
 *
 * Pure, deterministic recommendation generation based on fire protection data.
 * No side effects, null-safe, backward compatible.
 */

export type FireProtectionRecommendation = {
  id: string; // Deterministic ID based on scope:buildingId:code
  scope: 'building' | 'site';
  buildingId?: string;
  category: 'suppression' | 'detection' | 'water_supply';
  priority: 'high' | 'medium' | 'low';
  code: string;
  trigger: string; // Machine-readable description of what triggered this
  text: string; // Human-readable recommendation text
};

type Rating = 1 | 2 | 3 | 4 | 5;

interface BuildingSuppressionData {
  sprinklers?: {
    rating?: Rating;
    coverage_percent?: number;
    adequacy?: 'full' | 'partial' | 'inadequate' | 'none';
  };
  water_mist?: {
    rating?: Rating;
    coverage_percent?: number;
  };
}

interface BuildingDetectionData {
  rating?: Rating;
  coverage_percent?: number;
  monitoring?: string;
}

interface BuildingFireProtectionData {
  suppression?: BuildingSuppressionData;
  detection_alarm?: BuildingDetectionData;
}

interface SiteData {
  water_supply_reliability?: 'reliable' | 'unreliable' | 'unknown';
}

interface FireProtectionModule {
  buildings?: Record<string, BuildingFireProtectionData>;
  site?: SiteData;
}

/**
 * Generate deterministic recommendation ID
 */
function generateRecommendationId(
  scope: 'building' | 'site',
  code: string,
  buildingId?: string
): string {
  if (scope === 'building' && buildingId) {
    return `building:${buildingId}:${code}`;
  }
  return `site:${code}`;
}

/**
 * Determine priority based on rating and other factors
 */
function determinePriority(
  rating: Rating | undefined | null,
  coverage?: number
): 'high' | 'medium' | 'low' {
  if (!rating) return 'high';

  // Low ratings (1-2) are high priority
  if (rating <= 2) return 'high';

  // Rating 3 is medium priority
  if (rating === 3) return 'medium';

  // Rating 4+ with low coverage is medium priority
  if (rating >= 4 && coverage !== undefined && coverage < 80) {
    return 'medium';
  }

  // Rating 4+ with good coverage is low priority
  return 'low';
}

/**
 * Generate building-level suppression recommendations
 */
function generateBuildingSuppressionRecommendations(
  buildingId: string,
  suppression: BuildingSuppressionData | undefined
): FireProtectionRecommendation[] {
  if (!suppression) return [];

  const recommendations: FireProtectionRecommendation[] = [];
  const sprinklers = suppression.sprinklers;
  const waterMist = suppression.water_mist;

  // Primary suppression system (sprinklers or water mist)
  const primaryRating = sprinklers?.rating || waterMist?.rating;
  const primaryCoverage = sprinklers?.coverage_percent || waterMist?.coverage_percent;
  const primaryType = sprinklers?.rating ? 'sprinklers' : 'water_mist';

  // Check for inadequate or missing suppression
  if (!primaryRating || primaryRating <= 2) {
    recommendations.push({
      id: generateRecommendationId('building', 'SUPPRESSION_INADEQUATE', buildingId),
      scope: 'building',
      buildingId,
      category: 'suppression',
      priority: 'high',
      code: 'SUPPRESSION_INADEQUATE',
      trigger: `${primaryType}_rating=${primaryRating ?? 'missing'}`,
      text: primaryRating
        ? `Upgrade ${primaryType} system to improve protection rating from ${primaryRating} to at least 3.`
        : `Install adequate suppression system (sprinklers or water mist) for this building.`,
    });
  }

  // Check for coverage gaps
  if (primaryRating && primaryRating >= 3 && primaryCoverage !== undefined && primaryCoverage < 80) {
    recommendations.push({
      id: generateRecommendationId('building', 'COVERAGE_GAP', buildingId),
      scope: 'building',
      buildingId,
      category: 'suppression',
      priority: 'medium',
      code: 'COVERAGE_GAP',
      trigger: `${primaryType}_coverage=${primaryCoverage}%`,
      text: `Extend ${primaryType} coverage from ${primaryCoverage}% to at least 80% of the building.`,
    });
  }

  // Check for partial adequacy
  if (sprinklers?.adequacy === 'partial') {
    recommendations.push({
      id: generateRecommendationId('building', 'SPRINKLER_PARTIAL', buildingId),
      scope: 'building',
      buildingId,
      category: 'suppression',
      priority: 'medium',
      code: 'SPRINKLER_PARTIAL',
      trigger: `sprinkler_adequacy=partial`,
      text: `Review sprinkler system adequacy and upgrade to meet full occupancy risk requirements.`,
    });
  }

  // Check for inadequate adequacy
  if (sprinklers?.adequacy === 'inadequate') {
    recommendations.push({
      id: generateRecommendationId('building', 'SPRINKLER_INADEQUATE_DESIGN', buildingId),
      scope: 'building',
      buildingId,
      category: 'suppression',
      priority: 'high',
      code: 'SPRINKLER_INADEQUATE_DESIGN',
      trigger: `sprinkler_adequacy=inadequate`,
      text: `Sprinkler system design is inadequate for the occupancy. Upgrade to appropriate design standard (NFPA 13, BS EN 12845, or equivalent).`,
    });
  }

  return recommendations;
}

/**
 * Generate building-level detection recommendations
 */
function generateBuildingDetectionRecommendations(
  buildingId: string,
  detection: BuildingDetectionData | undefined
): FireProtectionRecommendation[] {
  if (!detection) return [];

  const recommendations: FireProtectionRecommendation[] = [];
  const rating = detection.rating;
  const coverage = detection.coverage_percent;
  const monitoring = detection.monitoring;

  // Check for inadequate or missing detection
  if (!rating || rating <= 2) {
    recommendations.push({
      id: generateRecommendationId('building', 'DETECTION_INADEQUATE', buildingId),
      scope: 'building',
      buildingId,
      category: 'detection',
      priority: 'high',
      code: 'DETECTION_INADEQUATE',
      trigger: `detection_rating=${rating ?? 'missing'}`,
      text: rating
        ? `Upgrade fire detection and alarm system to improve rating from ${rating} to at least 3.`
        : `Install adequate fire detection and alarm system for this building.`,
    });
  }

  // Check for coverage gaps
  if (rating && rating >= 3 && coverage !== undefined && coverage < 80) {
    recommendations.push({
      id: generateRecommendationId('building', 'DETECTION_COVERAGE_GAP', buildingId),
      scope: 'building',
      buildingId,
      category: 'detection',
      priority: 'medium',
      code: 'DETECTION_COVERAGE_GAP',
      trigger: `detection_coverage=${coverage}%`,
      text: `Extend fire detection coverage from ${coverage}% to at least 80% of the building.`,
    });
  }

  // Check for monitoring improvements
  if (rating && rating >= 3 && monitoring === 'local_only') {
    recommendations.push({
      id: generateRecommendationId('building', 'DETECTION_MONITORING_UPGRADE', buildingId),
      scope: 'building',
      buildingId,
      category: 'detection',
      priority: 'low',
      code: 'DETECTION_MONITORING_UPGRADE',
      trigger: `monitoring=local_only`,
      text: `Consider upgrading fire alarm monitoring from local-only to remote monitoring or ARC connection.`,
    });
  }

  return recommendations;
}

/**
 * Generate site-level water supply recommendations
 */
function generateSiteWaterRecommendations(
  site: SiteData | undefined
): FireProtectionRecommendation[] {
  if (!site) return [];

  const recommendations: FireProtectionRecommendation[] = [];
  const reliability = site.water_supply_reliability ?? 'unknown';

  // Unreliable water supply is high priority
  if (reliability === 'unreliable') {
    recommendations.push({
      id: generateRecommendationId('site', 'WATER_UNRELIABLE'),
      scope: 'site',
      category: 'water_supply',
      priority: 'high',
      code: 'WATER_UNRELIABLE',
      trigger: `water_reliability=unreliable`,
      text: `Improve water supply reliability through redundant mains connection, on-site storage, or pump upgrade to support fire protection systems.`,
    });
  }

  // Unknown water supply is medium priority
  if (reliability === 'unknown') {
    recommendations.push({
      id: generateRecommendationId('site', 'WATER_UNKNOWN'),
      scope: 'site',
      category: 'water_supply',
      priority: 'medium',
      code: 'WATER_UNKNOWN',
      trigger: `water_reliability=unknown`,
      text: `Conduct water supply assessment to determine adequacy and reliability for fire protection systems.`,
    });
  }

  return recommendations;
}

/**
 * Generate all fire protection recommendations for a module
 *
 * Pure function - no side effects, deterministic output, null-safe.
 *
 * @param fpModule - Complete RE-04 fire protection module data
 * @returns Array of structured recommendations
 */
export function generateFireProtectionRecommendations(
  fpModule: FireProtectionModule | undefined
): FireProtectionRecommendation[] {
  if (!fpModule) return [];

  const recommendations: FireProtectionRecommendation[] = [];

  // Generate building-level recommendations
  if (fpModule.buildings) {
    for (const [buildingId, buildingFp] of Object.entries(fpModule.buildings)) {
      // Suppression recommendations
      const suppressionRecs = generateBuildingSuppressionRecommendations(
        buildingId,
        buildingFp.suppression
      );
      recommendations.push(...suppressionRecs);

      // Detection recommendations
      const detectionRecs = generateBuildingDetectionRecommendations(
        buildingId,
        buildingFp.detection_alarm
      );
      recommendations.push(...detectionRecs);
    }
  }

  // Generate site-level recommendations
  const siteRecs = generateSiteWaterRecommendations(fpModule.site);
  recommendations.push(...siteRecs);

  return recommendations;
}

/**
 * Get recommendation counts by priority
 */
export function getRecommendationSummary(
  recommendations: FireProtectionRecommendation[]
): {
  total: number;
  high: number;
  medium: number;
  low: number;
} {
  return {
    total: recommendations.length,
    high: recommendations.filter(r => r.priority === 'high').length,
    medium: recommendations.filter(r => r.priority === 'medium').length,
    low: recommendations.filter(r => r.priority === 'low').length,
  };
}

/**
 * Get recommendations by category
 */
export function getRecommendationsByCategory(
  recommendations: FireProtectionRecommendation[]
): {
  suppression: FireProtectionRecommendation[];
  detection: FireProtectionRecommendation[];
  water_supply: FireProtectionRecommendation[];
} {
  return {
    suppression: recommendations.filter(r => r.category === 'suppression'),
    detection: recommendations.filter(r => r.category === 'detection'),
    water_supply: recommendations.filter(r => r.category === 'water_supply'),
  };
}

/**
 * Get recommendations for a specific building
 */
export function getBuildingRecommendations(
  recommendations: FireProtectionRecommendation[],
  buildingId: string
): FireProtectionRecommendation[] {
  return recommendations.filter(r => r.scope === 'building' && r.buildingId === buildingId);
}

/**
 * Get site-level recommendations
 */
export function getSiteRecommendations(
  recommendations: FireProtectionRecommendation[]
): FireProtectionRecommendation[] {
  return recommendations.filter(r => r.scope === 'site');
}
