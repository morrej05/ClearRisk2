/**
 * Sanitizes a module_instances payload to ensure empty outcome fields are not included
 *
 * @param payload - The payload object to sanitize
 * @returns Sanitized payload with empty outcome removed
 */
export function sanitizeModuleInstancePayload<T extends Record<string, any>>(
  payload: T
): T {
  const sanitized = { ...payload };

  // Remove outcome if it's an empty string after trimming
  if ('outcome' in sanitized) {
    const outcomeValue = sanitized.outcome;
    const cleanOutcome = String(outcomeValue ?? '').trim();

    if (cleanOutcome === '') {
      delete sanitized.outcome;
    }
  }

  return sanitized;
}
