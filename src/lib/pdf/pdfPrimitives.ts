import { PDFPage, PDFFont, rgb } from 'pdf-lib';
import { PDF_THEME, PdfProduct } from './pdfStyles';
import { wrapText, PDF_DEBUG_LAYOUT, normalizeDisplayValue, sanitizePdfText } from './pdfUtils';

type Fonts = { regular: PDFFont; bold: PDFFont };

const REPORT_HEADING_STYLES = {
  part: {
    size: 16,
    color: rgb(0.35, 0.38, 0.42),
    spacingBelow: 16,
  },
  section: {
    size: 20,
    lineHeight: 24,
    spacingAbove: 20,
    spacingBelow: 20,
    color: PDF_THEME.colours.charcoal,
  },
  module: {
    size: 12,
    lineHeight: 16,
    spacingAbove: 4,
    spacingBelow: 16,
    color: PDF_THEME.colours.charcoal,
  },
} as const;

const REPORT_LAYOUT_SPACING = {
  partToSectionHeader: 12,
  sectionHeaderToBody: REPORT_HEADING_STYLES.section.spacingBelow,
  sectionHeaderToInfoGap: 24,
  sectionToNextHeader: 18,
} as const;

export function getReportHeadingStyles() {
  return REPORT_HEADING_STYLES;
}
export function getReportLayoutSpacing() {
  return REPORT_LAYOUT_SPACING;
}

export function applyReportSpacing(y: number, spacingKey: keyof typeof REPORT_LAYOUT_SPACING): number {
  return y - REPORT_LAYOUT_SPACING[spacingKey];
}
/**
 * Debug helper: Draw bounding box with label for layout debugging
 */
export function drawDebugBox(page: PDFPage, x: number, yTop: number, w: number, h: number, label: string) {
  if (!PDF_DEBUG_LAYOUT) return;
  page.drawRectangle({
    x,
    y: yTop - h,
    width: w,
    height: h,
    borderColor: rgb(0.2, 0.6, 1.0),
    borderWidth: 0.5,
    opacity: 0.25,
  });
  page.drawText(label, {
    x: x + 2,
    y: yTop + 2,
    size: 6,
    color: rgb(0.2, 0.6, 1.0),
  });
}

export function drawDivider(page: PDFPage, x: number, y: number, w: number) {
  page.drawLine({
    start: { x, y },
    end: { x: x + w, y },
    thickness: 1,
    color: PDF_THEME.colours.divider,
  });
}

export function drawSectionHeaderBar(args: {
  page: PDFPage;
  x: number;
  y: number;
  w: number;
  sectionNo?: string;
  title: string;
  product: PdfProduct;
  fonts: Fonts;
}) {
  const { page, x, y, w, sectionNo, title, fonts } = args;

  if (!sectionNo) {
    page.drawText(title, {
      x,
      y,
      size: REPORT_HEADING_STYLES.part.size,
      font: fonts.regular,
      color: REPORT_HEADING_STYLES.part.color,
    });

  drawDivider(page, x, y - 8, w);
    return y - REPORT_HEADING_STYLES.part.spacingBelow - 8;
  }

  const text = `${sectionNo}. ${title}`;
  const drawY = y - REPORT_HEADING_STYLES.section.spacingAbove;

  page.drawText(text, {
    x,
    y: drawY,
    size: REPORT_HEADING_STYLES.section.size,
    font: fonts.bold,
    color: REPORT_HEADING_STYLES.section.color,
  });

  return drawY - REPORT_HEADING_STYLES.section.spacingBelow;
}

function normalizeOutcome(outcome: string) {
  const o = (outcome || '').toLowerCase();
  if (o.includes('compliant') || o === 'ok' || o === 'pass') return { label: 'Compliant', key: 'compliant' as const };
  if (o.includes('minor')) return { label: 'Minor action', key: 'minor' as const };
  if (o.includes('material') || o.includes('major')) return { label: 'Material', key: 'material' as const };
  if (o.includes('info') || o.includes('gap') || o.includes('incomplete')) return { label: 'Info gap', key: 'info' as const };
  return { label: outcome || 'Unknown', key: 'info' as const };
}

export function drawOutcomeBadge(args: {
  page: PDFPage;
  x: number;
  y: number;
  outcome: string;
  fonts: Fonts;
}) {
  const { page, x, y, outcome, fonts } = args;

  const { label, key } = normalizeOutcome(outcome);
  const size = PDF_THEME.typography.meta;
  const padX = PDF_THEME.shapes.badgePadX;
  const padY = PDF_THEME.shapes.badgePadY;

  const textW = fonts.bold.widthOfTextAtSize(label, size);
  const w = textW + padX * 2;
  const h = size + padY * 2;

  page.drawRectangle({
    x,
    y: y - h,
    width: w,
    height: h,
    color: PDF_THEME.colours.outcome[key],
    borderRadius: PDF_THEME.shapes.radius,
  });

  page.drawText(label, {
    x: x + padX,
    y: y - h + padY + 1,
    size,
    font: fonts.bold,
    color: rgb(1, 1, 1),
  });

  return { width: w, height: h };
}

type RiskBandKey = 'trivial' | 'tolerable' | 'moderate' | 'substantial' | 'intolerable';

// Risk band colors now derived from PDF_THEME (token-based)
const RISK_BANDS: { key: RiskBandKey; label: string; color: any }[] = [
  { key: 'trivial',      label: 'Trivial',      color: PDF_THEME.colours.risk.low.fg },
  { key: 'tolerable',    label: 'Tolerable',    color: PDF_THEME.colours.risk.low.fg },
  { key: 'moderate',     label: 'Moderate',     color: PDF_THEME.colours.risk.medium.fg },
  { key: 'substantial',  label: 'Substantial',  color: PDF_THEME.colours.risk.high.fg },
  { key: 'intolerable',  label: 'Intolerable',  color: PDF_THEME.colours.risk.high.fg },
];

function normalizeRiskBandKey(input: string): RiskBandKey {
  const s = (input || '').toLowerCase().trim();
  if (s.includes('trivial')) return 'trivial';
  if (s.includes('tolerable')) return 'tolerable';
  if (s.includes('moderate')) return 'moderate';
  if (s.includes('substantial')) return 'substantial';
  if (s.includes('intolerable')) return 'intolerable';
  return 'substantial';
}

export function drawExecutiveRiskHeader(args: {
  page: any;
  x: number;
  y: number;
  w: number;
  label: string;
  fonts: { regular: any; bold: any };
}) {
  const { page, x, y, w, label, fonts } = args;

  page.drawText(label.toUpperCase(), {
    x,
    y,
    size: 14,
    font: fonts.bold,
    color: PDF_THEME.colours.accent.fra,
  });

  const dividerY = y - 10;
  page.drawLine({
    start: { x, y: dividerY },
    end: { x: x + w, y: dividerY },
    thickness: 1,
    color: PDF_THEME.colours.divider,
  });

  return dividerY - PDF_THEME.rhythm.md;
}

export function drawRiskBadge(args: {
  page: any;
  x: number;
  y: number;
  riskLabel: string;
  fonts: { regular: any; bold: any };
}) {
  const { page, x, y, riskLabel, fonts } = args;

  const bandKey = normalizeRiskBandKey(riskLabel);
  const band = RISK_BANDS.find(b => b.key === bandKey)!;

  const badgeH = 48;
  const padX = 16;
  const text = (riskLabel || band.label).toUpperCase();

  const textW = fonts.bold.widthOfTextAtSize(text, 20);
  const badgeW = Math.min(320, Math.max(220, textW + padX * 2));

  page.drawRectangle({
    x,
    y: y - badgeH,
    width: badgeW,
    height: badgeH,
    color: band.color,
    borderRadius: 6,
  });

  page.drawText(text, {
    x: x + padX,
    y: y - badgeH + 14,
    size: 20,
    font: fonts.bold,
    color: rgb(1, 1, 1),
  });

  return y - badgeH - PDF_THEME.rhythm.lg;
}

export function drawRiskBand(args: {
  page: any;
  x: number;
  y: number;
  w: number;
  riskLabel: string;
  fonts: { regular: any; bold: any };
}) {
  const { page, x, y, w, riskLabel, fonts } = args;

  const activeKey = normalizeRiskBandKey(riskLabel);
  const segmentW = w / 5;
  const bandH = 16;

  for (let i = 0; i < 5; i++) {
    page.drawRectangle({
      x: x + i * segmentW,
      y: y - bandH,
      width: segmentW - 1,
      height: bandH,
      color: rgb(0.93, 0.94, 0.95),
    });
  }

  const activeIndex = RISK_BANDS.findIndex(b => b.key === activeKey);
  const active = RISK_BANDS[activeIndex];

  page.drawRectangle({
    x: x + activeIndex * segmentW,
    y: y - bandH,
    width: segmentW - 1,
    height: bandH,
    color: active.color,
  });

  const labelY = y - bandH - 12;
  const labelSize = 9;

  for (let i = 0; i < 5; i++) {
    const lbl = RISK_BANDS[i].label;
    const lw = fonts.regular.widthOfTextAtSize(lbl, labelSize);

    page.drawText(lbl, {
      x: x + i * segmentW + (segmentW - lw) / 2,
      y: labelY,
      size: labelSize,
      font: fonts.regular,
      color: rgb(0.35, 0.38, 0.42),
    });
  }

  return labelY - PDF_THEME.rhythm.md;
}

export function drawLikelihoodConsequenceBlock(args: {
  page: any;
  x: number;
  y: number;
  w: number;
  likelihood: string;
  consequence: string;
  fonts: { regular: any; bold: any };
}) {
  const { page, x, y, w, likelihood, consequence, fonts } = args;

  const labelSize = 11.5;
  const valueSize = 11.5;
  const rowGap = 14;

  const leftColW = Math.min(260, w * 0.58);
  const rightX = x + leftColW + 10;

  const safeLikelihood = sanitizePdfText(normalizeDisplayValue(likelihood)).trim();
  const safeConsequence = sanitizePdfText(normalizeDisplayValue(consequence)).trim();

  page.drawText('Likelihood of Fire:', {
    x,
    y,
    size: labelSize,
    font: fonts.regular,
    color: PDF_THEME.colours.text,
  });

  page.drawText(safeLikelihood, {
    x: rightX,
    y,
    size: valueSize,
    font: fonts.bold,
    color: PDF_THEME.colours.text,
  });

  const y2 = y - rowGap;

  page.drawText('Consequence to Life if Fire Occurs:', {
    x,
    y: y2,
    size: labelSize,
    font: fonts.regular,
    color: PDF_THEME.colours.text,
  });

  page.drawText(safeConsequence, {
    x: rightX,
    y: y2,
    size: valueSize,
    font: fonts.bold,
    color: PDF_THEME.colours.text,
  });

  // Matrix icon removed per user request
  // const gridSize = 10;
  // const gridX = x + w - (gridSize * 3) - 6;
  // const gridYTop = y - 4;

  // for (let r = 0; r < 3; r++) {
  //   for (let c = 0; c < 3; c++) {
  //     page.drawRectangle({
  //       x: gridX + c * gridSize,
  //       y: (gridYTop - (r + 1) * gridSize),
  //       width: gridSize,
  //       height: gridSize,
  //       borderWidth: 1,
  //       borderColor: rgb(0.75, 0.77, 0.8),
  //       color: rgb(1, 1, 1),
  //     });
  //   }
  // }

  // page.drawRectangle({
  //   x: gridX + 1 * gridSize,
  //   y: gridYTop - (3 * gridSize),
  //   width: gridSize,
  //   height: gridSize,
  //   color: rgb(0.9, 0.92, 0.96),
  //   borderWidth: 1,
  //   borderColor: rgb(0.75, 0.77, 0.8),
  // });

  return y2 - PDF_THEME.rhythm.lg;
}

/**
 * Draw Action Card (Engineering Consultancy Style)
 * Left-stripe colored card with priority, description, and metadata
 */
export function drawActionCard(args: {
  page: any;
  x: number;
  y: number;
  w: number;
  ref?: string;
  description: string;
  priority: string;
  owner?: string;
  target?: string;
  status?: string;
  fonts: { regular: any; bold: any };
}) {
  const { page, x, y, w, ref, description, priority, owner, target, status, fonts } = args;

  const cardPadding = 14;
  const stripeW = 4;
  const titleSize = 11.5;
  const metaSize = 9.5;
  const lineGap = 14;
  const headerRowH = 14;
  const gapAfterHeader = 10;
  const gapBeforeMeta = 10;

  // Priority stripe colors now derived from PDF_THEME (token-based)
  const p = (priority || '').toLowerCase();
  let stripeColor = PDF_THEME.colours.risk.medium.fg;
  if (p.includes('p1') || p.includes('critical')) stripeColor = PDF_THEME.colours.risk.high.fg;
  else if (p.includes('p2') || p.includes('high')) stripeColor = PDF_THEME.colours.risk.medium.fg;
  else if (p.includes('p3') || p.includes('medium')) stripeColor = PDF_THEME.colours.risk.info.fg;
  else if (p.includes('p4') || p.includes('low')) stripeColor = PDF_THEME.colours.risk.info.fg;

  const textX = x + stripeW + cardPadding;
  const maxTextW = w - stripeW - cardPadding * 2;

  // Wrap description
  const lines = wrapText(description, maxTextW, titleSize, fonts.regular);

  // Height calc
  const descH = lines.length * lineGap;
  const metaH = 12;
  const cardH = cardPadding + headerRowH + gapAfterHeader + descH + gapBeforeMeta + metaH + cardPadding;

  page.drawRectangle({ x, y: y - cardH, width: stripeW, height: cardH, color: stripeColor });

  let cursorY = y - cardPadding;

  // Header row: ref on left, priority pill on right
  if (ref) {
    page.drawText(ref, {
      x: textX,
      y: cursorY,
      size: 9.5,
      font: fonts.bold,
      color: PDF_THEME.colours.text,
    });
  }

  // Priority pill on right
  const priorityText = priority.toUpperCase();
  const priorityTextW = fonts.bold.widthOfTextAtSize(priorityText, 9);
  const pillPaddingX = 6;
  const pillPaddingY = 3;
  const pillW = priorityTextW + pillPaddingX * 2;
  const pillH = 12;
  const pillX = x + w - cardPadding - pillW;
  const pillY = cursorY - 2;

  page.drawRectangle({
    x: pillX,
    y: pillY - pillH + pillPaddingY,
    width: pillW,
    height: pillH,
    color: rgb(0.93, 0.94, 0.95),
  });

  page.drawText(priorityText, {
    x: pillX + pillPaddingX,
    y: pillY - pillH + pillPaddingY + 3,
    size: 9,
    font: fonts.bold,
    color: stripeColor,
  });

  cursorY -= (headerRowH + gapAfterHeader);

  // Description lines
  for (const line of lines) {
    page.drawText(line, {
      x: textX,
      y: cursorY,
      size: titleSize,
      font: fonts.regular,
      color: PDF_THEME.colours.text,
    });
    cursorY -= lineGap;
  }

  cursorY -= gapBeforeMeta;

  // Meta row
  const safeStatus = sanitizePdfText(normalizeDisplayValue(status || '-')).trim();
  const metaText = `Owner: ${owner || '(Unassigned)'}   |   Target: ${target || '-'}   |   Status: ${safeStatus}`;
  page.drawText(metaText, {
    x: textX,
    y: cursorY,
    size: metaSize,
    font: fonts.regular,
    color: rgb(0.35, 0.38, 0.42),
  });

  return y - cardH - 12;
}

/**
 * Draw Page Title (Arup-style hierarchy)
 * Main H1-level page heading with rule underneath
 */
export function drawPageTitle(
  page: PDFPage,
  x: number,
  y: number,
  title: string,
  fonts: { regular: PDFFont; bold: PDFFont }
): number {
  const titleLines = wrapText(sanitizePdfText(title), 495, REPORT_HEADING_STYLES.section.size, fonts.bold);
  let cursorY = y;

  for (const line of titleLines) {
    page.drawText(line, {
      x,
      y: cursorY,
      size: REPORT_HEADING_STYLES.section.size,
      font: fonts.bold,
      color: REPORT_HEADING_STYLES.section.color,
    });
    cursorY -= REPORT_HEADING_STYLES.section.lineHeight;
  }

  return cursorY - REPORT_HEADING_STYLES.section.spacingBelow;
}

/**
 * Draw Section Title (Arup-style hierarchy)
 * H2-level section heading
 */
export function drawSectionTitle(
  page: PDFPage,
  x: number,
  y: number,
  title: string,
  fonts: { regular: PDFFont; bold: PDFFont }
): number {
  page.drawText(sanitizePdfText(title), {
    x,
    y,
    size: REPORT_HEADING_STYLES.module.size,
    font: fonts.bold,
    color: REPORT_HEADING_STYLES.module.color,
  });

  return y - REPORT_HEADING_STYLES.module.spacingBelow;
}

export function drawWrappedSubsectionHeading(
  page: PDFPage,
  x: number,
  y: number,
  title: string,
  fonts: Fonts,
  maxWidth = 495,
) {
  const lines = wrapText(sanitizePdfText(title), maxWidth, REPORT_HEADING_STYLES.module.size, fonts.bold);
  const startY = y - REPORT_HEADING_STYLES.module.spacingAbove;
  let cursorY = startY;

  for (const line of lines) {
    page.drawText(line, {
      x,
      y: cursorY,
      size: REPORT_HEADING_STYLES.module.size,
      font: fonts.bold,
      color: REPORT_HEADING_STYLES.module.color,
    });
    cursorY -= REPORT_HEADING_STYLES.module.lineHeight;
  }

  return cursorY - REPORT_HEADING_STYLES.module.spacingBelow;
}

/**
 * Draw Contents Row (aligned number column)
 * Format: "01  Section Title"
 */
export function drawContentsRow(
  page: PDFPage,
  x: number,
  y: number,
  sectionNumber: number,
  title: string,
  fonts: { regular: PDFFont; bold: PDFFont }
): number {
  const numberColWidth = 28;
  const numText = String(sectionNumber).padStart(2, '0');

  page.drawText(numText, {
    x,
    y,
    size: 12,
    font: fonts.bold,
    color: PDF_THEME.colours.text,
  });

  page.drawText(title, {
    x: x + numberColWidth,
    y,
    size: 12,
    font: fonts.regular,
    color: PDF_THEME.colours.text,
  });

  return y - 18;
}

// Action Register Intro Box Constants (private to this module)
const ACTION_REGISTER_INTRO_TITLE = "Action Register";
const ACTION_REGISTER_INTRO_BODY = "The following actions arise from the findings of this Fire Risk Assessment. Each action has been prioritised based on potential life safety impact and overall risk. Recommended timescales should be considered alongside operational constraints and statutory obligations.";
const AR_INTRO_PADDING = 12;
const AR_INTRO_TITLE_GAP = 6;
const AR_INTRO_TITLE_SIZE = 12;
const AR_INTRO_BODY_SIZE = 10.5;
const AR_INTRO_BOX_COLOR = rgb(0.94, 0.94, 0.94);

/**
 * Measure Action Register intro box height deterministically
 * Must match exact rendering logic in drawActionRegisterIntroBox
 */
export function measureActionRegisterIntroBoxHeight(args: {
  w: number;
  fonts: Fonts;
}): {
  height: number;
  bodyLines: string[];
  titleLineHeight: number;
  bodyLineHeight: number;
} {
  const { w, fonts } = args;
  const innerW = w - 2 * AR_INTRO_PADDING;

  // Wrap body text
  const bodyLines = wrapText(
    ACTION_REGISTER_INTRO_BODY,
    innerW,
    AR_INTRO_BODY_SIZE,
    fonts.regular
  );

  // Calculate line heights
  const titleLineHeight = PDF_THEME.typography.lineHeight(AR_INTRO_TITLE_SIZE);
  const bodyLineHeight = PDF_THEME.typography.lineHeight(AR_INTRO_BODY_SIZE);

  // Calculate total body height
  const bodyHeight = bodyLines.length * bodyLineHeight;

  // Total height: top padding + title + gap + body + bottom padding
  const height = AR_INTRO_PADDING + titleLineHeight + AR_INTRO_TITLE_GAP + bodyHeight + AR_INTRO_PADDING;

  return { height, bodyLines, titleLineHeight, bodyLineHeight };
}

/**
 * Draw Action Register intro box
 * Rendering logic must match measurement in measureActionRegisterIntroBoxHeight
 */
export function drawActionRegisterIntroBox(args: {
  page: PDFPage;
  x: number;
  y: number;
  w: number;
  fonts: Fonts;
  product: PdfProduct;
}): { y: number; height: number } {
  const { page, x, y, w, fonts } = args;

  // Measure first to get exact dimensions
  const measurement = measureActionRegisterIntroBoxHeight({ w, fonts });
  const { height, bodyLines, titleLineHeight, bodyLineHeight } = measurement;

  // Draw background rectangle
  page.drawRectangle({
    x,
    y: y - height,
    width: w,
    height,
    color: AR_INTRO_BOX_COLOR,
  });

  // Draw text using top-down cursor that EXACTLY matches measurement
  const textX = x + AR_INTRO_PADDING;
  let cursorY = y - AR_INTRO_PADDING;

  // Draw title
  cursorY -= titleLineHeight;
  page.drawText(ACTION_REGISTER_INTRO_TITLE, {
    x: textX,
    y: cursorY,
    size: AR_INTRO_TITLE_SIZE,
    font: fonts.bold,
    color: PDF_THEME.colours.text,
  });

  // Gap after title
  cursorY -= AR_INTRO_TITLE_GAP;

  // Draw body lines
  for (const line of bodyLines) {
    cursorY -= bodyLineHeight;
    page.drawText(line, {
      x: textX,
      y: cursorY,
      size: AR_INTRO_BODY_SIZE,
      font: fonts.regular,
      color: PDF_THEME.colours.text,
    });
  }

  // Return bottom Y position and height
  return { y: y - height, height };
}
