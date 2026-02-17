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
  },
  {
    id: 'high_risk_lithium',
    type: 'weakness',
    weight: 85,
    when: (data) => includesAny(safeGet(data, 'high_risk_activities', []), ['lithium', 'battery', 'e-bike', 'e-scooter']),
    text: (data) => 'Lithium-ion battery charging activities present elevated fire risk',
  },
  {
    id: 'high_risk_kitchen',
    type: 'weakness',
    weight: 80,
    when: (data) => includesAny(safeGet(data, 'high_risk_activities', []), ['kitchen', 'cooking', 'deep fat']),
    text: (data) => 'Commercial cooking operations identified as significant ignition source',
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
  },
  {
    id: 'housekeeping_medium',
    type: 'weakness',
    weight: 60,
    when: (data) => safeGet(data, 'housekeeping_fire_load') === 'medium',
    text: (data) => 'Housekeeping requires improvement to reduce fire load',
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
  },
  {
    id: 'arson_risk_low',
    type: 'strength',
    weight: 40,
    when: (data) => safeGet(data, 'arson_risk') === 'low',
    text: (data) => 'Arson risk well-controlled through security measures',
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
  },
  {
    id: 'escape_route_obstructions',
    type: 'weakness',
    weight: 85,
    when: (data) => isYes(safeGet(data, 'escape_route_obstructions')),
    text: (data) => 'Obstructions identified in escape routes',
  },
  {
    id: 'final_exits_inadequate',
    type: 'weakness',
    weight: 88,
    when: (data) => isNo(safeGet(data, 'final_exits_adequate')),
    text: (data) => 'Final exits inadequate for occupant capacity',
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
  },
  {
    id: 'disabled_egress_inadequate',
    type: 'weakness',
    weight: 75,
    when: (data) => {
      const val = safeGet(data, 'disabled_egress_arrangements');
      return val === 'inadequate' || val === 'missing';
    },
    text: (data) => 'Disabled egress arrangements require improvement',
  },
  {
    id: 'travel_distances_compliant',
    type: 'strength',
    weight: 35,
    when: (data) => isYes(safeGet(data, 'travel_distances_compliant')),
    text: (data) => 'Travel distances comply with regulatory guidance',
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
  },
];

/**
 * Section 8: Emergency Lighting (FRA_3_ACTIVE_SYSTEMS - emergency lighting)
 */
export const section8Rules: KeyPointRule[] = [
  {
    id: 'emergency_lighting_absent',
    type: 'weakness',
    weight: 90,
    when: (data) => isNo(safeGet(data, 'emergency_lighting_present')),
    text: (data) => 'Emergency lighting not present; installation required',
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
  },
  {
    id: 'fire_doors_adequate',
    type: 'strength',
    weight: 35,
    when: (data) => safeGet(data, 'fire_doors_condition') === 'adequate',
    text: (data) => 'Fire doors generally in adequate condition',
  },
];

/**
 * Section 10: Fixed Fire Suppression (FRA_8_FIREFIGHTING_EQUIPMENT)
 */
export const section10Rules: KeyPointRule[] = [
  {
    id: 'sprinkler_absent_high_risk',
    type: 'weakness',
    weight: 85,
    when: (data) => {
      // Only flag if storeys > 2 or high occupancy (indicates need)
      return isNo(safeGet(data, 'sprinkler_present'));
    },
    text: (data) => 'No sprinkler system present',
  },
  {
    id: 'extinguishers_absent',
    type: 'weakness',
    weight: 90,
    when: (data) => isNo(safeGet(data, 'extinguishers_present')),
    text: (data) => 'Fire extinguishers not present; provision required',
  },
  {
    id: 'extinguisher_servicing_missing',
    type: 'weakness',
    weight: 75,
    when: (data) => {
      const present = safeGet(data, 'extinguishers_present');
      const servicing = safeGet(data, 'extinguisher_servicing_evidence');
      return isYes(present) && isNo(servicing);
    },
    text: (data) => 'Fire extinguisher servicing evidence not available',
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
  },
  {
    id: 'sprinkler_present',
    type: 'strength',
    weight: 50,
    when: (data) => isYes(safeGet(data, 'sprinkler_present')),
    text: (data) => 'Automatic sprinkler system installed',
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
  },
  {
    id: 'fire_policy_missing',
    type: 'weakness',
    weight: 75,
    when: (data) => isNo(safeGet(data, 'fire_safety_policy')),
    text: (data) => 'Fire safety policy not documented',
  },
  {
    id: 'testing_records_missing',
    type: 'weakness',
    weight: 70,
    when: (data) => isNo(safeGet(data, 'testing_records')),
    text: (data) => 'Testing and maintenance records not available',
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
  },
  {
    id: 'ptw_hot_work_missing',
    type: 'weakness',
    weight: 70,
    when: (data) => isNo(safeGet(data, 'ptw_hot_work')),
    text: (data) => 'Permit to work system not in place for hot work activities',
  },
  {
    id: 'emergency_plan_missing',
    type: 'weakness',
    weight: 88,
    when: (data) => isNo(safeGet(data, 'emergency_plan_exists')),
    text: (data) => 'Emergency evacuation plan not documented',
  },
  {
    id: 'peeps_missing',
    type: 'weakness',
    weight: 82,
    when: (data) => isNo(safeGet(data, 'peeps_in_place')),
    text: (data) => 'Personal Emergency Evacuation Plans (PEEPs) not in place',
  },
  {
    id: 'responsibilities_defined',
    type: 'strength',
    weight: 45,
    when: (data) => isYes(safeGet(data, 'responsibilities_defined')),
    text: (data) => 'Fire safety responsibilities clearly defined and communicated',
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
  },
  {
    id: 'boundary_distances_adequate',
    type: 'strength',
    weight: 35,
    when: (data) => isYes(safeGet(data, 'boundary_distances_adequate')),
    text: (data) => 'Boundary separation distances adequate',
  },
];

/**
 * Get rules for a specific section
 */
export function getRulesForSection(sectionId: number): KeyPointRule[] {
  switch (sectionId) {
    case 5: return section5Rules;
    case 6: return section6Rules;
    case 7: return section7Rules;
    case 8: return section8Rules;
    case 9: return section9Rules;
    case 10: return section10Rules;
    case 11: return section11Rules;
    case 12: return section12Rules;
    default: return [];
  }
}
