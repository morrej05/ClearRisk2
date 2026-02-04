import { HRG_CANONICAL_KEYS, getHrgConfig, humanizeCanonicalKey, humanizeIndustryKey } from '../reference/hrgMasterMap';
import { getEnabledFactors } from '../reference/occupancyRelevance';
import { getConstructionRating } from './constructionRating';
import { supabase } from '../../supabase';

export interface RiskEngineeringData {
  industry_key: string | null;
  ratings: Record<string, number>;
}

export interface ScoreFactor {
  key: string;
  label: string;
  rating: number;
  weight: number;
  score: number;
  maxScore: number;
}

export interface RiskEngineeringScoreBreakdown {
  industryKey: string | null;
  industryLabel: string;
  globalPillars: ScoreFactor[];
  occupancyDrivers: ScoreFactor[];
  totalScore: number;
  maxScore: number;
  topContributors: ScoreFactor[];
}

export function ensureRatingsObject(data: Partial<RiskEngineeringData>): RiskEngineeringData {
  const ratings: Record<string, number> = { ...(data.ratings || {}) };

  for (const key of HRG_CANONICAL_KEYS) {
    if (typeof ratings[key] !== 'number') {
      ratings[key] = 3;
    }
  }

  return {
    industry_key: data.industry_key || null,
    ratings,
  };
}

export function getRating(data: Record<string, any>, canonicalKey: string): number {
  return data?.ratings?.[canonicalKey] ?? 3;
}

export function setRating(
  data: Record<string, any>,
  canonicalKey: string,
  rating: number
): Record<string, any> {
  return {
    ...data,
    ratings: {
      ...(data.ratings || {}),
      [canonicalKey]: rating,
    },
  };
}

export function calculateScore(rating: number, weight: number): number {
  return rating * weight;
}

/**
 * Canonical scoring builder for Risk Engineering.
 * Single source of truth for building score breakdowns.
 *
 * Returns:
 * - industryKey + industry label
 * - globalPillars[] (always included): construction, fire_protection, exposure, management
 * - occupancyDrivers[] (industry-specific, filtered by relevance/weight>0)
 * - totalScore, maxScore
 * - topContributors[] (top 3 by score)
 *
 * Inclusion/scoring rules:
 * - Global pillars ALWAYS included
 * - Industry-specific drivers included only if relevant (weight > 0 or relevance flag true per HRG map)
 * - score = (rating ?? 0) * weight
 * - maxScore per factor = 5 * weight
 * - totals are sums across included factors
 */
export async function buildRiskEngineeringScoreBreakdown(
  documentId: string,
  riskEngData: Record<string, any>
): Promise<RiskEngineeringScoreBreakdown> {
  const industryKey = riskEngData?.industry_key || null;
  const industryLabel = industryKey ? humanizeIndustryKey(industryKey) : 'No Industry Selected';

  // Fetch section grades for global pillars
  const { data: doc } = await supabase
    .from('documents')
    .select('section_grades')
    .eq('id', documentId)
    .maybeSingle();

  const sectionGrades = doc?.section_grades || {};

  // Get construction rating (priority: section_grades > computed from RE-02 > default 3)
  const constructionResult = await getConstructionRating(documentId);

  // Build global pillar factors (ALWAYS INCLUDED)
  const globalPillars: ScoreFactor[] = [
    {
      key: 'construction_and_combustibility',
      label: 'Construction & Combustibility',
      rating: constructionResult.rating,
      weight: getHrgConfig(industryKey, 'construction').weight || 3,
      score: constructionResult.rating * (getHrgConfig(industryKey, 'construction').weight || 3),
      maxScore: 5 * (getHrgConfig(industryKey, 'construction').weight || 3),
    },
    {
      key: 'fire_protection',
      label: 'Fire Protection',
      rating: sectionGrades.fire_protection || 1,
      weight: getHrgConfig(industryKey, 'fire_protection').weight || 3,
      score: (sectionGrades.fire_protection || 1) * (getHrgConfig(industryKey, 'fire_protection').weight || 3),
      maxScore: 5 * (getHrgConfig(industryKey, 'fire_protection').weight || 3),
    },
    {
      key: 'exposure',
      label: 'Exposure',
      rating: sectionGrades.exposure || 3,
      weight: getHrgConfig(industryKey, 'exposure').weight || 3,
      score: (sectionGrades.exposure || 3) * (getHrgConfig(industryKey, 'exposure').weight || 3),
      maxScore: 5 * (getHrgConfig(industryKey, 'exposure').weight || 3),
    },
    {
      key: 'management_systems',
      label: 'Management Systems',
      rating: sectionGrades.management || 3,
      weight: getHrgConfig(industryKey, 'management').weight || 3,
      score: (sectionGrades.management || 3) * (getHrgConfig(industryKey, 'management').weight || 3),
      maxScore: 5 * (getHrgConfig(industryKey, 'management').weight || 3),
    },
  ];

  // Get enabled factors for this occupancy
  const enabledFactors = getEnabledFactors(industryKey);

  // Build occupancy driver factors (FILTERED BY OCCUPANCY RELEVANCE)
  const occupancyDrivers: ScoreFactor[] = HRG_CANONICAL_KEYS
    .filter(key => enabledFactors.includes(key))
    .map(canonicalKey => {
      const rating = getRating(riskEngData, canonicalKey);
      const config = getHrgConfig(industryKey, canonicalKey);
      const score = calculateScore(rating, config.weight);
      const maxScore = 5 * config.weight;

      return {
        key: canonicalKey,
        label: humanizeCanonicalKey(canonicalKey),
        rating,
        weight: config.weight,
        score,
        maxScore,
      };
    })
    .filter(factor => factor.weight > 0); // Only include if weight > 0

  // Combine all factors for totals
  const allFactors = [...globalPillars, ...occupancyDrivers];
  const totalScore = allFactors.reduce((sum, factor) => sum + factor.score, 0);
  const maxScore = allFactors.reduce((sum, factor) => sum + factor.maxScore, 0);

  // Top 3 contributors by score
  const topContributors = [...allFactors]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    industryKey,
    industryLabel,
    globalPillars,
    occupancyDrivers,
    totalScore,
    maxScore,
    topContributors,
  };
}
