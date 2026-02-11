/**
 * RE-04 Fire Protection - Recommendation Generator (Phase 3 - MINIMAL SPEC)
 *
 * Pure, deterministic recommendation generation based on fire protection data.
 * Only generates recommendations from real data triggers (no missing data triggers).
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
    provided_pct?: number;
    required_pct?: number;
  };
  water_mist?: {
    rating?: Rating;
    provided_pct?: number;
    required_pct?: number;
  };
}

interface BuildingDetectionData {
  rating?: Rating;
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
 * Generate building-level suppression recommendations
 * Only triggers on real data (no missing/undefined triggers)
 */
function generateBuildingSuppressionRecommendations(
  buildingId: string,
  suppression: BuildingSuppressionData | undefined
): FireProtectionRecommendation[] {
  if (!suppression) return [];

  const recommendations: FireProtectionRecommendation[] = [];
  const sprinklers = suppression.sprinklers;
  const waterMist = suppression.water_mist;

  // Track which codes have been generated to avoid duplicates
  const generatedCodes = new Set<string>();

  // Check sprinkler rating (only if rating exists and is <= 2)
  if (sprinklers?.rating !== undefined && sprinklers.rating <= 2) {
    const code = 'SPRINKLER_INADEQUATE';
    generatedCodes.add(code);
    recommendations.push({
      id: generateRecommendationId('building', code, buildingId),
      scope: 'building',
      buildingId,
      category: 'suppression',
      priority: sprinklers.rating === 1 ? 'high' : 'medium',
      code,
      trigger: `sprinklers_rating=${sprinklers.rating}`,
      text: `Upgrade sprinkler system to achieve adequate protection (currently rated ${sprinklers.rating}).`,
    });
  }

  // Check sprinkler coverage gap (only if both provided_pct and required_pct exist)
  if (
    sprinklers?.provided_pct !== undefined &&
    sprinklers?.required_pct !== undefined &&
    sprinklers.provided_pct < sprinklers.required_pct
  ) {
    const code = 'COVERAGE_GAP';
    if (!generatedCodes.has(code)) {
      generatedCodes.add(code);
      const gap = sprinklers.required_pct - sprinklers.provided_pct;
      const priority = gap >= 30 ? 'high' : 'medium';
      recommendations.push({
        id: generateRecommendationId('building', code, buildingId),
        scope: 'building',
        buildingId,
        category: 'suppression',
        priority,
        code,
        trigger: `sprinklers_provided=${sprinklers.provided_pct}%_required=${sprinklers.required_pct}%`,
        text: `Extend sprinkler coverage from ${sprinklers.provided_pct}% to ${sprinklers.required_pct}% to meet requirements (${gap}% gap).`,
      });
    }
  }

  // Check water mist rating (only if rating exists and is <= 2, and no sprinkler inadequate already)
  if (waterMist?.rating !== undefined && waterMist.rating <= 2) {
    const code = 'WATER_MIST_INADEQUATE';
    if (!generatedCodes.has('SPRINKLER_INADEQUATE')) {
      generatedCodes.add(code);
      recommendations.push({
        id: generateRecommendationId('building', code, buildingId),
        scope: 'building',
        buildingId,
        category: 'suppression',
        priority: waterMist.rating === 1 ? 'high' : 'medium',
        code,
        trigger: `water_mist_rating=${waterMist.rating}`,
        text: `Upgrade water mist system to achieve adequate protection (currently rated ${waterMist.rating}).`,
      });
    }
  }

  // Check water mist coverage gap (only if both provided_pct and required_pct exist, and no sprinkler coverage gap)
  if (
    waterMist?.provided_pct !== undefined &&
    waterMist?.required_pct !== undefined &&
    waterMist.provided_pct < waterMist.required_pct
  ) {
    const code = 'COVERAGE_GAP';
    if (!generatedCodes.has(code)) {
      generatedCodes.add(code);
      const gap = waterMist.required_pct - waterMist.provided_pct;
      const priority = gap >= 30 ? 'high' : 'medium';
      recommendations.push({
        id: generateRecommendationId('building', code, buildingId),
        scope: 'building',
        buildingId,
        category: 'suppression',
        priority,
        code,
        trigger: `water_mist_provided=${waterMist.provided_pct}%_required=${waterMist.required_pct}%`,
        text: `Extend water mist coverage from ${waterMist.provided_pct}% to ${waterMist.required_pct}% to meet requirements (${gap}% gap).`,
      });
    }
  }

  return recommendations;
}

/**
 * Generate building-level detection recommendations
 * Only triggers on real data (no missing/undefined triggers)
 */
function generateBuildingDetectionRecommendations(
  buildingId: string,
  detection: BuildingDetectionData | undefined
): FireProtectionRecommendation[] {
  if (!detection) return [];

  const recommendations: FireProtectionRecommendation[] = [];
  const rating = detection.rating;

  // Check for inadequate detection (only if rating exists and is <= 2)
  if (rating !== undefined && rating <= 2) {
    recommendations.push({
      id: generateRecommendationId('building', 'DETECTION_INADEQUATE', buildingId),
      scope: 'building',
      buildingId,
      category: 'detection',
      priority: rating === 1 ? 'high' : 'medium',
      code: 'DETECTION_INADEQUATE',
      trigger: `detection_rating=${rating}`,
      text: `Upgrade fire detection and alarm system to achieve adequate protection (currently rated ${rating}).`,
    });
  }

  return recommendations;
}

/**
 * Generate site-level water supply recommendations
 * Only triggers on real data (no missing/undefined triggers)
 */
function generateSiteWaterRecommendations(
  site: SiteData | undefined
): FireProtectionRecommendation[] {
  if (!site) return [];

  const recommendations: FireProtectionRecommendation[] = [];
  const reliability = site.water_supply_reliability;

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

  // Unknown water supply is low priority
  if (reliability === 'unknown') {
    recommendations.push({
      id: generateRecommendationId('site', 'WATER_UNKNOWN'),
      scope: 'site',
      category: 'water_supply',
      priority: 'low',
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
 * Only generates recommendations from real data (no missing/undefined triggers).
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
