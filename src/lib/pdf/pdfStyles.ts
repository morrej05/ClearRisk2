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
    sectionHeader: 72,
    sectionHeaderWithSummary: 120,
  },
};
