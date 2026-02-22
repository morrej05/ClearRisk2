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

  // Disabled egress
  if (data.disabled_egress_arrangements === 'inadequate') {
    drivers.push('Provision for disabled persons in emergency egress is inadequate');
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

  // Alarm testing
  if (data.inspection_alarm_weekly_test === 'no') {
    drivers.push('Weekly fire alarm testing is not being conducted');
  }

  // Hot work permit
  if (data.ptw_hot_work === 'no' && data.contractor_supervision === 'no') {
    drivers.push('No hot work permit system in place despite contractor activities');
  }

  // Emergency lighting testing
  if (data.inspection_emergency_lighting_monthly === 'no') {
    drivers.push('Monthly emergency lighting functional tests are not being conducted');
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
 * Generate contextual assessor summary for Section 10 from structured data
 * Used when module.assessor_summary is missing or boilerplate
 *
 * @param module FRA_8 module instance
 * @param document Document metadata (for building height)
 * @returns Professional summary text or null if insufficient data
 */
export function generateSection10AssessorSummary(
  module: ModuleInstance | undefined,
  document: Document
): string | null {
  if (!module || !module.data) return null;

  const data = module.data;
  const firefighting = data.firefighting || {};
  const fixedFacilities = firefighting.fixed_facilities || {};

  // Extract building height for context
  const buildingHeightM = data.building_height_m || document.meta?.building_height_m || 0;

  const parts: string[] = [];

  // 1. Sprinkler system narrative
  const sprinklers = fixedFacilities.sprinklers || {};
  const hasSprinklers = sprinklers.installed === 'yes' || data.sprinkler_present === 'yes';

  if (hasSprinklers) {
    let sprinklerText = 'Sprinkler system installed';

    // Add type
    const systemType = sprinklers.type || data.sprinkler_type;
    if (systemType) {
      const typeLabel = String(systemType).replace(/_/g, ' ').toLowerCase();
      sprinklerText += ` (${typeLabel})`;
    }

    // Add coverage
    const coverage = sprinklers.coverage || data.sprinkler_coverage;
    if (coverage && coverage !== 'unknown') {
      const coverageLabel = String(coverage).replace(/_/g, ' ').toLowerCase();
      sprinklerText += ` with ${coverageLabel} coverage`;
    }

    // Add servicing status
    const servicingStatus = sprinklers.servicing_status || data.sprinkler_servicing_status;
    if (servicingStatus === 'current' || servicingStatus === 'satisfactory') {
      sprinklerText += '; servicing current';
    } else if (servicingStatus === 'overdue' || servicingStatus === 'unknown') {
      sprinklerText += '; servicing overdue or not evidenced';
    }

    parts.push(sprinklerText);
  } else if (data.sprinkler_present === 'no' || sprinklers.installed === 'no') {
    parts.push('No sprinkler system installed');
  }

  // 2. Rising mains (dry/wet risers)
  const dryRiser = fixedFacilities.dry_riser || {};
  const wetRiser = fixedFacilities.wet_riser || {};
  const hasDryRiser = dryRiser.installed === 'yes' || data.rising_mains === 'dry_riser';
  const hasWetRiser = wetRiser.installed === 'yes' || data.rising_mains === 'wet_riser';
  const isHighRise = buildingHeightM >= 18;

  if (hasDryRiser || hasWetRiser) {
    const riserType = hasWetRiser ? 'wet riser' : 'dry riser';
    let riserText = `${riserType.charAt(0).toUpperCase() + riserType.slice(1)} installed`;

    const riserServicing = hasWetRiser ? wetRiser.servicing_status : dryRiser.servicing_status;
    if (riserServicing === 'current' || riserServicing === 'satisfactory') {
      riserText += ' with current testing regime';
    } else if (riserServicing === 'overdue' || riserServicing === 'defective') {
      riserText += '; testing overdue or defective';
    }

    parts.push(riserText);
  } else if (!isHighRise && buildingHeightM > 0) {
    parts.push('rising mains not installed (not required based on building height)');
  }

  // 3. Firefighting lift and shaft
  const firefightingLift = fixedFacilities.firefighting_lift || {};
  const firefightingShaft = fixedFacilities.firefighting_shaft || {};
  const hasLift = firefightingLift.present === 'yes' || data.firefighting_lift === 'yes';
  const hasShaft = firefightingShaft.present === 'yes' || data.firefighting_shaft === 'yes';

  if (hasLift && hasShaft) {
    parts.push('firefighting lift and shaft provided');
  } else if (hasLift) {
    parts.push('firefighting lift provided');
  } else if (hasShaft) {
    parts.push('firefighting shaft provided');
  }

  // If no substantial content, return null
  if (parts.length === 0) return null;

  // Build final summary with proper grammar
  let summary = '';

  if (parts.length === 1) {
    summary = parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + '.';
  } else if (parts.length === 2) {
    summary = parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + '; ' + parts[1] + '.';
  } else {
    // Three or more parts
    const firstPart = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    const middleParts = parts.slice(1, -1).join('; ');
    const lastPart = parts[parts.length - 1];
    summary = `${firstPart}; ${middleParts}; ${lastPart}.`;
  }

  // Add concluding statement if no deficiencies mentioned
  const hasDeficiencies = summary.toLowerCase().includes('overdue') ||
                          summary.toLowerCase().includes('defective') ||
                          summary.toLowerCase().includes('not evidenced');

  if (!hasDeficiencies) {
    summary += ' Overall, facilities are proportionate to building height, use and risk profile.';
  }

  return summary;
}
