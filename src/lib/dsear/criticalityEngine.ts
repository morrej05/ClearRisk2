export type ExplosionCriticality = 'Low' | 'Moderate' | 'High' | 'Critical';

export interface ExplosionFlag {
  id: string;
  level: 'critical' | 'high' | 'moderate';
  title: string;
  detail: string;
  relatedModules: string[];
}

export interface ExplosionSummary {
  overall: ExplosionCriticality;
  flags: ExplosionFlag[];
  criticalCount: number;
  highCount: number;
  moderateCount: number;
}

export interface ExplosionSeverityResult {
  level: 'critical' | 'high' | 'moderate' | 'low';
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  triggerId: string;
  triggerText: string;
}

interface ModuleInstance {
  module_key: string;
  outcome: string | null;
  assessor_notes?: string;
  data: Record<string, any>;
}

/**
 * Normalize DSEAR module keys to canonical forms.
 * Handles various aliases and legacy naming conventions.
 */
function normalizeDsearModuleKey(key: string): string {
  const k = String(key || '').trim();

  const map: Record<string, string> = {
    // Substances
    'DSEAR_1_DANGEROUS_SUBSTANCES': 'DSEAR_1_SUBSTANCES',
    'DSEAR_1_SUBSTANCES_REGISTER': 'DSEAR_1_SUBSTANCES',

    // HAC / zoning
    'DSEAR_3_HAZARDOUS_AREA_CLASSIFICATION': 'DSEAR_3_HAC',
    'DSEAR_3_HAC_ZONING': 'DSEAR_3_HAC',

    // Mitigation / explosion protection
    'DSEAR_5_MITIGATION': 'DSEAR_5_EXPLOSION_PROTECTION',

    // Risk table
    'DSEAR_6_RISK_TABLE': 'DSEAR_6_RISK_ASSESSMENT',

    // Hierarchy of control
    'DSEAR_10_HIERARCHY_OF_CONTROL': 'DSEAR_10_HIERARCHY_CONTROL',
    'DSEAR_10_HIERARCHY_SUBSTITUTION': 'DSEAR_10_HIERARCHY_CONTROL',
  };

  return map[k] || k;
}

/**
 * Normalize an array of module instances to use canonical module keys.
 */
function normalizeDsearModules(modules: ModuleInstance[]): ModuleInstance[] {
  return modules.map(m => ({
    ...m,
    module_key: normalizeDsearModuleKey(m.module_key)
  }));
}

export function computeExplosionSummary(context: {
  modules: ModuleInstance[];
}): ExplosionSummary {
  // Normalize module keys to handle aliases and legacy naming
  const normalized = normalizeDsearModules(context.modules);
  const flags: ExplosionFlag[] = [];

  const dsear1 = normalized.find((m) => m.module_key === 'DSEAR_1_SUBSTANCES');
  const dsear2 = normalized.find((m) => m.module_key === 'DSEAR_2_PROCESS_RELEASES');
  const dsear3 = normalized.find((m) => m.module_key === 'DSEAR_3_HAC');
  const dsear4 = normalized.find((m) => m.module_key === 'DSEAR_4_IGNITION_SOURCES');
  const dsear5 = normalized.find((m) => m.module_key === 'DSEAR_5_EXPLOSION_PROTECTION');
  const dsear6 = normalized.find((m) => m.module_key === 'DSEAR_6_RISK_ASSESSMENT');
  const dsear10 = normalized.find((m) => m.module_key === 'DSEAR_10_HIERARCHY_CONTROL');

  checkCriticalTriggers(flags, dsear1, dsear2, dsear3, dsear4, dsear5);
  checkHighTriggers(flags, dsear2, dsear4, dsear6, normalized);
  checkModerateTriggers(flags, normalized);

  flags.sort((a, b) => {
    const levelOrder: Record<string, number> = {
      critical: 3,
      high: 2,
      moderate: 1,
    };

    if (levelOrder[a.level] !== levelOrder[b.level]) {
      return levelOrder[b.level] - levelOrder[a.level];
    }

    return a.title.length - b.title.length;
  });

  const criticalCount = flags.filter((f) => f.level === 'critical').length;
  const highCount = flags.filter((f) => f.level === 'high').length;
  const moderateCount = flags.filter((f) => f.level === 'moderate').length;

  const overall = determineOverallCriticality(criticalCount, highCount, moderateCount);

  return {
    overall,
    flags,
    criticalCount,
    highCount,
    moderateCount,
  };
}

function checkCriticalTriggers(
  flags: ExplosionFlag[],
  dsear1: ModuleInstance | undefined,
  dsear2: ModuleInstance | undefined,
  dsear3: ModuleInstance | undefined,
  dsear4: ModuleInstance | undefined,
  dsear5: ModuleInstance | undefined
): void {
  checkZonesWithoutDrawings(flags, dsear3);
  checkZoneWithoutATEX(flags, dsear3, dsear4);
  checkATEXRequiredWithoutControls(flags, dsear3, dsear4);
  checkContinuousReleaseWithoutZoning(flags, dsear1, dsear2, dsear3);
}

function checkZonesWithoutDrawings(
  flags: ExplosionFlag[],
  dsear3: ModuleInstance | undefined
): void {
  if (!dsear3) return;

  const zones = dsear3.data.zones || [];
  const hasZones = zones.some((z: any) => z.zone_type && z.zone_type !== '');
  const drawingsReference = dsear3.data.drawings_reference || '';

  if (hasZones && (!drawingsReference || drawingsReference.trim().length < 10)) {
    flags.push({
      id: 'EX-CR-01',
      level: 'critical',
      title: 'Hazardous zones declared without drawings',
      detail:
        'Hazardous area zones have been declared but no hazardous area classification drawing has been uploaded or referenced. This is a fundamental compliance requirement under DSEAR.',
      relatedModules: ['DSEAR_3_HAC'],
    });
  }
}

function checkZoneWithoutATEX(
  flags: ExplosionFlag[],
  dsear3: ModuleInstance | undefined,
  dsear4: ModuleInstance | undefined
): void {
  if (!dsear3 || !dsear4) return;

  const zones = dsear3.data.zones || [];
  const hasZone1or2 = zones.some(
    (z: any) => z.zone_type === '1' || z.zone_type === '2' || z.zone_type === '21' || z.zone_type === '22'
  );

  const atexRequired = dsear4.data.ATEX_equipment_required;
  const atexPresent = dsear4.data.ATEX_equipment_present;

  if (hasZone1or2) {
    if (atexRequired === 'unknown' || atexRequired === '') {
      flags.push({
        id: 'EX-CR-02',
        level: 'critical',
        title: 'Zone 1/2 present but ATEX requirement not confirmed',
        detail:
          'Zone 1, 2, 21, or 22 hazardous areas are present which require ATEX-rated equipment. However, ATEX equipment requirement status is unknown or not confirmed.',
        relatedModules: ['DSEAR_3_HAC', 'DSEAR_4_IGNITION_SOURCES'],
      });
    } else if (atexRequired === 'yes' && atexPresent !== 'yes') {
      flags.push({
        id: 'EX-CR-02',
        level: 'critical',
        title: 'Zone 1/2 present but ATEX equipment not confirmed',
        detail:
          'Zone 1, 2, 21, or 22 hazardous areas are present which require ATEX-rated equipment. ATEX equipment is required but presence/suitability is not confirmed.',
        relatedModules: ['DSEAR_3_HAC', 'DSEAR_4_IGNITION_SOURCES'],
      });
    }
  }
}

function checkATEXRequiredWithoutControls(
  flags: ExplosionFlag[],
  dsear3: ModuleInstance | undefined,
  dsear4: ModuleInstance | undefined
): void {
  if (!dsear3 || !dsear4) return;

  const zones = dsear3.data.zones || [];
  const hasZones = zones.some((z: any) => z.zone_type && z.zone_type !== '');

  const atexRequired = dsear4.data.ATEX_equipment_required;
  const staticControls = dsear4.data.static_control_measures || '';
  const hotWorkControls = dsear4.data.hot_work_controls || '';
  const inspectionRegime = dsear4.data.inspection_testing_regime || '';

  if (hasZones && atexRequired === 'yes') {
    const hasControls =
      (staticControls && staticControls.trim().length > 10) ||
      (hotWorkControls && hotWorkControls.trim().length > 10) ||
      (inspectionRegime && inspectionRegime.trim().length > 10);

    if (!hasControls) {
      flags.push({
        id: 'EX-CR-03',
        level: 'critical',
        title: 'ATEX required but ignition source controls missing',
        detail:
          'ATEX equipment is required based on hazardous area zones present, but ignition source controls (static control, hot work procedures, or inspection/testing regime) are not adequately documented.',
        relatedModules: ['DSEAR_3_HAC', 'DSEAR_4_IGNITION_SOURCES'],
      });
    }
  }
}

function checkContinuousReleaseWithoutZoning(
  flags: ExplosionFlag[],
  dsear1: ModuleInstance | undefined,
  dsear2: ModuleInstance | undefined,
  dsear3: ModuleInstance | undefined
): void {
  if (!dsear1 || !dsear2) return;

  const substances = dsear1.data.substances || [];
  const hasFlammableSubstance = substances.some(
    (s: any) => s.name && s.physical_state && s.physical_state !== 'non_flammable'
  );

  const processes = dsear2.data.process_descriptions || [];
  const hasContinuousRelease = processes.some(
    (p: any) => p.grade_of_release === 'continuous' || p.grade_of_release === 'primary'
  );

  const zones = dsear3?.data.zones || [];
  const hasZones = zones.some((z: any) => z.zone_type && z.zone_type !== '');

  if (hasFlammableSubstance && hasContinuousRelease && !hasZones) {
    flags.push({
      id: 'EX-CR-04',
      level: 'critical',
      title: 'Continuous release present but no zoning performed',
      detail:
        'Flammable substance(s) are present with continuous or primary grade release sources, but hazardous area classification (zoning) has not been performed. This is a fundamental DSEAR requirement.',
      relatedModules: ['DSEAR_1_SUBSTANCES', 'DSEAR_2_PROCESS_RELEASES', 'DSEAR_3_HAC'],
    });
  }
}

function checkHighTriggers(
  flags: ExplosionFlag[],
  dsear2: ModuleInstance | undefined,
  dsear4: ModuleInstance | undefined,
  dsear6: ModuleInstance | undefined,
  modules: ModuleInstance[]
): void {
  checkVentilationUnknown(flags, dsear2);
  checkNoInspectionRegime(flags, dsear4);
  checkRiskAssessmentBands(flags, dsear6);
  checkMultipleMaterialDeficiencies(flags, modules);
}

function checkVentilationUnknown(
  flags: ExplosionFlag[],
  dsear2: ModuleInstance | undefined
): void {
  if (!dsear2) return;

  const processes = dsear2.data.process_descriptions || [];
  const hasReleaseSource = processes.some(
    (p: any) => p.release_sources && p.release_sources.trim().length > 0
  );
  const hasUnknownVentilation = processes.some(
    (p: any) => p.release_sources && (p.ventilation_type === 'unknown' || !p.ventilation_type)
  );

  if (hasReleaseSource && hasUnknownVentilation) {
    flags.push({
      id: 'EX-HI-01',
      level: 'high',
      title: 'Ventilation effectiveness unknown where release sources exist',
      detail:
        'Release sources have been identified but ventilation type or effectiveness is not confirmed. Ventilation is critical for controlling explosive atmosphere formation.',
      relatedModules: ['DSEAR_2_PROCESS_RELEASES'],
    });
  }
}

function checkNoInspectionRegime(
  flags: ExplosionFlag[],
  dsear4: ModuleInstance | undefined
): void {
  if (!dsear4) return;

  const atexPresent = dsear4.data.ATEX_equipment_present;
  const inspectionRegime = dsear4.data.inspection_testing_regime || '';

  if (atexPresent === 'yes' && (!inspectionRegime || inspectionRegime.trim().length < 20)) {
    flags.push({
      id: 'EX-HI-02',
      level: 'high',
      title: 'No inspection/verification regime for Ex equipment',
      detail:
        'ATEX or explosion-protected equipment is present but no inspection, testing, or verification regime is documented. Regular inspection is a DSEAR maintenance requirement.',
      relatedModules: ['DSEAR_4_IGNITION_SOURCES'],
    });
  }
}

function checkRiskAssessmentBands(
  flags: ExplosionFlag[],
  dsear6: ModuleInstance | undefined
): void {
  if (!dsear6) return;

  const riskRows = dsear6.data.risk_rows || [];
  const criticalRows = riskRows.filter(
    (r: any) => r.residualRiskBand === 'Critical' && r.activity
  );
  const highRows = riskRows.filter(
    (r: any) => r.residualRiskBand === 'High' && r.activity
  );

  if (criticalRows.length > 0) {
    const activities = criticalRows.map((r: any) => r.activity).slice(0, 3).join(', ');
    flags.push({
      id: 'EX-HI-04',
      level: 'high',
      title: 'Critical residual risk identified in risk assessment',
      detail: `${criticalRows.length} risk row(s) have been assessed as Critical residual risk, indicating urgent risk management gaps. Activities include: ${activities}.`,
      relatedModules: ['DSEAR_6_RISK_ASSESSMENT'],
    });
  } else if (highRows.length >= 2) {
    const activities = highRows.map((r: any) => r.activity).slice(0, 3).join(', ');
    flags.push({
      id: 'EX-HI-05',
      level: 'high',
      title: 'Multiple high residual risks identified',
      detail: `${highRows.length} risk row(s) have been assessed as High residual risk, indicating significant safety improvements required. Activities include: ${activities}.`,
      relatedModules: ['DSEAR_6_RISK_ASSESSMENT'],
    });
  }
}

function checkMultipleMaterialDeficiencies(
  flags: ExplosionFlag[],
  modules: ModuleInstance[]
): void {
  const materialDefCount = modules.filter((m) => m.outcome === 'material_def').length;

  if (materialDefCount >= 2) {
    const modulesWithDeficiencies = modules
      .filter((m) => m.outcome === 'material_def')
      .map((m) => m.module_key);

    flags.push({
      id: 'EX-HI-03',
      level: 'high',
      title: 'Multiple modules flagged as material deficiencies',
      detail: `${materialDefCount} modules are marked with material deficiencies, indicating systemic compliance issues across the DSEAR assessment.`,
      relatedModules: modulesWithDeficiencies,
    });
  }
}

function checkModerateTriggers(
  flags: ExplosionFlag[],
  modules: ModuleInstance[]
): void {
  const infoGapCount = modules.filter((m) => m.outcome === 'info_gap').length;

  if (infoGapCount >= 3) {
    const modulesWithGaps = modules
      .filter((m) => m.outcome === 'info_gap')
      .map((m) => m.module_key);

    flags.push({
      id: 'EX-MD-01',
      level: 'moderate',
      title: 'Multiple information gaps limit assurance',
      detail: `${infoGapCount} modules are marked with information gaps. Multiple gaps limit the overall assurance that can be provided regarding explosion risk management.`,
      relatedModules: modulesWithGaps,
    });
  }
}

function determineOverallCriticality(
  criticalCount: number,
  highCount: number,
  moderateCount: number
): ExplosionCriticality {
  if (criticalCount > 0) {
    return 'Critical';
  }

  if (highCount >= 2) {
    return 'High';
  }

  if (highCount === 1 || moderateCount >= 2) {
    return 'Moderate';
  }

  if (moderateCount === 1) {
    return 'Moderate';
  }

  return 'Low';
}

export function deriveExplosionSeverity(context: {
  modules: ModuleInstance[];
}): ExplosionSeverityResult {
  // Normalize module keys to handle aliases and legacy naming
  const normalized = normalizeDsearModules(context.modules);
  const flags: ExplosionFlag[] = [];

  const dsear1 = normalized.find((m) => m.module_key === 'DSEAR_1_SUBSTANCES');
  const dsear2 = normalized.find((m) => m.module_key === 'DSEAR_2_PROCESS_RELEASES');
  const dsear3 = normalized.find((m) => m.module_key === 'DSEAR_3_HAC');
  const dsear4 = normalized.find((m) => m.module_key === 'DSEAR_4_IGNITION_SOURCES');
  const dsear5 = normalized.find((m) => m.module_key === 'DSEAR_5_EXPLOSION_PROTECTION');
  const dsear6 = normalized.find((m) => m.module_key === 'DSEAR_6_RISK_ASSESSMENT');

  checkCriticalTriggers(flags, dsear1, dsear2, dsear3, dsear4, dsear5);
  checkHighTriggers(flags, dsear2, dsear4, dsear6, normalized);
  checkModerateTriggers(flags, normalized);

  flags.sort((a, b) => {
    const levelOrder: Record<string, number> = {
      critical: 3,
      high: 2,
      moderate: 1,
    };
    return levelOrder[b.level] - levelOrder[a.level];
  });

  if (flags.length === 0) {
    return {
      level: 'low',
      priority: 'P4',
      triggerId: 'EX-LOW-01',
      triggerText: 'Advisory improvement identified during assessment.',
    };
  }

  const topFlag = flags[0];
  const priority = topFlag.level === 'critical' ? 'P1' :
                   topFlag.level === 'high' ? 'P2' :
                   topFlag.level === 'moderate' ? 'P3' : 'P4';

  return {
    level: topFlag.level,
    priority,
    triggerId: topFlag.id,
    triggerText: topFlag.detail,
  };
}
