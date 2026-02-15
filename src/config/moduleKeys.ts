/**
 * Module Key Mapping
 *
 * Maps abstract required-module names to actual section keys used in the application.
 * This is the single source of truth for module key mapping.
 *
 * DO NOT rename existing sections/routes - only map to them here.
 */

export const MODULE_KEYS = {
  // FRA - Common/Shared modules
  survey_info: 'A1_DOC_CONTROL',
  property_details: 'A2_BUILDING_PROFILE',
  persons_at_risk: 'A3_PERSONS_AT_RISK',

  // FRA - Specific modules
  management: 'FRA_6_MANAGEMENT_SYSTEMS',
  emergency_arrangements: 'FRA_7_EMERGENCY_ARRANGEMENTS',
  hazards: 'FRA_1_HAZARDS',
  means_of_escape: 'FRA_2_ESCAPE_ASIS',
  fire_protection: 'FRA_3_PROTECTION_ASIS',
  significant_findings: 'FRA_90_SIGNIFICANT_FINDINGS',
  external_fire_spread: 'FRA_5_EXTERNAL_FIRE_SPREAD',

  // FSD - Specific modules
  regulatory_basis: 'FSD_1_REG_BASIS',
  evacuation_strategy: 'FSD_2_EVAC_STRATEGY',
  escape_design: 'FSD_3_ESCAPE_DESIGN',
  passive_protection: 'FSD_4_PASSIVE_PROTECTION',
  active_systems: 'FSD_5_ACTIVE_SYSTEMS',
  frs_access: 'FSD_6_FRS_ACCESS',
  drawings_schedules: 'FSD_7_DRAWINGS',
  smoke_control: 'FSD_8_SMOKE_CONTROL',
  construction_phase: 'FSD_9_CONSTRUCTION_PHASE',

  // DSEAR - Specific modules
  dangerous_substances: 'DSEAR_1_DANGEROUS_SUBSTANCES',
  process_releases: 'DSEAR_2_PROCESS_RELEASES',
  hazardous_area_classification: 'DSEAR_3_HAZARDOUS_AREA_CLASSIFICATION',
  ignition_sources: 'DSEAR_4_IGNITION_SOURCES',
  explosion_protection: 'DSEAR_5_EXPLOSION_PROTECTION',
  risk_assessment_table: 'DSEAR_6_RISK_ASSESSMENT',
  hierarchy_of_control: 'DSEAR_10_HIERARCHY_OF_CONTROL',
  explosion_emergency: 'DSEAR_11_EXPLOSION_EMERGENCY_RESPONSE',
} as const;

export type ModuleKeyMap = typeof MODULE_KEYS;
export type AbstractModuleKey = keyof ModuleKeyMap;
export type ActualModuleKey = ModuleKeyMap[AbstractModuleKey];
