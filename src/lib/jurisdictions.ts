/**
 * Central Jurisdiction Definitions and Mappings
 *
 * This file defines the legal regimes and their associated legislation,
 * replacing the old 'UK' / 'IE' model with explicit jurisdictions.
 */

export type Jurisdiction = 'england_wales' | 'scotland' | 'northern_ireland' | 'ireland';
export type ExplosionRegime = 'UK_DSEAR' | 'ROI_ATEX';

export interface JurisdictionConfig {
  code: Jurisdiction;
  label: string;
  fullName: string;
  primaryLegislation: string[];
  enforcingAuthority: string;
  regulatoryFrameworkText: string;
  responsiblePersonDuties: string[];
  dutyholderHeading: string;
  dutyholderTerm: string;
  references: string[];
}

/**
 * Central jurisdiction configuration mapping
 */
export const JURISDICTION_CONFIG: Record<Jurisdiction, JurisdictionConfig> = {
  england_wales: {
    code: 'england_wales',
    label: 'England & Wales',
    fullName: 'England and Wales',
    primaryLegislation: [
      'Regulatory Reform (Fire Safety) Order 2005 (FSO)',
      'Health and Safety at Work etc. Act 1974',
      'Building Regulations 2010 (Approved Document B)',
      'Housing Act 2004',
    ],
    enforcingAuthority: 'Fire and Rescue Authority',
    regulatoryFrameworkText: `The Regulatory Reform (Fire Safety) Order 2005 (FSO) applies to virtually all premises and workplaces in England and Wales, other than domestic premises. These regulations place a legal duty on the 'responsible person' to carry out a suitable and sufficient fire risk assessment and to implement appropriate fire safety measures.

The responsible person must identify fire hazards and people at risk, evaluate the risks arising from those hazards, and determine whether existing fire safety measures are adequate or if additional precautions are required. The assessment must be kept under regular review and be revised where significant changes occur to the premises, work activities, or if the assessment is no longer valid.

The FSO adopts a risk-based, goal-setting approach to fire safety rather than prescriptive requirements. This means that the responsible person has flexibility in determining how to achieve adequate fire safety standards, provided that the level of risk to relevant persons is reduced to an acceptable level. Guidance documents such as those published by the government and professional bodies provide valuable assistance in interpreting the requirements and achieving compliance.

Key objectives under the FSO include ensuring that people can safely evacuate the premises in the event of fire, that fire safety systems and equipment are properly maintained and tested, that staff receive appropriate fire safety training, and that suitable management arrangements are in place to maintain and improve fire safety standards over time.`,
    responsiblePersonDuties: [
      'Under Article 9 of the FSO, the Responsible Person must make a suitable and sufficient assessment of fire risks.',
      'The assessment must identify significant findings and persons especially at risk.',
      'Preventive and protective measures must be implemented and maintained.',
      'Fire safety arrangements must be recorded where 5 or more persons are employed.',
      'The assessment must be kept under review and revised where necessary.',
    ],
    dutyholderHeading: 'WHAT IS REQUIRED OF THE RESPONSIBLE PERSON',
    dutyholderTerm: 'responsible person',
    references: [
      'BS 9999:2017 - Fire safety in the design, management and use of buildings',
      'BS 9991:2015 - Fire safety in the design, management and use of residential buildings',
      'PAS 79-1:2020 - Fire risk assessment – Premises other than housing',
      'PAS 79-2:2020 - Fire risk assessment – Housing',
    ],
  },

  scotland: {
    code: 'scotland',
    label: 'Scotland',
    fullName: 'Scotland',
    primaryLegislation: [
      'Fire (Scotland) Act 2005',
      'Fire Safety (Scotland) Regulations 2006',
      'Building (Scotland) Regulations 2004',
      'Health and Safety at Work etc. Act 1974',
    ],
    enforcingAuthority: 'Scottish Fire and Rescue Service',
    regulatoryFrameworkText: `The Fire (Scotland) Act 2005 and the Fire Safety (Scotland) Regulations 2006 apply to virtually all premises and workplaces in Scotland, other than domestic premises. These regulations place a legal duty on the duty holder to carry out a suitable and sufficient fire safety risk assessment and to implement appropriate fire safety measures.

The duty holder must identify fire hazards and people at risk, evaluate the risks arising from those hazards, and determine whether existing fire safety measures are adequate or if additional precautions are required. The assessment must be kept under regular review and be revised where significant changes occur to the premises, work activities, or if the assessment is no longer valid.

Scottish fire safety legislation adopts a risk-based, goal-setting approach to fire safety rather than prescriptive requirements. This means that the duty holder has flexibility in determining how to achieve adequate fire safety standards, provided that the level of risk to relevant persons is reduced to an acceptable level. Guidance documents published by the Scottish Government and professional bodies provide valuable assistance in interpreting the requirements and achieving compliance.

Key objectives include ensuring that people can safely evacuate the premises in the event of fire, that fire safety systems and equipment are properly maintained and tested, that staff receive appropriate fire safety training, and that suitable management arrangements are in place to maintain and improve fire safety standards over time.`,
    responsiblePersonDuties: [
      'Under the Fire (Scotland) Act 2005, the duty holder must carry out a fire safety risk assessment.',
      'The assessment must identify risks to relevant persons and measures to eliminate or reduce those risks.',
      'Fire safety measures must be implemented and maintained.',
      'Arrangements must be recorded where 5 or more persons are employed.',
      'The assessment must be reviewed regularly and when circumstances change.',
    ],
    dutyholderHeading: 'WHAT IS REQUIRED OF THE DUTY HOLDER',
    dutyholderTerm: 'duty holder',
    references: [
      'BS 9999:2017 - Fire safety in the design, management and use of buildings',
      'BS 9991:2015 - Fire safety in the design, management and use of residential buildings',
      'Scottish Government Fire Safety Guidance',
    ],
  },

  northern_ireland: {
    code: 'northern_ireland',
    label: 'Northern Ireland',
    fullName: 'Northern Ireland',
    primaryLegislation: [
      'Fire and Rescue Services (Northern Ireland) Order 2006',
      'Fire Safety Regulations (Northern Ireland) 2010',
      'Building Regulations (Northern Ireland) 2012',
      'Health and Safety at Work (Northern Ireland) Order 1978',
    ],
    enforcingAuthority: 'Northern Ireland Fire & Rescue Service',
    regulatoryFrameworkText: `The Fire Safety Regulations (Northern Ireland) 2010, made under the Fire and Rescue Services (Northern Ireland) Order 2006, apply to virtually all premises and workplaces in Northern Ireland, other than domestic premises. These regulations place a legal duty on the responsible person to carry out a suitable and sufficient fire risk assessment and to implement appropriate fire safety measures.

The responsible person must identify fire hazards and people at risk, evaluate the risks arising from those hazards, and determine whether existing fire safety measures are adequate or if additional precautions are required. The assessment must be kept under regular review and be revised where significant changes occur to the premises, work activities, or if the assessment is no longer valid.

The Fire Safety Regulations adopt a risk-based, goal-setting approach to fire safety rather than prescriptive requirements. This means that the responsible person has flexibility in determining how to achieve adequate fire safety standards, provided that the level of risk to relevant persons is reduced to an acceptable level. Guidance documents published by the Northern Ireland Fire & Rescue Service and professional bodies provide valuable assistance in interpreting the requirements and achieving compliance.

Key objectives include ensuring that people can safely evacuate the premises in the event of fire, that fire safety systems and equipment are properly maintained and tested, that staff receive appropriate fire safety training, and that suitable management arrangements are in place to maintain and improve fire safety standards over time.`,
    responsiblePersonDuties: [
      'Under the Fire Safety Regulations (NI) 2010, the responsible person must carry out a fire risk assessment.',
      'The assessment must identify persons at risk and evaluate, remove or reduce risks.',
      'Appropriate fire safety measures must be provided and maintained.',
      'Fire safety arrangements must be recorded where 5 or more persons are employed.',
      'The assessment must be reviewed regularly and when circumstances change.',
    ],
    dutyholderHeading: 'WHAT IS REQUIRED OF THE RESPONSIBLE PERSON',
    dutyholderTerm: 'responsible person',
    references: [
      'BS 9999:2017 - Fire safety in the design, management and use of buildings',
      'BS 9991:2015 - Fire safety in the design, management and use of residential buildings',
      'NIFRS Fire Safety Guidance',
    ],
  },

  ireland: {
    code: 'ireland',
    label: 'Republic of Ireland',
    fullName: 'Republic of Ireland',
    primaryLegislation: [
      'Fire Services Acts 1981 & 2003',
      'Building Control Acts 1990 & 2007',
      'Safety, Health and Welfare at Work Act 2005',
      'Building Control Regulations 1997-2018',
    ],
    enforcingAuthority: 'Building Control Authority / Fire Authority',
    regulatoryFrameworkText: `The Safety, Health and Welfare at Work Act 2005 and the Fire Services Acts 1981 & 2003 place a legal duty on employers and persons in control of premises to carry out suitable and sufficient risk assessments, including fire safety, and to implement appropriate fire safety measures. These requirements apply to virtually all premises and workplaces other than domestic premises.

Employers and persons in control must identify fire hazards and people at risk, evaluate the risks arising from those hazards, and determine whether existing fire safety measures are adequate or if additional precautions are required. The assessment must be kept under regular review and be revised where significant changes occur to the premises, work activities, or if the assessment is no longer valid.

Irish fire safety legislation adopts a risk-based, goal-setting approach to fire safety rather than prescriptive requirements. This means that dutyholders have flexibility in determining how to achieve adequate fire safety standards, provided that the level of risk to relevant persons is reduced to an acceptable level. Technical Guidance Document B (TGD-B) and other guidance documents published by relevant authorities and professional bodies provide valuable assistance in interpreting the requirements and achieving compliance.

Key objectives include ensuring that people can safely evacuate the premises in the event of fire, that fire safety systems and equipment are properly maintained and tested, that staff receive appropriate fire safety training, and that suitable management arrangements are in place to maintain and improve fire safety standards over time.`,
    responsiblePersonDuties: [
      'Under the Safety, Health and Welfare at Work Act 2005, employers must conduct risk assessments including fire safety.',
      'Fire safety measures must be appropriate to the nature and scale of the hazard.',
      'Emergency plans and procedures must be established.',
      'Safety statements must be prepared and made available.',
      'Risk assessments must be reviewed regularly and when circumstances change.',
    ],
    dutyholderHeading: 'WHAT IS REQUIRED OF EMPLOYERS AND PERSONS IN CONTROL',
    dutyholderTerm: 'employer/person in control',
    references: [
      'Technical Guidance Document B (TGD-B) - Fire Safety',
      'BS 9999:2017 - Fire safety in the design, management and use of buildings',
      'IS 3217:2013 - Emergency lighting',
      'IS 291:2015 - Fire detection and fire alarm systems',
    ],
  },
};

/**
 * Get jurisdiction configuration
 */
export function getJurisdictionConfig(jurisdiction: Jurisdiction | string | null | undefined): JurisdictionConfig {
  // Handle legacy 'UK' / 'IE' values
  const normalized = normalizeJurisdiction(jurisdiction);
  return JURISDICTION_CONFIG[normalized];
}

/**
 * Normalize legacy jurisdiction values to new format
 */
export function normalizeJurisdiction(jurisdiction: Jurisdiction | string | null | undefined): Jurisdiction {
  if (!jurisdiction) return 'england_wales';

  const upper = String(jurisdiction).toUpperCase();

  // Legacy mappings
  if (upper === 'UK' || upper.includes('UNITED KINGDOM') || upper.includes('ENGLAND')) {
    return 'england_wales';
  }

  if (upper === 'IE' || upper === 'IRELAND' || upper === 'REPUBLIC') {
    return 'ireland';
  }

  if (upper === 'EUROPE' || upper === 'ATEX' || upper === 'ROI') {
    return 'ireland';
  }

  if (upper.includes('SCOT')) {
    return 'scotland';
  }

  if (upper.includes('NORTHERN') || upper.includes('NI')) {
    return 'northern_ireland';
  }

  // Direct match
  const direct = jurisdiction.toLowerCase() as Jurisdiction;
  if (JURISDICTION_CONFIG[direct]) {
    return direct;
  }

  // Default
  return 'england_wales';
}

/**
 * Get display label for jurisdiction
 */
export function getJurisdictionLabel(jurisdiction: Jurisdiction | string | null | undefined): string {
  const config = getJurisdictionConfig(jurisdiction);
  return config.label;
}

/**
 * Get all available jurisdictions for selection
 */
export function getAvailableJurisdictions(): Array<{ value: Jurisdiction; label: string }> {
  return [
    { value: 'england_wales', label: 'England & Wales' },
    { value: 'scotland', label: 'Scotland' },
    { value: 'northern_ireland', label: 'Northern Ireland' },
    { value: 'ireland', label: 'Republic of Ireland' },
  ];
}

/**
 * Check if jurisdiction is England & Wales
 * Used for conditional display of England/Wales-specific content like "Approved Document B"
 */
export function isEnglandWales(jurisdiction: Jurisdiction | string | null | undefined): boolean {
  return normalizeJurisdiction(jurisdiction) === 'england_wales';
}

/**
 * Get jurisdiction-appropriate standards list
 * Replaces "Approved Document B" with neutral alternatives for non-EW jurisdictions
 */
export function getStandardsOptions(jurisdiction: Jurisdiction | string | null | undefined): string[] {
  const isEW = isEnglandWales(jurisdiction);

  return [
    'BS 9999:2017',
    'BS 9991:2015',
    isEW ? 'Approved Document B' : 'Applicable building regulations and guidance',
    'BS 5588 (legacy)',
    'BS 7974 (fire engineering)',
    'PD 7974',
    'NFPA 101',
    'Other',
  ];
}


/**
 * Normalize jurisdiction values for DSEAR context
 * DSEAR is currently constrained to Great Britain jurisdictions.
 */
export function normalizeDsearJurisdiction(jurisdiction: Jurisdiction | string | null | undefined): Jurisdiction {
  const normalized = normalizeJurisdiction(jurisdiction);
  return normalized === 'ireland' ? 'england_wales' : normalized;
}

/**
 * Get available jurisdictions for DSEAR selection
 */
export function getDsearJurisdictionOptions() {
  return [
   { value: 'england_wales', label: 'England & Wales' },
    { value: 'scotland', label: 'Scotland' },
    { value: 'northern_ireland', label: 'Northern Ireland' },
    { value: 'ireland', label: 'Republic of Ireland' },
  ];
}

/**
 * Resolve explosion regulatory regime from jurisdiction.
 * Keeps mapping explicit to avoid drift across PDF/reference paths.
 */
export function resolveExplosionRegime(
  jurisdiction: Jurisdiction | string | null | undefined
): ExplosionRegime {
  const raw = String(jurisdiction ?? '').toUpperCase().trim();
  if (raw === 'ROI') {
    return 'ROI_ATEX';
  }

  const normalized = normalizeJurisdiction(jurisdiction);
  return normalized === 'ireland' ? 'ROI_ATEX' : 'UK_DSEAR';
}