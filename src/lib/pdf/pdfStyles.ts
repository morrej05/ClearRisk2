import { rgb } from 'pdf-lib';
import { TOKENS, hexToPdfRgb } from '../../theme/tokens';

/**
 * PDF Theme System - Token-Based
 * Uses single source of truth from src/theme/tokens.ts
 * Section headers are NEUTRAL to avoid client logo clashes
 * Risk colors only for badges, markers, and matrices
 */

export const PDF_STYLES = {
  fontSizes: {
    h1: 19,
    body: 11,
    meta: 9,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
  },
  colours: {
    h1: rgb(0.1, 0.1, 0.1),
    meta: rgb(0.4, 0.4, 0.4),
    divider: rgb(0.85, 0.85, 0.85),
  },
  blocks: {
    sectionHeader: 88,
    sectionHeaderWithSummary: 140,
  },
};

// Convert tokens to PDF RGB format (0-1 floats)
const uiColors = {
  ink: rgb(...Object.values(hexToPdfRgb(TOKENS.ui.ink))),
  text: rgb(...Object.values(hexToPdfRgb(TOKENS.ui.text))),
  muted: rgb(...Object.values(hexToPdfRgb(TOKENS.ui.muted))),
  surface: rgb(...Object.values(hexToPdfRgb(TOKENS.ui.surface))),
  card: rgb(...Object.values(hexToPdfRgb(TOKENS.ui.card))),
  border: rgb(...Object.values(hexToPdfRgb(TOKENS.ui.border))),
  divider: rgb(...Object.values(hexToPdfRgb(TOKENS.ui.divider))),
};

const brandColors = {
  accent: rgb(...Object.values(hexToPdfRgb(TOKENS.brand.accent))),
  accentHover: rgb(...Object.values(hexToPdfRgb(TOKENS.brand.accentHover))),
  accentSoft: rgb(...Object.values(hexToPdfRgb(TOKENS.brand.accentSoft))),
};

const riskColors = {
  high: {
    fg: rgb(...Object.values(hexToPdfRgb(TOKENS.risk.high.fg))),
    bg: rgb(...Object.values(hexToPdfRgb(TOKENS.risk.high.bg))),
    border: rgb(...Object.values(hexToPdfRgb(TOKENS.risk.high.border))),
  },
  medium: {
    fg: rgb(...Object.values(hexToPdfRgb(TOKENS.risk.medium.fg))),
    bg: rgb(...Object.values(hexToPdfRgb(TOKENS.risk.medium.bg))),
    border: rgb(...Object.values(hexToPdfRgb(TOKENS.risk.medium.border))),
  },
  low: {
    fg: rgb(...Object.values(hexToPdfRgb(TOKENS.risk.low.fg))),
    bg: rgb(...Object.values(hexToPdfRgb(TOKENS.risk.low.bg))),
    border: rgb(...Object.values(hexToPdfRgb(TOKENS.risk.low.border))),
  },
  info: {
    fg: rgb(...Object.values(hexToPdfRgb(TOKENS.risk.info.fg))),
    bg: rgb(...Object.values(hexToPdfRgb(TOKENS.risk.info.bg))),
    border: rgb(...Object.values(hexToPdfRgb(TOKENS.risk.info.border))),
  },
};

export const PDF_THEME = {
  typography: {
    title: 26,
    section: 18,
    module: 14,
    body: 11.5,
    meta: 9.5,
    tableHeader: 10.5,
    lineHeight: (size: number) => Math.round(size * 1.35 * 10) / 10,
  },

  rhythm: {
    xs: 4,
    sm: 6,
    md: 12,
    lg: 18,
    xl: 24,
  },

  colours: {
    // UI neutrals (token-based)
    ...uiColors,

    // Brand (token-based)
    brand: brandColors,

    // Risk levels (token-based, semantic only)
    risk: riskColors,

    // Legacy accent colors (kept for gradual migration, but should be avoided)
    accent: {
      fra: brandColors.accent,      // Map to neutral brand accent
      fsd: brandColors.accent,       // Map to neutral brand accent
      dsear: brandColors.accent,     // Map to neutral brand accent
      re: brandColors.accent,        // Map to neutral brand accent
      combined: brandColors.accent,  // Map to neutral brand accent
    },

    // Outcome colors (mapped to risk tokens)
    outcome: {
      compliant: riskColors.low.fg,
      minor: riskColors.medium.fg,
      material: riskColors.high.fg,
      info: riskColors.info.fg,
    },

    // Priority colors (mapped to risk tokens)
    priority: {
      high: riskColors.high.fg,
      medium: riskColors.medium.fg,
      low: riskColors.low.fg,
    },
  },

  shapes: {
    radius: 6,
    badgePadX: 6,
    badgePadY: 3,
    headerBarH: 28,
    stripeW: 5,
  },
} as const;

export type PdfProduct = keyof typeof PDF_THEME.colours.accent;
