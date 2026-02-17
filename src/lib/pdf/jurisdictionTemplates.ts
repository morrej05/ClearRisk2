/**
 * Jurisdiction-Specific Templates for FRA PDFs
 *
 * Provides jurisdiction-aware text for regulatory frameworks, legislation,
 * and compliance requirements in fire risk assessment reports.
 */

export interface JurisdictionTemplate {
  code: string;
  name: string;
  legislationName: string;
  legislationYear: string;
  regulatoryAuthority: string;
  dutiesHeading: string;
  dutiesIntroduction: string;
  standardsReference: string[];
}

/**
 * England & Wales Template
 * Default jurisdiction for FRA reports
 */
export const ENGLAND_WALES: JurisdictionTemplate = {
  code: 'england_wales',
  name: 'England & Wales',
  legislationName: 'Regulatory Reform (Fire Safety) Order',
  legislationYear: '2005',
  regulatoryAuthority: 'Fire and Rescue Authority',
  dutiesHeading: 'Responsible Person Duties',
  dutiesIntroduction: 'Under the Regulatory Reform (Fire Safety) Order 2005, the Responsible Person must:',
  standardsReference: [
    'PAS 79:2020 Fire Risk Assessment - Domestic premises',
    'PAN 79:2020 Fire Risk Assessment - Premises other than domestic premises',
    'Fire Safety in the Design, Management and Use of Residential Buildings (2023)'
  ]
};

/**
 * Scotland Template
 */
export const SCOTLAND: JurisdictionTemplate = {
  code: 'scotland',
  name: 'Scotland',
  legislationName: 'Fire (Scotland) Act',
  legislationYear: '2005',
  regulatoryAuthority: 'Scottish Fire and Rescue Service',
  dutiesHeading: 'Duty Holder Responsibilities',
  dutiesIntroduction: 'Under the Fire (Scotland) Act 2005 and Fire Safety (Scotland) Regulations 2006, the duty holder must:',
  standardsReference: [
    'Fire Safety (Scotland) Regulations 2006',
    'Scottish Government Fire Safety Guidance'
  ]
};

/**
 * Northern Ireland Template
 */
export const NORTHERN_IRELAND: JurisdictionTemplate = {
  code: 'northern_ireland',
  name: 'Northern Ireland',
  legislationName: 'Fire and Rescue Services (Northern Ireland) Order',
  legislationYear: '2006',
  regulatoryAuthority: 'Northern Ireland Fire and Rescue Service',
  dutiesHeading: 'Responsible Person Duties',
  dutiesIntroduction: 'Under the Fire and Rescue Services (Northern Ireland) Order 2006, the Responsible Person must:',
  standardsReference: [
    'Fire Safety Regulations (Northern Ireland) 2010',
    'Department of Health, Social Services and Public Safety Guidance'
  ]
};

/**
 * Republic of Ireland Template
 */
export const REPUBLIC_OF_IRELAND: JurisdictionTemplate = {
  code: 'republic_of_ireland',
  name: 'Republic of Ireland',
  legislationName: 'Fire Services Acts',
  legislationYear: '1981 & 2003',
  regulatoryAuthority: 'Local Fire Authority',
  dutiesHeading: 'Person in Control Duties',
  dutiesIntroduction: 'Under the Fire Services Acts 1981 & 2003 and Safety, Health and Welfare at Work Act 2005, the person in control must:',
  standardsReference: [
    'Fire Safety Certificate requirements',
    'Safety, Health and Welfare at Work Act 2005',
    'Technical Guidance Document B (Fire Safety)'
  ]
};

/**
 * Get jurisdiction template by code
 */
export function getJurisdictionTemplate(jurisdictionCode?: string): JurisdictionTemplate {
  const code = (jurisdictionCode || 'england_wales').toLowerCase();

  switch (code) {
    case 'scotland':
      return SCOTLAND;
    case 'northern_ireland':
      return NORTHERN_IRELAND;
    case 'republic_of_ireland':
    case 'ireland':
      return REPUBLIC_OF_IRELAND;
    case 'england_wales':
    case 'england':
    case 'wales':
    default:
      return ENGLAND_WALES;
  }
}

/**
 * Format legislation reference for PDF
 */
export function formatLegislationReference(template: JurisdictionTemplate): string {
  return `${template.legislationName} ${template.legislationYear}`;
}

/**
 * Get full regulatory framework text for jurisdiction
 */
export function getRegulatoryFrameworkText(jurisdictionCode?: string): string {
  const template = getJurisdictionTemplate(jurisdictionCode);

  return `This Fire Risk Assessment has been undertaken in accordance with the ${formatLegislationReference(template)} and associated guidance documents.

The assessment follows a systematic approach to identify fire hazards, evaluate risks to life safety, and recommend appropriate control measures where required.

The ${template.regulatoryAuthority} enforces fire safety legislation in ${template.name}.`;
}
