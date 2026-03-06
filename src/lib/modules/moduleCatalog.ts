export interface ModuleDefinition {
  name: string;
  docTypes: string[];
  order: number;
  type?: 'input' | 'derived';
  hidden?: boolean; // If true, hide from navigation but allow programmatic access
  deprecated?: boolean;
  outcomeCategory?: 'critical' | 'governance'; // Determines outcome UI and scoring impact
}

export interface ModuleInstanceLike {
  id: string;
  module_key: string;
  [key: string]: unknown;
}

export const MODULE_CATALOG: Record<string, ModuleDefinition> = {
  RISK_ENGINEERING: {
    name: 'RE-00 – Summary',
    docTypes: ['RE'],
    order: 0,
    type: 'input',
  },
  RE_01_DOC_CONTROL: {
    name: 'RE-01 – Document Control',
    docTypes: ['RE'],
    order: 1,
    type: 'input',
  },
  RE_02_CONSTRUCTION: {
    name: 'RE-02 – Construction',
    docTypes: ['RE'],
    order: 2,
    type: 'input',
  },
  RE_03_OCCUPANCY: {
    name: 'RE-03 – Occupancy',
    docTypes: ['RE'],
    order: 3,
    type: 'input',
  },
  RE_07_NATURAL_HAZARDS: {
    name: 'RE-05 – Exposures',
    docTypes: ['RE'],
    order: 4,
    type: 'input',
  },
  RE_06_FIRE_PROTECTION: {
    name: 'RE-06 – Fire Protection',
    docTypes: ['RE'],
    order: 5,
    type: 'input',
  },
  RE_08_UTILITIES: {
    name: 'RE-06 – Utilities & Critical Services',
    docTypes: ['RE'],
    order: 6,
    type: 'input',
  },
  RE_09_MANAGEMENT: {
    name: 'RE-07 – Management Systems',
    docTypes: ['RE'],
    order: 7,
    type: 'input',
  },
  RE_12_LOSS_VALUES: {
    name: 'RE-08 – Loss & Values',
    docTypes: ['RE'],
    order: 8,
    type: 'input',
  },
  RE_13_RECOMMENDATIONS: {
    name: 'RE-09 – Recommendations',
    docTypes: ['RE'],
    order: 9,
    type: 'input',
  },
  RE_10_SITE_PHOTOS: {
    name: 'RE-10 – Supporting Documentation',
    docTypes: ['RE'],
    order: 10,
    type: 'input',
  },
  RE_14_DRAFT_OUTPUTS: {
    name: 'RE-11 - Summary & Key Findings',
    docTypes: ['RE'],
    order: 999,
    type: 'derived',
    hidden: true, // Hidden from navigation - RISK_ENGINEERING routes to this component
  },


  A1_DOC_CONTROL: {
    name: 'A1 - Document Control & Governance',
    docTypes: ['FRA', 'FSD', 'DSEAR'],
    order: 1,
    type: 'input',
    outcomeCategory: 'governance',
  },
  A2_BUILDING_PROFILE: {
    name: 'A2 - Building Profile',
    docTypes: ['FRA', 'FSD', 'DSEAR'],
    order: 2,
    type: 'input',
    outcomeCategory: 'governance', // Context/inputs - governance assessment
  },
  A3_PERSONS_AT_RISK: {
    name: 'A3 - Occupancy & Persons at Risk',
    docTypes: ['FRA', 'FSD', 'DSEAR'],
    order: 3,
    type: 'input',
    outcomeCategory: 'governance', // Context/inputs - governance assessment
  },
  FRA_6_MANAGEMENT_SYSTEMS: {
    name: 'FRA-6 - Management Systems',
    docTypes: ['FRA'],
    order: 4,
    type: 'input',
    outcomeCategory: 'governance',
  },
  FRA_7_EMERGENCY_ARRANGEMENTS: {
    name: 'FRA-7 - Emergency Arrangements',
    docTypes: ['FRA'],
    order: 5,
    type: 'input',
    outcomeCategory: 'critical', // Operational life safety
  },
  A7_REVIEW_ASSURANCE: {
    name: 'A7 - Review & Assurance',
    docTypes: ['FRA'],
    order: 7,
    type: 'input',
    outcomeCategory: 'governance',
  },
  FRA_1_HAZARDS: {
    name: 'FRA-1 - Hazards & Ignition Sources',
    docTypes: ['FRA'],
    order: 10,
    type: 'input',
    outcomeCategory: 'critical', // Ignition sources + EICR
  },
  FRA_2_ESCAPE_ASIS: {
    name: 'FRA-2 - Means of Escape (As-Is)',
    docTypes: ['FRA'],
    order: 11,
    type: 'input',
    outcomeCategory: 'critical', // Life safety - means of escape
  },
  FRA_3_PROTECTION_ASIS: {
    name: 'FRA-3 - Fire Protection (As-Is)',
    docTypes: ['FRA'],
    order: 12,
    type: 'input',
    deprecated: true,
    outcomeCategory: 'critical',
  },
  FRA_3_ACTIVE_SYSTEMS: {
    name: 'FRA-3 – Active Fire Protection (As-Is)',
    docTypes: ['FRA'],
    order: 12,
    type: 'input',
    outcomeCategory: 'critical', // Detection, alarm, lighting
  },
  FRA_4_PASSIVE_PROTECTION: {
    name: 'FRA-4 – Passive Fire Protection (As-Is)',
    docTypes: ['FRA'],
    order: 13,
    type: 'input',
    outcomeCategory: 'critical', // Compartmentation
  },
  FRA_8_FIREFIGHTING_EQUIPMENT: {
    name: 'FRA-8 – Firefighting Equipment (As-Is)',
    docTypes: ['FRA'],
    order: 14,
    type: 'input',
    outcomeCategory: 'critical', // Critical for fixed firefighting facilities
  },
  FRA_5_EXTERNAL_FIRE_SPREAD: {
    name: 'FRA-5 - External Fire Spread',
    docTypes: ['FRA'],
    order: 15,
    type: 'input',
    outcomeCategory: 'critical', // Life safety - external spread
  },
  FRA_90_SIGNIFICANT_FINDINGS: {
    name: 'FRA-90 - Significant Findings (Summary)',
    docTypes: ['FRA'],
    order: 16,
    type: 'derived',
    outcomeCategory: 'critical', // Summary of critical findings
  },
  FSD_1_REG_BASIS: {
    name: 'FSD-1 - Regulatory Basis',
    docTypes: ['FSD'],
    order: 20,
    type: 'input',
    outcomeCategory: 'governance', // Regulatory framework documentation
  },
  FSD_2_EVAC_STRATEGY: {
    name: 'FSD-2 - Evacuation Strategy',
    docTypes: ['FSD'],
    order: 21,
    type: 'input',
    outcomeCategory: 'critical', // Life safety - evacuation
  },
  FSD_3_ESCAPE_DESIGN: {
    name: 'FSD-3 - Escape Design',
    docTypes: ['FSD'],
    order: 22,
    type: 'input',
    outcomeCategory: 'critical', // Life safety - escape design
  },
  FSD_4_PASSIVE_PROTECTION: {
    name: 'FSD-4 - Passive Fire Protection',
    docTypes: ['FSD'],
    order: 23,
    type: 'input',
    outcomeCategory: 'critical', // Compartmentation, structural protection
  },
  FSD_5_ACTIVE_SYSTEMS: {
    name: 'FSD-5 - Active Fire Systems',
    docTypes: ['FSD'],
    order: 24,
    type: 'input',
    outcomeCategory: 'critical', // Detection, alarm, suppression
  },
  FSD_6_FRS_ACCESS: {
    name: 'FSD-6 - Fire & Rescue Service Access',
    docTypes: ['FSD'],
    order: 25,
    type: 'input',
    outcomeCategory: 'critical', // Fire service access
  },
  FSD_7_DRAWINGS: {
    name: 'FSD-7 - Drawings & Schedules',
    docTypes: ['FSD'],
    order: 26,
    type: 'input',
    outcomeCategory: 'governance', // Documentation
  },
  FSD_8_SMOKE_CONTROL: {
    name: 'FSD-8 - Smoke Control',
    docTypes: ['FSD'],
    order: 27,
    type: 'input',
    outcomeCategory: 'critical', // Life safety - smoke control
  },
  FSD_9_CONSTRUCTION_PHASE: {
    name: 'FSD-9 - Construction Phase',
    docTypes: ['FSD'],
    order: 28,
    type: 'input',
    outcomeCategory: 'governance', // Process management
  },
  DSEAR_1_DANGEROUS_SUBSTANCES: {
    name: 'DSEAR-1 - Dangerous Substances Register',
    docTypes: ['DSEAR'],
    order: 30,
    type: 'input',
    outcomeCategory: 'critical', // Hazard identification
  },
  DSEAR_2_PROCESS_RELEASES: {
    name: 'DSEAR-2 - Process & Release Assessment',
    docTypes: ['DSEAR'],
    order: 31,
    type: 'input',
    outcomeCategory: 'critical', // Release scenarios
  },
  DSEAR_3_HAZARDOUS_AREA_CLASSIFICATION: {
    name: 'DSEAR-3 - Hazardous Area Classification',
    docTypes: ['DSEAR'],
    order: 32,
    type: 'input',
    outcomeCategory: 'critical', // Zone classification
  },
  DSEAR_4_IGNITION_SOURCES: {
    name: 'DSEAR-4 - Ignition Source Control',
    docTypes: ['DSEAR'],
    order: 33,
    type: 'input',
    outcomeCategory: 'critical', // Ignition control
  },
  DSEAR_5_EXPLOSION_PROTECTION: {
    name: 'DSEAR-5 - Explosion Protection & Mitigation',
    docTypes: ['DSEAR'],
    order: 34,
    type: 'input',
    outcomeCategory: 'critical', // Protection systems
  },
  DSEAR_6_RISK_ASSESSMENT: {
    name: 'DSEAR-6 - Risk Assessment Table',
    docTypes: ['DSEAR'],
    order: 35,
    type: 'input',
    outcomeCategory: 'critical', // Risk assessment
  },
  DSEAR_10_HIERARCHY_OF_CONTROL: {
    name: 'DSEAR-10 - Hierarchy of Control',
    docTypes: ['DSEAR'],
    order: 36,
    type: 'input',
    outcomeCategory: 'governance', // Management approach
  },
  DSEAR_11_EXPLOSION_EMERGENCY_RESPONSE: {
    name: 'DSEAR-11 - Explosion Emergency Response',
    docTypes: ['DSEAR'],
    order: 37,
    type: 'input',
    outcomeCategory: 'critical', // Emergency response
  },
};

const MODULE_KEY_ALIASES: Record<string, string> = {
  A4_MANAGEMENT_CONTROLS: 'FRA_6_MANAGEMENT_SYSTEMS',
  A5_EMERGENCY_ARRANGEMENTS: 'FRA_7_EMERGENCY_ARRANGEMENTS',
  FRA_4_SIGNIFICANT_FINDINGS: 'FRA_90_SIGNIFICANT_FINDINGS',
};

function resolveModuleKey(moduleKey: string): string {
  return MODULE_KEY_ALIASES[moduleKey] ?? moduleKey;
}

const modulesWithoutType = Object.entries(MODULE_CATALOG).filter(
  ([, def]) => !def.type
);

if (modulesWithoutType.length > 0) {
  throw new Error(
    `Every module must define a type. Missing: ${modulesWithoutType
      .map(([key]) => key)
      .join(', ')}`
  );
}

export function getModuleName(moduleKey: string): string {
  const resolvedKey = resolveModuleKey(moduleKey);
  return MODULE_CATALOG[resolvedKey]?.name || moduleKey;
}

export function sortModulesByOrder(
  modules: Array<{ module_key: string }>
): Array<{ module_key: string }> {
  return [...modules].sort((a, b) => {
    const orderA = MODULE_CATALOG[resolveModuleKey(a.module_key)]?.order ?? 999;
    const orderB = MODULE_CATALOG[resolveModuleKey(b.module_key)]?.order ?? 999;
    return orderA - orderB;
  });
}

export function getModuleKeysForDocType(
  docType: string,
  options?: { includeDeprecated?: boolean; includeDeprecatedIfPresent?: Iterable<string> }
): string[] {
  const includeDeprecated = options?.includeDeprecated ?? false;
  const includeDeprecatedIfPresent = new Set(options?.includeDeprecatedIfPresent ?? []);

  return Object.entries(MODULE_CATALOG)
    .filter(([key, def]) => {
      if (!def.docTypes.includes(docType) || def.hidden) return false;
      if (!def.deprecated) return true;
      if (includeDeprecated) return true;
      return includeDeprecatedIfPresent.has(key);
    })
    .sort((a, b) => (a[1].order ?? 999) - (b[1].order ?? 999))
    .map(([key]) => key);
}

export function filterDeprecatedModuleKeysForNavigation(
  moduleKeys: string[],
  documentModuleKeys: Iterable<string>
): string[] {
  const presentKeys = new Set(documentModuleKeys);

  return moduleKeys.filter((moduleKey) => {
    const def = MODULE_CATALOG[moduleKey];
    if (!def?.deprecated) return true;
    return presentKeys.has(moduleKey);
  });
}

/**
 * Get the outcome category for a module (critical vs governance)
 * Defaults to 'governance' if not found (safer than defaulting to critical)
 *
 * Regression guard: A1 modules must always resolve to 'governance'
 */
export function getModuleOutcomeCategory(moduleKey: string): 'critical' | 'governance' {
  // Guard against undefined/invalid input - default to governance (safe fallback)
  if (!moduleKey || typeof moduleKey !== 'string') {
    return 'governance';
  }

  const resolvedKey = resolveModuleKey(moduleKey);
  const category = MODULE_CATALOG[resolvedKey]?.outcomeCategory || 'governance';

  // DEV GUARD: A1 must always be governance (safe check for string)
  if (
    import.meta.env.DEV &&
    typeof resolvedKey === 'string' &&
    resolvedKey.startsWith('A1_') &&
    category !== 'governance'
  ) {
    console.warn(
      '⚠️ REGRESSION: A1 module should have outcomeCategory: "governance"',
      { moduleKey, resolvedKey, category }
    );
  }

  return category;
}

/**
 * Normalized outcome values used for scoring and PDF
 */
export type NormalizedOutcome =
  | 'compliant'
  | 'minor_def'
  | 'material_def'
  | 'info_gap'
  | 'na';

/**
 * Outcome options for critical modules
 */
export const CRITICAL_OUTCOME_OPTIONS = [
  { value: 'Compliant', label: 'Compliant' },
  { value: 'Minor Deficiency', label: 'Minor Deficiency' },
  { value: 'Material Deficiency', label: 'Material Deficiency' },
  { value: 'Information Gap', label: 'Information Gap' },
  { value: 'Not Applicable', label: 'Not Applicable' },
] as const;

/**
 * Outcome options for governance modules
 */
export const GOVERNANCE_OUTCOME_OPTIONS = [
  { value: 'Adequate', label: 'Adequate' },
  { value: 'Improvement Recommended', label: 'Improvement Recommended' },
  { value: 'Significant Improvement Required', label: 'Significant Improvement Required' },
  { value: 'Information Incomplete', label: 'Information Incomplete' },
  { value: 'Not Applicable', label: 'Not Applicable' },
] as const;

/**
 * Normalize an outcome value to a standard format for scoring/PDF
 */
export function normalizeOutcome(
  outcome: string | null | undefined,
  category: 'critical' | 'governance'
): NormalizedOutcome | '' | string {
  if (!outcome) return '';

  const normalized = outcome.toLowerCase().trim();

  // Preserve canonical values
  if (normalized === 'compliant') return 'compliant';
  if (normalized === 'minor_def') return 'minor_def';
  if (normalized === 'material_def') return 'material_def';
  if (normalized === 'info_gap' || normalized === 'information_incomplete') return 'info_gap';
  if (
    normalized === 'na' ||
    normalized === 'n/a' ||
    normalized === 'not_applicable' ||
    normalized === 'not applicable'
  ) {
    return 'na';
  }

  // Critical mapping
  if (category === 'critical') {
    if (normalized === 'minor deficiency') return 'minor_def';
    if (normalized === 'material deficiency') return 'material_def';
    if (normalized === 'information gap') return 'info_gap';
  }

  // Governance mapping
  if (category === 'governance') {
    if (normalized === 'adequate') return 'compliant';
    if (normalized === 'improvement recommended') return 'minor_def';
    if (normalized === 'significant improvement required') return 'material_def';
    if (normalized === 'information incomplete') return 'info_gap';
  }

  return normalized;
}

// Legacy RE keys that should normalize to canonical MODULE_CATALOG keys
export const RE_MODULE_KEY_MAP: Record<string, string> = {
  RE_10_PROCESS_RISK: 'RE_10_SITE_PHOTOS',
};

export function normalizeReModuleKey(moduleKey: string): string | null {
  const mapped = RE_MODULE_KEY_MAP[moduleKey] ?? moduleKey;
  return MODULE_CATALOG[mapped] ? mapped : null;
}

export function getReModulesForDocument(
  moduleInstances: ModuleInstanceLike[],
  opts?: { documentId?: string | null }
): ModuleInstanceLike[] {
  const instances = Array.isArray(moduleInstances) ? moduleInstances : [];
  const canonicalKeys = getModuleKeysForDocType('RE');
  const canonicalSet = new Set(canonicalKeys);
  const byKey = new Map<string, ModuleInstanceLike>();

  for (const instance of instances) {
    const normalizedKey = normalizeReModuleKey(instance.module_key);

    if (!normalizedKey || !canonicalSet.has(normalizedKey)) {
      if (import.meta.env.DEV) {
        console.warn('[getReModulesForDocument] Ignoring unmatched RE module_instance', {
          document_id: opts?.documentId ?? null,
          module_key: instance.module_key,
        });
      }
      continue;
    }

    const mapped = { ...instance, module_key: normalizedKey };
    const existing = byKey.get(normalizedKey);

    // Prefer the row that already uses the canonical key when both exist
    if (!existing || (existing.module_key !== normalizedKey && instance.module_key === normalizedKey)) {
      byKey.set(normalizedKey, mapped);
    }
  }

  return canonicalKeys
    .map((key) => byKey.get(key))
    .filter((module): module is ModuleInstanceLike => Boolean(module));
}

export function getDsearSpecificModuleKeys(): Set<string> {
  return new Set(
    getModuleKeysForDocType('DSEAR').filter((moduleKey) => moduleKey.startsWith('DSEAR_'))
  );
}

export function getFireRiskModuleKeys(): Set<string> {
  return new Set([
    ...getModuleKeysForDocType('FRA'),
    ...getModuleKeysForDocType('FSD'),
  ]);
}
