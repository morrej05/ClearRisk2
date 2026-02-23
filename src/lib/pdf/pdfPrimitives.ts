import { PDFPage, PDFFont, rgb } from 'pdf-lib';
import { PDF_THEME, PdfProduct } from './pdfStyles';

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
