/**
 * Fixed PAS-79 Aligned FRA Report Structure
 *
 * This defines the immutable section skeleton for Fire Risk Assessment PDFs.
 * Section numbers 1-14 are fixed and jurisdiction-agnostic.
 * Internal module keys are NOT printed in the PDF output.
 */

export interface PdfSection {
  id: number;
  title: string;
  moduleKeys: string[];
  description?: string;
}

/**
 * PAS-79:2020 Aligned Section Structure
 *
 * This structure aligns with PAS-79 fire risk assessment methodology
 * while maintaining flexibility for jurisdiction-specific requirements.
 */
export const FRA_REPORT_STRUCTURE: PdfSection[] = [
  {
    id: 1,
    title: "Report Details & Assessor Information",
    moduleKeys: [],
    description: "Cover page, version control, assessor credentials"
  },
  {
    id: 2,
    title: "Premises & General Information",
    moduleKeys: ["A2_BUILDING_PROFILE"],
    description: "Building description, construction, occupancy type"
  },
  {
    id: 3,
    title: "Occupants & Vulnerability",
    moduleKeys: ["A3_PERSONS_AT_RISK"],
    description: "Persons at risk, vulnerable groups, occupancy characteristics"
  },
  {
    id: 4,
    title: "Relevant Legislation & Duty Holder",
    moduleKeys: ["A1_DOC_CONTROL"],
    description: "Regulatory framework, responsible person duties"
  },
  {
    id: 5,
    title: "Fire Hazards & Ignition Sources",
    moduleKeys: ["FRA_1_HAZARDS"],
    description: "Identification of potential ignition sources and fire hazards"
  },
  {
    id: 6,
    title: "Means of Escape",
    moduleKeys: ["FRA_2_ESCAPE_ASIS"],
    description: "Escape routes, travel distances, signage, emergency lighting"
  },
  {
    id: 7,
    title: "Fire Detection, Alarm & Warning",
    moduleKeys: ["FRA_3_ACTIVE_SYSTEMS"],
    description: "Fire detection systems, alarm systems, warning arrangements"
  },
  {
    id: 8,
    title: "Emergency Lighting",
    moduleKeys: ["FRA_3_ACTIVE_SYSTEMS"],
    description: "Emergency lighting provision and adequacy"
  },
  {
    id: 9,
    title: "Passive Fire Protection (Compartmentation)",
    moduleKeys: ["FRA_4_PASSIVE_PROTECTION"],
    description: "Fire resistance, compartmentation, fire doors, fire stopping"
  },
  {
    id: 10,
    title: "Fixed Fire Suppression & Firefighting Facilities",
    moduleKeys: ["FRA_8_FIREFIGHTING_EQUIPMENT"],
    description: "Sprinklers, hose reels, fire extinguishers, firefighting equipment"
  },
  {
    id: 11,
    title: "Fire Safety Management & Procedures",
    moduleKeys: ["A4_MANAGEMENT_CONTROLS", "FRA_6_MANAGEMENT_SYSTEMS", "A5_EMERGENCY_ARRANGEMENTS", "FRA_7_EMERGENCY_ARRANGEMENTS", "A7_REVIEW_ASSURANCE"],
    description: "Management of fire safety, training, drills, maintenance, record keeping"
  },
  {
    id: 12,
    title: "External Fire Spread",
    moduleKeys: ["FRA_5_EXTERNAL_FIRE_SPREAD"],
    description: "External fire spread to/from adjacent buildings"
  },
  {
    id: 13,
    title: "Significant Findings, Risk Evaluation & Action Plan",
    moduleKeys: ["FRA_4_SIGNIFICANT_FINDINGS", "FRA_90_SIGNIFICANT_FINDINGS"],
    description: "Overall risk assessment, significant findings, recommendations"
  },
  {
    id: 14,
    title: "Review & Reassessment",
    moduleKeys: [],
    description: "Review requirements and next assessment date"
  }
];

/**
 * Get section title by ID
 */
export function getSectionTitle(sectionId: number): string {
  const section = FRA_REPORT_STRUCTURE.find(s => s.id === sectionId);
  return section ? section.title : `Section ${sectionId}`;
}

/**
 * Get section by module key
 */
export function getSectionForModuleKey(moduleKey: string): PdfSection | null {
  return FRA_REPORT_STRUCTURE.find(section =>
    section.moduleKeys.includes(moduleKey)
  ) || null;
}

/**
 * Check if a module key should be included in PDF output
 */
export function isModuleIncludedInPdf(moduleKey: string): boolean {
  return FRA_REPORT_STRUCTURE.some(section =>
    section.moduleKeys.includes(moduleKey)
  );
}
