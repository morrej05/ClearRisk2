export type Jurisdiction = 'england_wales' | 'scotland' | 'northern_ireland' | 'ireland';

export interface RegulatoryFramework {
  title: string;
  legislation: string[];
  enforcingAuthority: string;
  keyDuties: string[];
  references: string[];
}

export function getRegulatoryFrameworkContent(jurisdiction: Jurisdiction): RegulatoryFramework {
  switch (jurisdiction) {
    case 'england_wales':
      return {
        title: 'Regulatory Framework (England & Wales)',
        legislation: [
          'Regulatory Reform (Fire Safety) Order 2005 (FSO)',
          'Health and Safety at Work etc. Act 1974',
          'Building Regulations 2010 (Approved Document B)',
          'Housing Act 2004',
        ],
        enforcingAuthority: 'Fire and Rescue Authority',
        keyDuties: [
          'Under Article 9 of the FSO, the Responsible Person must make a suitable and sufficient assessment of fire risks.',
          'The assessment must identify significant findings and persons especially at risk.',
          'Preventive and protective measures must be implemented and maintained.',
          'Fire safety arrangements must be recorded where 5 or more persons are employed.',
          'The assessment must be kept under review and revised where necessary.',
        ],
        references: [
          'BS 9999:2017 - Fire safety in the design, management and use of buildings',
          'BS 9991:2015 - Fire safety in the design, management and use of residential buildings',
          'PAS 79-1:2020 - Fire risk assessment – Premises other than housing',
          'PAS 79-2:2020 - Fire risk assessment – Housing',
        ],
      };

    case 'scotland':
      return {
        title: 'Regulatory Framework (Scotland)',
        legislation: [
          'Fire (Scotland) Act 2005',
          'Fire Safety (Scotland) Regulations 2006',
          'Building (Scotland) Regulations 2004',
          'Health and Safety at Work etc. Act 1974',
        ],
        enforcingAuthority: 'Scottish Fire and Rescue Service',
        keyDuties: [
          'Under the Fire (Scotland) Act 2005, the duty holder must carry out a fire safety risk assessment.',
          'The assessment must identify risks to relevant persons and measures to eliminate or reduce those risks.',
          'Fire safety measures must be implemented and maintained.',
          'Arrangements must be recorded where 5 or more persons are employed.',
          'The assessment must be reviewed regularly and when circumstances change.',
        ],
        references: [
          'BS 9999:2017 - Fire safety in the design, management and use of buildings',
          'BS 9991:2015 - Fire safety in the design, management and use of residential buildings',
          'Scottish Government Fire Safety Guidance',
        ],
      };

    case 'northern_ireland':
      return {
        title: 'Regulatory Framework (Northern Ireland)',
        legislation: [
          'Fire and Rescue Services (Northern Ireland) Order 2006',
          'Fire Safety Regulations (Northern Ireland) 2010',
          'Building Regulations (Northern Ireland) 2012',
          'Health and Safety at Work (Northern Ireland) Order 1978',
        ],
        enforcingAuthority: 'Northern Ireland Fire & Rescue Service',
        keyDuties: [
          'Under the Fire Safety Regulations (NI) 2010, the responsible person must carry out a fire risk assessment.',
          'The assessment must identify persons at risk and evaluate, remove or reduce risks.',
          'Appropriate fire safety measures must be provided and maintained.',
          'Fire safety arrangements must be recorded where 5 or more persons are employed.',
          'The assessment must be reviewed regularly and when circumstances change.',
        ],
        references: [
          'BS 9999:2017 - Fire safety in the design, management and use of buildings',
          'BS 9991:2015 - Fire safety in the design, management and use of residential buildings',
          'NIFRS Fire Safety Guidance',
        ],
      };

    case 'ireland':
      return {
        title: 'Regulatory Framework (Ireland)',
        legislation: [
          'Fire Services Acts 1981 & 2003',
          'Building Control Acts 1990 & 2007',
          'Safety, Health and Welfare at Work Act 2005',
          'Building Control Regulations 1997-2018',
        ],
        enforcingAuthority: 'Building Control Authority / Fire Authority',
        keyDuties: [
          'Under the Safety, Health and Welfare at Work Act 2005, employers must conduct risk assessments including fire safety.',
          'Fire safety measures must be appropriate to the nature and scale of the hazard.',
          'Emergency plans and procedures must be established.',
          'Safety statements must be prepared and made available.',
          'Risk assessments must be reviewed regularly and when circumstances change.',
        ],
        references: [
          'Technical Guidance Document B (TGD-B) - Fire Safety',
          'BS 9999:2017 - Fire safety in the design, management and use of buildings',
          'IS 3217:2013 - Emergency lighting',
          'IS 291:2015 - Fire detection and fire alarm systems',
        ],
      };

    default:
      return getRegulatoryFrameworkContent('england_wales');
  }
}

export function getResponsiblePersonDuties(jurisdiction: Jurisdiction): string[] {
  const framework = getRegulatoryFrameworkContent(jurisdiction);
  return framework.keyDuties;
}
