export interface InfoGapQuickAction {
  action: string;
  reason: string;
  priority: 'P2' | 'P3';
}

export interface InfoGapDetection {
  hasInfoGap: boolean;
  reasons: string[];
  quickActions: InfoGapQuickAction[];
}

export function detectInfoGaps(
  moduleKey: string,
  moduleData: Record<string, any>,
  outcome: string | null
): InfoGapDetection {
  const reasons: string[] = [];
  const quickActions: InfoGapQuickAction[] = [];

  // If outcome is explicitly set to info_gap, include that
  if (outcome === 'info_gap') {
    reasons.push('Module outcome marked as Information Gap');
  }

  // Module-specific info gap detection
  switch (moduleKey) {
    case 'A1_DOC_CONTROL':
      if (!moduleData.responsible_person || !moduleData.responsible_person.trim()) {
        reasons.push('Responsible person not identified');
        quickActions.push({
          action: 'Identify and document the responsible person for fire safety',
          reason: 'Legal requirement under Regulatory Reform (Fire Safety) Order 2005',
          priority: 'P2',
        });
      }
      if (!moduleData.standards_selected || moduleData.standards_selected.length === 0) {
        reasons.push('No assessment standards selected');
        quickActions.push({
          action: 'Select and document applicable fire safety standards (e.g., BS 9999, BS 9991)',
          reason: 'Defines assessment methodology and compliance framework',
          priority: 'P3',
        });
      }
      break;

    case 'A4_MANAGEMENT_CONTROLS':
      if (moduleData.fire_safety_policy === 'unknown' || !moduleData.fire_safety_policy) {
        reasons.push('Fire safety policy status unknown');
        quickActions.push({
          action: 'Verify existence of fire safety policy and management procedures',
          reason: 'Essential for demonstrating management commitment',
          priority: 'P2',
        });
      }
      if (moduleData.training_induction === 'unknown' || !moduleData.training_induction) {
        reasons.push('Staff training status unknown');
        quickActions.push({
          action: 'Obtain fire safety training records and verify induction procedures',
          reason: 'Trained staff are critical to fire safety management',
          priority: 'P2',
        });
      }
      if (moduleData.testing_records === 'unknown' || !moduleData.testing_records) {
        reasons.push('Testing records availability unknown');
        quickActions.push({
          action: 'Request and review fire safety equipment testing/maintenance records',
          reason: 'Demonstrates ongoing system maintenance and compliance',
          priority: 'P3',
        });
      }
      break;

    case 'A5_EMERGENCY_ARRANGEMENTS':
      if (moduleData.emergency_plan_exists === 'unknown' || !moduleData.emergency_plan_exists) {
        reasons.push('Emergency plan status unknown');
        quickActions.push({
          action: 'Verify existence of emergency evacuation plan and procedures',
          reason: 'Legal requirement and critical for life safety',
          priority: 'P2',
        });
      }
      if (moduleData.peeps_in_place === 'unknown' || !moduleData.peeps_in_place) {
        reasons.push('PEEPs status unknown');
        quickActions.push({
          action: 'Confirm whether Personal Emergency Evacuation Plans (PEEPs) exist for vulnerable persons',
          reason: 'Legal duty to ensure all persons can evacuate safely',
          priority: 'P2',
        });
      }
      if (moduleData.drill_frequency === 'unknown' || !moduleData.drill_frequency) {
        reasons.push('Fire drill frequency unknown');
        quickActions.push({
          action: 'Obtain fire drill records and confirm frequency of evacuations',
          reason: 'Regular drills essential for emergency preparedness',
          priority: 'P3',
        });
      }
      break;

    case 'FRA_1_HAZARDS':
      if (!moduleData.ignition_sources || moduleData.ignition_sources.length === 0) {
        reasons.push('No ignition sources identified');
        quickActions.push({
          action: 'Conduct detailed walkthrough to identify all potential ignition sources',
          reason: 'Ignition sources are fundamental to fire risk assessment',
          priority: 'P2',
        });
      }
      if (!moduleData.fuel_sources || moduleData.fuel_sources.length === 0) {
        reasons.push('No fuel sources identified');
        quickActions.push({
          action: 'Survey premises to identify and document all combustible materials and fuel sources',
          reason: 'Fuel sources determine potential fire load and spread',
          priority: 'P2',
        });
      }
      if (moduleData.arson_risk === 'unknown' || !moduleData.arson_risk) {
        reasons.push('Arson risk not assessed');
        quickActions.push({
          action: 'Assess arson vulnerability including external security, waste storage, and access control',
          reason: 'Arson is a significant cause of fire in commercial premises',
          priority: 'P3',
        });
      }
      break;

    case 'FRA_2_ESCAPE_ASIS':
      if (moduleData.travel_distances_compliant === 'unknown' || !moduleData.travel_distances_compliant) {
        reasons.push('Travel distances not verified');
        quickActions.push({
          action: 'Measure and verify travel distances to final exits against applicable standards',
          reason: 'Travel distances are critical for safe evacuation',
          priority: 'P2',
        });
      }
      if (moduleData.escape_strategy === 'unknown' || !moduleData.escape_strategy) {
        reasons.push('Escape strategy not determined');
        quickActions.push({
          action: 'Determine and document the building\'s fire evacuation strategy (simultaneous, phased, stay-put)',
          reason: 'Defines evacuation approach and influences all other provisions',
          priority: 'P2',
        });
      }
      if (moduleData.stair_protection_status === 'unknown' || !moduleData.stair_protection_status) {
        reasons.push('Stair protection status unknown');
        quickActions.push({
          action: 'Verify staircase fire protection including enclosure and fire doors',
          reason: 'Protected stairs are essential for multi-storey evacuation',
          priority: 'P2',
        });
      }
      break;

    case 'FRA_3_PROTECTION_ASIS':
      if (moduleData.alarm_present === 'unknown' || !moduleData.alarm_present) {
        reasons.push('Fire alarm system presence unknown');
        quickActions.push({
          action: 'Confirm fire alarm system installation and obtain system certificates',
          reason: 'Alarm system is primary means of warning occupants',
          priority: 'P2',
        });
      }
      if (moduleData.alarm_present === 'yes' && (!moduleData.alarm_category || moduleData.alarm_category === 'unknown')) {
        reasons.push('Fire alarm category not identified');
        quickActions.push({
          action: 'Identify fire alarm category (L1-L5/M) from commissioning certificates',
          reason: 'Category defines level of protection provided',
          priority: 'P2',
        });
      }
      if (moduleData.emergency_lighting_present === 'unknown' || !moduleData.emergency_lighting_present) {
        reasons.push('Emergency lighting presence unknown');
        quickActions.push({
          action: 'Survey building for emergency lighting installation and obtain test certificates',
          reason: 'Emergency lighting enables safe evacuation in power failure',
          priority: 'P2',
        });
      }
      if (moduleData.compartmentation_condition === 'unknown' || !moduleData.compartmentation_condition) {
        reasons.push('Compartmentation condition unknown');
        quickActions.push({
          action: 'Commission compartmentation survey to verify fire resistance of walls, floors, and penetrations',
          reason: 'Compartmentation prevents fire spread and supports stay-put strategies',
          priority: 'P2',
        });
      }
      if (moduleData.fire_stopping_confidence === 'low' || moduleData.fire_stopping_confidence === 'unknown') {
        reasons.push('Fire stopping integrity uncertain');
        quickActions.push({
          action: 'Arrange intrusive survey of fire stopping at service penetrations and construction joints',
          reason: 'Fire stopping breaches can compromise compartmentation',
          priority: 'P2',
        });
      }
      break;

    case 'FRA_5_EXTERNAL_FIRE_SPREAD':
      if (!moduleData.building_height_m || moduleData.building_height_m === 0) {
        reasons.push('Building height not recorded');
        quickActions.push({
          action: 'Measure or obtain building height (from plans or building records)',
          reason: 'Buildings ≥18m have specific regulatory requirements',
          priority: 'P2',
        });
      }
      if (moduleData.cladding_present === 'unknown' || !moduleData.cladding_present) {
        reasons.push('Cladding system presence/type unknown');
        quickActions.push({
          action: 'Inspect external walls and identify cladding system type and materials',
          reason: 'Combustible cladding poses significant external fire spread risk',
          priority: 'P2',
        });
      }
      if (moduleData.cladding_present === 'yes' && (moduleData.insulation_combustibility_known === 'unknown' || !moduleData.insulation_combustibility_known)) {
        reasons.push('Insulation combustibility unknown');
        quickActions.push({
          action: 'Obtain building records or commission testing to determine insulation combustibility classification',
          reason: 'Combustible insulation can lead to rapid vertical fire spread',
          priority: 'P2',
        });
      }
      if (moduleData.building_height_m >= 18 && (!moduleData.pas9980_or_equivalent_appraisal || moduleData.pas9980_or_equivalent_appraisal === 'unknown')) {
        reasons.push('PAS 9980 appraisal status unknown for high-rise building');
        quickActions.push({
          action: 'Confirm whether PAS 9980 external wall appraisal has been completed',
          reason: 'Legal requirement for residential buildings ≥18m',
          priority: 'P2',
        });
      }
      break;

    case 'FRA_4_SIGNIFICANT_FINDINGS':
      if (!moduleData.overall_risk_rating || moduleData.overall_risk_rating === 'unknown') {
        reasons.push('Overall risk rating not determined');
        quickActions.push({
          action: 'Complete all other modules to determine overall fire risk rating',
          reason: 'Overall rating drives risk communication and action prioritization',
          priority: 'P2',
        });
      }
      if (!moduleData.executive_summary || !moduleData.executive_summary.trim()) {
        reasons.push('Executive summary not written');
        quickActions.push({
          action: 'Draft executive summary of key findings, deficiencies, and recommendations',
          reason: 'Summary provides client with clear understanding of risk',
          priority: 'P3',
        });
      }
      break;
  }

  // Determine if there's an actionable info gap
  const hasInfoGap = outcome === 'info_gap' || quickActions.length > 0;

  return {
    hasInfoGap,
    reasons,
    quickActions,
  };
}

export function getModuleInfoGapTitle(moduleKey: string): string {
  switch (moduleKey) {
    case 'A1_DOC_CONTROL':
      return 'Document Control Information Gaps';
    case 'A4_MANAGEMENT_CONTROLS':
      return 'Management Systems Information Gaps';
    case 'A5_EMERGENCY_ARRANGEMENTS':
      return 'Emergency Arrangements Information Gaps';
    case 'FRA_1_HAZARDS':
      return 'Hazard Identification Information Gaps';
    case 'FRA_2_ESCAPE_ASIS':
      return 'Means of Escape Information Gaps';
    case 'FRA_3_PROTECTION_ASIS':
      return 'Fire Protection Information Gaps';
    case 'FRA_5_EXTERNAL_FIRE_SPREAD':
      return 'External Fire Spread Information Gaps';
    case 'FRA_4_SIGNIFICANT_FINDINGS':
      return 'Assessment Completion Information Gaps';
    default:
      return 'Information Gaps';
  }
}
