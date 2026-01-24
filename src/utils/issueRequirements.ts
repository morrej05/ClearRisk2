/**
 * Issue Requirements Matrix
 *
 * Defines required modules and conditional requirements for FRA, FSD, and DSEAR surveys.
 * This is the single source of truth for issue gating rules.
 */

import { MODULE_KEYS } from '../config/moduleKeys';

export type SurveyType = 'FRA' | 'FSD' | 'DSEAR';

export type IssueCtx = {
  scope_type?: 'full' | 'limited' | 'desktop' | 'other';
  engineered_solutions_used?: boolean;
  suppression_applicable?: boolean;
  smoke_control_applicable?: boolean;
}

export interface ModuleRule {
  key: string;
  label: string;
  required: boolean;
  condition?: (ctx: IssueCtx) => boolean;
  requiredFields?: string[];
}

export interface ValidationContext extends IssueCtx {
  surveyType: SurveyType;
  [key: string]: any;
}

/**
 * Get required modules for a given survey type and context
 */
export function getRequiredModules(
  surveyType: SurveyType,
  ctx: IssueCtx = {}
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
function getFraRequiredModules(ctx: IssueCtx): ModuleRule[] {
  return [
    {
      key: MODULE_KEYS.survey_info,
      label: 'Document Control & Governance',
      required: true,
    },
    {
      key: MODULE_KEYS.property_details,
      label: 'Building Profile',
      required: true,
    },
    {
      key: MODULE_KEYS.persons_at_risk,
      label: 'Occupancy & Persons at Risk',
      required: true,
    },
    {
      key: MODULE_KEYS.management,
      label: 'Management Systems',
      required: true,
    },
    {
      key: MODULE_KEYS.emergency_arrangements,
      label: 'Emergency Arrangements',
      required: true,
    },
    {
      key: MODULE_KEYS.hazards,
      label: 'Hazards & Ignition Sources',
      required: true,
    },
    {
      key: MODULE_KEYS.means_of_escape,
      label: 'Means of Escape',
      required: true,
    },
    {
      key: MODULE_KEYS.fire_protection,
      label: 'Fire Protection',
      required: true,
    },
    {
      key: MODULE_KEYS.significant_findings,
      label: 'Significant Findings',
      required: true,
    },
  ];
}

/**
 * FSD Required Modules
 */
function getFsdRequiredModules(ctx: IssueCtx): ModuleRule[] {
  const modules: ModuleRule[] = [
    {
      key: MODULE_KEYS.survey_info,
      label: 'Document Control & Governance',
      required: true,
    },
    {
      key: MODULE_KEYS.property_details,
      label: 'Building Profile',
      required: true,
    },
    {
      key: MODULE_KEYS.persons_at_risk,
      label: 'Occupancy & Persons at Risk',
      required: true,
    },
    {
      key: MODULE_KEYS.regulatory_basis,
      label: 'Regulatory Basis',
      required: true,
    },
    {
      key: MODULE_KEYS.evacuation_strategy,
      label: 'Evacuation Strategy',
      required: true,
    },
    {
      key: MODULE_KEYS.escape_design,
      label: 'Escape Design',
      required: true,
    },
    {
      key: MODULE_KEYS.passive_protection,
      label: 'Passive Fire Protection',
      required: true,
    },
    {
      key: MODULE_KEYS.active_systems,
      label: 'Active Fire Systems',
      required: true,
    },
    {
      key: MODULE_KEYS.frs_access,
      label: 'Fire & Rescue Service Access',
      required: true,
    },
  ];

  // Conditional modules
  if (ctx.smoke_control_applicable) {
    modules.push({
      key: MODULE_KEYS.smoke_control,
      label: 'Smoke Control',
      required: true,
      condition: (c) => c.smoke_control_applicable === true,
    });
  }

  // If engineered solutions used, certain sections become mandatory
  if (ctx.engineered_solutions_used) {
    // These are already required, but we might need to add specific validation later
  }

  return modules;
}

/**
 * DSEAR Required Modules
 */
function getDsearRequiredModules(ctx: IssueCtx): ModuleRule[] {
  return [
    {
      key: MODULE_KEYS.survey_info,
      label: 'Document Control & Governance',
      required: true,
    },
    {
      key: MODULE_KEYS.property_details,
      label: 'Building Profile',
      required: true,
    },
    {
      key: MODULE_KEYS.persons_at_risk,
      label: 'Occupancy & Persons at Risk',
      required: true,
    },
    {
      key: MODULE_KEYS.dangerous_substances,
      label: 'Dangerous Substances Register',
      required: true,
    },
    {
      key: MODULE_KEYS.process_releases,
      label: 'Process & Release Assessment',
      required: true,
    },
    {
      key: MODULE_KEYS.hazardous_area_classification,
      label: 'Hazardous Area Classification',
      required: true,
    },
    {
      key: MODULE_KEYS.ignition_sources,
      label: 'Ignition Source Control',
      required: true,
    },
    {
      key: MODULE_KEYS.explosion_protection,
      label: 'Explosion Protection & Mitigation',
      required: true,
    },
    {
      key: MODULE_KEYS.risk_assessment_table,
      label: 'Risk Assessment Table',
      required: true,
    },
    {
      key: MODULE_KEYS.hierarchy_of_control,
      label: 'Hierarchy of Control',
      required: true,
    },
    {
      key: MODULE_KEYS.explosion_emergency,
      label: 'Explosion Emergency Response',
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
  ctx: IssueCtx
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
  ctx: IssueCtx
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
  ctx: IssueCtx
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
