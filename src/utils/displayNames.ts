export type Jurisdiction = 'UK' | 'IE';

export function getAssessmentDisplayName(
  assessmentType: string,
  jurisdiction?: Jurisdiction | string | null
): string {
  const normalizedJurisdiction = normalizeJurisdiction(jurisdiction);

  if (assessmentType === 'DSEAR' || assessmentType === 'dsear') {
    if (normalizedJurisdiction === 'UK') {
      return 'DSEAR Risk Assessment';
    } else {
      return 'Explosive Atmospheres Risk Assessment';
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
  const normalizedJurisdiction = normalizeJurisdiction(jurisdiction);

  if (assessmentType === 'DSEAR' || assessmentType === 'dsear') {
    if (normalizedJurisdiction === 'UK') {
      return 'DSEAR';
    } else {
      return 'Explosive Atmospheres';
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

function normalizeJurisdiction(jurisdiction?: Jurisdiction | string | null): Jurisdiction {
  if (!jurisdiction) return 'UK';

  const upper = jurisdiction.toUpperCase();

  if (upper.includes('IE') || upper.includes('IRELAND')) {
    return 'IE';
  }

  return 'UK';
}
