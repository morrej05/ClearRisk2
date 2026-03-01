/**
 * DEPRECATED: This helper is legacy. Use src/lib/jurisdictions.ts instead.
 * Kept for backward compatibility with old code paths.
 */
import { normalizeJurisdiction, getJurisdictionConfig, type Jurisdiction } from '../../jurisdictions';

export function fraRegulatoryFrameworkText(jurisdiction: Jurisdiction | string = 'england_wales'): string {
  const normalized = normalizeJurisdiction(jurisdiction);
  const config = getJurisdictionConfig(normalized);
  return config.regulatoryFrameworkText;
}

export default fraRegulatoryFrameworkText;
