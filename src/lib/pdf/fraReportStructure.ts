/**
 * Fixed PAS-79 Aligned FRA Report Structure
 *
 * This defines the immutable section skeleton for Fire Risk Assessment PDFs.
 * Section numbers 1-14 are fixed and jurisdiction-agnostic.
 * Internal module keys are NOT printed in the PDF output.
 */

export interface PdfSection {
  id: number;
  displayNumber?: number; // Optional: for continuous numbering when sections are skipped
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
    title: "Assessment Details",
    moduleKeys: ["A1_DOC_CONTROL"],
    description: "Assessment metadata, client, site, assessor information"
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
    title: "Fire Detection, Alarm & Emergency Lighting",
    moduleKeys: ["FRA_3_ACTIVE_SYSTEMS"],
    description: "Fire detection, alarm/warning arrangements, and emergency lighting"
  },
  {
    id: 9,
    displayNumber: 8, // Section 8 was removed (merged into 7), so display as 8
    title: "Passive Fire Protection (Compartmentation)",
    moduleKeys: ["FRA_4_PASSIVE_PROTECTION"],
    description: "Fire resistance, compartmentation, fire doors, fire stopping"
  },
  {
    id: 10,
    displayNumber: 9, // Renumber to 9 for continuous sequence
    title: "Fixed Suppression Systems & Firefighting Facilities",
    moduleKeys: ["FRA_8_FIREFIGHTING_EQUIPMENT"],
    description: "Sprinklers, hose reels, fire extinguishers, firefighting equipment"
  },
  {
    id: 11,
    displayNumber: 10, // Renumber to 10 for continuous sequence
    title: "Fire Safety Management & Procedures",
    moduleKeys: ["A4_MANAGEMENT_CONTROLS", "FRA_6_MANAGEMENT_SYSTEMS", "A5_EMERGENCY_ARRANGEMENTS", "FRA_7_EMERGENCY_ARRANGEMENTS", "A7_REVIEW_ASSURANCE"],
    description: "Management of fire safety, training, drills, maintenance, record keeping"
  },
  {
    id: 12,
    displayNumber: 11, // Renumber to 11 for continuous sequence
    title: "External Fire Spread",
    moduleKeys: ["FRA_5_EXTERNAL_FIRE_SPREAD"],
    description: "External fire spread to/from adjacent buildings"
  },
  {
    id: 13,
    displayNumber: 12, // Renumber to 12 for continuous sequence
    title: "Significant Findings, Risk Evaluation & Action Plan",
    moduleKeys: ["FRA_4_SIGNIFICANT_FINDINGS", "FRA_90_SIGNIFICANT_FINDINGS"],
    description: "Overall risk assessment, significant findings, recommendations"
  },
  {
    id: 14,
    displayNumber: 13, // Renumber to 13 for continuous sequence
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
