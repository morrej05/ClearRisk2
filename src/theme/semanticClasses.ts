/**
 * Semantic Class Helpers
 * Provides consistent, token-based Tailwind class strings for semantic use cases
 * Prevents ad-hoc color usage and ensures design system compliance
 */

import { RiskLevel } from './tokens';

/**
 * Get classes for risk badges (small status indicators)
 * Usage: Priority chips, status badges, risk labels
 */
export function getRiskBadgeClasses(level: RiskLevel | string): string {
  const normalized = level.toLowerCase();

  if (normalized === 'high' || normalized === 'critical' || normalized === 'material') {
    return 'bg-risk-high-bg text-risk-high-fg border border-risk-high-border';
  }
  if (normalized === 'medium' || normalized === 'moderate' || normalized === 'minor') {
    return 'bg-risk-medium-bg text-risk-medium-fg border border-risk-medium-border';
  }
  if (normalized === 'low' || normalized === 'compliant') {
    return 'bg-risk-low-bg text-risk-low-fg border border-risk-low-border';
  }
  // Default to info for unknown/neutral states
  return 'bg-risk-info-bg text-risk-info-fg border border-risk-info-border';
}

/**
 * Get classes for priority badges (recommendation priorities)
 * Maps P1->high, P2->medium, P3->low, P4->info
 */
export function getPriorityBadgeClasses(priority: 'Critical' | 'High' | 'Medium' | 'Low' | string): string {
  const p = priority.toLowerCase();
  if (p === 'critical' || p === 'p1') {
    return 'bg-risk-high-bg text-risk-high-fg border border-risk-high-border';
  }
  if (p === 'high' || p === 'p2') {
    return 'bg-risk-medium-bg text-risk-medium-fg border border-risk-medium-border';
  }
  if (p === 'medium' || p === 'p3') {
    return 'bg-risk-low-bg text-risk-low-fg border border-risk-low-border';
  }
  if (p === 'low' || p === 'p4') {
    return 'bg-risk-info-bg text-risk-info-fg border border-risk-info-border';
  }
  return 'bg-risk-info-bg text-risk-info-fg border border-risk-info-border';
}

/**
 * Get classes for alert banners
 * Usage: Top-of-page notifications, warnings, info messages
 */
export function getAlertClasses(kind: 'error' | 'warning' | 'success' | 'info'): string {
  switch (kind) {
    case 'error':
      return 'bg-risk-high-bg text-risk-high-fg border-l-4 border-risk-high-fg';
    case 'warning':
      return 'bg-risk-medium-bg text-risk-medium-fg border-l-4 border-risk-medium-fg';
    case 'success':
      return 'bg-risk-low-bg text-risk-low-fg border-l-4 border-risk-low-fg';
    case 'info':
    default:
      return 'bg-risk-info-bg text-risk-info-fg border-l-4 border-risk-info-fg';
  }
}

/**
 * Get classes for row markers (left border accent on table rows)
 * Usage: Risk tables, action registers
 */
export function getRiskRowMarkerClasses(level: RiskLevel | string): string {
  const normalized = level.toLowerCase();

  if (normalized === 'high' || normalized === 'critical') {
    return 'border-l-4 border-risk-high-fg';
  }
  if (normalized === 'medium' || normalized === 'moderate') {
    return 'border-l-4 border-risk-medium-fg';
  }
  if (normalized === 'low') {
    return 'border-l-4 border-risk-low-fg';
  }
  return 'border-l-4 border-risk-info-fg';
}

/**
 * Get button classes for primary actions
 * Usage: Submit buttons, primary CTAs
 */
export function getPrimaryButtonClasses(): string {
  return 'bg-brand-accent hover:bg-brand-accent-hover text-white border border-brand-accent focus:ring-2 focus:ring-brand-accent focus:ring-offset-2';
}

/**
 * Get button classes for secondary actions
 * Usage: Cancel buttons, secondary CTAs
 */
export function getSecondaryButtonClasses(): string {
  return 'bg-ui-card hover:bg-ui-surface text-ui-text border border-ui-border focus:ring-2 focus:ring-brand-accent focus:ring-offset-2';
}

/**
 * Get button classes for destructive actions
 * Usage: Delete buttons, dangerous actions
 */
export function getDestructiveButtonClasses(): string {
  return 'bg-risk-high-bg hover:bg-risk-high-fg text-risk-high-fg hover:text-white border border-risk-high-border focus:ring-2 focus:ring-risk-high-fg focus:ring-offset-2';
}

/**
 * Get standard card classes
 */
export function getCardClasses(): string {
  return 'bg-ui-card border border-ui-border rounded-lg shadow-sm';
}

/**
 * Get text color for headings
 */
export function getHeadingClasses(level: 'h1' | 'h2' | 'h3' | 'h4' = 'h2'): string {
  return `text-ui-ink font-semibold ${level === 'h1' ? 'text-3xl' : level === 'h2' ? 'text-2xl' : level === 'h3' ? 'text-xl' : 'text-lg'}`;
}

/**
 * Get text color for body text
 */
export function getBodyTextClasses(): string {
  return 'text-ui-text';
}

/**
 * Get text color for muted/secondary text
 */
export function getMutedTextClasses(): string {
  return 'text-ui-muted';
}
