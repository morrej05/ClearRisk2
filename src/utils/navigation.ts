/**
 * Navigation utilities for consistent routing and return-to behavior
 */

/**
 * Get the returnTo path from navigation state, or use fallback
 */
export function getReturnTo(state: any, fallback = '/dashboard'): string {
  return state?.returnTo || fallback;
}

/**
 * Navigate with a returnTo state parameter
 */
export function withReturnTo(navigate: any, to: string, returnTo: string) {
  navigate(to, { state: { returnTo } });
}
