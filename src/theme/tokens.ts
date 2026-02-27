/**
 * Design Token System - Single Source of Truth
 * Choice B: Neutral + Subtle Slate Accent with Muted Semantic Risk Colors
 *
 * USAGE RULES:
 * - UI neutrals for all general UI elements
 * - Brand accent for primary actions and subtle emphasis
 * - Risk colors ONLY for semantic badges, markers, and risk matrices
 * - NO strong saturated colors in large blocks
 */

export const TOKENS = {
  ui: {
    ink: '#111827',       // Primary text, headings
    text: '#374151',      // Body text
    muted: '#6B7280',     // Secondary text, labels
    surface: '#F9FAFB',   // Page background
    card: '#FFFFFF',      // Card background
    border: '#E5E7EB',    // Borders, dividers
    divider: '#F1F5F9',   // Subtle dividers
  },

  brand: {
    accent: '#2F3E4E',        // Primary brand color
    accentHover: '#1E293B',   // Hover state
    accentSoft: '#EEF2F7',    // Light background for brand elements
  },

  risk: {
    high: {
      fg: '#9B1C1C',       // Dark red text
      bg: '#FDECEC',       // Light red background
      border: '#F5C2C2',   // Red border
    },
    medium: {
      fg: '#B45309',       // Dark amber text
      bg: '#FFF4E5',       // Light amber background
      border: '#FAD7B5',   // Amber border
    },
    low: {
      fg: '#166534',       // Dark green text
      bg: '#EAF7EE',       // Light green background
      border: '#B7E4C7',   // Green border
    },
    info: {
      fg: '#475569',       // Dark slate text
      bg: '#F1F5F9',       // Light slate background
      border: '#CBD5E1',   // Slate border
    },
  },
} as const;

/**
 * Convert hex color to RGB triplet (0-255)
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert hex color to PDF-lib RGB (0-1 floats)
 */
export function hexToPdfRgb(hex: string): { r: number; g: number; b: number } {
  const { r, g, b } = hexToRgb(hex);
  return {
    r: r / 255,
    g: g / 255,
    b: b / 255,
  };
}

export type RiskLevel = 'high' | 'medium' | 'low' | 'info';
