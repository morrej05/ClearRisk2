/**
 * Deterministic Key Points Rule Engine
 *
 * Generates 0-4 concise observation bullets per FRA section
 * based on structured field data (no LLM calls).
 *
 * Rules prioritize:
 * 1. Weaknesses (deficiencies, gaps, non-compliance)
 * 2. Strengths (good practice, compliance indicators)
 * 3. Info (contextual observations)
 *
 * Filters out unknown/N/A/default noise.
 */

export interface KeyPointRule {
  id: string;
  type: 'weakness' | 'strength' | 'info';
  weight: number; // Higher = more important
  when: (data: any) => boolean;
  text: (data: any) => string;
  /** Evidence extraction: returns field paths and values that triggered this rule */
  evidence: (data: any) => Array<{ field: string; value: any }>;
}

export interface KeyPoint {
  type: 'weakness' | 'strength' | 'info';
  weight: number;
  text: string;
}

/**
 * Safe field access helpers
 */
function safeGet(obj: any, path: string, defaultVal: any = null): any {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return defaultVal;
    current = current[key];
  }
  return current ?? defaultVal;
}

function isYes(value: any): boolean {
  if (!value) return false;
  const str = String(value).toLowerCase().trim();
  return str === 'yes' || str === 'true' || str === '1';
}

function isNo(value: any): boolean {
  if (!value) return false;
  const str = String(value).toLowerCase().trim();
  return str === 'no' || str === 'false' || str === '0';
}

function isUnknown(value: any): boolean {
  if (!value) return true;
  const str = String(value).toLowerCase().trim();
  return str === 'unknown' || str === 'not known' || str === 'not_known' || str === 'n/a' || str === 'not applicable';
}

function hasValue(value: any): boolean {
  return value != null && !isUnknown(value) && String(value).trim() !== '';
}

function includesAny(arr: any, keywords: string[]): boolean {
  if (!Array.isArray(arr)) return false;
  const items = arr.map(v => String(v).toLowerCase());
  return keywords.some(kw => items.some(item => item.includes(kw)));
}

/**
 * Section 5: Fire Hazards & Ignition Sources (FRA_1_HAZARDS)
 */
export const section5Rules: KeyPointRule[] = [
  {
    id: 'eicr_c1_c2_outstanding',
    type: 'weakness',
    weight: 100,
    when: (data) => {
      const eicr = safeGet(data, 'electrical_safety', {});
      return isYes(safeGet(eicr, 'eicr_outstanding_c1_c2'));
    },
    text: (data) => 'Outstanding C1/C2 electrical defects identified',
    evidence: (data) => [{ field: 'electrical_safety.eicr_outstanding_c1_c2', value: safeGet(data, 'electrical_safety.eicr_outstanding_c1_c2') }],
  },
  {
    id: 'eicr_unsatisfactory',
    type: 'weakness',
    weight: 95,
    when: (data) => {
      const eicr = safeGet(data, 'electrical_safety', {});
      const c1c2 = isYes(safeGet(eicr, 'eicr_outstanding_c1_c2'));
      return safeGet(eicr, 'eicr_satisfactory') === 'unsatisfactory' && !c1c2;
    },
    text: (data) => 'EICR assessment rated as unsatisfactory',
    evidence: (data) => [{ field: 'electrical_safety.eicr_satisfactory', value: safeGet(data, 'electrical_safety.eicr_satisfactory') }],
  },
  {
    id: 'high_risk_lithium',
    type: 'weakness',
    weight: 85,
    when: (data) => includesAny(safeGet(data, 'high_risk_activities', []), ['lithium', 'battery', 'e-bike', 'e-scooter']),
    text: (data) => 'Lithium-ion battery charging activities present elevated fire risk',
    evidence: (data) => [{ field: 'high_risk_activities', value: safeGet(data, 'high_risk_activities') }],
  },
  {
    id: 'high_risk_kitchen',
    type: 'weakness',
    weight: 80,
    when: (data) => includesAny(safeGet(data, 'high_risk_activities', []), ['kitchen', 'cooking', 'deep fat']),
    text: (data) => 'Commercial cooking operations identified as significant ignition source',
    evidence: (data) => [{ field: 'high_risk_activities', value: safeGet(data, 'high_risk_activities') }],
  },
  {
    id: 'housekeeping_high',
    type: 'weakness',
    weight: 75,
    when: (data) => {
      const val = safeGet(data, 'housekeeping_fire_load');
      return val === 'high' || val === 'very_high';
    },
    text: (data) => 'Housekeeping standards poor; excessive combustible materials present',
    evidence: (data) => [{ field: 'housekeeping_fire_load', value: safeGet(data, 'housekeeping_fire_load') }],
  },
  {
    id: 'housekeeping_medium',
    type: 'weakness',
    weight: 60,
    when: (data) => safeGet(data, 'housekeeping_fire_load') === 'medium',
    text: (data) => 'Housekeeping requires improvement to reduce fire load',
    evidence: (data) => [{ field: 'housekeeping_fire_load', value: safeGet(data, 'housekeeping_fire_load') }],
  },
  {
    id: 'arson_risk_high',
    type: 'weakness',
    weight: 70,
    when: (data) => {
      const val = safeGet(data, 'arson_risk');
      return val === 'high' || val === 'very_high';
    },
    text: (data) => 'Site vulnerable to arson; additional security measures recommended',
    evidence: (data) => [{ field: 'arson_risk', value: safeGet(data, 'arson_risk') }],
  },
  {
    id: 'arson_risk_low',
    type: 'strength',
    weight: 40,
    when: (data) => safeGet(data, 'arson_risk') === 'low',
    text: (data) => 'Arson risk well-controlled through security measures',
    evidence: (data) => [{ field: 'arson_risk', value: safeGet(data, 'arson_risk') }],
  },
];

/**
 * Section 6: Means of Escape (FRA_2_ESCAPE_ASIS)
 */
export const section6Rules: KeyPointRule[] = [
  {
    id: 'travel_distances_non_compliant',
    type: 'weakness',
    weight: 90,
    when: (data) => isNo(safeGet(data, 'travel_distances_compliant')),
    text: (data) => 'Travel distances exceed regulatory guidance limits',
    evidence: (data) => [{ field: 'travel_distances_compliant', value: safeGet(data, 'travel_distances_compliant') }],
  },
  {
    id: 'escape_route_obstructions',
    type: 'weakness',
    weight: 85,
    when: (data) => isYes(safeGet(data, 'escape_route_obstructions')),
    text: (data) => 'Obstructions identified in escape routes',
    evidence: (data) => [{ field: 'escape_route_obstructions', value: safeGet(data, 'escape_route_obstructions') }],
  },
  {
    id: 'final_exits_inadequate',
    type: 'weakness',
    weight: 88,
    when: (data) => isNo(safeGet(data, 'final_exits_adequate')),
    text: (data) => 'Final exits inadequate for occupant capacity',
    evidence: (data) => [{ field: 'final_exits_adequate', value: safeGet(data, 'final_exits_adequate') }],
  },
  {
    id: 'stair_protection_inadequate',
    type: 'weakness',
    weight: 82,
    when: (data) => {
      const val = safeGet(data, 'stair_protection_status');
      return val === 'inadequate' || val === 'non_compliant';
    },
    text: (data) => 'Stair protection does not meet required fire resistance standards',
    evidence: (data) => [{ field: 'stair_protection_status', value: safeGet(data, 'stair_protection_status') }],
  },
  {
    id: 'exit_signage_inadequate',
    type: 'weakness',
    weight: 70,
    when: (data) => {
      const val = safeGet(data, 'exit_signage_adequacy');
      return val === 'inadequate' || val === 'missing';
    },
    text: (data) => 'Exit signage is inadequate or missing',
    evidence: (data) => [{ field: 'exit_signage_adequacy', value: safeGet(data, 'exit_signage_adequacy') }],
  },
  {
    id: 'assisted_evacuation_physical_inadequate',
    type: 'weakness',
    weight: 75,
    when: (data) => {
      const val = safeGet(data, 'disabled_egress_arrangements');
      return val === 'inadequate' || val === 'missing';
    },
    text: (data) => 'Physical provisions for assisted evacuation require improvement (refuges, equipment)',
    evidence: (data) => [{ field: 'disabled_egress_arrangements', value: safeGet(data, 'disabled_egress_arrangements') }],
  },
  {
    id: 'travel_distances_compliant',
    type: 'strength',
    weight: 35,
    when: (data) => isYes(safeGet(data, 'travel_distances_compliant')),
    text: (data) => 'Travel distances comply with regulatory guidance',
    evidence: (data) => [{ field: 'travel_distances_compliant', value: safeGet(data, 'travel_distances_compliant') }],
  },
];

/**
 * Section 7: Fire Detection, Alarm & Warning (FRA_3_ACTIVE_SYSTEMS - detection)
 */
export const section7Rules: KeyPointRule[] = [
  {
    id: 'fire_alarm_absent',
    type: 'weakness',
    weight: 95,
    when: (data) => isNo(safeGet(data, 'fire_alarm_present')),
    text: (data) => 'No fire alarm system present; installation required',
    evidence: (data) => [{ field: 'fire_alarm_present', value: safeGet(data, 'fire_alarm_present') }],
  },
  {
    id: 'alarm_testing_missing',
    type: 'weakness',
    weight: 80,
    when: (data) => {
      const present = safeGet(data, 'fire_alarm_present');
      const evidence = safeGet(data, 'alarm_testing_evidence');
      return isYes(present) && isNo(evidence);
    },
    text: (data) => 'Fire alarm testing records not available',
    evidence: (data) => [
      { field: 'fire_alarm_present', value: safeGet(data, 'fire_alarm_present') },
      { field: 'alarm_testing_evidence', value: safeGet(data, 'alarm_testing_evidence') }
    ],
  },
  {
    id: 'alarm_zoning_inadequate',
    type: 'weakness',
    weight: 70,
    when: (data) => {
      const val = safeGet(data, 'alarm_zoning_adequacy');
      return val === 'inadequate' || val === 'poor';
    },
    text: (data) => 'Fire alarm zoning arrangements inadequate for building complexity',
    evidence: (data) => [{ field: 'alarm_zoning_adequacy', value: safeGet(data, 'alarm_zoning_adequacy') }],
  },
  {
    id: 'alarm_category_l1',
    type: 'strength',
    weight: 50,
    when: (data) => {
      const cat = String(safeGet(data, 'fire_alarm_category', '')).toUpperCase();
      return cat === 'L1' || cat === 'L1_FULL_COVERAGE';
    },
    text: (data) => 'L1 fire alarm system provides comprehensive coverage',
    evidence: (data) => [{ field: 'fire_alarm_category', value: safeGet(data, 'fire_alarm_category') }],
  },
  {
    id: 'alarm_category_adequate',
    type: 'info',
    weight: 40,
    when: (data) => {
      const cat = String(safeGet(data, 'fire_alarm_category', '')).toUpperCase();
      return cat === 'L2' || cat === 'L3' || cat === 'M';
    },
    text: (data) => {
      const cat = String(safeGet(data, 'fire_alarm_category', '')).toUpperCase();
      return `${cat} fire alarm system installed`;
    },
    evidence: (data) => [{ field: 'fire_alarm_category', value: safeGet(data, 'fire_alarm_category') }],
  },
  // Emergency Lighting (merged from former Section 8)
  {
    id: 'emergency_lighting_absent',
    type: 'weakness',
    weight: 90,
    when: (data) => isNo(safeGet(data, 'emergency_lighting_present')),
    text: (data) => 'Emergency lighting not present; installation required',
    evidence: (data) => [{ field: 'emergency_lighting_present', value: safeGet(data, 'emergency_lighting_present') }],
  },
  {
    id: 'el_testing_missing',
    type: 'weakness',
    weight: 75,
    when: (data) => {
      const present = safeGet(data, 'emergency_lighting_present');
      const evidence = safeGet(data, 'emergency_lighting_testing_evidence');
      return isYes(present) && isNo(evidence);
    },
    text: (data) => 'Emergency lighting testing records not available',
    evidence: (data) => [
      { field: 'emergency_lighting_present', value: safeGet(data, 'emergency_lighting_present') },
      { field: 'emergency_lighting_testing_evidence', value: safeGet(data, 'emergency_lighting_testing_evidence') }
    ],
  },
  {
    id: 'el_coverage_inadequate',
    type: 'weakness',
    weight: 80,
    when: (data) => {
      const val = safeGet(data, 'emergency_lighting_coverage');
      return val === 'inadequate' || val === 'partial';
    },
    text: (data) => 'Emergency lighting coverage inadequate along escape routes',
    evidence: (data) => [{ field: 'emergency_lighting_coverage', value: safeGet(data, 'emergency_lighting_coverage') }],
  },
  {
    id: 'el_adequate',
    type: 'strength',
    weight: 35,
    when: (data) => {
      const present = isYes(safeGet(data, 'emergency_lighting_present'));
      const evidence = isYes(safeGet(data, 'emergency_lighting_testing_evidence'));
      return present && evidence;
    },
    text: (data) => 'Emergency lighting system present with testing evidence',
    evidence: (data) => [
      { field: 'emergency_lighting_present', value: safeGet(data, 'emergency_lighting_present') },
      { field: 'emergency_lighting_testing_evidence', value: safeGet(data, 'emergency_lighting_testing_evidence') }
    ],
  },
];

/**
 * Section 9: Passive Fire Protection (FRA_4_PASSIVE_PROTECTION)
 */
export const section9Rules: KeyPointRule[] = [
  {
    id: 'fire_doors_inadequate',
    type: 'weakness',
    weight: 90,
    when: (data) => {
      const val = safeGet(data, 'fire_doors_condition');
      return val === 'inadequate' || val === 'poor' || val === 'non_compliant';
    },
    text: (data) => 'Fire doors in inadequate condition; repairs or replacement required',
    evidence: (data) => [{ field: 'fire_doors_condition', value: safeGet(data, 'fire_doors_condition') }],
  },
  {
    id: 'compartmentation_inadequate',
    type: 'weakness',
    weight: 88,
    when: (data) => {
      const val = safeGet(data, 'compartmentation_condition');
      return val === 'inadequate' || val === 'poor' || val === 'breached';
    },
    text: (data) => 'Compartmentation breached or inadequate; fire-stopping works required',
    evidence: (data) => [{ field: 'compartmentation_condition', value: safeGet(data, 'compartmentation_condition') }],
  },
  {
    id: 'fire_stopping_unknown',
    type: 'weakness',
    weight: 75,
    when: (data) => {
      const val = safeGet(data, 'fire_stopping_confidence');
      return val === 'unknown' || val === 'low' || val === 'poor';
    },
    text: (data) => 'Low confidence in fire-stopping effectiveness; intrusive survey recommended',
    evidence: (data) => [{ field: 'fire_stopping_confidence', value: safeGet(data, 'fire_stopping_confidence') }],
  },
  {
    id: 'cavity_barriers_missing',
    type: 'weakness',
    weight: 80,
    when: (data) => {
      const val = safeGet(data, 'cavity_barriers_adequate');
      return isNo(val) || val === 'missing' || val === 'inadequate';
    },
    text: (data) => 'Cavity barriers inadequate or missing in concealed spaces',
    evidence: (data) => [{ field: 'cavity_barriers_adequate', value: safeGet(data, 'cavity_barriers_adequate') }],
  },
  {
    id: 'fire_doors_adequate',
    type: 'strength',
    weight: 35,
    when: (data) => safeGet(data, 'fire_doors_condition') === 'adequate',
    text: (data) => 'Fire doors generally in adequate condition',
    evidence: (data) => [{ field: 'fire_doors_condition', value: safeGet(data, 'fire_doors_condition') }],
  },
];

/**
 * Section 10: Fixed Fire Suppression (FRA_8_FIREFIGHTING_EQUIPMENT)
 * CRITICAL: Check structured data.firefighting.fixed_facilities FIRST, then fall back to legacy flat fields
 */
export const section10Rules: KeyPointRule[] = [
  {
    id: 'sprinkler_absent_high_risk',
    type: 'weakness',
    weight: 85,
    when: (data) => {
      // Check structured data first
      const sprinklers = safeGet(data, 'firefighting.fixed_facilities.sprinklers', {});
      const structuredInstalled = safeGet(sprinklers, 'installed');

      // If structured data exists, use it
      if (structuredInstalled) {
        return isNo(structuredInstalled);
      }

      // Fall back to legacy flat field
      return isNo(safeGet(data, 'sprinkler_present'));
    },
    text: (data) => 'No sprinkler system present',
    evidence: (data) => {
      const sprinklers = safeGet(data, 'firefighting.fixed_facilities.sprinklers', {});
      return [
        { field: 'firefighting.fixed_facilities.sprinklers.installed', value: safeGet(sprinklers, 'installed') },
        { field: 'sprinkler_present', value: safeGet(data, 'sprinkler_present') }
      ];
    },
  },
  {
    id: 'sprinkler_servicing_overdue',
    type: 'weakness',
    weight: 80,
    when: (data) => {
      // Check structured data first
      const sprinklers = safeGet(data, 'firefighting.fixed_facilities.sprinklers', {});
      const structuredInstalled = safeGet(sprinklers, 'installed');
      const structuredServicing = safeGet(sprinklers, 'servicing_status');

      if (structuredInstalled && isYes(structuredInstalled)) {
        return structuredServicing === 'overdue' || structuredServicing === 'unknown';
      }

      // Fall back to legacy
      const legacyPresent = safeGet(data, 'sprinkler_present');
      const legacyServicing = safeGet(data, 'sprinkler_servicing_status');
      return isYes(legacyPresent) && (legacyServicing === 'overdue' || legacyServicing === 'unknown');
    },
    text: (data) => 'Sprinkler system servicing overdue or not evidenced',
    evidence: (data) => {
      const sprinklers = safeGet(data, 'firefighting.fixed_facilities.sprinklers', {});
      return [
        { field: 'firefighting.fixed_facilities.sprinklers.servicing_status', value: safeGet(sprinklers, 'servicing_status') },
        { field: 'sprinkler_servicing_status', value: safeGet(data, 'sprinkler_servicing_status') }
      ];
    },
  },
  {
    id: 'extinguishers_absent',
    type: 'weakness',
    weight: 90,
    when: (data) => {
      // Check structured data first
      const extinguishers = safeGet(data, 'firefighting.portable_extinguishers', {});
      const structuredPresent = safeGet(extinguishers, 'present');

      if (structuredPresent) {
        return isNo(structuredPresent);
      }

      return isNo(safeGet(data, 'extinguishers_present'));
    },
    text: (data) => 'Fire extinguishers not present; provision required',
    evidence: (data) => [
      { field: 'firefighting.portable_extinguishers.present', value: safeGet(data, 'firefighting.portable_extinguishers.present') },
      { field: 'extinguishers_present', value: safeGet(data, 'extinguishers_present') }
    ],
  },
  {
    id: 'extinguisher_servicing_missing',
    type: 'weakness',
    weight: 75,
    when: (data) => {
      // Check structured data first
      const extinguishers = safeGet(data, 'firefighting.portable_extinguishers', {});
      const structuredPresent = safeGet(extinguishers, 'present');
      const structuredServicing = safeGet(extinguishers, 'servicing_status');

      if (structuredPresent && isYes(structuredPresent)) {
        return structuredServicing === 'overdue' || structuredServicing === 'unknown' || isNo(structuredServicing);
      }

      // Fall back to legacy
      const present = safeGet(data, 'extinguishers_present');
      const servicing = safeGet(data, 'extinguisher_servicing_evidence');
      return isYes(present) && isNo(servicing);
    },
    text: (data) => 'Fire extinguisher servicing evidence not available',
    evidence: (data) => [
      { field: 'firefighting.portable_extinguishers.present', value: safeGet(data, 'firefighting.portable_extinguishers.present') },
      { field: 'firefighting.portable_extinguishers.servicing_status', value: safeGet(data, 'firefighting.portable_extinguishers.servicing_status') },
      { field: 'extinguishers_present', value: safeGet(data, 'extinguishers_present') },
      { field: 'extinguisher_servicing_evidence', value: safeGet(data, 'extinguisher_servicing_evidence') }
    ],
  },
  {
    id: 'hydrant_access_poor',
    type: 'weakness',
    weight: 70,
    when: (data) => {
      const val = safeGet(data, 'hydrant_access');
      return val === 'poor' || val === 'inadequate' || val === 'limited';
    },
    text: (data) => 'Fire service hydrant access limited or inadequate',
    evidence: (data) => [{ field: 'hydrant_access', value: safeGet(data, 'hydrant_access') }],
  },
  {
    id: 'sprinkler_present',
    type: 'strength',
    weight: 50,
    when: (data) => {
      // Check structured data first
      const sprinklers = safeGet(data, 'firefighting.fixed_facilities.sprinklers', {});
      const structuredInstalled = safeGet(sprinklers, 'installed');

      if (structuredInstalled) {
        return isYes(structuredInstalled);
      }

      return isYes(safeGet(data, 'sprinkler_present'));
    },
    text: (data) => {
      // Add detail if available
      const sprinklers = safeGet(data, 'firefighting.fixed_facilities.sprinklers', {});
      const systemType = safeGet(sprinklers, 'type') || safeGet(data, 'sprinkler_type');
      const coverage = safeGet(sprinklers, 'coverage') || safeGet(data, 'sprinkler_coverage');

      let text = 'Automatic sprinkler system installed';

      if (systemType) {
        const typeLabel = String(systemType).replace(/_/g, ' ').toLowerCase();
        text += ` (${typeLabel})`;
      }

      if (coverage && coverage !== 'unknown') {
        const coverageLabel = String(coverage).replace(/_/g, ' ').toLowerCase();
        text += ` with ${coverageLabel} coverage`;
      }

      return text;
    },
    evidence: (data) => {
      const sprinklers = safeGet(data, 'firefighting.fixed_facilities.sprinklers', {});
      return [
        { field: 'firefighting.fixed_facilities.sprinklers.installed', value: safeGet(sprinklers, 'installed') },
        { field: 'sprinkler_present', value: safeGet(data, 'sprinkler_present') }
      ];
    },
  },
];

/**
 * Section 11: Fire Safety Management (composite A4/FRA_6/A5/FRA_7/A7)
 */
export const section11Rules: KeyPointRule[] = [
  {
    id: 'testing_records_not_evidenced',
    type: 'weakness',
    weight: 80,
    when: (data) => {
      const records = safeGet(data, 'testing_records');
      return isUnknown(records) || !hasValue(records);
    },
    text: (data) => 'Fire safety testing and inspection records have not been evidenced',
    evidence: (data) => [{ field: 'testing_records', value: safeGet(data, 'testing_records') }],
  },
  {
    id: 'policy_training_not_verified',
    type: 'weakness',
    weight: 78,
    when: (data) => {
      const policy = safeGet(data, 'fire_safety_policy');
      const training = safeGet(data, 'training_induction');
      const drills = safeGet(data, 'drill_frequency');
      const unknownCount = [policy, training, drills].filter(v => isUnknown(v) || !hasValue(v)).length;
      return unknownCount >= 2;
    },
    text: (data) => 'Training and fire safety policy records have not been verified',
    evidence: (data) => [
      { field: 'fire_safety_policy', value: safeGet(data, 'fire_safety_policy') },
      { field: 'training_induction', value: safeGet(data, 'training_induction') },
      { field: 'drill_frequency', value: safeGet(data, 'drill_frequency') }
    ],
  },
  {
    id: 'fire_policy_missing',
    type: 'weakness',
    weight: 75,
    when: (data) => isNo(safeGet(data, 'fire_safety_policy')),
    text: (data) => 'Fire safety policy not documented',
    evidence: (data) => [{ field: 'fire_safety_policy', value: safeGet(data, 'fire_safety_policy') }],
  },
  {
    id: 'testing_records_missing',
    type: 'weakness',
    weight: 70,
    when: (data) => isNo(safeGet(data, 'testing_records')),
    text: (data) => 'Testing and maintenance records not available',
    evidence: (data) => [{ field: 'testing_records', value: safeGet(data, 'testing_records') }],
  },
  {
    id: 'training_missing',
    type: 'weakness',
    weight: 85,
    when: (data) => {
      const induction = safeGet(data, 'training_induction');
      return isNo(induction) || induction === 'inadequate';
    },
    text: (data) => 'Fire safety training and induction inadequate',
    evidence: (data) => [{ field: 'training_induction', value: safeGet(data, 'training_induction') }],
  },
  {
    id: 'ptw_hot_work_missing',
    type: 'weakness',
    weight: 70,
    when: (data) => isNo(safeGet(data, 'ptw_hot_work')),
    text: (data) => 'Permit to work system not in place for hot work activities',
    evidence: (data) => [{ field: 'ptw_hot_work', value: safeGet(data, 'ptw_hot_work') }],
  },
  {
    id: 'emergency_plan_missing',
    type: 'weakness',
    weight: 88,
    when: (data) => isNo(safeGet(data, 'emergency_plan_exists')),
    text: (data) => 'Emergency evacuation plan not documented',
    evidence: (data) => [{ field: 'emergency_plan_exists', value: safeGet(data, 'emergency_plan_exists') }],
  },
  {
    id: 'peeps_missing',
    type: 'weakness',
    weight: 82,
    when: (data) => isNo(safeGet(data, 'peeps_in_place')),
    text: (data) => 'Personal Emergency Evacuation Plans (PEEPs) not in place',
    evidence: (data) => [{ field: 'peeps_in_place', value: safeGet(data, 'peeps_in_place') }],
  },
  {
    id: 'responsibilities_defined',
    type: 'strength',
    weight: 45,
    when: (data) => isYes(safeGet(data, 'responsibilities_defined')),
    text: (data) => 'Fire safety responsibilities clearly defined and communicated',
    evidence: (data) => [{ field: 'responsibilities_defined', value: safeGet(data, 'responsibilities_defined') }],
  },
  {
    id: 'emergency_arrangements_good',
    type: 'strength',
    weight: 40,
    when: (data) => {
      const plan = isYes(safeGet(data, 'emergency_plan_exists'));
      const peeps = isYes(safeGet(data, 'peeps_in_place'));
      return plan && peeps;
    },
    text: (data) => 'Emergency arrangements documented with PEEPs in place',
    evidence: (data) => [
      { field: 'emergency_plan_exists', value: safeGet(data, 'emergency_plan_exists') },
      { field: 'peeps_in_place', value: safeGet(data, 'peeps_in_place') }
    ],
  },
];

/**
 * Section 12: External Fire Spread (FRA_5_EXTERNAL_FIRE_SPREAD)
 */
export const section12Rules: KeyPointRule[] = [
  {
    id: 'cladding_combustibility_unknown',
    type: 'weakness',
    weight: 90,
    when: (data) => {
      const present = isYes(safeGet(data, 'cladding_present'));
      const known = safeGet(data, 'insulation_combustibility_known');
      return present && (isUnknown(known) || isNo(known));
    },
    text: (data) => 'Cladding present but combustibility classification unknown; assessment required',
    evidence: (data) => [
      { field: 'cladding_present', value: safeGet(data, 'cladding_present') },
      { field: 'insulation_combustibility_known', value: safeGet(data, 'insulation_combustibility_known') }
    ],
  },
  {
    id: 'cladding_concerns',
    type: 'weakness',
    weight: 95,
    when: (data) => {
      const val = safeGet(data, 'cladding_concerns');
      return isYes(val) || val === 'significant';
    },
    text: (data) => 'Significant concerns identified regarding external wall construction',
    evidence: (data) => [{ field: 'cladding_concerns', value: safeGet(data, 'cladding_concerns') }],
  },
  {
    id: 'pas9980_missing',
    type: 'weakness',
    weight: 85,
    when: (data) => {
      const present = isYes(safeGet(data, 'cladding_present'));
      const appraisal = safeGet(data, 'pas9980_or_equivalent_appraisal');
      return present && (isNo(appraisal) || isUnknown(appraisal));
    },
    text: (data) => 'PAS 9980 or equivalent appraisal not undertaken for external walls',
    evidence: (data) => [
      { field: 'cladding_present', value: safeGet(data, 'cladding_present') },
      { field: 'pas9980_or_equivalent_appraisal', value: safeGet(data, 'pas9980_or_equivalent_appraisal') }
    ],
  },
  {
    id: 'interim_measures',
    type: 'info',
    weight: 60,
    when: (data) => {
      const val = safeGet(data, 'interim_measures');
      return hasValue(val) && val !== 'none';
    },
    text: (data) => 'Interim fire safety measures implemented pending remediation',
    evidence: (data) => [{ field: 'interim_measures', value: safeGet(data, 'interim_measures') }],
  },
  {
    id: 'boundary_distances_adequate',
    type: 'strength',
    weight: 35,
    when: (data) => isYes(safeGet(data, 'boundary_distances_adequate')),
    text: (data) => 'Boundary separation distances adequate',
    evidence: (data) => [{ field: 'boundary_distances_adequate', value: safeGet(data, 'boundary_distances_adequate') }],
  },
];

/**
 * Get rules for a specific section
 */
export function getRulesForSection(sectionId: number): KeyPointRule[] {
  switch (sectionId) {
    case 5: return section5Rules;
    case 6: return section6Rules;
    case 7: return section7Rules; // Now includes emergency lighting rules
    case 9: return section9Rules;
    case 10: return section10Rules;
    case 11: return section11Rules;
    case 12: return section12Rules;
    default: return [];
  }
}
