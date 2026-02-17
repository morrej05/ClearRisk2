/**
 * Generate deterministic Key Points for FRA sections 5-12
 *
 * Takes module instances and actions, evaluates rules,
 * and returns 0-4 prioritized observation bullets.
 */

import { getRulesForSection, type KeyPoint, type KeyPointRule } from './rules';

interface ModuleInstance {
  id: string;
  module_key: string;
  data: Record<string, any>;
  outcome: string | null;
}

interface Action {
  id: string;
  recommended_action: string;
  priority_band: string;
  status: string;
}

interface GenerateKeyPointsInput {
  sectionId: number;
  moduleInstances: ModuleInstance[];
  actions?: Action[];
}

/**
 * Normalize text for deduplication
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two texts are near-duplicates
 */
function isNearDuplicate(text1: string, text2: string): boolean {
  const norm1 = normalizeText(text1);
  const norm2 = normalizeText(text2);

  // Exact match
  if (norm1 === norm2) return true;

  // Check if one is a substring of the other (first 40 chars)
  const prefix1 = norm1.substring(0, 40);
  const prefix2 = norm2.substring(0, 40);
  if (prefix1 === prefix2) return true;

  // Check Levenshtein-like similarity for short texts
  if (norm1.length < 50 && norm2.length < 50) {
    const similarity = calculateSimilarity(norm1, norm2);
    return similarity > 0.85;
  }

  return false;
}

/**
 * Calculate text similarity (simple ratio)
 */
function calculateSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance calculation
 */
function levenshteinDistance(s1: string, s2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[s2.length][s1.length];
}

/**
 * Deduplicate key points
 */
function deduplicateKeyPoints(points: KeyPoint[]): KeyPoint[] {
  const unique: KeyPoint[] = [];

  for (const point of points) {
    const isDupe = unique.some(existing => isNearDuplicate(existing.text, point.text));
    if (!isDupe) {
      unique.push(point);
    }
  }

  return unique;
}

/**
 * Merge module data from multiple modules in a section
 * For composite sections (e.g., section 11 with multiple modules)
 */
function mergeModuleData(modules: ModuleInstance[]): Record<string, any> {
  const merged: Record<string, any> = {};

  for (const module of modules) {
    if (module.data) {
      Object.assign(merged, module.data);
    }
  }

  return merged;
}

/**
 * Generate Key Points for a section
 */
export function generateSectionKeyPoints(input: GenerateKeyPointsInput): string[] {
  const { sectionId, moduleInstances, actions = [] } = input;

  // Only generate for sections 5-12
  if (sectionId < 5 || sectionId > 12) {
    return [];
  }

  // Get rules for this section
  const rules = getRulesForSection(sectionId);
  if (rules.length === 0) {
    return [];
  }

  // Merge data from all modules in this section
  const mergedData = mergeModuleData(moduleInstances);

  // Evaluate all rules
  const points: KeyPoint[] = [];

  for (const rule of rules) {
    try {
      // Check if rule condition is met
      if (rule.when(mergedData)) {
        const text = rule.text(mergedData);

        // Skip if text is empty or contains noise
        if (!text || text.trim() === '') continue;
        const lowerText = text.toLowerCase();
        if (lowerText.includes('unknown') ||
            lowerText.includes('not known') ||
            lowerText.includes('n/a') ||
            lowerText.includes('not applicable') ||
            lowerText.includes('no information')) {
          continue;
        }

        points.push({
          type: rule.type,
          weight: rule.weight,
          text: text.trim(),
        });
      }
    } catch (error) {
      // Silently skip rules that throw (defensive programming)
      console.warn(`[Key Points] Rule ${rule.id} failed for section ${sectionId}:`, error);
    }
  }

  // If no points generated, return empty
  if (points.length === 0) {
    return [];
  }

  // Sort by priority: weaknesses first, then by weight descending
  points.sort((a, b) => {
    // Weaknesses always come first
    if (a.type === 'weakness' && b.type !== 'weakness') return -1;
    if (a.type !== 'weakness' && b.type === 'weakness') return 1;

    // Then sort by weight (higher weight = more important)
    return b.weight - a.weight;
  });

  // Deduplicate
  const uniquePoints = deduplicateKeyPoints(points);

  // Take top 4 maximum
  const finalPoints = uniquePoints.slice(0, 4);

  // Return just the text strings
  return finalPoints.map(p => p.text);
}
