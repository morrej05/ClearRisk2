// DEPRECATED: FRA helpers below are legacy wrappers around src/lib/jurisdictions.ts
// Use src/lib/jurisdictions.ts directly for new code (getJurisdictionConfig, normalizeJurisdiction)
export { fraRegulatoryFrameworkText } from './fra/regulatoryFramework';
export { fraResponsiblePersonDutiesText } from './fra/responsiblePersonDuties';

// Explosion (DSEAR) report text
export { explosiveAtmospheresPurposeText } from './explosion/purposeAndIntroduction';
export { hazardousAreaClassificationText } from './explosion/hazardousAreaClassification';
export { zoneDefinitionsText } from './explosion/zoneDefinitions';

// FSD report text
export { fsdPurposeAndScopeText } from './fsd/purposeAndScope';
export { fsdLimitationsText } from './fsd/limitations';

// References (uses canonical 4-way jurisdiction model)
export { getExplosiveAtmospheresReferences, type ReferenceItem } from './references';

// NOTE: Jurisdiction type is re-exported from src/lib/jurisdictions.ts (canonical source)
export type { Jurisdiction } from '../jurisdictions';
