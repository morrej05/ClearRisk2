/**
 * FRA Field Accessor Helpers
 *
 * Purpose:
 * Provide safe, alias-aware field access for FRA module data.
 * Eliminates field-name drift by checking canonical field name first,
 * then falling back to known aliases from moduleFieldSchema.
 *
 * Usage:
 *   getField(data, 'FRA_3_ACTIVE_SYSTEMS', 'fire_alarm_present')
 *     -> checks data.fire_alarm_present
 *     -> falls back to data.alarm_present (alias)
 *     -> returns undefined if not found
 *
 *   hasTruthy(data, 'A4_MANAGEMENT_CONTROLS', 'fire_safety_policy_exists')
 *     -> returns true if fire_safety_policy_exists OR fire_safety_policy is truthy
 */

import {
  FRA_MODULE_FIELD_SCHEMA,
  resolveFraSchemaModuleKey,
} from './moduleFieldSchema';

/**
 * Safely access nested field by dot-notation path
 */
function getByPath(data: Record<string, any>, path: string): any {
  if (!data || typeof data !== 'object') return undefined;
  const keys = path.split('.');
  let current: any = data;

  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[key];
  }

  return current;
}

/**
 * Check if value is present (not null/undefined)
 */
function hasValue(value: any): boolean {
  return value !== undefined && value !== null;
}

/**
 * Get field value by canonical name with alias fallback
 *
 * @param data - Module data payload
 * @param moduleKey - Module key (e.g., 'FRA_3_ACTIVE_SYSTEMS' or 'FRA_3')
 * @param canonicalKey - Canonical field name (e.g., 'fire_alarm_present')
 * @returns Field value or undefined if not found
 */
export function getField(
  data: Record<string, any>,
  moduleKey: string,
  canonicalKey: string
): any {
  if (!data || typeof data !== 'object') return undefined;

  const resolvedModuleKey = resolveFraSchemaModuleKey(moduleKey);
  const aliasMap = resolvedModuleKey
    ? FRA_MODULE_FIELD_SCHEMA[resolvedModuleKey]
    : undefined;

  // Build candidate list: canonical first, then aliases
  const aliases = aliasMap?.[canonicalKey] ?? [];
  const candidates = [canonicalKey, ...aliases];

  // Return first candidate with a defined value
  for (const candidate of candidates) {
    const value = getByPath(data, candidate);
    if (hasValue(value)) return value;
  }

  return undefined;
}

/**
 * Check if canonical field (or alias) has a truthy value
 *
 * @param data - Module data payload
 * @param moduleKey - Module key (e.g., 'FRA_3_ACTIVE_SYSTEMS')
 * @param canonicalKey - Canonical field name
 * @returns true if field is truthy, false otherwise
 */
export function hasTruthy(
  data: Record<string, any>,
  moduleKey: string,
  canonicalKey: string
): boolean {
  return Boolean(getField(data, moduleKey, canonicalKey));
}

/**
 * Get canonical field as string enum
 *
 * @param data - Module data payload
 * @param moduleKey - Module key
 * @param canonicalKey - Canonical field name
 * @returns String value or null if not found/empty
 */
export function getEnum(
  data: Record<string, any>,
  moduleKey: string,
  canonicalKey: string
): string | null {
  const value = getField(data, moduleKey, canonicalKey);
  if (value === undefined || value === null) return null;
  return String(value);
}
