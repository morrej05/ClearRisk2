import { HRG_CANONICAL_KEYS } from '../reference/hrgMasterMap';

export interface RiskEngineeringData {
  industry_key: string | null;
  ratings: Record<string, number>;
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
