/**
 * Generate deterministic Key Points for FRA sections 5-12
 *
 * Takes module instances and actions, evaluates rules,
 * and returns 0-4 prioritized observation bullets.
 */

import { getRulesForSection, type KeyPoint, type KeyPointRule } from './rules';
import { getCanonicalKeysForModule } from '../../fra/schema/moduleFieldSchema';
import { getField } from '../../fra/schema/getField';
import { type FiredSentence, type SectionEvaluation, type EvaluationContext } from './types';
import { detectInfoGaps } from '../../../utils/infoGapQuickActions';

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
 * Deduplicate fired sentences
 */
function deduplicateFiredSentences(sentences: FiredSentence[]): FiredSentence[] {
  const unique: FiredSentence[] = [];

  for (const sentence of sentences) {
    const isDupe = unique.some(existing => isNearDuplicate(existing.text, sentence.text));
    if (!isDupe) {
      unique.push(sentence);
    }
  }

  return unique;
}

/**
 * Merge module data from multiple modules in a section
 * For composite sections (e.g., section 11 with multiple modules)
 *
 * IMPORTANT: Hydrates canonical field names using schema aliases
 * so rules can evaluate against consistent field names regardless
 * of which variant the form/info-gap/summary logic used.
 */
function mergeModuleData(modules: ModuleInstance[]): Record<string, any> {
  const merged: Record<string, any> = {};

  for (const module of modules) {
    if (module.data) {
      // First: copy raw data
      Object.assign(merged, module.data);

      // Second: hydrate canonical fields using schema aliases
      // This ensures rules using canonical names will find values
      // even if original data used alias field names
      const canonicalKeys = getCanonicalKeysForModule(module.module_key);
      for (const canonicalKey of canonicalKeys) {
        const value = getField(module.data, module.module_key, canonicalKey);
        if (value !== undefined) {
          merged[canonicalKey] = value;
        }
      }
    }
  }

  return merged;
}

/**
 * Generate FiredSentence array (new deterministic output)
 * INTERNAL: Returns structured output with evidence trails
 */
export function generateFiredSentences(input: GenerateKeyPointsInput): FiredSentence[] {
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

  // Evaluate all rules and collect fired sentences
  const fired: FiredSentence[] = [];

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

        // Extract evidence
        const evidence = rule.evidence(mergedData);

        fired.push({
          ruleId: rule.id,
          type: rule.type,
          weight: rule.weight,
          text: text.trim(),
          evidence,
        });
      }
    } catch (error) {
      // Silently skip rules that throw (defensive programming)
      console.warn(`[Key Points] Rule ${rule.id} failed for section ${sectionId}:`, error);
    }
  }

  // If no sentences fired, return empty
  if (fired.length === 0) {
    return [];
  }

  // Sort by priority: weaknesses first, then by weight descending
  fired.sort((a, b) => {
    // Weaknesses always come first
    if (a.type === 'weakness' && b.type !== 'weakness') return -1;
    if (a.type !== 'weakness' && b.type === 'weakness') return 1;

    // Then sort by weight (higher weight = more important)
    return b.weight - a.weight;
  });

  // Deduplicate
  const uniqueFired = deduplicateFiredSentences(fired);

  // Take top 4 maximum (limit for Key Points)
  const finalFired = uniqueFired.slice(0, 4);

  return finalFired;
}

/**
 * Generate Section Evaluation (complete structured output)
 * INTERNAL: Returns full evaluation with summary, provisional flag, and info gaps
 */
export function generateSectionEvaluation(input: GenerateKeyPointsInput): SectionEvaluation {
  const { sectionId, moduleInstances, actions = [] } = input;

  // Generate fired sentences
  const fired = generateFiredSentences(input);

  // Generate summary line
  const weaknessCount = fired.filter(s => s.type === 'weakness').length;
  const strengthCount = fired.filter(s => s.type === 'strength').length;
  const infoCount = fired.filter(s => s.type === 'info').length;

  let summary = '';
  const parts: string[] = [];
  if (weaknessCount > 0) parts.push(`${weaknessCount} weakness${weaknessCount !== 1 ? 'es' : ''}`);
  if (strengthCount > 0) parts.push(`${strengthCount} strength${strengthCount !== 1 ? 's' : ''}`);
  if (infoCount > 0) parts.push(`${infoCount} observation${infoCount !== 1 ? 's' : ''}`);

  if (parts.length > 0) {
    summary = parts.join(', ') + ' identified';
  } else {
    summary = 'No significant observations';
  }

  // Check for info gaps (provisional status)
  const mergedData = mergeModuleData(moduleInstances);
  const infoGapReasons: string[] = [];
  let provisional = false;

  // Check each module for info gaps
  for (const module of moduleInstances) {
    const detection = detectInfoGaps(
      module.module_key,
      module.data,
      module.outcome,
      {}
    );

    if (detection.hasInfoGap) {
      provisional = true;
      infoGapReasons.push(...detection.reasons);
    }
  }

  return {
    sectionId,
    summary,
    fired,
    provisional,
    infoGapReasons,
  };
}

/**
 * Generate Key Points for a section (BACKWARD COMPATIBLE)
 * PUBLIC: Returns string[] for existing callers
 */
export function generateSectionKeyPoints(input: GenerateKeyPointsInput): string[] {
  // Use new function internally, then project to string[]
  const fired = generateFiredSentences(input);
  const points = fired.map(s => s.text);

  // Safety: ensure no leading bullet markers remain
  return points.map(p =>
    (p ?? '')
      .toString()
      .trim()
      .replace(/^([•\-\*\u2022\u25CF\u25A0\u25AA]+)\s+/, '')
  );
}
