import { Jurisdiction, normalizeJurisdiction as normalizeJurisdictionCore } from '../lib/jurisdictions';

export type { Jurisdiction } from '../lib/jurisdictions';

export function getAssessmentDisplayName(
  assessmentType: string,
  jurisdiction?: Jurisdiction | string | null
): string {
  const normalizedJurisdiction = normalizeJurisdictionCore(jurisdiction);

  if (assessmentType === 'DSEAR' || assessmentType === 'dsear') {
    if (normalizedJurisdiction === 'ireland') {
      return 'Explosive Atmospheres Risk Assessment';
    } else {
      return 'DSEAR Risk Assessment';
    }
  }

  switch (assessmentType) {
    case 'FRA':
    case 'fra':
      return 'Fire Risk Assessment';
    case 'FSD':
    case 'fire_strategy':
      return 'Fire Strategy Document';
    case 'wildfire':
      return 'Wildfire Risk Assessment';
    default:
      return assessmentType;
  }
}

export function getAssessmentShortName(
  assessmentType: string,
  jurisdiction?: Jurisdiction | string | null
): string {
  const normalizedJurisdiction = normalizeJurisdictionCore(jurisdiction);

  if (assessmentType === 'DSEAR' || assessmentType === 'dsear') {
    if (normalizedJurisdiction === 'ireland') {
      return 'Explosive Atmospheres';
    } else {
      return 'DSEAR';
    }
  }

  switch (assessmentType) {
    case 'FRA':
    case 'fra':
      return 'FRA';
    case 'FSD':
    case 'fire_strategy':
      return 'FSD';
    case 'wildfire':
      return 'Wildfire';
    default:
      return assessmentType;
  }
}
