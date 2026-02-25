/**
 * Section Summary Generator for FRA PDF Sections 5-12
 *
 * Generates professional assessor summaries that appear at the top of each technical section
 * Based on module outcomes, actions, info gaps, and specific field data
 */

import type { ModuleInstance } from '../supabase/attachments';
import type { Document } from './fra/fraTypes';

interface Action {
  id: string;
  priority: number;
  status: string;
}

interface SectionContext {
  sectionId: number;
  sectionTitle: string;
  moduleInstances: ModuleInstance[];
  actions?: Action[];
}

export interface SectionSummaryWithDrivers {
  summary: string;
  drivers: string[];
}

/**
 * Generate professional assessor summary for a section with driver bullets
 * Returns context-aware summary + up to 3 key points based on section data
 *
 * Priority order (from highest to lowest):
 * 1. P1 action OR material_def → Significant deficiencies, urgent action required
 * 2. P2 action → Deficiencies/info gaps, actions required
 * 3. Info gap (even if compliant) → Key aspects not verified
 * 4. Minor_def → Minor deficiencies, improvements recommended
 * 5. Otherwise → No significant deficiencies identified
 */
export function generateSectionSummary(context: SectionContext): SectionSummaryWithDrivers | null {
  const { sectionId, sectionTitle, moduleInstances, actions = [] } = context;

  // Only generate summaries for sections 5-12 (technical assessment sections)
  if (sectionId < 5 || sectionId > 12) return null;

  // If no modules in section, no summary needed
  if (moduleInstances.length === 0) return null;

  // Analyze outcomes
  const hasMaterialDef = moduleInstances.some(m => m.outcome === 'material_def');
  const hasMinorDef = moduleInstances.some(m => m.outcome === 'minor_def');
  const hasInfoGap = moduleInstances.some(m => m.outcome === 'info_gap');

  // Check for priority actions
  const openActions = actions.filter(a => a.status !== 'closed' && a.status !== 'completed');
  const hasP1Actions = openActions.some(a => a.priority === 1);
  const hasP2Actions = openActions.some(a => a.priority === 2);
  const hasP3P4Actions = openActions.some(a => a.priority === 3 || a.priority === 4);
  const hasAnyOpenActions = openActions.length > 0;

  // Detect if this is a governance section (management/procedures)
  const isGovernanceSection = sectionId === 11; // Section 11: Fire Safety Management

  // Extract section-specific drivers
  const drivers = extractSectionDrivers(sectionId, moduleInstances);

  // Generate context-aware summary following priority order
  let summary = '';

  // Priority 1: P1 action OR material deficiency
  if (hasP1Actions || hasMaterialDef) {
    summary = generateP1OrMaterialDefSummary(isGovernanceSection);
  }
  // Priority 2: P2 action
  else if (hasP2Actions) {
    summary = generateP2ActionSummary(isGovernanceSection);
  }
  // Priority 3: Info gap (even if outcome is compliant)
  else if (hasInfoGap) {
    summary = generateInfoGapSummary(isGovernanceSection);
  }
  // Priority 4: Minor deficiency OR P3/P4 actions exist
  else if (hasMinorDef || hasP3P4Actions) {
    summary = generateMinorDefSummary(isGovernanceSection);
  }
  // Priority 5: No significant deficiencies (only if NO open actions and NO info gaps)
  else if (!hasAnyOpenActions) {
    summary = generateCompliantSummary(isGovernanceSection);
  }
  // Fallback: If actions exist but don't fit above categories, treat as minor
  else {
    summary = generateMinorDefSummary(isGovernanceSection);
  }

  return { summary, drivers };
}

/**
 * Priority 1: P1 action OR material deficiency
 * "Significant deficiencies identified; urgent remedial action required."
 */
function generateP1OrMaterialDefSummary(isGovernance: boolean): string {
  if (isGovernance) {
    return 'Significant deficiencies identified in fire safety management systems; urgent remedial action required.';
  }
  return 'Significant deficiencies identified in this area; urgent remedial action required.';
}

/**
 * Priority 2: P2 action exists
 * "Deficiencies and/or information gaps identified; actions required to address these matters."
 */
function generateP2ActionSummary(isGovernance: boolean): string {
  if (isGovernance) {
    return 'Deficiencies and/or information gaps identified in fire safety management systems; actions required to address these matters.';
  }
  return 'Deficiencies and/or information gaps identified; actions required to address these matters.';
}

/**
 * Priority 3: Info gap (even if outcome is compliant)
 * "No material deficiencies identified; however key aspects could not be verified at time of assessment."
 */
function generateInfoGapSummary(isGovernance: boolean): string {
  if (isGovernance) {
    return 'No material deficiencies identified in fire safety management systems; however key aspects could not be verified at time of assessment.';
  }
  return 'No material deficiencies identified; however key aspects could not be verified at time of assessment.';
}

/**
 * Priority 4: Minor deficiency
 * "Minor deficiencies identified; improvements recommended."
 */
function generateMinorDefSummary(isGovernance: boolean): string {
  if (isGovernance) {
    return 'Minor deficiencies identified in fire safety management systems; improvements recommended.';
  }
  return 'Minor deficiencies identified; improvements recommended.';
}

/**
 * Priority 5: No significant deficiencies
 * "No significant deficiencies identified in this area at time of assessment."
 */
function generateCompliantSummary(isGovernance: boolean): string {
  if (isGovernance) {
    return 'No significant deficiencies identified in fire safety management systems at time of assessment.';
  }
  return 'No significant deficiencies identified in this area at time of assessment.';
}

/**
 * Extract up to 3 key driver bullets based on section-specific field data
 * These are concrete evidence points that support the summary
 */
export function extractSectionDrivers(sectionId: number, moduleInstances: ModuleInstance[]): string[] {
  const drivers: string[] = [];

  // Combine data from all modules in the section
  const allData = moduleInstances.reduce((acc, m) => {
    return { ...acc, ...(m.data || {}) };
  }, {} as Record<string, any>);

  switch (sectionId) {
    case 5: // Fire Hazards & Ignition Sources
      return extractSection5Drivers(allData);
    case 6: // Means of Escape
      return extractSection6Drivers(allData);
    case 7: // Active Fire Protection (Detection, Alarm & Emergency Lighting)
      return extractSection7Drivers(allData);
    case 9: // Passive Fire Protection (Compartmentation)
      return extractSection9Drivers(allData);
    case 10: // Fixed Fire Suppression & Firefighting
      return extractSection10Drivers(allData);
    case 11: // Fire Safety Management & Procedures
      return extractSection11Drivers(allData);
    case 12: // External Fire Spread
      return extractSection12Drivers(allData);
    default:
      return ['No specific issues were recorded in this section.'];
  }
}

function extractSection5Drivers(data: Record<string, any>): string[] {
  const drivers: string[] = [];

  // EICR status - C1/C2 takes absolute precedence
  const electrical = data.electrical_safety || {};
  const hasC1C2 = electrical.eicr_outstanding_c1_c2 === 'yes' ||
                  String(electrical.eicr_outstanding_c1_c2).toLowerCase().includes('yes');

  if (hasC1C2) {
    drivers.push('Outstanding C1/C2 electrical defects identified requiring immediate remediation');
  } else if (electrical.eicr_satisfactory === 'no' || electrical.eicr_satisfactory === 'unsatisfactory') {
    drivers.push('Electrical Installation Condition Report (EICR) identified unsatisfactory conditions');
  } else if (electrical.eicr_evidence_seen === 'no') {
    drivers.push('No evidence of valid Electrical Installation Condition Report (EICR) was seen');
  }

  // Arson risk
  if (data.arson_risk === 'high') {
    drivers.push('Elevated arson risk due to inadequate security or previous incidents');
  }

  // Housekeeping/fire load
  if (data.housekeeping_fire_load === 'high' || data.housekeeping_fire_load === 'excessive') {
    drivers.push('Excessive combustible materials or poor housekeeping standards observed');
  }

  // High-risk activities
  if (Array.isArray(data.high_risk_activities) && data.high_risk_activities.length > 0) {
    const activities = data.high_risk_activities.join(', ').replace(/_/g, ' ');
    drivers.push(`High-risk activities present: ${activities}`);
  }

  // Oxygen enrichment
  if (data.oxygen_enrichment === 'known') {
    drivers.push('Oxygen enrichment sources identified, increasing fire severity risk');
  }

  if (drivers.length === 0) {
    return ['No specific issues were recorded in this section.'];
  }

  return drivers.slice(0, 3);
}

function extractSection6Drivers(data: Record<string, any>): string[] {
  const drivers: string[] = [];

  // Travel distances
  if (data.travel_distances_compliant === 'no') {
    drivers.push('Travel distances exceed regulatory guidance limits');
  }

  // Escape route obstructions
  if (data.escape_route_obstructions === 'yes') {
    drivers.push('Obstructions identified in escape routes that impede safe evacuation');
  }

  // Final exits
  if (data.final_exits_adequate === 'no') {
    drivers.push('Final exit arrangements are inadequate for the occupancy');
  }

  // Exit signage
  if (data.exit_signage_adequacy === 'inadequate') {
    drivers.push('Emergency exit signage is inadequate or missing');
  }

  // Stair protection
  if (data.stair_protection_status === 'inadequate') {
    drivers.push('Protected stairways have inadequate fire resistance or integrity');
  }

  // Assisted evacuation physical provisions
  if (data.disabled_egress_arrangements === 'inadequate') {
    drivers.push('Physical provisions for assisted evacuation are inadequate (refuges, equipment, communications)');
  }

  if (drivers.length === 0) {
    return ['No specific issues were recorded in this section.'];
  }

  return drivers.slice(0, 3);
}

function extractSection7Drivers(data: Record<string, any>): string[] {
  const drivers: string[] = [];

  // Alarm system presence
  if (data.fire_alarm_present === 'no') {
    drivers.push('No fire detection and alarm system installed');
  } else if (data.fire_alarm_present === 'yes') {
    // Alarm category
    if (data.fire_alarm_category && data.fire_alarm_category !== 'unknown') {
      drivers.push(`Fire alarm system category: ${data.fire_alarm_category}`);
    }

    // Testing evidence
    if (data.alarm_testing_evidence === 'no' || data.alarm_testing_evidence === 'unknown') {
      drivers.push('No evidence of regular fire alarm testing and servicing');
    }
  }

  // Zoning adequacy
  if (data.alarm_zoning_adequacy === 'inadequate') {
    drivers.push('Fire alarm zoning is inadequate for building layout');
  }

  // False alarm frequency
  if (data.false_alarm_frequency === 'excessive') {
    drivers.push('Excessive false alarm activations reducing system credibility');
  }

  // Emergency lighting presence (merged from Section 8)
  if (data.emergency_lighting_present === 'no') {
    drivers.push('No emergency lighting system installed');
  } else if (data.emergency_lighting_present === 'yes') {
    // Testing evidence
    if (data.emergency_lighting_testing_evidence === 'no' || data.emergency_lighting_testing_evidence === 'unknown') {
      drivers.push('No evidence of regular emergency lighting testing (monthly functional, annual duration)');
    }
  }

  // Coverage gaps
  if (data.emergency_lighting_coverage === 'inadequate') {
    drivers.push('Emergency lighting coverage is inadequate for escape routes and open areas');
  }

  if (drivers.length === 0) {
    return ['No specific issues were recorded in this section.'];
  }

  return drivers.slice(0, 4); // Increased limit to accommodate merged content
}

function extractSection9Drivers(data: Record<string, any>): string[] {
  const drivers: string[] = [];

  // Fire doors condition
  if (data.fire_doors_condition === 'poor' || data.fire_doors_condition === 'inadequate') {
    drivers.push('Fire doors are in poor condition with integrity compromised');
  }

  // Fire door inspection regime
  if (data.fire_doors_inspection_regime === 'no' || data.fire_doors_inspection_regime === 'unknown') {
    drivers.push('No evidence of regular fire door inspection regime');
  }

  // Compartmentation condition
  if (data.compartmentation_condition === 'poor' || data.compartmentation_condition === 'breached') {
    drivers.push('Compartmentation has been breached, compromising fire containment');
  }

  // Fire stopping confidence
  if (data.fire_stopping_confidence === 'low' || data.fire_stopping_confidence === 'very_low') {
    drivers.push('Low confidence in fire stopping effectiveness due to visible breaches or lack of access');
  }

  // Cavity barriers
  if (data.cavity_barriers_adequate === 'no') {
    drivers.push('Cavity barriers are inadequate or missing in concealed spaces');
  }

  if (drivers.length === 0) {
    return ['No specific issues were recorded in this section.'];
  }

  return drivers.slice(0, 3);
}

function extractSection10Drivers(data: Record<string, any>): string[] {
  const drivers: string[] = [];
  const firefighting = data.firefighting || {};
  const fixedFacilities = firefighting.fixed_facilities || {};

  // Extract building height for context
  const buildingHeightM = data.building_height_m || 0;
  const isHighRise = buildingHeightM >= 18;

  // 1. Sprinkler system - structured then legacy fallback
  const sprinklers = fixedFacilities.sprinklers || {};
  const hasSprinklers = sprinklers.installed === 'yes' || data.sprinkler_present === 'yes';

  if (hasSprinklers) {
    // Build sprinkler narrative with type and coverage
    let sprinklerDesc = 'Sprinkler system installed';

    // Add type if available (prioritize structured data)
    const systemType = sprinklers.type || data.sprinkler_type;
    if (systemType) {
      const typeLabel = systemType.replace(/_/g, ' ').toLowerCase();
      sprinklerDesc += ` (${typeLabel})`;
    }

    // Add coverage if available
    const coverage = sprinklers.coverage || data.sprinkler_coverage;
    if (coverage) {
      const coverageLabel = coverage.replace(/_/g, ' ').toLowerCase();
      sprinklerDesc += ` with ${coverageLabel} coverage`;
    }

    // Note servicing status
    const servicingStatus = sprinklers.servicing_status || data.sprinkler_servicing_status;
    if (servicingStatus === 'overdue' || servicingStatus === 'unknown') {
      sprinklerDesc += '; servicing overdue or not evidenced';
    } else if (servicingStatus === 'current' || servicingStatus === 'satisfactory') {
      sprinklerDesc += '; servicing current';
    }

    drivers.push(sprinklerDesc);
  } else if (data.sprinkler_present === 'no') {
    // No sprinklers - provide proportionality commentary
    drivers.push('No sprinkler system installed; this is proportionate to the building height, use and risk profile');
  }

  // 2. Rising mains (dry/wet risers) - check height requirements
  const dryRiser = fixedFacilities.dry_riser || {};
  const wetRiser = fixedFacilities.wet_riser || {};
  const hasDryRiser = dryRiser.installed === 'yes' || data.rising_mains === 'dry_riser';
  const hasWetRiser = wetRiser.installed === 'yes' || data.rising_mains === 'wet_riser';

  if (hasDryRiser || hasWetRiser) {
    const riserType = hasWetRiser ? 'wet riser' : 'dry riser';
    let riserDesc = `${riserType.charAt(0).toUpperCase() + riserType.slice(1)} installed`;

    // Check servicing
    const riserServicing = hasWetRiser ? wetRiser.servicing_status : dryRiser.servicing_status;
    if (riserServicing === 'current' || riserServicing === 'satisfactory') {
      riserDesc += ' with current testing regime';
    } else if (riserServicing === 'overdue' || riserServicing === 'defective') {
      riserDesc += '; testing overdue or defective';
    }

    drivers.push(riserDesc);
  } else if (!isHighRise && buildingHeightM > 0) {
    // No risers but building < 18m
    drivers.push('Rising mains not installed; not required based on building height');
  }

  // 3. Firefighting lift and shaft - positive provisions
  const firefightingLift = fixedFacilities.firefighting_lift || {};
  const firefightingShaft = fixedFacilities.firefighting_shaft || {};
  const hasLift = firefightingLift.present === 'yes' || data.firefighting_lift === 'yes';
  const hasShaft = firefightingShaft.present === 'yes' || data.firefighting_shaft === 'yes';

  if (hasLift && hasShaft) {
    drivers.push('Firefighting lift and firefighting shaft provided, supporting fire service intervention');
  } else if (hasLift) {
    drivers.push('Firefighting lift provided, supporting fire service access');
  } else if (hasShaft) {
    drivers.push('Firefighting shaft provided for fire service equipment access');
  }

  // 4. Portable extinguishers - only if deficient
  const portableExtinguishers = firefighting.portable_extinguishers || {};
  const hasExtinguishers = portableExtinguishers.present === 'yes' || data.extinguishers_present === 'yes';

  if (data.extinguishers_present === 'no') {
    drivers.push('No portable fire extinguishers provided');
  } else if (hasExtinguishers) {
    const extServicing = portableExtinguishers.servicing_status || data.extinguisher_servicing_status;
    if (extServicing === 'overdue' || extServicing === 'unknown' || data.extinguisher_servicing_evidence === 'no') {
      drivers.push('Portable fire extinguishers lack evidence of annual servicing');
    }
  }

  // 5. Overall proportionality statement (if space and no critical issues)
  if (drivers.length === 0) {
    drivers.push('Overall, firefighting facilities are proportionate to building height, use and risk profile');
  } else if (drivers.length < 3 && !drivers.some(d => d.includes('overdue') || d.includes('lack') || d.includes('No portable'))) {
    // Add proportionality statement if we have space and no deficiencies
    drivers.push('Overall, facilities are proportionate to building height, use and risk profile');
  }

  return drivers.slice(0, 4); // Allow 4 drivers for this section
}

function extractSection11Drivers(data: Record<string, any>): string[] {
  const drivers: string[] = [];

  // Fire safety policy
  if (data.fire_safety_policy_exists === 'no') {
    drivers.push('No documented fire safety policy in place');
  }

  // Training provision
  if (data.training_induction_provided === 'no') {
    drivers.push('Staff fire safety induction training is not provided');
  }

  // Fire drills
  if (data.training_fire_drill_frequency === 'never' || data.training_fire_drill_frequency === 'ad_hoc') {
    drivers.push('Fire drills are not conducted at appropriate intervals');
  }

  // Hot work permit
  if (data.ptw_hot_work === 'no' && data.contractor_supervision === 'no') {
    drivers.push('No hot work permit system in place despite contractor activities');
  }

  // Inspection records
  if (data.inspection_records_available === 'no') {
    drivers.push('Fire safety inspection records are not available or not maintained');
  }

  if (drivers.length === 0) {
    return ['No specific issues were recorded in this section.'];
  }

  return drivers.slice(0, 3);
}

function extractSection12Drivers(data: Record<string, any>): string[] {
  const drivers: string[] = [];

  // Boundary distances
  if (data.boundary_distances_adequate === 'no') {
    drivers.push('Separation distances to boundaries are inadequate');
  }

  // External wall construction
  if (data.external_wall_fire_resistance === 'inadequate' || data.external_wall_fire_resistance === 'unknown') {
    drivers.push('External wall fire resistance is inadequate or not verified');
  }

  // Cladding concerns
  if (data.cladding_concerns === 'yes') {
    drivers.push('Concerns identified regarding external cladding materials');
  }

  // External storage
  if (data.external_storage_risk === 'high') {
    drivers.push('External storage of combustibles presents elevated fire spread risk');
  }

  // Neighbouring premises
  if (data.neighbouring_premises_risk === 'high') {
    drivers.push('Adjacent premises present significant fire spread risk');
  }

  if (drivers.length === 0) {
    return ['No specific issues were recorded in this section.'];
  }

  return drivers.slice(0, 3);
}

/**
 * Detect if text is generic boilerplate that should be replaced
 */
function isBoilerplateSummary(text: string): boolean {
  if (!text || text.trim().length === 0) return true;

  const normalized = text.toLowerCase().trim();

  // Common boilerplate patterns
  const boilerplatePatterns = [
    'no significant deficiencies identified',
    'no material deficiencies identified',
    'minor deficiencies identified',
    'significant deficiencies identified',
    'deficiencies and/or information gaps identified',
    'at time of assessment',
    'urgent remedial action required',
    'actions required to address these matters',
    'improvements recommended',
    'however key aspects could not be verified',
  ];

  // If text contains 2+ boilerplate patterns, it's generic
  const matchCount = boilerplatePatterns.filter(pattern => normalized.includes(pattern)).length;
  if (matchCount >= 2) return true;

  // If text is very short and matches any pattern exactly, it's boilerplate
  if (normalized.length < 150 && boilerplatePatterns.some(pattern => normalized.includes(pattern))) {
    return true;
  }

  return false;
}

/**
 * Universal Assessor Summary Generator
 * Generates contextual narrative from structured module data
 * Works across all FRA sections (5-11)
 *
 * @param sectionId Section number (5-11)
 * @param module Module instance with structured data
 * @param document Document metadata for context (building height, use, etc.)
 * @returns Professional summary text or null if insufficient data
 */
export function generateAssessorSummary(
  sectionId: number,
  module: ModuleInstance | undefined,
  document: Document
): string | null {
  if (!module || !module.data) return null;

  // If assessor provided custom summary and it's not boilerplate, use it
  if (module.data.assessor_summary && !isBoilerplateSummary(module.data.assessor_summary)) {
    return module.data.assessor_summary;
  }

  // Generate contextual summary based on section
  switch (sectionId) {
    case 5:
      return generateSection5Summary(module, document);
    case 6:
      return generateSection6Summary(module, document);
    case 7:
      return generateSection7Summary(module, document);
    case 9:
      return generateSection9Summary(module, document);
    case 10:
      return generateSection10Summary(module, document);
    case 11:
      return generateSection11Summary(module, document);
    default:
      return null;
  }
}

/**
 * Section 5: Fire Hazards & Ignition Sources
 */
function generateSection5Summary(module: ModuleInstance, document: Document): string | null {
  const data = module.data;
  const parts: string[] = [];

  // Electrical safety
  const eicr = data.electrical_safety || {};
  if (eicr.eicr_evidence_seen === 'yes') {
    if (eicr.eicr_outstanding_c1_c2 === 'yes') {
      parts.push('Electrical installation has outstanding C1/C2 defects requiring urgent attention');
    } else if (eicr.eicr_satisfactory === 'satisfactory') {
      parts.push('Electrical installation condition satisfactory with current EICR');
    } else if (eicr.eicr_satisfactory === 'unsatisfactory') {
      parts.push('Electrical installation rated unsatisfactory; remedial work required');
    }
  } else if (eicr.eicr_evidence_seen === 'no') {
    parts.push('Electrical installation certificate not evidenced');
  }

  // High-risk activities
  const highRiskActivities = data.high_risk_activities || [];
  if (Array.isArray(highRiskActivities) && highRiskActivities.length > 0) {
    parts.push(`High-risk activities identified including ${highRiskActivities[0]}`);
  }

  // Arson risk
  if (data.arson_risk === 'high' || data.arson_risk === 'elevated') {
    parts.push('Elevated arson risk noted');
  }

  // Housekeeping
  if (data.housekeeping_fire_load === 'high' || data.housekeeping_fire_load === 'excessive') {
    parts.push('Fire load management requires improvement');
  } else if (data.housekeeping_fire_load === 'low' || data.housekeeping_fire_load === 'minimal') {
    parts.push('Fire load appropriately managed');
  }

  if (parts.length === 0) return null;

  return parts.slice(0, 3).join('. ') + '.';
}

/**
 * Section 6: Means of Escape
 */
function generateSection6Summary(module: ModuleInstance, document: Document): string | null {
  const data = module.data;
  const parts: string[] = [];

  // Escape strategy
  const strategy = data.escape_strategy_current || data.escape_strategy;
  if (strategy) {
    const strategyLabel = String(strategy).replace(/_/g, ' ').toLowerCase();
    parts.push(`Escape strategy is ${strategyLabel}`);
  }

  // Travel distances
  if (data.travel_distances_compliant === 'yes' || data.travel_distances === 'compliant') {
    parts.push('Travel distances within acceptable limits');
  } else if (data.travel_distances_compliant === 'no' || data.travel_distances === 'non_compliant') {
    parts.push('Travel distances exceed recommended limits');
  }

  // Obstructions
  if (data.escape_route_obstructions === 'yes' || data.escape_route_obstructions === 'present') {
    parts.push('Escape route obstructions identified requiring removal');
  } else if (data.escape_route_obstructions === 'no') {
    parts.push('Escape routes maintained clear');
  }

  // Signage
  if (data.signage_adequacy === 'adequate' || data.signage === 'adequate') {
    parts.push('Exit signage provision adequate');
  } else if (data.signage_adequacy === 'inadequate' || data.signage === 'inadequate') {
    parts.push('Exit signage requires enhancement');
  }

  if (parts.length === 0) return null;

  return parts.slice(0, 3).join('. ') + '.';
}

/**
 * Section 7: Fire Detection, Alarm & Emergency Lighting
 */
function generateSection7Summary(module: ModuleInstance, document: Document): string | null {
  const data = module.data;
  const parts: string[] = [];

  // Fire alarm system
  const hasAlarm = data.fire_alarm_present === 'yes' || data.alarm_present === 'yes';
  if (hasAlarm) {
    const category = data.fire_alarm_category || data.alarm_category || data.category;
    if (category) {
      const categoryLabel = String(category).toUpperCase();
      parts.push(`Fire alarm system installed (${categoryLabel} category)`);
    } else {
      parts.push('Fire alarm system installed');
    }

    // Testing evidence
    if (data.alarm_testing_evidence === 'current' || data.testing_maintenance === 'current') {
      parts.push('Testing and maintenance regime current');
    } else if (data.alarm_testing_evidence === 'overdue' || data.testing_maintenance === 'overdue') {
      parts.push('Testing records overdue or not evidenced');
    }
  } else if (data.fire_alarm_present === 'no' || data.alarm_present === 'no') {
    parts.push('No fire alarm system installed');
  }

  // Emergency lighting
  const hasEL = data.emergency_lighting_present === 'yes';
  if (hasEL) {
    const elTesting = data.emergency_lighting_testing;
    if (elTesting === 'current' || elTesting === 'satisfactory') {
      parts.push('Emergency lighting provided with current testing');
    } else if (elTesting === 'overdue' || elTesting === 'unsatisfactory') {
      parts.push('Emergency lighting testing overdue');
    }
  } else if (data.emergency_lighting_present === 'no') {
    parts.push('Emergency lighting not provided');
  }

  if (parts.length === 0) return null;

  return parts.slice(0, 3).join('. ') + '.';
}

/**
 * Section 9: Passive Fire Protection (Fire Doors, Compartmentation)
 */
function generateSection9Summary(module: ModuleInstance, document: Document): string | null {
  const data = module.data;
  const parts: string[] = [];

  // Fire doors
  if (data.fire_doors_present === 'yes') {
    const doorCondition = data.fire_doors_condition;
    if (doorCondition === 'good' || doorCondition === 'satisfactory') {
      parts.push('Fire doors in satisfactory condition');
    } else if (doorCondition === 'poor' || doorCondition === 'defective') {
      parts.push('Fire door defects identified requiring remediation');
    }
  } else if (data.fire_doors_present === 'no') {
    parts.push('No fire doors installed');
  }

  // Compartmentation
  if (data.compartmentation_status === 'intact' || data.compartmentation_status === 'good') {
    parts.push('Compartmentation integrity maintained');
  } else if (data.compartmentation_status === 'breached' || data.compartmentation_status === 'compromised') {
    parts.push('Compartmentation breaches identified');
  }

  // Fire stopping
  if (data.fire_stopping_adequacy === 'adequate' || data.fire_stopping_adequacy === 'good') {
    parts.push('Fire stopping provision adequate');
  } else if (data.fire_stopping_adequacy === 'inadequate' || data.fire_stopping_adequacy === 'poor') {
    parts.push('Fire stopping deficiencies noted');
  }

  if (parts.length === 0) return null;

  return parts.slice(0, 3).join('. ') + '.';
}

/**
 * Section 10: Fixed Fire Suppression & Firefighting Facilities
 */
function generateSection10Summary(module: ModuleInstance, document: Document): string | null {
  const data = module.data;
  const firefighting = data.firefighting || {};
  const fixedFacilities = firefighting.fixed_facilities || {};

  const parts: string[] = [];

  // Sprinkler system
  const sprinklers = fixedFacilities.sprinklers || {};
  const hasSprinklers = sprinklers.installed === 'yes' || data.sprinkler_present === 'yes';

  if (hasSprinklers) {
    let text = 'Sprinkler system installed';
    const systemType = sprinklers.type || data.sprinkler_type;
    const coverage = sprinklers.coverage || data.sprinkler_coverage;

    if (systemType && coverage && coverage !== 'unknown') {
      const typeLabel = String(systemType).replace(/_/g, ' ').toLowerCase();
      const coverageLabel = String(coverage).replace(/_/g, ' ').toLowerCase();
      text += ` (${typeLabel}, ${coverageLabel} coverage)`;
    } else if (systemType) {
      const typeLabel = String(systemType).replace(/_/g, ' ').toLowerCase();
      text += ` (${typeLabel})`;
    }

    const servicingStatus = sprinklers.servicing_status || data.sprinkler_servicing_status;
    if (servicingStatus === 'overdue' || servicingStatus === 'unknown') {
      text += ' with servicing overdue';
    }

    parts.push(text);
  } else if (data.sprinkler_present === 'no' || sprinklers.installed === 'no') {
    parts.push('No sprinkler system installed');
  }

  // Rising mains
  const dryRiser = fixedFacilities.dry_riser || {};
  const wetRiser = fixedFacilities.wet_riser || {};
  const hasDryRiser = dryRiser.installed === 'yes';
  const hasWetRiser = wetRiser.installed === 'yes';

  if (hasDryRiser || hasWetRiser) {
    const riserType = hasWetRiser ? 'Wet riser' : 'Dry riser';
    const riserServicing = hasWetRiser ? wetRiser.servicing_status : dryRiser.servicing_status;

    if (riserServicing === 'overdue' || riserServicing === 'defective') {
      parts.push(`${riserType} testing overdue or defective`);
    } else {
      parts.push(`${riserType} installed with current testing`);
    }
  }

  // Portable extinguishers
  const extinguishers = firefighting.portable_extinguishers || {};
  if (extinguishers.present === 'yes' || data.extinguishers_present === 'yes') {
    const servicingStatus = extinguishers.servicing_status || data.extinguisher_servicing_evidence;
    if (servicingStatus === 'overdue' || servicingStatus === 'no' || servicingStatus === 'unknown') {
      parts.push('Fire extinguisher servicing overdue');
    }
  } else if (extinguishers.present === 'no' || data.extinguishers_present === 'no') {
    parts.push('Fire extinguishers not provided');
  }

  if (parts.length === 0) return null;

  return parts.slice(0, 3).join('. ') + '.';
}

/**
 * Section 11: Fire Safety Management & Procedures
 * Enhanced with PTW systems and records depth
 */
function generateSection11Summary(module: ModuleInstance, document: Document): string | null {
  const data = module.data;
  const parts: string[] = [];

  // PTW Hot Work (provides authority)
  const ptwHotWork = data.ptw_hot_work;
  if (ptwHotWork === 'yes' || ptwHotWork === 'formal') {
    parts.push('Formal permit-to-work system in place for hot work activities');
  } else if (ptwHotWork === 'no' || ptwHotWork === 'informal') {
    parts.push('Hot work permit-to-work system not implemented');
  }

  // Fire safety policy
  if (data.fire_safety_policy_exists === 'yes' || data.fire_safety_policy === 'yes') {
    parts.push('Fire safety policy documented');
  } else if (data.fire_safety_policy_exists === 'no' || data.fire_safety_policy === 'no') {
    parts.push('Fire safety policy not documented');
  }

  // Training provision
  if (data.training_induction_provided === 'yes' || data.training_induction === 'yes') {
    const refresher = data.training_refresher_frequency || data.training_refresher;
    if (refresher === 'annual' || refresher === 'regular') {
      parts.push('Staff fire safety training regime in place');
    }
  } else if (data.training_induction_provided === 'no' || data.training_induction === 'no') {
    parts.push('Staff fire safety training not provided');
  }

  // Fire drills
  const drillFrequency = data.training_fire_drill_frequency || data.drill_frequency;
  if (drillFrequency === 'never' || drillFrequency === 'ad_hoc') {
    parts.push('Fire drill frequency inadequate');
  } else if (drillFrequency === 'annual' || drillFrequency === 'six_monthly') {
    parts.push('Fire drills conducted at appropriate intervals');
  }

  // Inspection records (governance perspective - not specific systems)
  const inspectionRecords = data.inspection_records_available;
  if (inspectionRecords === 'no' || inspectionRecords === 'partial') {
    parts.push('Inspection records not fully evidenced');
  } else if (inspectionRecords === 'yes' || inspectionRecords === 'available') {
    parts.push('Testing and inspection records maintained');
  }

  // Housekeeping
  if (data.housekeeping_rating === 'poor' || data.housekeeping_rating === 'inadequate') {
    parts.push('Housekeeping standards require improvement');
  } else if (data.housekeeping_rating === 'good' || data.housekeeping_rating === 'excellent') {
    parts.push('Housekeeping standards satisfactory');
  }

  if (parts.length === 0) return null;

  // Return max 4 sentences (increased from 3 for governance depth)
  return parts.slice(0, 4).join('. ') + '.';
}

/**
 * @deprecated Use generateAssessorSummary() instead
 * Kept for backward compatibility with Section 10 specific call
 */
export function generateSection10AssessorSummary(
  module: ModuleInstance | undefined,
  document: Document
): string | null {
  return generateAssessorSummary(10, module, document);
}

/**
 * Helper: Derive emergency lighting system presence from Section 7 owner module
 *
 * Single source of truth for emergency lighting presence used in SCS/reliance calculations.
 * Queries FRA_3_ACTIVE_SYSTEMS (current) or FRA_3_PROTECTION_ASIS (deprecated) module.
 *
 * @param moduleInstances - Array of module instances to search
 * @returns true if emergency lighting system is present, false otherwise
 */
export function getHasEmergencyLightingSystemFromActiveSystems(moduleInstances: any[]): boolean {
  const active = moduleInstances.find(m =>
    m.module_key === 'FRA_3_ACTIVE_SYSTEMS' || m.module_key === 'FRA_3_PROTECTION_ASIS'
  );
  return (
    active?.data?.emergency_lighting_present === true ||
    String(active?.data?.emergency_lighting_present || '').toLowerCase() === 'yes'
  );
}
