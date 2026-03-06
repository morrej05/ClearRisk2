import { normalizeOutcome, getModuleOutcomeCategory } from '../lib/modules/moduleCatalog';

/**
 * Sanitizes a module_instances payload to ensure empty outcome fields are not included
 * and normalizes outcome values to database-compatible format
 *
 * @param payload - The payload object to sanitize
 * @param moduleKey - Optional module key for outcome normalization
 * @returns Sanitized payload with empty outcome removed and normalized outcome
 */
export function sanitizeModuleInstancePayload<T extends Record<string, any>>(
  payload: T,
  moduleKey?: string
): T {
  const sanitized = { ...payload } as Record<string, any>;

  // Remove or normalize outcome
  if ('outcome' in sanitized) {
    const outcomeValue = sanitized.outcome;
    const cleanOutcome = String(outcomeValue ?? '').trim();

    if (cleanOutcome === '') {
      delete sanitized.outcome;
    } else if (moduleKey) {
      // Normalize outcome to database format
      const category = getModuleOutcomeCategory(moduleKey);
      const normalized = normalizeOutcome(cleanOutcome, category);

      console.log('[sanitizeModuleInstancePayload] Outcome normalization:', {
        moduleKey,
        category,
        input: cleanOutcome,
        normalized,
      });

      sanitized.outcome = normalized;
    } else {
      console.warn('[sanitizeModuleInstancePayload] No moduleKey provided for outcome normalization:', {
        outcome: cleanOutcome,
        warning: 'This may cause database constraint violations',
      });
    }
  }

   const hasOutcome = 'outcome' in sanitized;
  const hasAssessorNotes = 'assessor_notes' in sanitized;

  if (hasOutcome || hasAssessorNotes) {
    const existingData =
      sanitized.data && typeof sanitized.data === 'object' && !Array.isArray(sanitized.data)
        ? sanitized.data
        : {};

    sanitized.data = {
      ...existingData,
      ...(hasOutcome ? { section_assessment_outcome: sanitized.outcome ?? null } : {}),
      ...(hasAssessorNotes ? { section_assessment_notes: sanitized.assessor_notes ?? '' } : {}),
    };
  }

  return sanitized as T;
}
