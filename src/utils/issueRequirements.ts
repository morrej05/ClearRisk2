/**
 * Issue Requirements Matrix
 *
 * Defines required modules and conditional requirements for FRA, FSD, and DSEAR surveys.
 * This is the single source of truth for issue gating rules.
 */

export type SurveyType = 'FRA' | 'FSD' | 'DSEAR';

export interface ModuleRule {
  key: string;
  label: string;
  required: boolean;
  condition?: (ctx: ValidationContext) => boolean;
  requiredFields?: string[];
}

export interface ValidationContext {
  surveyType: SurveyType;
  scopeType?: string;
  engineeredSolutionsUsed?: boolean;
  hasSuppression?: boolean;
  hasSmokeControl?: boolean;
  [key: string]: any;
}

/**
 * Get required modules for a given survey type and context
 */
export function getRequiredModules(
  surveyType: SurveyType,
  ctx: ValidationContext = { surveyType }
): ModuleRule[] {
  switch (surveyType) {
    case 'FRA':
      return getFraRequiredModules(ctx);
    case 'FSD':
      return getFsdRequiredModules(ctx);
    case 'DSEAR':
      return getDsearRequiredModules(ctx);
    default:
      return [];
  }
}

/**
 * FRA Required Modules
 */
function getFraRequiredModules(ctx: ValidationContext): ModuleRule[] {
  return [
    {
      key: 'survey_info',
      label: 'Survey Information',
      required: true,
      requiredFields: ['inspection_date', 'surveyor_name', 'company_name', 'site_name', 'scope_type'],
    },
    {
      key: 'property_details',
      label: 'Property Details',
      required: true,
    },
    {
      key: 'construction',
      label: 'Construction',
      required: true,
    },
    {
      key: 'occupancy',
      label: 'Occupancy',
      required: true,
    },
    {
      key: 'hazards',
      label: 'Fire Hazards',
      required: true,
    },
    {
      key: 'fire_protection',
      label: 'Fire Protection',
      required: true,
    },
    {
      key: 'management',
      label: 'Management',
      required: true,
    },
    {
      key: 'risk_evaluation',
      label: 'Risk Evaluation',
      required: true,
      requiredFields: ['overall_risk_rating'],
    },
    {
      key: 'recommendations',
      label: 'Recommendations',
      required: true,
    },
  ];
}

/**
 * FSD Required Modules
 */
function getFsdRequiredModules(ctx: ValidationContext): ModuleRule[] {
  const modules: ModuleRule[] = [
    {
      key: 'strategy_scope_basis',
      label: 'Strategy Scope & Basis',
      required: true,
      requiredFields: ['design_stage', 'standards_basis'],
    },
    {
      key: 'building_description',
      label: 'Building Description',
      required: true,
    },
    {
      key: 'occupancy_fire_load',
      label: 'Occupancy & Fire Load',
      required: true,
    },
    {
      key: 'means_of_escape',
      label: 'Means of Escape',
      required: true,
    },
    {
      key: 'compartmentation',
      label: 'Compartmentation',
      required: true,
    },
    {
      key: 'detection_alarm',
      label: 'Detection & Alarm',
      required: true,
    },
    {
      key: 'management_assumptions',
      label: 'Management Assumptions',
      required: ctx.engineeredSolutionsUsed === true,
      condition: (c) => c.engineeredSolutionsUsed === true,
    },
    {
      key: 'limitations_reliance',
      label: 'Limitations & Reliance',
      required: ctx.engineeredSolutionsUsed === true,
      condition: (c) => c.engineeredSolutionsUsed === true,
      requiredFields: ['limitations_text'],
    },
  ];

  // Conditional modules
  if (ctx.hasSuppression || ctx.requiresSuppression) {
    modules.push({
      key: 'suppression',
      label: 'Suppression Systems',
      required: true,
      condition: (c) => c.hasSuppression === true || c.requiresSuppression === true,
    });
  }

  if (ctx.hasSmokeControl) {
    modules.push({
      key: 'smoke_control',
      label: 'Smoke Control',
      required: true,
      condition: (c) => c.hasSmokeControl === true,
    });
  }

  return modules;
}

/**
 * DSEAR Required Modules
 */
function getDsearRequiredModules(ctx: ValidationContext): ModuleRule[] {
  return [
    {
      key: 'assessment_scope',
      label: 'Assessment Scope',
      required: true,
    },
    {
      key: 'substances',
      label: 'Dangerous Substances',
      required: true,
      requiredFields: ['substance_list'],
    },
    {
      key: 'processes',
      label: 'Processes',
      required: true,
    },
    {
      key: 'hazardous_area_classification',
      label: 'Hazardous Area Classification',
      required: true,
      requiredFields: ['zone_entries'],
    },
    {
      key: 'ignition_sources',
      label: 'Ignition Sources',
      required: true,
    },
    {
      key: 'control_measures',
      label: 'Control Measures',
      required: true,
    },
    {
      key: 'equipment_compliance',
      label: 'Equipment Compliance',
      required: true,
    },
    {
      key: 'management_controls',
      label: 'Management Controls',
      required: true,
    },
    {
      key: 'risk_evaluation',
      label: 'Risk Evaluation',
      required: true,
    },
    {
      key: 'actions',
      label: 'Actions',
      required: true,
    },
  ];
}

/**
 * Check if a specific field is required based on context
 */
export function isFieldRequired(
  surveyType: SurveyType,
  moduleKey: string,
  fieldKey: string,
  ctx: ValidationContext
): boolean {
  const modules = getRequiredModules(surveyType, ctx);
  const module = modules.find(m => m.key === moduleKey);

  if (!module || !module.requiredFields) {
    return false;
  }

  return module.requiredFields.includes(fieldKey);
}

/**
 * Get human-readable requirement description
 */
export function getRequirementDescription(
  surveyType: SurveyType,
  ctx: ValidationContext
): string {
  const modules = getRequiredModules(surveyType, ctx);
  const requiredCount = modules.filter(m => m.required).length;
  const conditionalCount = modules.filter(m => !m.required && m.condition).length;

  let description = `${requiredCount} required modules must be completed`;

  if (conditionalCount > 0) {
    description += `, ${conditionalCount} conditional modules based on your selections`;
  }

  return description;
}

/**
 * Check if a module is required given the current context
 */
export function isModuleRequired(
  module: ModuleRule,
  ctx: ValidationContext
): boolean {
  if (!module.required && !module.condition) {
    return false;
  }

  if (module.required) {
    return true;
  }

  if (module.condition) {
    return module.condition(ctx);
  }

  return false;
}
