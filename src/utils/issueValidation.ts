/**
 * Issue Validation Logic
 *
 * Validates whether a survey is eligible for issuance based on:
 * - Required module completion
 * - Required field validation
 * - Conditional requirements
 * - Survey-specific business rules
 *
 * This module uses simple, serializable inputs so it can be reused in Edge Functions.
 */

import {
  getRequiredModules,
  isModuleRequired,
  type SurveyType,
  type IssueCtx,
} from './issueRequirements';

export type BlockerType =
  | 'module_incomplete'
  | 'missing_field'
  | 'conditional_missing'
  | 'confirm_missing'
  | 'no_recommendations';

export interface Blocker {
  type: BlockerType;
  moduleKey?: string;
  fieldKey?: string;
  message: string;
}

export interface ValidationResult {
  eligible: boolean;
  blockers: Blocker[];
}

export type ModuleProgress = Record<string, 'not_started' | 'in_progress' | 'complete'>;
export type ActionStatus = 'open' | 'closed' | string;

/**
 * Main validation function - checks if survey is eligible for issuance
 *
 * @param type - Survey type (FRA, FSD, DSEAR)
 * @param ctx - Issue context with scope, engineered solutions, etc.
 * @param answers - Survey answers/form data
 * @param moduleProgress - Module completion status map
 * @param actions - List of actions/recommendations
 * @returns ValidationResult with eligible flag and list of blockers
 */
export function validateIssueEligibility(
  type: SurveyType,
  ctx: IssueCtx,
  answers: any,
  moduleProgress: ModuleProgress,
  actions: Array<{ status: ActionStatus }>
): ValidationResult {
  const blockers: Blocker[] = [];

  // Get required modules for this survey type
  const requiredModules = getRequiredModules(type, ctx);

  // 1. Check module completion
  for (const module of requiredModules) {
    if (isModuleRequired(module, ctx)) {
      const status = moduleProgress[module.key];

      if (status !== 'complete') {
        blockers.push({
          type: 'module_incomplete',
          moduleKey: module.key,
          message: `${module.label} must be completed`,
        });
      }
    }
  }

  // 2. Survey-specific validations
  const specificBlockers = validateSurveySpecific(type, ctx, answers, actions);
  blockers.push(...specificBlockers);

  return {
    eligible: blockers.length === 0,
    blockers,
  };
}

/**
 * Survey-specific validation rules
 */
function validateSurveySpecific(
  type: SurveyType,
  ctx: IssueCtx,
  answers: any,
  actions: Array<{ status: ActionStatus }>
): Blocker[] {
  const blockers: Blocker[] = [];

  switch (type) {
    case 'FRA':
      blockers.push(...validateFra(ctx, answers, actions));
      break;
    case 'FSD':
      blockers.push(...validateFsd(ctx, answers));
      break;
    case 'DSEAR':
      blockers.push(...validateDsear(ctx, answers, actions));
      break;
  }

  return blockers;
}

/**
 * FRA-specific validation
 */
function validateFra(
  ctx: IssueCtx,
  answers: any,
  actions: Array<{ status: ActionStatus }>
): Blocker[] {
  const blockers: Blocker[] = [];

  // Check scope limitations for limited/desktop assessments
  if (
    ctx.scope_type &&
    ['limited', 'desktop'].includes(ctx.scope_type) &&
    !answers?.scope_limitations?.trim()
  ) {
    blockers.push({
      type: 'conditional_missing',
      message: 'Scope limitations must be specified for limited/desktop assessments',
    });
  }

  // Check recommendations or "no significant findings"
  const hasRecommendations = actions && actions.filter(a => a.status !== 'closed').length > 0;
  const noSignificantFindings = answers?.no_significant_findings === true;

  if (!hasRecommendations && !noSignificantFindings) {
    blockers.push({
      type: 'no_recommendations',
      message: 'Must have at least one recommendation OR confirm no significant findings',
    });
  }

  return blockers;
}

/**
 * FSD-specific validation
 */
function validateFsd(
  ctx: IssueCtx,
  answers: any
): Blocker[] {
  const blockers: Blocker[] = [];

  // Check engineered solutions requirements
  if (ctx.engineered_solutions_used) {
    if (!answers?.limitations_text?.trim()) {
      blockers.push({
        type: 'conditional_missing',
        message: 'Limitations must be documented when using engineered solutions',
      });
    }

    if (!answers?.management_assumptions_text?.trim()) {
      blockers.push({
        type: 'conditional_missing',
        message: 'Management assumptions must be documented when using engineered solutions',
      });
    }
  }

  return blockers;
}

/**
 * DSEAR-specific validation
 */
function validateDsear(
  ctx: IssueCtx,
  answers: any,
  actions: Array<{ status: ActionStatus }>
): Blocker[] {
  const blockers: Blocker[] = [];

  // Check substances list
  const substances = answers?.substances;
  const noDangerousSubstances = answers?.no_dangerous_substances === true;

  if ((!substances || substances.length === 0) && !noDangerousSubstances) {
    blockers.push({
      type: 'missing_field',
      message: 'At least one dangerous substance must be identified OR confirm no dangerous substances',
    });
  }

  // Check hazardous area classification
  const zones = answers?.zones;
  const noZonedAreas = answers?.no_zoned_areas === true;

  if ((!zones || zones.length === 0) && !noZonedAreas) {
    blockers.push({
      type: 'missing_field',
      message: 'Zone classification must be documented OR confirm no zoned areas',
    });
  }

  // Check actions or controls adequate confirmation
  const hasActions = actions && actions.filter(a => a.status !== 'closed').length > 0;
  const controlsAdequate = answers?.controls_adequate_confirmed === true;

  if (!hasActions && !controlsAdequate) {
    blockers.push({
      type: 'no_recommendations',
      message: 'Must have at least one action OR confirm controls are adequate',
    });
  }

  return blockers;
}

/**
 * Group blockers by module for UI display
 */
export function groupBlockersByModule(blockers: Blocker[]): Map<string, Blocker[]> {
  const grouped = new Map<string, Blocker[]>();

  for (const blocker of blockers) {
    const key = blocker.moduleKey || 'general';
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(blocker);
  }

  return grouped;
}

/**
 * Get summary text for validation result
 */
export function getValidationSummary(result: ValidationResult): string {
  if (result.eligible) {
    return 'All requirements met - ready to issue';
  }

  const blockerCount = result.blockers.length;
  return `${blockerCount} issue${blockerCount !== 1 ? 's' : ''} must be resolved before issuing`;
}
