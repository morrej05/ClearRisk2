export interface ModuleDefinition {
  name: string;
  docTypes: string[];
  order: number;
}

export const MODULE_CATALOG: Record<string, ModuleDefinition> = {
  A1_DOC_CONTROL: {
    name: 'A1 - Document Control & Governance',
    docTypes: ['FRA', 'FSD', 'DSEAR'],
    order: 1,
  },
  A2_BUILDING_PROFILE: {
    name: 'A2 - Building Profile',
    docTypes: ['FRA', 'FSD', 'DSEAR'],
    order: 2,
  },
  A3_PERSONS_AT_RISK: {
    name: 'A3 - Occupancy & Persons at Risk',
    docTypes: ['FRA', 'FSD', 'DSEAR'],
    order: 3,
  },
  A4_MANAGEMENT_CONTROLS: {
    name: 'A4 - Management Systems',
    docTypes: ['FRA'],
    order: 4,
  },
  A5_EMERGENCY_ARRANGEMENTS: {
    name: 'A5 - Emergency Arrangements',
    docTypes: ['FRA'],
    order: 5,
  },
  A7_REVIEW_ASSURANCE: {
    name: 'A7 - Review & Assurance',
    docTypes: ['FRA'],
    order: 7,
  },
  FRA_1_HAZARDS: {
    name: 'FRA-1 - Hazards & Ignition Sources',
    docTypes: ['FRA'],
    order: 10,
  },
  FRA_2_ESCAPE_ASIS: {
    name: 'FRA-2 - Means of Escape (As-Is)',
    docTypes: ['FRA'],
    order: 11,
  },
  FRA_3_PROTECTION_ASIS: {
    name: 'FRA-3 - Fire Protection (As-Is)',
    docTypes: ['FRA'],
    order: 12,
  },
  FRA_5_EXTERNAL_FIRE_SPREAD: {
    name: 'FRA-5 - External Fire Spread',
    docTypes: ['FRA'],
    order: 13,
  },
  FRA_4_SIGNIFICANT_FINDINGS: {
    name: 'FRA-4 - Significant Findings (Summary)',
    docTypes: ['FRA'],
    order: 14,
  },
  FSD_1_REG_BASIS: {
    name: 'FSD-1 - Regulatory Basis',
    docTypes: ['FSD'],
    order: 20,
  },
  FSD_2_EVAC_STRATEGY: {
    name: 'FSD-2 - Evacuation Strategy',
    docTypes: ['FSD'],
    order: 21,
  },
  FSD_3_ESCAPE_DESIGN: {
    name: 'FSD-3 - Escape Design',
    docTypes: ['FSD'],
    order: 22,
  },
  FSD_4_PASSIVE_PROTECTION: {
    name: 'FSD-4 - Passive Fire Protection',
    docTypes: ['FSD'],
    order: 23,
  },
  FSD_5_ACTIVE_SYSTEMS: {
    name: 'FSD-5 - Active Fire Systems',
    docTypes: ['FSD'],
    order: 24,
  },
  FSD_6_FRS_ACCESS: {
    name: 'FSD-6 - Fire & Rescue Service Access',
    docTypes: ['FSD'],
    order: 25,
  },
  FSD_7_DRAWINGS: {
    name: 'FSD-7 - Drawings & Schedules',
    docTypes: ['FSD'],
    order: 26,
  },
  FSD_8_SMOKE_CONTROL: {
    name: 'FSD-8 - Smoke Control',
    docTypes: ['FSD'],
    order: 27,
  },
  FSD_9_CONSTRUCTION_PHASE: {
    name: 'FSD-9 - Construction Phase',
    docTypes: ['FSD'],
    order: 28,
  },
  DSEAR_1_DANGEROUS_SUBSTANCES: {
    name: 'DSEAR-1 - Dangerous Substances Register',
    docTypes: ['DSEAR'],
    order: 30,
  },
  DSEAR_2_PROCESS_RELEASES: {
    name: 'DSEAR-2 - Process & Release Assessment',
    docTypes: ['DSEAR'],
    order: 31,
  },
  DSEAR_3_HAZARDOUS_AREA_CLASSIFICATION: {
    name: 'DSEAR-3 - Hazardous Area Classification',
    docTypes: ['DSEAR'],
    order: 32,
  },
  DSEAR_4_IGNITION_SOURCES: {
    name: 'DSEAR-4 - Ignition Source Control',
    docTypes: ['DSEAR'],
    order: 33,
  },
  DSEAR_5_EXPLOSION_PROTECTION: {
    name: 'DSEAR-5 - Explosion Protection & Mitigation',
    docTypes: ['DSEAR'],
    order: 34,
  },
  DSEAR_6_RISK_ASSESSMENT: {
    name: 'DSEAR-6 - Risk Assessment Table',
    docTypes: ['DSEAR'],
    order: 35,
  },
  DSEAR_10_HIERARCHY_OF_CONTROL: {
    name: 'DSEAR-10 - Hierarchy of Control',
    docTypes: ['DSEAR'],
    order: 36,
  },
  DSEAR_11_EXPLOSION_EMERGENCY_RESPONSE: {
    name: 'DSEAR-11 - Explosion Emergency Response',
    docTypes: ['DSEAR'],
    order: 37,
  },
};

export function getModuleName(moduleKey: string): string {
  return MODULE_CATALOG[moduleKey]?.name || moduleKey;
}

export function sortModulesByOrder(modules: Array<{ module_key: string }>): Array<{ module_key: string }> {
  return [...modules].sort((a, b) => {
    const orderA = MODULE_CATALOG[a.module_key]?.order || 999;
    const orderB = MODULE_CATALOG[b.module_key]?.order || 999;
    return orderA - orderB;
  });
}
