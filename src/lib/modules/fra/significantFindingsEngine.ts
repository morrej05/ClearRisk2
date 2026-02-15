import {
  deriveExecutiveOutcome,
  checkMaterialDeficiency,
  type FraExecutiveOutcome,
  type FraPriority,
  type FraContext,
  type FraFindingCategory,
} from './severityEngine';
import type { FraComplexityBand } from './complexityEngine';

export interface FraTopIssue {
  title: string;
  priority: FraPriority;
  triggerText?: string;
  category?: FraFindingCategory;
}

export interface FraComputedSummary {
  computedOutcome: FraExecutiveOutcome;
  counts: {
    p1: number;
    p2: number;
    p3: number;
    p4: number;
  };
  topIssues: FraTopIssue[];
  materialDeficiency: boolean;
  toneParagraph: string;
}

export interface ActionForComputation {
  title?: string;
  priority?: FraPriority;
  category?: FraFindingCategory;
  trigger_text?: string;
  status?: string;
}

const PRIORITY_ORDER: Record<FraPriority, number> = {
  P1: 1,
  P2: 2,
  P3: 3,
  P4: 4,
};

const HIGH_PRIORITY_CATEGORIES: FraFindingCategory[] = [
  'MeansOfEscape',
  'DetectionAlarm',
  'Compartmentation',
];

function generateToneParagraph(
  scsBand: FraComplexityBand,
  occupancyRisk: 'NonSleeping' | 'Sleeping' | 'Vulnerable',
  outcome: FraExecutiveOutcome
): string {
  const complexityContext = (() => {
    switch (scsBand) {
      case 'VeryHigh':
        return 'The premises comprises a complex building with significant reliance on structural and active fire protection systems. Effective maintenance and management controls are critical.';
      case 'High':
        return 'The building presents structural and occupancy complexity which increases reliance on fire protection measures.';
      case 'Moderate':
        return 'The building has moderate complexity requiring appropriate fire safety provisions.';
      case 'Low':
      default:
        return 'The premises presents a relatively straightforward fire safety context.';
    }
  })();

  const occupancyContext = (() => {
    switch (occupancyRisk) {
      case 'Vulnerable':
        return ' The presence of vulnerable occupants increases the criticality of maintaining robust fire safety systems.';
      case 'Sleeping':
        return ' As sleeping accommodation, occupants may be less alert to fire cues, requiring higher standards of detection and alarm provision.';
      case 'NonSleeping':
      default:
        return '';
    }
  })();

  const outcomeContext = (() => {
    switch (outcome) {
      case 'MaterialLifeSafetyRiskPresent':
        return ' Material life safety deficiencies have been identified which require immediate attention.';
      case 'SignificantDeficiencies':
        return ' Significant deficiencies have been identified which require prompt remedial action.';
      case 'ImprovementsRequired':
        return ' Improvements are required to achieve compliance with fire safety standards.';
      case 'SatisfactoryWithImprovements':
      default:
        return ' Overall, fire safety arrangements are satisfactory subject to the improvements identified.';
    }
  })();

  return `${complexityContext}${occupancyContext}${outcomeContext}`;
}

function sortActions(
  actions: ActionForComputation[],
  scsBand: FraComplexityBand
): ActionForComputation[] {
  const highComplexity = scsBand === 'High' || scsBand === 'VeryHigh';

  return [...actions].sort((a, b) => {
    const aPriority = a.priority || 'P4';
    const bPriority = b.priority || 'P4';

    const priorityDiff = PRIORITY_ORDER[aPriority] - PRIORITY_ORDER[bPriority];
    if (priorityDiff !== 0) return priorityDiff;

    if (highComplexity) {
      const aIsHighPriorityCat = HIGH_PRIORITY_CATEGORIES.includes(
        a.category as FraFindingCategory
      );
      const bIsHighPriorityCat = HIGH_PRIORITY_CATEGORIES.includes(
        b.category as FraFindingCategory
      );

      if (aIsHighPriorityCat && !bIsHighPriorityCat) return -1;
      if (!aIsHighPriorityCat && bIsHighPriorityCat) return 1;
    }

    return 0;
  });
}

export function computeFraSummary(context: {
  actions: ActionForComputation[];
  scsBand: FraComplexityBand;
  fraContext: FraContext;
}): FraComputedSummary {
  const { actions, scsBand, fraContext } = context;

  const openActions = actions.filter(
    (a) => a.status === 'open' || a.status === 'in_progress'
  );

  const counts = {
    p1: openActions.filter((a) => a.priority === 'P1').length,
    p2: openActions.filter((a) => a.priority === 'P2').length,
    p3: openActions.filter((a) => a.priority === 'P3').length,
    p4: openActions.filter((a) => a.priority === 'P4').length,
  };

  const computedOutcome = deriveExecutiveOutcome(openActions);

  const materialDefCheck = checkMaterialDeficiency(openActions, fraContext);
  const materialDeficiency = materialDefCheck.isMaterialDeficiency;

  const sortedActions = sortActions(openActions, scsBand);
  const topIssues: FraTopIssue[] = sortedActions.slice(0, 3).map((action) => {
    const priority = action.priority || 'P4';
    const showTrigger = priority === 'P1' || priority === 'P2';

    return {
      title: action.title || 'Untitled action',
      priority,
      triggerText: showTrigger ? action.trigger_text : undefined,
      category: action.category,
    };
  });

  const toneParagraph = generateToneParagraph(
    scsBand,
    fraContext.occupancyRisk,
    computedOutcome
  );

  return {
    computedOutcome,
    counts,
    topIssues,
    materialDeficiency,
    toneParagraph,
  };
}
