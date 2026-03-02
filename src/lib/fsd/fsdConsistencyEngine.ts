export type AssuranceSeverity = 'critical' | 'major' | 'info';

export interface AssuranceFlag {
  id: string;
  severity: AssuranceSeverity;
  title: string;
  detail: string;
  relatedModules: string[];
}

export interface FsdConsistencyResult {
  flags: AssuranceFlag[];
}

interface ModuleInstance {
  module_key: string;
  outcome: string | null;
  assessor_notes?: string;
  data: Record<string, any>;
}

export function runFsdConsistencyChecks(context: {
  modules: ModuleInstance[];
}): FsdConsistencyResult {
  const { modules } = context;
  const flags: AssuranceFlag[] = [];

  const fsd1 = modules.find((m) => m.module_key === 'FSD_1_REG_BASIS');
  const fsd2 = modules.find((m) => m.module_key === 'FSD_2_EVAC_STRATEGY');
  const a2 = modules.find((m) => m.module_key === 'A2_BUILDING_PROFILE');
  const fsd4 = modules.find((m) => m.module_key === 'FSD_4_PASSIVE_PROTECTION');
  const fsd5 = modules.find((m) => m.module_key === 'FSD_5_ACTIVE_SYSTEMS');
  const fsd6 = modules.find((m) => m.module_key === 'FSD_6_FRS_ACCESS');
  const fsd8 = modules.find((m) => m.module_key === 'FSD_8_SMOKE_CONTROL');

  checkEvacuationStrategyDependencies(flags, fsd2, fsd8, fsd4);
  checkHeightFirefighting(flags, a2, fsd6);
  checkGuidanceRouteConsistency(flags, fsd1, modules);
  checkSmokeControlConsistency(flags, fsd8);
  checkSuppressionConsistency(flags, fsd5);
  checkDeviationsWithoutJustification(flags, fsd1);
  checkInformationGapConcentration(flags, modules);

  flags.sort((a, b) => {
    const severityOrder: Record<AssuranceSeverity, number> = {
      critical: 3,
      major: 2,
      info: 1,
    };

    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[b.severity] - severityOrder[a.severity];
    }

    return a.title.length - b.title.length;
  });

  return { flags };
}

function checkEvacuationStrategyDependencies(
  flags: AssuranceFlag[],
  fsd2: ModuleInstance | undefined,
  fsd8: ModuleInstance | undefined,
  fsd4: ModuleInstance | undefined
): void {
  if (!fsd2) return;

  const evacuationStrategy = fsd2.data.evacuation_strategy;

  if (evacuationStrategy === 'phased' || evacuationStrategy === 'progressive_horizontal') {
    const smokeControlMissing =
      !fsd8 ||
      fsd8.outcome === 'info_gap' ||
      !fsd8.data.smoke_control_present ||
      fsd8.data.smoke_control_present === 'unknown';

    if (smokeControlMissing) {
      flags.push({
        id: 'CHK-ES-01',
        severity: 'critical',
        title: 'Evacuation strategy depends on smoke control',
        detail:
          'Evacuation strategy is phased or progressive horizontal, which depends on smoke control and management measures. However, smoke control strategy is not evidenced or marked as information gap.',
        relatedModules: ['FSD_2_EVAC_STRATEGY', 'FSD_8_SMOKE_CONTROL'],
      });
    }
  }

  if (evacuationStrategy === 'stay_put') {
    const compartmentationMissing =
      !fsd4 ||
      fsd4.outcome === 'info_gap' ||
      !fsd4.data.compartmentation_strategy ||
      fsd4.data.compartmentation_strategy.trim().length < 20;

    if (compartmentationMissing) {
      flags.push({
        id: 'CHK-ES-02',
        severity: 'major',
        title: 'Stay put strategy requires robust compartmentation',
        detail:
          'Evacuation strategy is stay put, which requires robust compartmentation to contain fire and smoke. However, compartmentation strategy is not adequately evidenced or marked as information gap.',
        relatedModules: ['FSD_2_EVAC_STRATEGY', 'FSD_4_PASSIVE_PROTECTION'],
      });
    }
  }
}

function checkHeightFirefighting(
  flags: AssuranceFlag[],
  a2: ModuleInstance | undefined,
  fsd6: ModuleInstance | undefined
): void {
  if (!a2) return;

  const storeysExact = parseInt(a2.data.storeys_exact, 10);
  const storeysBand = a2.data.storeys_band;
  const heightM = parseFloat(a2.data.height_m);

  let isHighRise = false;
  if (!isNaN(storeysExact) && storeysExact >= 6) {
    isHighRise = true;
  } else if (storeysBand === '6-10' || storeysBand === '11-18' || storeysBand === '18+') {
    isHighRise = true;
  } else if (!isNaN(heightM) && heightM >= 18) {
    isHighRise = true;
  }

  if (isHighRise) {
    const firefightingMissing =
      !fsd6 ||
      fsd6.outcome === 'info_gap' ||
      !fsd6.data.fire_service_facilities_strategy ||
      fsd6.data.fire_service_facilities_strategy.trim().length < 20;

    if (firefightingMissing) {
      flags.push({
        id: 'CHK-FF-01',
        severity: 'major',
        title: 'Building height suggests firefighting facilities required',
        detail:
          'Building height or storey count suggests firefighting facilities are likely relevant (6+ storeys or 18m+ height). However, the strategy does not adequately address firefighting facilities.',
        relatedModules: ['A2_BUILDING_PROFILE', 'FSD_6_FRS_ACCESS'],
      });
    }
  }
}

function checkGuidanceRouteConsistency(
  flags: AssuranceFlag[],
  fsd1: ModuleInstance | undefined,
  modules: ModuleInstance[]
): void {
  if (!fsd1) return;

  const regulatoryFramework = fsd1.data.regulatory_framework;

  if (regulatoryFramework === 'BS7974') {
    const hasModellingModule = modules.some(
      (m) =>
        m.module_key.includes('SCENARIO') ||
        m.module_key.includes('MODELLING') ||
        (m.data.design_fire_scenarios && m.data.design_fire_scenarios.trim().length > 20) ||
        (m.data.aset_rset_summary && m.data.aset_rset_summary.trim().length > 20)
    );

    if (!hasModellingModule) {
      flags.push({
        id: 'CHK-GD-01',
        severity: 'info',
        title: 'Engineered route selected but modelling not evidenced',
        detail:
          'Regulatory framework is BS 7974 (engineered approach), but design fire scenarios, ASET/RSET calculations, or modelling assumptions are not evidenced.',
        relatedModules: ['FSD_1_REG_BASIS'],
      });
    }
  }

  if (regulatoryFramework === 'ADB') {
    const hasEngineeredDependencies = modules.some(
      (m) =>
        (m.data.smoke_control_present === 'yes' && m.data.system_type === 'mechanical') ||
        (m.data.sprinkler_provision === 'yes' || m.data.sprinkler_provision === 'partial')
    );

    if (hasEngineeredDependencies) {
      const hasJustification =
        fsd1.data.design_objectives_notes &&
        fsd1.data.design_objectives_notes.includes('engineered');

      if (!hasJustification) {
        flags.push({
          id: 'CHK-GD-02',
          severity: 'info',
          title: 'Prescriptive route but strategy relies on engineered measures',
          detail:
            'Regulatory framework is prescriptive (building regulations compliance route), but the strategy appears to rely on engineered measures (mechanical smoke control or sprinklers). Ensure justification for this approach is documented.',
          relatedModules: ['FSD_1_REG_BASIS'],
        });
      }
    }
  }
}

function checkSmokeControlConsistency(
  flags: AssuranceFlag[],
  fsd8: ModuleInstance | undefined
): void {
  if (!fsd8) return;

  const smokeControlPresent = fsd8.data.smoke_control_present;
  const systemType = fsd8.data.system_type;

  if (smokeControlPresent === 'yes' && systemType === 'mechanical') {
    const commissioningMissing =
      !fsd8.data.maintenance_testing_assumptions ||
      fsd8.data.maintenance_testing_assumptions.trim().length < 20;

    const managementOutcomeGap = fsd8.outcome === 'info_gap';

    if (commissioningMissing || managementOutcomeGap) {
      flags.push({
        id: 'CHK-SC-01',
        severity: 'major',
        title: 'Mechanical smoke control without commissioning evidence',
        detail:
          'Mechanical smoke control system is declared, but commissioning, maintenance, and management arrangements are not adequately evidenced.',
        relatedModules: ['FSD_8_SMOKE_CONTROL'],
      });
    }
  }
}

function checkSuppressionConsistency(
  flags: AssuranceFlag[],
  fsd5: ModuleInstance | undefined
): void {
  if (!fsd5) return;

  const sprinklerProvision = fsd5.data.sprinkler_provision;

  if (sprinklerProvision === 'yes' || sprinklerProvision === 'partial') {
    const standardUnknown =
      !fsd5.data.sprinkler_standard || fsd5.data.sprinkler_standard === 'unknown';

    const coverageUndocumented =
      !fsd5.data.sprinkler_notes || fsd5.data.sprinkler_notes.trim().length < 20;

    if (standardUnknown || coverageUndocumented) {
      flags.push({
        id: 'CHK-SP-01',
        severity: 'major',
        title: 'Suppression system without adequate specification',
        detail:
          'Sprinkler or suppression system is present, but coverage, standard, or design assumptions are not adequately documented.',
        relatedModules: ['FSD_5_ACTIVE_SYSTEMS'],
      });
    }
  }
}

function checkDeviationsWithoutJustification(
  flags: AssuranceFlag[],
  fsd1: ModuleInstance | undefined
): void {
  if (!fsd1) return;

  const deviations = fsd1.data.deviations || [];

  const unjustifiedDeviations = deviations.filter(
    (d: any) =>
      (d.topic || d.deviation) && (!d.justification || d.justification.trim().length < 10)
  );

  if (unjustifiedDeviations.length > 0) {
    flags.push({
      id: 'CHK-DV-01',
      severity: 'major',
      title: 'Deviations recorded without justification',
      detail: `${unjustifiedDeviations.length} deviation(s) recorded without adequate justification. Design assurance is limited when departures from guidance are not justified.`,
      relatedModules: ['FSD_1_REG_BASIS'],
    });
  }
}

function checkInformationGapConcentration(
  flags: AssuranceFlag[],
  modules: ModuleInstance[]
): void {
  const infoGapModules = modules.filter((m) => m.outcome === 'info_gap');

  if (infoGapModules.length > 3) {
    const severity: AssuranceSeverity = infoGapModules.length > 5 ? 'major' : 'info';

    flags.push({
      id: 'CHK-IG-01',
      severity,
      title: 'Multiple information gaps limit assurance',
      detail: `${infoGapModules.length} modules are marked with information gaps. Multiple information gaps significantly limit the overall assurance that can be provided for this strategy.`,
      relatedModules: infoGapModules.map((m) => m.module_key),
    });
  }
}
