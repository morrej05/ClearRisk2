/**
 * Canonical FRA Module Field Schema
 *
 * Purpose:
 * Eliminate field-name drift across FRA logic layers (forms, key points,
 * info-gap detection, summary generation, scoring) by defining a single
 * source of truth for field names and their known aliases.
 *
 * Each module key maps to a canonical field name → aliases dictionary.
 * All FRA evaluation logic should use getField() helpers to resolve
 * canonical names with fallback to aliases for backward compatibility.
 */

export type FraSchemaModuleKey =
  | 'FRA_1_HAZARDS'
  | 'FRA_2_ESCAPE_ASIS'
  | 'FRA_3_ACTIVE_SYSTEMS'
  | 'FRA_4_PASSIVE_PROTECTION'
  | 'FRA_5_EXTERNAL_FIRE_SPREAD'
  | 'FRA_8_FIREFIGHTING_EQUIPMENT'
  | 'A4_MANAGEMENT_CONTROLS'
  | 'A5_EMERGENCY_ARRANGEMENTS'
  | 'A7_REVIEW_ASSURANCE';

export type FieldAliasMap = Record<string, string[]>;

/**
 * Canonical FRA field schema for module-level payloads.
 *
 * Each canonical field key includes known aliases observed across:
 * - Module forms (A1-A7, FRA1-FRA8)
 * - sectionSummaryGenerator.ts (extractSectionDrivers)
 * - keyPoints/rules.ts
 * - infoGapQuickActions.ts
 * - scoringEngine.ts
 *
 * Aliases resolve field-name drift where different code paths use
 * different keys for the same conceptual field.
 */
export const FRA_MODULE_FIELD_SCHEMA: Record<FraSchemaModuleKey, FieldAliasMap> = {
  FRA_1_HAZARDS: {
    arson_risk: [],
    housekeeping_fire_load: [],
    high_risk_activities: [],
    oxygen_enrichment: [],
    ignition_sources: [],
    fuel_sources: [],
    electrical_safety: [],
    'electrical_safety.eicr_satisfactory': [],
    'electrical_safety.eicr_evidence_seen': [],
    'electrical_safety.eicr_outstanding_c1_c2': [],
  },

  FRA_2_ESCAPE_ASIS: {
    travel_distances_compliant: [],
    escape_route_obstructions: [],
    final_exits_adequate: [],
    stair_protection_status: [],
    exit_signage_adequacy: [],
    disabled_egress_arrangements: [],
    escape_strategy: [],
  },

  FRA_3_ACTIVE_SYSTEMS: {
    // Fire alarm system fields with aliases from info-gap/quick-action logic
    fire_alarm_present: ['alarm_present'],
    fire_alarm_category: ['alarm_category'],
    alarm_testing_evidence: ['alarm_test_evidence', 'alarm_testing_records'],
    alarm_zoning_adequacy: [],
    false_alarm_frequency: [],

    // Emergency lighting fields with aliases from info-gap logic
    emergency_lighting_present: [],
    emergency_lighting_testing_evidence: ['el_testing_evidence'],
    emergency_lighting_coverage: [],
    emergency_lighting_system_type: [],
  },

  FRA_4_PASSIVE_PROTECTION: {
    fire_doors_condition: [],
    fire_doors_inspection_regime: [],
    compartmentation_condition: [],
    fire_stopping_confidence: [],
    cavity_barriers_adequate: [],
  },

  FRA_5_EXTERNAL_FIRE_SPREAD: {
    building_height_m: ['building_height_relevant'],
    boundary_distances_adequate: [],
    external_wall_fire_resistance: [],
    cladding_present: [],
    cladding_concerns: [],
    external_storage_risk: [],
    neighbouring_premises_risk: [],
    insulation_combustibility_known: [],
    pas9980_or_equivalent_appraisal: [],
    interim_measures: [],
    external_openings_fire_stopping: [],
    cavity_barriers_status: [],
  },

  FRA_8_FIREFIGHTING_EQUIPMENT: {
    sprinkler_present: [],
    extinguishers_present: [],
    // Alias from info-gap detection uses different naming
    extinguisher_servicing_evidence: ['extinguishers_servicing'],
    hydrant_access: [],
    firefighting: [],
    'firefighting.fixed_facilities.sprinklers.servicing_status': [],
    'firefighting.hose_reels.installed': [],
    'firefighting.hose_reels.servicing_status': [],
  },

  A4_MANAGEMENT_CONTROLS: {
    // Key points rules use different field names than form fields
    fire_safety_policy_exists: ['fire_safety_policy'],
    training_induction_provided: ['training_induction'],
    training_fire_drill_frequency: [],
    ptw_hot_work: [],
    contractor_supervision: [],
    inspection_alarm_weekly_test: [],
    inspection_emergency_lighting_monthly: [],
    inspection_records_available: ['testing_records'],
  },

  A5_EMERGENCY_ARRANGEMENTS: {
    emergency_plan_exists: [],
    peeps_in_place: [],
    evacuation_drills_frequency: ['drill_frequency', 'training_fire_drill_frequency'],
    assembly_points_defined: [],
  },

  A7_REVIEW_ASSURANCE: {
    review: [],
    'review.periodic_review_completed': [],
    'review.significant_findings_recorded': [],
    'review.actions_tracked_to_close': [],
    'review.recent_drill_completed': [],
    'review.training_records_current': [],
    'review.change_management_applied': [],
    'review.evidence_retained': [],
  },
};

/**
 * Short module key aliases for convenience
 * (e.g., FRA_3 -> FRA_3_ACTIVE_SYSTEMS)
 */
export const FRA_SCHEMA_MODULE_ALIASES: Record<string, FraSchemaModuleKey> = {
  FRA_1: 'FRA_1_HAZARDS',
  FRA_2: 'FRA_2_ESCAPE_ASIS',
  FRA_3: 'FRA_3_ACTIVE_SYSTEMS',
  FRA_4: 'FRA_4_PASSIVE_PROTECTION',
  FRA_5: 'FRA_5_EXTERNAL_FIRE_SPREAD',
  FRA_8: 'FRA_8_FIREFIGHTING_EQUIPMENT',
  A4: 'A4_MANAGEMENT_CONTROLS',
  A5: 'A5_EMERGENCY_ARRANGEMENTS',
  A7: 'A7_REVIEW_ASSURANCE',
};

/**
 * Resolve module key to canonical schema key
 */
export function resolveFraSchemaModuleKey(moduleKey: string): FraSchemaModuleKey | null {
  if ((FRA_MODULE_FIELD_SCHEMA as Record<string, FieldAliasMap>)[moduleKey]) {
    return moduleKey as FraSchemaModuleKey;
  }
  return FRA_SCHEMA_MODULE_ALIASES[moduleKey] ?? null;
}

/**
 * Get all canonical field keys for a module
 */
export function getCanonicalKeysForModule(moduleKey: string): string[] {
  const resolved = resolveFraSchemaModuleKey(moduleKey);
  if (!resolved) return [];
  return Object.keys(FRA_MODULE_FIELD_SCHEMA[resolved]);
}
