/**
 * DEPRECATED: This helper is legacy. Use src/lib/jurisdictions.ts instead.
 * Kept for backward compatibility with old code paths.
 */
import { normalizeJurisdiction, getJurisdictionConfig, type Jurisdiction } from '../../jurisdictions';

export function fraResponsiblePersonDutiesText(jurisdiction: Jurisdiction | string = 'england_wales'): string {
  const normalized = normalizeJurisdiction(jurisdiction);
  const config = getJurisdictionConfig(normalized);

  // Return duties formatted as text (join with double newline for paragraphs)
  return config.responsiblePersonDuties.join('\n\n');
}

export default fraResponsiblePersonDutiesText;
