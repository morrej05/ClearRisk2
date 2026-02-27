export type RecommendationPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type DriverDimension =
  | 'construction'
  | 'fire_protection'
  | 'detection'
  | 'management'
  | 'special_hazards'
  | 'business_interruption';

export interface DimensionScores {
  construction: number;
  fire_protection: number;
  detection: number;
  management: number;
  special_hazards: number;
  business_interruption: number;
}

export function calculatePriority(score: number): RecommendationPriority {
  if (score < 40) return 'Critical';
  if (score < 55) return 'High';
  if (score < 70) return 'Medium';
  return 'Low';
}

export function getPriorityForDimension(
  driverDimension: DriverDimension | undefined,
  dimensionScores: DimensionScores
): RecommendationPriority | undefined {
  if (!driverDimension) return undefined;

  const score = dimensionScores[driverDimension];
  if (score === undefined || score === 0) return undefined;

  return calculatePriority(score);
}

/**
 * Get priority color classes - using token-based semantic mapping
 * Critical/High → high, Medium → medium, Low → low
 */
export function getPriorityColor(priority: RecommendationPriority | undefined): string {
  if (!priority) {
    return 'bg-risk-info-bg text-risk-info-fg border border-risk-info-border';
  }

  switch (priority) {
    case 'Critical':
    case 'High':
      return 'bg-risk-high-bg text-risk-high-fg border border-risk-high-border';
    case 'Medium':
      return 'bg-risk-medium-bg text-risk-medium-fg border border-risk-medium-border';
    case 'Low':
      return 'bg-risk-low-bg text-risk-low-fg border border-risk-low-border';
    default:
      return 'bg-risk-info-bg text-risk-info-fg border border-risk-info-border';
  }
}

export const DRIVER_DIMENSION_LABELS: Record<DriverDimension, string> = {
  construction: 'Construction & Combustibility',
  fire_protection: 'Fire Protection',
  detection: 'Detection Systems',
  management: 'Management Systems',
  special_hazards: 'Special Hazards',
  business_interruption: 'Business Interruption',
};

export function getDimensionScoresFromFormData(formData: any): DimensionScores {
  return {
    construction: formData.constructionScore || 0,
    fire_protection: formData.fireProtectionScore || 0,
    detection: formData.detectionScore || 0,
    management: formData.managementScore || 0,
    special_hazards: formData.specialHazardsScore || 0,
    business_interruption: formData.businessInterruptionScore || 0,
  };
}

export function sortRecommendationsByPriority<T extends { priority?: RecommendationPriority }>(
  recommendations: T[]
): T[] {
  const priorityOrder: Record<string, number> = {
    'Critical': 1,
    'High': 2,
    'Medium': 3,
    'Low': 4,
    '': 5,
  };

  return [...recommendations].sort((a, b) => {
    const aPriority = a.priority || '';
    const bPriority = b.priority || '';
    return priorityOrder[aPriority] - priorityOrder[bPriority];
  });
}
