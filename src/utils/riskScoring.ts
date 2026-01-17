export interface SectorWeights {
  construction: number;
  protection: number;
  detection: number;
  management: number;
  hazards: number;
  bi: number;
}

export interface SectorInfo {
  name: string;
  weights: SectorWeights;
  description: string;
  emphasis: string[];
}

export const SECTOR_PROFILES: Record<string, SectorInfo> = {
  'Food & Beverage': {
    name: 'Food & Beverage',
    weights: {
      construction: 0.35,
      protection: 0.30,
      detection: 0.15,
      management: 0.10,
      hazards: 0.05,
      bi: 0.05,
    },
    description: 'Food processing and storage occupancies are historically associated with severe fire losses driven by combustible construction, insulated panels, ceiling void fire spread, and smoke contamination. As such, construction materials and fire protection coverage are weighted more heavily in the overall risk score.',
    emphasis: [
      'Construction & Combustibility (High)',
      'Fire Protection (High)',
      'Detection Systems (Medium)',
    ],
  },
  'Foundry / Metal': {
    name: 'Foundry / Metal',
    weights: {
      construction: 0.15,
      protection: 0.20,
      detection: 0.15,
      management: 0.25,
      hazards: 0.15,
      bi: 0.10,
    },
    description: 'Foundry operations are typically characterised by non-combustible construction but elevated process hazards, including molten metal, high-energy equipment, and dependency on critical plant. Management systems and special hazards therefore carry increased weighting.',
    emphasis: [
      'Management Systems (High)',
      'Fire Protection (Medium)',
      'Special Hazards (Medium)',
    ],
  },
  'Chemical / ATEX': {
    name: 'Chemical / ATEX',
    weights: {
      construction: 0.15,
      protection: 0.25,
      detection: 0.15,
      management: 0.20,
      hazards: 0.20,
      bi: 0.05,
    },
    description: 'Chemical manufacturing and ATEX-classified environments present elevated risks from flammable materials, explosive atmospheres, and reactive processes. Fire protection systems, management controls, and special hazard management are prioritised in the risk assessment.',
    emphasis: [
      'Fire Protection (High)',
      'Special Hazards (High)',
      'Management Systems (High)',
    ],
  },
  'Logistics / Warehouse': {
    name: 'Logistics / Warehouse',
    weights: {
      construction: 0.30,
      protection: 0.35,
      detection: 0.15,
      management: 0.10,
      hazards: 0.05,
      bi: 0.05,
    },
    description: 'Warehousing and logistics operations typically involve high-piled storage in large open spaces, making fire protection coverage and building construction critical factors. These elements are weighted most heavily in the risk score.',
    emphasis: [
      'Fire Protection (Very High)',
      'Construction & Combustibility (High)',
      'Detection Systems (Medium)',
    ],
  },
  'Office / Commercial': {
    name: 'Office / Commercial',
    weights: {
      construction: 0.20,
      protection: 0.20,
      detection: 0.20,
      management: 0.15,
      hazards: 0.05,
      bi: 0.20,
    },
    description: 'Office and commercial occupancies generally present lower fire risks but may have significant business interruption exposure. The risk assessment provides balanced weighting across protection systems with emphasis on business continuity.',
    emphasis: [
      'Business Interruption (High)',
      'Detection Systems (Medium)',
      'Fire Protection (Medium)',
    ],
  },
  'General Industrial': {
    name: 'General Industrial',
    weights: {
      construction: 0.25,
      protection: 0.25,
      detection: 0.15,
      management: 0.15,
      hazards: 0.10,
      bi: 0.10,
    },
    description: 'General industrial occupancies employ balanced weighting across all risk factors, reflecting typical manufacturing environments without specific elevated hazards.',
    emphasis: [
      'Construction & Combustibility (Medium)',
      'Fire Protection (Medium)',
      'Management Systems (Medium)',
    ],
  },
  'Other': {
    name: 'Other',
    weights: {
      construction: 0.25,
      protection: 0.25,
      detection: 0.15,
      management: 0.15,
      hazards: 0.10,
      bi: 0.10,
    },
    description: 'Default weighting profile applies balanced emphasis across all risk factors.',
    emphasis: [
      'Construction & Combustibility (Medium)',
      'Fire Protection (Medium)',
      'All other factors equally weighted',
    ],
  },
};

export function getSectorWeights(industrySector: string): SectorWeights {
  const profile = SECTOR_PROFILES[industrySector];
  if (!profile) {
    console.warn(`[SECTOR_CONFIG] Unknown sector: "${industrySector}", falling back to "General Industrial"`);
    return SECTOR_PROFILES['General Industrial'].weights;
  }
  return profile.weights;
}

export const AVAILABLE_SECTORS = [
  'Food & Beverage',
  'Foundry / Metal',
  'Chemical / ATEX',
  'Logistics / Warehouse',
  'Office / Commercial',
  'General Industrial',
  'Other',
] as const;

if (import.meta.env.DEV) {
  const missingSectors = AVAILABLE_SECTORS.filter(sector => !SECTOR_PROFILES[sector]);
  if (missingSectors.length > 0) {
    console.error(
      '[SECTOR_CONFIG] ERROR: The following sectors are in the dropdown but missing from SECTOR_PROFILES:',
      missingSectors
    );
    console.error('[SECTOR_CONFIG] Available profiles:', Object.keys(SECTOR_PROFILES));
  } else {
    console.log('[SECTOR_CONFIG] ✓ All dropdown sectors have corresponding SECTOR_PROFILES');
  }
}

export function getSectorInfo(industrySector: string): SectorInfo | null {
  const info = SECTOR_PROFILES[industrySector];
  if (!info && industrySector) {
    console.warn(`[SECTOR_CONFIG] getSectorInfo: Unknown sector "${industrySector}"`);
  }
  return info || null;
}

export function calculateOverallRiskScore(
  constructionScore: number,
  fireProtectionScore: number,
  detectionScore: number,
  managementScore: number,
  specialHazardsScore: number,
  businessInterruptionScore: number,
  weights: SectorWeights
): number {
  const score =
    constructionScore * weights.construction +
    fireProtectionScore * weights.protection +
    detectionScore * weights.detection +
    managementScore * weights.management +
    specialHazardsScore * weights.hazards +
    businessInterruptionScore * weights.bi;

  return Math.round(score);
}

export function getRiskBand(score: number): string {
  if (score >= 85) return 'Very Good';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Tolerable';
  if (score >= 40) return 'Poor';
  return 'Very Poor';
}

// Grade-based scoring (1-5 scale)
export interface SectionGrades {
  survey_info?: number;
  property_details?: number;
  construction?: number;
  occupancy?: number;
  management?: number;
  fire_protection?: number;
  business_continuity?: number;
  loss_expectancy?: number;
  hazards?: number;
  natural_hazards?: number;
  recommendations?: number;
  attachments?: number;
}

export function calculateOverallGrade(sectionGrades: SectionGrades): number {
  const grades = Object.values(sectionGrades).filter(g => g !== undefined && g > 0);
  if (grades.length === 0) return 3; // Default to "Adequate"

  const sum = grades.reduce((acc, grade) => acc + grade, 0);
  return sum / grades.length;
}

export function getRiskBandFromGrade(overallGrade: number): string {
  if (overallGrade < 2.0) return 'Critical';
  if (overallGrade < 3.0) return 'High';
  if (overallGrade < 4.0) return 'Medium';
  return 'Low';
}

export function getGradePriorityLevel(grade: number): 'Critical' | 'High' | 'Medium' | 'Low' {
  if (grade === 1) return 'Critical';
  if (grade === 2) return 'High';
  if (grade === 3) return 'Medium';
  return 'Low';
}

export function getRiskBandColor(band: string): string {
  switch (band) {
    case 'Very Good':
      return 'text-green-700 bg-green-50 border-green-200';
    case 'Good':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'Tolerable':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'Poor':
      return 'text-orange-700 bg-orange-50 border-orange-200';
    case 'Very Poor':
      return 'text-red-700 bg-red-50 border-red-200';
    default:
      return 'text-slate-700 bg-slate-50 border-slate-200';
  }
}

export interface DimensionContribution {
  name: string;
  score: number;
  weight: number;
  contribution: number;
  percentage: string;
}

export function calculateDimensionContributions(
  constructionScore: number,
  fireProtectionScore: number,
  detectionScore: number,
  managementScore: number,
  specialHazardsScore: number,
  businessInterruptionScore: number,
  weights: SectorWeights
): DimensionContribution[] {
  return [
    {
      name: 'Construction & Combustibility',
      score: constructionScore,
      weight: weights.construction,
      contribution: constructionScore * weights.construction,
      percentage: `${(weights.construction * 100).toFixed(0)}%`,
    },
    {
      name: 'Fire Protection',
      score: fireProtectionScore,
      weight: weights.protection,
      contribution: fireProtectionScore * weights.protection,
      percentage: `${(weights.protection * 100).toFixed(0)}%`,
    },
    {
      name: 'Detection Systems',
      score: detectionScore,
      weight: weights.detection,
      contribution: detectionScore * weights.detection,
      percentage: `${(weights.detection * 100).toFixed(0)}%`,
    },
    {
      name: 'Management Systems',
      score: managementScore,
      weight: weights.management,
      contribution: managementScore * weights.management,
      percentage: `${(weights.management * 100).toFixed(0)}%`,
    },
    {
      name: 'Special Hazards',
      score: specialHazardsScore,
      weight: weights.hazards,
      contribution: specialHazardsScore * weights.hazards,
      percentage: `${(weights.hazards * 100).toFixed(0)}%`,
    },
    {
      name: 'Business Interruption',
      score: businessInterruptionScore,
      weight: weights.bi,
      contribution: businessInterruptionScore * weights.bi,
      percentage: `${(weights.bi * 100).toFixed(0)}%`,
    },
  ];
}

export function getLowestContributors(contributions: DimensionContribution[]): DimensionContribution[] {
  return [...contributions].sort((a, b) => a.contribution - b.contribution).slice(0, 2);
}
