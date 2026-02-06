export interface ModuleDefinition {
  name: string;
  docTypes: string[];
  order: number;
  hidden?: boolean; // If true, hide from navigation but allow programmatic access
}

export const MODULE_CATALOG: Record<string, ModuleDefinition> = {
  RISK_ENGINEERING: {
    name: 'RE-00 – Summary',
    docTypes: ['RE'],
    order: 0,
  },
  RE_01_DOC_CONTROL: {
    name: 'RE-01 – Document Control',
    docTypes: ['RE'],
    order: 1,
  },
  RE_02_CONSTRUCTION: {
    name: 'RE-02 – Construction',
    docTypes: ['RE'],
    order: 2,
  },
  RE_03_OCCUPANCY: {
    name: 'RE-03 – Occupancy',
    docTypes: ['RE'],
    order: 3,
  },
  RE_07_NATURAL_HAZARDS: {
    name: 'RE-05 – Exposures',
    docTypes: ['RE'],
    order: 4,
  },
  RE_06_FIRE_PROTECTION: {
    name: 'RE-06 – Fire Protection',
    docTypes: ['RE'],
    order: 5,
  },
  RE_08_UTILITIES: {
    name: 'RE-06 – Utilities & Critical Services',
    docTypes: ['RE'],
    order: 6,
  },
  RE_09_MANAGEMENT: {
    name: 'RE-07 – Management Systems',
    docTypes: ['RE'],
    order: 7,
  },
  RE_12_LOSS_VALUES: {
    name: 'RE-08 – Loss & Values',
    docTypes: ['RE'],
    order: 8,
  },
  RE_13_RECOMMENDATIONS: {
    name: 'RE-09 – Recommendations',
    docTypes: ['RE'],
    order: 9,
  },
  RE_10_SITE_PHOTOS: {
    name: 'RE-10 – Supporting Documentation',
    docTypes: ['RE'],
    order: 10,
  },
  RE_14_DRAFT_OUTPUTS: {
    name: 'RE-11 - Summary & Key Findings',
    docTypes: ['RE'],
    order: 999,
    hidden: true, // Hidden from navigation - RISK_ENGINEERING routes to this component
  },


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

export function sortModulesByOrder(
  modules: Array<{ module_key: string }>
): Array<{ module_key: string }> {
  return [...modules].sort((a, b) => {
    const orderA = MODULE_CATALOG[a.module_key]?.order ?? 999;
    const orderB = MODULE_CATALOG[b.module_key]?.order ?? 999;
    return orderA - orderB;
  });
}

export function getModuleKeysForDocType(docType: string): string[] {
  return Object.entries(MODULE_CATALOG)
    .filter(([_, def]) => def.docTypes.includes(docType) && !def.hidden)
    .sort((a, b) => (a[1].order ?? 999) - (b[1].order ?? 999))
    .map(([key]) => key);
}

/**
 * Single source of truth for module navigation paths.
 * Returns the correct URL path for a given module instance.
 */
export function getModuleNavigationPath(
  documentId: string,
  moduleKey: string,
  moduleInstanceId: string
): string {
  // All modules use the workspace route with module instance ID
  return `/documents/${documentId}/workspace?m=${moduleInstanceId}`;
}
