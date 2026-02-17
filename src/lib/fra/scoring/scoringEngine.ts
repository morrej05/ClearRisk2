export type Likelihood = "Low" | "Medium" | "High";
export type Consequence = "Slight" | "Moderate" | "Extreme";
export type OverallRisk = "Trivial" | "Tolerable" | "Moderate" | "Substantial" | "Intolerable";

export type ScoringResult = {
  likelihood: Likelihood;
  consequence: Consequence;
  overallRisk: OverallRisk;
  provisional: boolean;
  ruleTriggers: string[];
  provisionalReasons: string[];
};

interface BuildingProfile {
  sleeping_risk?: string;
  vulnerable_persons?: string;
  building_height_m?: number;
  single_staircase?: boolean;
  complex_evacuation?: string;
}

interface ModuleInstance {
  id: string;
  module_key: string;
  outcome: string | null;
  data: Record<string, any>;
}

interface ScoringArgs {
  jurisdiction: string;
  buildingProfile: BuildingProfile;
  moduleInstances: ModuleInstance[];
}

const GOVERNANCE_MODULES = [
  'A1_DOCUMENT_CONTROL',
  'A2_BUILDING_PROFILE',
  'A3_PERSONS_AT_RISK',
  'A4_MANAGEMENT',
  'A7_REVIEW_ASSURANCE',
];

const CRITICAL_MODULES = [
  'FRA_1_HAZARDS',
  'FRA_2_ESCAPE',
  'FRA_3_PROTECTION_ASIS',
  'FRA_3_ACTIVE_SYSTEMS',
  'FRA_4_PASSIVE_PROTECTION',
  'FRA_5_EXTERNAL_FIRE_SPREAD',
  'FRA_8_FIREFIGHTING_EQUIPMENT',
];

function normalizeOutcome(outcome: string | null): string {
  if (!outcome) return 'unknown';

  const lower = outcome.toLowerCase().replace(/[^a-z_]/g, '_');

  if (lower.includes('adequate') || lower.includes('compliant')) return 'adequate';
  if (lower.includes('improvement') || lower.includes('minor')) return 'minor_def';
  if (lower.includes('significant') || lower.includes('material')) return 'material_def';
  if (lower.includes('info') || lower.includes('gap')) return 'info_gap';

  return 'unknown';
}

function isGovernanceModule(moduleKey: string): boolean {
  return GOVERNANCE_MODULES.includes(moduleKey);
}

function isCriticalModule(moduleKey: string): boolean {
  return CRITICAL_MODULES.includes(moduleKey);
}

function getBaselineConsequence(profile: BuildingProfile): Consequence {
  const sleepingRisk = profile.sleeping_risk?.toLowerCase() || '';
  const vulnerable = profile.vulnerable_persons?.toLowerCase() || '';
  const height = profile.building_height_m || 0;
  const singleStair = profile.single_staircase || false;
  const complexEvac = profile.complex_evacuation?.toLowerCase() || '';

  if (
    sleepingRisk.includes('high') ||
    vulnerable.includes('significant') ||
    height > 30 ||
    (singleStair && height > 11) ||
    complexEvac.includes('very')
  ) {
    return 'Extreme';
  }

  if (
    sleepingRisk.includes('medium') ||
    vulnerable.includes('some') ||
    height > 18 ||
    singleStair ||
    complexEvac.includes('moderate')
  ) {
    return 'Moderate';
  }

  return 'Slight';
}

function hasEicrIssues(moduleInstance: ModuleInstance): boolean {
  const electrical = moduleInstance.data.electrical_safety;
  if (!electrical) return false;

  return (
    electrical.eicr_evidence_seen === 'no' ||
    electrical.eicr_outstanding_c1_c2 === 'yes' ||
    electrical.eicr_satisfactory === 'unsatisfactory'
  );
}

function hasFixedFirefightingIssues(moduleInstance: ModuleInstance, profile: BuildingProfile): boolean {
  const firefighting = moduleInstance.data.firefighting;
  if (!firefighting || !firefighting.fixed_facilities) return false;

  const height = profile.building_height_m || 0;
  const facilities = firefighting.fixed_facilities;

  if (height > 18) {
    if (
      facilities.sprinklers?.installed === 'yes' &&
      facilities.sprinklers?.servicing_status === 'defective'
    ) {
      return true;
    }

    if (
      facilities.dry_riser?.installed === 'no' ||
      facilities.firefighting_lift?.present === 'no'
    ) {
      return true;
    }
  }

  if (height > 50) {
    if (
      facilities.wet_riser?.installed === 'no' ||
      facilities.wet_riser?.servicing_status === 'defective'
    ) {
      return true;
    }
  }

  return false;
}

export function scoreFraDocument(args: ScoringArgs): ScoringResult {
  const { buildingProfile, moduleInstances } = args;

  let likelihood: Likelihood = "Low";
  let consequence: Consequence = getBaselineConsequence(buildingProfile);
  let provisional = false;
  const ruleTriggers: string[] = [];
  const provisionalReasons: string[] = [];

  let hasCriticalInfoGaps = false;
  let criticalMaterialDeficiencies: string[] = [];
  let governanceImprovements = 0;

  for (const instance of moduleInstances) {
    const normalized = normalizeOutcome(instance.outcome);
    const isGov = isGovernanceModule(instance.module_key);
    const isCrit = isCriticalModule(instance.module_key);
    const gapType = instance.data.scoring?.gapType;
    const extent = instance.data.scoring?.extent;

    if (normalized === 'info_gap') {
      if (gapType === 'critical' || isCrit) {
        hasCriticalInfoGaps = true;
        provisionalReasons.push(`Critical information gap in ${instance.module_key}`);
        ruleTriggers.push(`Critical info gap: ${instance.module_key}`);
      }
    }

    if (normalized === 'minor_def') {
      if (isGov) {
        governanceImprovements++;
        ruleTriggers.push(`Governance improvement needed: ${instance.module_key}`);
      } else if (isCrit) {
        if (likelihood === 'Low') likelihood = 'Medium';
        ruleTriggers.push(`Minor deficiency in critical module: ${instance.module_key}`);
      }
    }

    if (normalized === 'material_def') {
      if (isGov) {
        governanceImprovements += 2;
        if (likelihood === 'Low') likelihood = 'Medium';
        if (likelihood === 'Medium' && governanceImprovements >= 3) likelihood = 'High';
        ruleTriggers.push(`Material governance deficiency: ${instance.module_key}`);
      } else if (isCrit) {
        criticalMaterialDeficiencies.push(instance.module_key);

        if (extent === 'repeated' || extent === 'systemic') {
          if (consequence === 'Slight') consequence = 'Moderate';
          else if (consequence === 'Moderate') consequence = 'Extreme';
          ruleTriggers.push(`${extent} material deficiency escalated consequence: ${instance.module_key}`);
        }

        if (likelihood === 'Low') likelihood = 'Medium';
        if (extent === 'systemic') likelihood = 'High';

        ruleTriggers.push(`Material deficiency in critical module: ${instance.module_key}`);
      }
    }

    if (instance.module_key === 'FRA_1_HAZARDS' && hasEicrIssues(instance)) {
      if (likelihood === 'Low') likelihood = 'Medium';
      ruleTriggers.push('Electrical safety concerns (EICR)');
    }

    if (instance.module_key === 'FRA_8_FIREFIGHTING_EQUIPMENT' && hasFixedFirefightingIssues(instance, buildingProfile)) {
      if (consequence === 'Slight') consequence = 'Moderate';
      ruleTriggers.push('Critical fixed firefighting facility issues');
    }
  }

  if (hasCriticalInfoGaps) {
    provisional = true;
    if (likelihood === 'Low') likelihood = 'Medium';
    ruleTriggers.push('Assessment provisional due to critical info gaps');
  }

  const overallRisk = mapToOverallRisk(likelihood, consequence);

  if (hasCriticalInfoGaps && overallRisk === 'Trivial') {
    return {
      likelihood: 'Medium',
      consequence,
      overallRisk: 'Tolerable',
      provisional,
      ruleTriggers,
      provisionalReasons,
    };
  }

  return {
    likelihood,
    consequence,
    overallRisk,
    provisional,
    ruleTriggers,
    provisionalReasons,
  };
}

function mapToOverallRisk(likelihood: Likelihood, consequence: Consequence): OverallRisk {
  const matrix: Record<Likelihood, Record<Consequence, OverallRisk>> = {
    Low: {
      Slight: 'Trivial',
      Moderate: 'Tolerable',
      Extreme: 'Moderate',
    },
    Medium: {
      Slight: 'Tolerable',
      Moderate: 'Moderate',
      Extreme: 'Substantial',
    },
    High: {
      Slight: 'Moderate',
      Moderate: 'Substantial',
      Extreme: 'Intolerable',
    },
  };

  return matrix[likelihood][consequence];
}
