export const FEATURE_FLAGS = {
  IMPAIRMENTS_ENABLED: false,
} as const;

export function isFeatureEnabled(flag: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[flag];
}
