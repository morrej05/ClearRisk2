/**
 * Section Code Registry
 *
 * Defines standardized section codes for each survey framework.
 * Naming convention: [Framework]_[Number]_[Name]
 *
 * Framework Prefixes:
 * - FP = Fire Property
 * - FR = Fire Risk Assessment
 * - AT = ATEX
 */

export interface SectionConfig {
  code: string;
  name: string;
  required: boolean;
  availableInAbridged?: boolean;
}

export const FIRE_PROPERTY_SECTIONS: SectionConfig[] = [
  { code: 'FP_01_Location', name: 'Location & Occupancy', required: true, availableInAbridged: true },
  { code: 'FP_02_Construction', name: 'Construction', required: true, availableInAbridged: true },
  { code: 'FP_03_Compartmentation', name: 'Compartmentation', required: true, availableInAbridged: true },
  { code: 'FP_04_ExternalFire', name: 'External Fire Spread', required: true, availableInAbridged: true },
  { code: 'FP_05_InternalFinish', name: 'Internal Finish', required: true, availableInAbridged: true },
  { code: 'FP_06_FireProtection', name: 'Fire Protection Systems', required: false },
  { code: 'FP_07_FirefightingAccess', name: 'Firefighting Access & Equipment', required: false },
  { code: 'FP_08_MeansOfEscape', name: 'Means of Escape', required: false },
  { code: 'FP_09_Management', name: 'Fire Safety Management', required: false },
  { code: 'FP_10_ProcessRisk', name: 'Process Risk Assessment', required: true, availableInAbridged: true },
  { code: 'FP_11_Summary', name: 'Summary & Recommendations', required: true, availableInAbridged: true },
];

export const FRA_SECTIONS: SectionConfig[] = [
  { code: 'FR_01_Introduction', name: 'Introduction', required: true },
  { code: 'FR_02_FireHazards', name: 'Fire Hazards', required: true },
  { code: 'FR_03_PeopleAtRisk', name: 'People at Risk', required: true },
  { code: 'FR_04_EvaluateReduce', name: 'Evaluate & Reduce', required: true },
  { code: 'FR_05_RecordPlan', name: 'Record, Plan, Train', required: true },
];

export const ATEX_SECTIONS: SectionConfig[] = [
  { code: 'AT_01_Zoning', name: 'Hazardous Area Zoning', required: true },
  { code: 'AT_02_IgnitionSources', name: 'Ignition Source Assessment', required: true },
  { code: 'AT_03_EquipmentClassification', name: 'Equipment Classification', required: true },
  { code: 'AT_04_ControlMeasures', name: 'Control Measures', required: true },
];

export function getSectionsByFramework(
  frameworkType: 'fire_property' | 'fire_risk_assessment' | 'atex',
  surveyType?: 'Full' | 'Abridged'
): SectionConfig[] {
  let sections: SectionConfig[];

  switch (frameworkType) {
    case 'fire_property':
      sections = FIRE_PROPERTY_SECTIONS;
      break;
    case 'fire_risk_assessment':
      sections = FRA_SECTIONS;
      break;
    case 'atex':
      sections = ATEX_SECTIONS;
      break;
    default:
      sections = FIRE_PROPERTY_SECTIONS;
  }

  // Filter for abridged surveys if specified
  if (surveyType === 'Abridged') {
    return sections.filter(s => s.availableInAbridged);
  }

  return sections;
}

export function getSectionName(sectionCode: string): string {
  const allSections = [
    ...FIRE_PROPERTY_SECTIONS,
    ...FRA_SECTIONS,
    ...ATEX_SECTIONS,
  ];

  const section = allSections.find(s => s.code === sectionCode);
  return section?.name || sectionCode;
}
