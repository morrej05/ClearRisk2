/**
 * FRA PDF Constants
 * Central location for constants used across FRA PDF generation
 */

/**
 * Critical fields per section - used for information gap analysis
 */
export const CRITICAL_FIELDS: Record<number, string[]> = {
  5: ['eicr_evidence_seen', 'housekeeping_fire_load', 'arson_risk'],
  6: ['travel_distances_compliant', 'escape_route_obstructions', 'final_exits_adequate'],
  7: ['fire_alarm_present', 'alarm_testing_evidence', 'alarm_zoning_adequacy', 'emergency_lighting_present', 'emergency_lighting_testing_evidence', 'emergency_lighting_coverage'],
  9: ['fire_doors_condition', 'compartmentation_condition', 'fire_stopping_confidence'],
  10: ['sprinkler_present', 'extinguishers_present', 'hydrant_access'],
  11: ['fire_safety_policy_exists', 'training_induction_provided', 'inspection_alarm_weekly_test'],
  12: ['boundary_distances_adequate', 'external_wall_fire_resistance', 'cladding_concerns'],
};
