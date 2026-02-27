/**
 * Semantic Class Mapping Layer - Single Source of Truth
 *
 * All color class mappings flow through this file to prevent drift.
 * Uses ONLY token-based classes (ui, brand, risk).
 * NO raw Tailwind families (blue-600, red-50, etc.)
 *
 * Based on Choice B palette: neutral + subtle slate accent + muted risk colors.
 */

import { RiskLevel } from './tokens';

/**
 * Core Risk Token Classes by Variant
 * Returns token-based classes for different UI contexts
 */
export function riskTokenClasses(
  token: 'high' | 'medium' | 'low' | 'info',
  variant: 'badge' | 'chip' | 'rowMarker' | 'text' | 'softPanel'
): string {
  const baseClasses = {
    high: {
      badge: 'bg-risk-high-bg text-risk-high-fg border border-risk-high-border',
      chip: 'bg-risk-high-bg text-risk-high-fg border border-risk-high-border rounded-full px-2.5 py-0.5 text-xs font-medium',
      rowMarker: 'border-l-4 border-risk-high-fg',
      text: 'text-risk-high-fg',
      softPanel: 'bg-risk-high-bg border-l-4 border-risk-high-fg',
    },
    medium: {
      badge: 'bg-risk-medium-bg text-risk-medium-fg border border-risk-medium-border',
      chip: 'bg-risk-medium-bg text-risk-medium-fg border border-risk-medium-border rounded-full px-2.5 py-0.5 text-xs font-medium',
      rowMarker: 'border-l-4 border-risk-medium-fg',
      text: 'text-risk-medium-fg',
      softPanel: 'bg-risk-medium-bg border-l-4 border-risk-medium-fg',
    },
    low: {
      badge: 'bg-risk-low-bg text-risk-low-fg border border-risk-low-border',
      chip: 'bg-risk-low-bg text-risk-low-fg border border-risk-low-border rounded-full px-2.5 py-0.5 text-xs font-medium',
      rowMarker: 'border-l-4 border-risk-low-fg',
      text: 'text-risk-low-fg',
      softPanel: 'bg-risk-low-bg border-l-4 border-risk-low-fg',
    },
    info: {
      badge: 'bg-risk-info-bg text-risk-info-fg border border-risk-info-border',
      chip: 'bg-risk-info-bg text-risk-info-fg border border-risk-info-border rounded-full px-2.5 py-0.5 text-xs font-medium',
      rowMarker: 'border-l-4 border-risk-info-fg',
      text: 'text-risk-info-fg',
      softPanel: 'bg-risk-info-bg border-l-4 border-risk-info-fg',
    },
  };

  return baseClasses[token][variant];
}

/**
 * Action Status → Risk Token Mapping
 * DB-canonical statuses: open, in_progress, closed, deferred, not_applicable, superseded
 * Derived UI: overdue
 */
export function actionStatusClasses(status: string | null | undefined): string {
  const normalized = (status || 'unknown').toLowerCase().trim();

  // Mapping: action status → risk token
  if (normalized === 'overdue' || normalized === 'open') {
    return riskTokenClasses('high', 'badge');
  }
  if (normalized === 'in_progress' || normalized === 'deferred') {
    return riskTokenClasses('medium', 'badge');
  }
  if (normalized === 'closed') {
    return riskTokenClasses('low', 'badge');
  }
  if (normalized === 'not_applicable' || normalized === 'superseded') {
    return riskTokenClasses('info', 'badge');
  }

  return riskTokenClasses('info', 'badge');
}

/**
 * Action/FRA Priority → Risk Token Mapping
 * P1, P2, P3, P4 (and numeric 1-4)
 */
export function actionPriorityClasses(priority: string | number | null | undefined): string {
  if (!priority) {
    return riskTokenClasses('info', 'badge');
  }

  const normalized = String(priority).toUpperCase().trim();

  // P1 or 1 → high
  if (normalized === 'P1' || normalized === '1') {
    return riskTokenClasses('high', 'badge');
  }
  // P2 or 2 → medium
  if (normalized === 'P2' || normalized === '2') {
    return riskTokenClasses('medium', 'badge');
  }
  // P3, P4, 3, 4 → info
  if (normalized === 'P3' || normalized === '3' || normalized === 'P4' || normalized === '4') {
    return riskTokenClasses('info', 'badge');
  }

  return riskTokenClasses('info', 'badge');
}

/**
 * Recommendation Legacy Status → Canonical → Risk Token Mapping
 * Title-case legacy: Not Started, In Progress, Under Review, Completed, Rejected
 * Canonical lowercase: open, in_progress, closed, deferred, not_applicable
 */
export function recommendationStatusClasses(status: string | null | undefined): string {
  if (!status) {
    return riskTokenClasses('info', 'badge');
  }

  const normalized = status.trim();

  // Handle title-case legacy
  if (normalized === 'Not Started') {
    return riskTokenClasses('high', 'badge'); // → open → high
  }
  if (normalized === 'In Progress') {
    return riskTokenClasses('medium', 'badge'); // → in_progress → medium
  }
  if (normalized === 'Under Review') {
    return riskTokenClasses('info', 'badge'); // → in_progress (review) → info
  }
  if (normalized === 'Completed') {
    return riskTokenClasses('low', 'badge'); // → closed → low
  }
  if (normalized === 'Rejected') {
    return riskTokenClasses('info', 'badge'); // → closed (rejected) → info
  }

  // Handle lowercase canonical (reuse actionStatusClasses)
  return actionStatusClasses(status);
}

/**
 * Grade-Based Risk Band → Risk Token Mapping
 * Critical, High, Medium, Low
 */
export function gradeRiskBandClasses(label: string | null | undefined, variant: 'badge' | 'chip' | 'rowMarker' | 'text' | 'softPanel' = 'badge'): string {
  if (!label) {
    return riskTokenClasses('info', variant);
  }

  const normalized = label.toLowerCase().trim();

  // Critical or High → high
  if (normalized === 'critical' || normalized === 'high') {
    return riskTokenClasses('high', variant);
  }
  // Medium → medium
  if (normalized === 'medium') {
    return riskTokenClasses('medium', variant);
  }
  // Low → low
  if (normalized === 'low') {
    return riskTokenClasses('low', variant);
  }

  return riskTokenClasses('info', variant);
}

/**
 * Legacy Score-Based Risk Band → Risk Token Mapping
 * Very Poor, Poor, Tolerable, Good, Very Good
 */
export function scoreRiskBandClasses(label: string | null | undefined, variant: 'badge' | 'chip' | 'rowMarker' | 'text' | 'softPanel' = 'badge'): string {
  if (!label) {
    return riskTokenClasses('info', variant);
  }

  const normalized = label.toLowerCase().trim();

  // Very Poor or Poor → high
  if (normalized === 'very poor' || normalized === 'poor') {
    return riskTokenClasses('high', variant);
  }
  // Tolerable → medium
  if (normalized === 'tolerable') {
    return riskTokenClasses('medium', variant);
  }
  // Good or Very Good → low
  if (normalized === 'good' || normalized === 'very good') {
    return riskTokenClasses('low', variant);
  }

  return riskTokenClasses('info', variant);
}

/**
 * Focus Ring Class (brand accent)
 */
export function focusRingClass(): string {
  return 'focus:ring-brand-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-ui-surface';
}

/**
 * Legacy: Get classes for priority badges (recommendation priorities)
 * Kept for backward compatibility - redirects to actionPriorityClasses
 */
export function getPriorityBadgeClasses(priority: 'Critical' | 'High' | 'Medium' | 'Low' | string): string {
  const p = priority.toLowerCase();
  if (p === 'critical') {
    return riskTokenClasses('high', 'badge');
  }
  if (p === 'high') {
    return riskTokenClasses('medium', 'badge');
  }
  if (p === 'medium') {
    return riskTokenClasses('low', 'badge');
  }
  if (p === 'low') {
    return riskTokenClasses('info', 'badge');
  }
  return riskTokenClasses('info', 'badge');
}

/**
 * Legacy: Get classes for risk badges
 * Kept for backward compatibility - redirects to gradeRiskBandClasses
 */
export function getRiskBadgeClasses(level: RiskLevel | string): string {
  return gradeRiskBandClasses(level, 'badge');
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
