import { runFsdConsistencyChecks, type AssuranceFlag } from './fsdConsistencyEngine';

export type FsdOutcome = 'compliant' | 'minor_def' | 'material_def' | 'info_gap' | 'na';

export interface FsdDeviation {
  topic: string;
  deviation: string;
  justification: string;
}

export interface FsdDeviationScored extends FsdDeviation {
  score: number;
}

export interface FsdInfoGap {
  moduleKey: string;
  title: string;
  note?: string;
}

export interface FsdComputedSummary {
  computedOutcome: Exclude<FsdOutcome, 'na'>;
  outcomeCounts: Record<Exclude<FsdOutcome, 'na'>, number>;
  deviations: FsdDeviation[];
  topDeviations: FsdDeviationScored[];
  infoGaps: FsdInfoGap[];
  scopeSentence: string;
  assuranceFlags: AssuranceFlag[];
  topFlags: AssuranceFlag[];
}

export interface ModuleForComputation {
  module_key: string;
  outcome: string | null;
  assessor_notes?: string;
  data: Record<string, any>;
}

const MODULE_DISPLAY_NAMES: Record<string, string> = {
  A1_DOC_CONTROL: 'Document Control',
  FSD_1_REG_BASIS: 'Regulatory Basis',
  FSD_2_EVAC_STRATEGY: 'Evacuation Strategy',
  A2_BUILDING_PROFILE: 'Building Profile',
  A3_PERSONS_AT_RISK: 'Persons at Risk',
  FSD_3_ESCAPE_DESIGN: 'Means of Escape Design',
  FSD_4_PASSIVE_PROTECTION: 'Passive Fire Protection',
  FSD_5_ACTIVE_SYSTEMS: 'Active Fire Systems',
  FSD_6_FRS_ACCESS: 'Fire Service Access',
  FSD_7_DRAWINGS: 'Drawings Index',
  FSD_8_SMOKE_CONTROL: 'Smoke Control',
  FSD_9_CONSTRUCTION_PHASE: 'Construction Phase Fire Safety',
};

const OUTCOME_HIERARCHY: Record<Exclude<FsdOutcome, 'na'>, number> = {
  material_def: 4,
  info_gap: 3,
  minor_def: 2,
  compliant: 1,
};

function scoreDeviation(deviation: FsdDeviation): number {
  let score = 0;

  if (deviation.topic && deviation.topic.trim().length > 0) {
    score += 1;
  }

  if (deviation.deviation && deviation.deviation.trim().length > 0) {
    score += 2;
  }

  if (deviation.justification && deviation.justification.trim().length > 10) {
    score += 2;
  }

  return score;
}

function deriveDocumentOutcome(modules: ModuleForComputation[]): Exclude<FsdOutcome, 'na'> {
  let worstOutcome: Exclude<FsdOutcome, 'na'> = 'compliant';
  let worstSeverity = OUTCOME_HIERARCHY.compliant;

  for (const module of modules) {
    if (!module.outcome || module.outcome === 'na') continue;

    const moduleOutcome = module.outcome as Exclude<FsdOutcome, 'na'>;
    const severity = OUTCOME_HIERARCHY[moduleOutcome];

    if (severity > worstSeverity) {
      worstSeverity = severity;
      worstOutcome = moduleOutcome;
    }
  }

  return worstOutcome;
}

function extractDeviations(modules: ModuleForComputation[]): FsdDeviation[] {
  const fsd1Module = modules.find((m) => m.module_key === 'FSD_1_REG_BASIS');

  if (!fsd1Module || !fsd1Module.data.deviations) {
    return [];
  }

  const deviations = fsd1Module.data.deviations as FsdDeviation[];
  return deviations.filter(
    (d) => d.topic || d.deviation || d.justification
  );
}

function rankDeviations(deviations: FsdDeviation[]): FsdDeviationScored[] {
  return deviations
    .map((deviation) => ({
      ...deviation,
      score: scoreDeviation(deviation),
    }))
    .sort((a, b) => {
      if (a.score !== b.score) {
        return a.score - b.score;
      }

      const aLength = (a.deviation || '').length;
      const bLength = (b.deviation || '').length;
      return bLength - aLength;
    });
}

function extractInfoGaps(modules: ModuleForComputation[]): FsdInfoGap[] {
  return modules
    .filter((m) => m.outcome === 'info_gap')
    .map((m) => ({
      moduleKey: m.module_key,
      title: MODULE_DISPLAY_NAMES[m.module_key] || m.module_key,
      note: m.assessor_notes || undefined,
    }));
}

function adjustOutcomeForFlags(
  baseOutcome: Exclude<FsdOutcome, 'na'>,
  flags: AssuranceFlag[]
): Exclude<FsdOutcome, 'na'> {
  const hasCritical = flags.some((f) => f.severity === 'critical');
  const hasMajor = flags.some((f) => f.severity === 'major');
  const hasInfo = flags.some((f) => f.severity === 'info');

  const outcomeHierarchy: Record<Exclude<FsdOutcome, 'na'>, number> = {
    material_def: 4,
    info_gap: 3,
    minor_def: 2,
    compliant: 1,
  };

  const baseSeverity = outcomeHierarchy[baseOutcome];

  if (hasCritical) {
    const materialSeverity = outcomeHierarchy.material_def;
    if (baseSeverity < materialSeverity) {
      return 'material_def';
    }
  }

  if (hasMajor) {
    const minorSeverity = outcomeHierarchy.minor_def;
    if (baseSeverity < minorSeverity) {
      return 'minor_def';
    }
  }

  if (hasInfo && baseOutcome === 'compliant') {
    return 'info_gap';
  }

  return baseOutcome;
}

function generateScopeSentence(
  outcome: Exclude<FsdOutcome, 'na'>,
  deviationCount: number,
  infoGapCount: number
): string {
  switch (outcome) {
    case 'compliant':
      if (deviationCount === 0) {
        return 'The strategy is presented as compliant with the stated design basis, subject to the scope and limitations.';
      }
      return 'The strategy is generally compliant with the stated design basis. Minor deviations are justified and documented.';

    case 'minor_def':
      if (deviationCount > 0) {
        return 'Minor strategy issues or clarifications identified. Deviations require enhanced justification.';
      }
      return 'Minor strategy issues or clarifications identified.';

    case 'info_gap':
      if (infoGapCount === 1) {
        return 'Information gap identified which limits full assurance of compliance.';
      }
      return `${infoGapCount} information gaps identified which limit full assurance of compliance.`;

    case 'material_def':
      if (deviationCount > 0) {
        return 'Material design deviations or deficiencies identified. Inadequate justification for departures from guidance.';
      }
      return 'Material design deficiencies identified requiring resolution.';

    default:
      return 'Design basis assessment completed.';
  }
}

export function computeFsdSummary(context: {
  modules: ModuleForComputation[];
}): FsdComputedSummary {
  const { modules } = context;

  const { flags } = runFsdConsistencyChecks({ modules });

  const baseOutcome = deriveDocumentOutcome(modules);
  const computedOutcome = adjustOutcomeForFlags(baseOutcome, flags);

  const outcomeCounts: Record<Exclude<FsdOutcome, 'na'>, number> = {
    compliant: 0,
    minor_def: 0,
    material_def: 0,
    info_gap: 0,
  };

  for (const module of modules) {
    if (module.outcome && module.outcome !== 'na') {
      const outcome = module.outcome as Exclude<FsdOutcome, 'na'>;
      outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1;
    }
  }

  const deviations = extractDeviations(modules);
  const rankedDeviations = rankDeviations(deviations);
  const topDeviations = rankedDeviations.slice(0, 5);

  const infoGaps = extractInfoGaps(modules);

  const scopeSentence = generateScopeSentence(
    computedOutcome,
    deviations.length,
    infoGaps.length
  );

  const topFlags = flags.slice(0, 5);

  return {
    computedOutcome,
    outcomeCounts,
    deviations,
    topDeviations,
    infoGaps,
    scopeSentence,
    assuranceFlags: flags,
    topFlags,
  };
}
