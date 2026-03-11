export type FsdJurisdiction =
  | 'england'
  | 'wales'
  | 'scotland'
  | 'northern_ireland'
  | 'ireland';

export function normalizeFsdJurisdiction(jurisdiction: string | null | undefined): FsdJurisdiction {
  if (!jurisdiction) return 'england';

  const value = jurisdiction.trim().toLowerCase();

  if (value === 'england' || value.includes('england')) return 'england';
  if (value === 'wales' || value.includes('wales')) return 'wales';
  if (value.includes('scot')) return 'scotland';
  if (value.includes('northern') || value === 'ni' || value.includes('northern_ireland')) return 'northern_ireland';
  if (value === 'ireland' || value === 'ie' || value.includes('republic')) return 'ireland';

  if (value === 'england_wales' || value === 'uk') return 'england';

  return 'england';
}

