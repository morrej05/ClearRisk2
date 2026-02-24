import { PDFPage, PDFFont, rgb } from 'pdf-lib';
import { PDF_THEME, PdfProduct } from './pdfStyles';
import { wrapText } from './pdfUtils';

type Fonts = { regular: PDFFont; bold: PDFFont };

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
  const { page, x, y, w, sectionNo, title, product, fonts } = args;

  const barH = PDF_THEME.shapes.headerBarH;
  const accent = PDF_THEME.colours.accent[product] ?? PDF_THEME.colours.accent.combined;

  page.drawRectangle({
    x,
    y: y - barH,
    width: w,
    height: barH,
    color: accent,
  });

  const text = sectionNo ? `${sectionNo}   ${title}` : title;

  page.drawText(text, {
    x: x + 10,
    y: y - barH + 4,
    size: PDF_THEME.typography.section,
    font: fonts.bold,
    color: rgb(1, 1, 1),
  });

  drawDivider(page, x, y - barH - 6, w);

  return y - barH - PDF_THEME.rhythm.md;
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

const RISK_BANDS: { key: RiskBandKey; label: string; color: any }[] = [
  { key: 'trivial',      label: 'Trivial',      color: rgb(0.25, 0.55, 0.35) },
  { key: 'tolerable',    label: 'Tolerable',    color: rgb(0.45, 0.65, 0.35) },
  { key: 'moderate',     label: 'Moderate',     color: rgb(0.75, 0.65, 0.2)  },
  { key: 'substantial',  label: 'Substantial',  color: rgb(0.75, 0.45, 0.15) },
  { key: 'intolerable',  label: 'Intolerable',  color: rgb(0.65, 0.15, 0.15) },
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

  page.drawText('Likelihood of Fire:', {
    x,
    y,
    size: labelSize,
    font: fonts.regular,
    color: PDF_THEME.colours.text,
  });

  page.drawText(String(likelihood || '').trim(), {
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

  page.drawText(String(consequence || '').trim(), {
    x: rightX,
    y: y2,
    size: valueSize,
    font: fonts.bold,
    color: PDF_THEME.colours.text,
  });

  const gridSize = 10;
  const gridX = x + w - (gridSize * 3) - 6;
  const gridYTop = y - 4;

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      page.drawRectangle({
        x: gridX + c * gridSize,
        y: (gridYTop - (r + 1) * gridSize),
        width: gridSize,
        height: gridSize,
        borderWidth: 1,
        borderColor: rgb(0.75, 0.77, 0.8),
        color: rgb(1, 1, 1),
      });
    }
  }

  page.drawRectangle({
    x: gridX + 1 * gridSize,
    y: gridYTop - (3 * gridSize),
    width: gridSize,
    height: gridSize,
    color: rgb(0.9, 0.92, 0.96),
    borderWidth: 1,
    borderColor: rgb(0.75, 0.77, 0.8),
  });

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

  const cardPadding = 12;
  const stripeW = 4;
  const titleSize = 11.5;
  const metaSize = 9.5;
  const lineGap = 14;

  const p = (priority || '').toLowerCase();
  let stripeColor = rgb(0.75, 0.45, 0.15);
  if (p.includes('p1') || p.includes('critical')) stripeColor = rgb(0.65, 0.15, 0.15);
  else if (p.includes('p2') || p.includes('high')) stripeColor = rgb(0.70, 0.35, 0.10);
  else if (p.includes('p3') || p.includes('medium')) stripeColor = rgb(0.75, 0.65, 0.20);
  else if (p.includes('p4') || p.includes('low')) stripeColor = rgb(0.12, 0.29, 0.55);

  const textX = x + stripeW + cardPadding;
  const maxTextW = w - stripeW - cardPadding * 2;

  // Wrap description
  const lines = wrapText(description, maxTextW, titleSize, fonts.regular);

  // Height calc
  const badgeRowH = 12;
  const descH = lines.length * lineGap;
  const metaH = 12;
  const cardH = cardPadding + badgeRowH + 8 + descH + 8 + metaH + cardPadding;

  page.drawRectangle({ x, y: y - cardH, width: stripeW, height: cardH, color: stripeColor });

  let cursorY = y - cardPadding;

  // Top row: "FRA-2026-001 • P4" or just "P4"
  const topLabel = ref ? `${ref} • ${priority}` : priority;
  page.drawText(topLabel.toUpperCase(), {
    x: textX,
    y: cursorY,
    size: 9,
    font: fonts.bold,
    color: stripeColor,
  });
  cursorY -= 18;

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

  // Meta row
  const metaText = `Owner: ${owner || '(Unassigned)'}   |   Target: ${target || '-'}   |   Status: ${status || '-'}`;
  page.drawText(metaText, {
    x: textX,
    y: cursorY - 2,
    size: metaSize,
    font: fonts.regular,
    color: rgb(0.35, 0.38, 0.42),
  });

  return y - cardH - 12;
}
