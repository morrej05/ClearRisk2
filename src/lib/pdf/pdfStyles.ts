import { rgb } from 'pdf-lib';

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
    text: rgb(0.12, 0.16, 0.2),
    divider: rgb(0.9, 0.91, 0.92),

    accent: {
      fra: rgb(0.65, 0.12, 0.12),
      fsd: rgb(0.5, 0.1, 0.15),
      dsear: rgb(0.78, 0.55, 0.1),
      re: rgb(0.12, 0.29, 0.55),
      combined: rgb(0.15, 0.15, 0.18),
    },

    outcome: {
      compliant: rgb(0.12, 0.55, 0.32),
      minor: rgb(0.82, 0.55, 0.12),
      material: rgb(0.76, 0.16, 0.16),
      info: rgb(0.55, 0.58, 0.62),
    },

    priority: {
      high: rgb(0.76, 0.16, 0.16),
      medium: rgb(0.82, 0.55, 0.12),
      low: rgb(0.12, 0.29, 0.55),
    },
  },

  shapes: {
    radius: 6,
    badgePadX: 6,
    badgePadY: 3,
    headerBarH: 18,
    stripeW: 5,
  },
} as const;

export type PdfProduct = keyof typeof PDF_THEME.colours.accent;
