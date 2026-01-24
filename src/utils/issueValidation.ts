/**
 * Issue Validation Logic
 *
 * Validates whether a survey is eligible for issuance based on:
 * - Required module completion
 * - Required field validation
 * - Conditional requirements
 * - Assessor confirmation
 */

import {
  getRequiredModules,
  isModuleRequired,
  type SurveyType,
  type ValidationContext,
  type ModuleRule,
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

export interface Survey {
  id: string;
  document_type: SurveyType;
  scope_type?: string;
  scope_limitations?: string;
  engineered_solutions_used?: boolean;
  issued_confirmed?: boolean;
  form_data?: any;
}

export interface ModuleProgress {
  [moduleKey: string]: 'complete' | 'incomplete' | 'not_started';
}

export interface Action {
  id: string;
  status: string;
  [key: string]: any;
}

/**
 * Main validation function - checks if survey is eligible for issuance
 */
export async function validateIssueEligibility(
  survey: Survey,
  answers: any,
  moduleProgress: ModuleProgress,
  actions: Action[]
): Promise<ValidationResult> {
  const blockers: Blocker[] = [];

  // Build validation context
  const ctx: ValidationContext = {
    surveyType: survey.document_type,
    scopeType: survey.scope_type,
    engineeredSolutionsUsed: survey.engineered_solutions_used,
    // Extract conditional flags from answers if needed
    hasSuppression: answers?.suppression_applicable === true,
    hasSmokeControl: answers?.smoke_control_applicable === true,
  };

  // Get required modules for this survey type
  const requiredModules = getRequiredModules(survey.document_type, ctx);

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

  // 2. Check required fields
  const fieldBlockers = validateRequiredFields(survey, answers, requiredModules, ctx);
  blockers.push(...fieldBlockers);

  // 3. Survey-specific validations
  const specificBlockers = validateSurveySpecific(survey, answers, actions, ctx);
  blockers.push(...specificBlockers);

  // 4. Check assessor confirmation
  if (!survey.issued_confirmed) {
    blockers.push({
      type: 'confirm_missing',
      message: 'Assessor must confirm completeness before issuing',
    });
  }

  return {
    eligible: blockers.length === 0,
    blockers,
  };
}

/**
 * Validate required fields for each module
 */
function validateRequiredFields(
  survey: Survey,
  answers: any,
  modules: ModuleRule[],
  ctx: ValidationContext
): Blocker[] {
  const blockers: Blocker[] = [];

  for (const module of modules) {
    if (!isModuleRequired(module, ctx) || !module.requiredFields) {
      continue;
    }

    for (const fieldKey of module.requiredFields) {
      const fieldValue = answers?.[module.key]?.[fieldKey];

      if (!isFieldValueValid(fieldValue)) {
        blockers.push({
          type: 'missing_field',
          moduleKey: module.key,
          fieldKey,
          message: `${module.label}: ${formatFieldName(fieldKey)} is required`,
        });
      }
    }
  }

  return blockers;
}

/**
 * Survey-specific validation rules
 */
function validateSurveySpecific(
  survey: Survey,
  answers: any,
  actions: Action[],
  ctx: ValidationContext
): Blocker[] {
  const blockers: Blocker[] = [];

  switch (survey.document_type) {
    case 'FRA':
      blockers.push(...validateFra(survey, answers, actions, ctx));
      break;
    case 'FSD':
      blockers.push(...validateFsd(survey, answers, ctx));
      break;
    case 'DSEAR':
      blockers.push(...validateDsear(survey, answers, actions, ctx));
      break;
  }

  return blockers;
}

/**
 * FRA-specific validation
 */
function validateFra(
  survey: Survey,
  answers: any,
  actions: Action[],
  ctx: ValidationContext
): Blocker[] {
  const blockers: Blocker[] = [];

  // Check scope limitations for limited/desktop assessments
  if (
    ctx.scopeType &&
    ['limited', 'desktop'].includes(ctx.scopeType) &&
    !survey.scope_limitations?.trim()
  ) {
    blockers.push({
      type: 'conditional_missing',
      moduleKey: 'survey_info',
      fieldKey: 'scope_limitations',
      message: 'Scope limitations must be specified for limited/desktop assessments',
    });
  }

  // Check overall risk rating exists
  if (!answers?.risk_evaluation?.overall_risk_rating) {
    blockers.push({
      type: 'missing_field',
      moduleKey: 'risk_evaluation',
      fieldKey: 'overall_risk_rating',
      message: 'Overall risk rating must be assigned',
    });
  }

  // Check recommendations or "no significant findings"
  const hasRecommendations = actions && actions.length > 0;
  const noSignificantFindings = answers?.recommendations?.no_significant_findings === true;

  if (!hasRecommendations && !noSignificantFindings) {
    blockers.push({
      type: 'no_recommendations',
      moduleKey: 'recommendations',
      message: 'Must have at least one recommendation OR confirm no significant findings',
    });
  }

  return blockers;
}

/**
 * FSD-specific validation
 */
function validateFsd(
  survey: Survey,
  answers: any,
  ctx: ValidationContext
): Blocker[] {
  const blockers: Blocker[] = [];

  // Check engineered solutions requirements
  if (survey.engineered_solutions_used) {
    if (!answers?.limitations_reliance?.limitations_text?.trim()) {
      blockers.push({
        type: 'conditional_missing',
        moduleKey: 'limitations_reliance',
        fieldKey: 'limitations_text',
        message: 'Limitations must be documented when using engineered solutions',
      });
    }

    if (!answers?.management_assumptions?.assumptions_text?.trim()) {
      blockers.push({
        type: 'conditional_missing',
        moduleKey: 'management_assumptions',
        fieldKey: 'assumptions_text',
        message: 'Management assumptions must be documented when using engineered solutions',
      });
    }
  }

  // Check design stage and standards are specified
  if (!answers?.strategy_scope_basis?.design_stage) {
    blockers.push({
      type: 'missing_field',
      moduleKey: 'strategy_scope_basis',
      fieldKey: 'design_stage',
      message: 'Design stage must be specified',
    });
  }

  if (!answers?.strategy_scope_basis?.standards_basis?.trim()) {
    blockers.push({
      type: 'missing_field',
      moduleKey: 'strategy_scope_basis',
      fieldKey: 'standards_basis',
      message: 'Standards and regulatory basis must be documented',
    });
  }

  return blockers;
}

/**
 * DSEAR-specific validation
 */
function validateDsear(
  survey: Survey,
  answers: any,
  actions: Action[],
  ctx: ValidationContext
): Blocker[] {
  const blockers: Blocker[] = [];

  // Check substances list
  const substances = answers?.substances?.substance_list;
  if (!substances || !Array.isArray(substances) || substances.length === 0) {
    blockers.push({
      type: 'missing_field',
      moduleKey: 'substances',
      fieldKey: 'substance_list',
      message: 'At least one dangerous substance must be identified',
    });
  }

  // Check hazardous area classification
  const zoneEntries = answers?.hazardous_area_classification?.zone_entries;
  const noZonedAreas = answers?.hazardous_area_classification?.no_zoned_areas === true;

  if ((!zoneEntries || zoneEntries.length === 0) && !noZonedAreas) {
    blockers.push({
      type: 'missing_field',
      moduleKey: 'hazardous_area_classification',
      fieldKey: 'zone_entries',
      message: 'Zone classification must be documented OR confirm no zoned areas',
    });
  }

  // Check actions or controls adequate confirmation
  const hasActions = actions && actions.length > 0;
  const controlsAdequate = answers?.actions?.controls_adequate === true;

  if (!hasActions && !controlsAdequate) {
    blockers.push({
      type: 'no_recommendations',
      moduleKey: 'actions',
      message: 'Must have at least one action OR confirm controls are adequate',
    });
  }

  return blockers;
}

/**
 * Check if a field value is valid (not empty/null/undefined)
 */
function isFieldValueValid(value: any): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

/**
 * Format field key to human-readable label
 */
function formatFieldName(fieldKey: string): string {
  return fieldKey
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
