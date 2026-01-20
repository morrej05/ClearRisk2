import { PDFDocument, PDFPage, rgb } from 'pdf-lib';

export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
export const MARGIN = 50;
export const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

export function sanitizePdfText(input: unknown): string {
  const s = (input ?? '').toString();

  let sanitized = s
    .replace(/⚠/g, '!')
    .replace(/✅/g, '[OK]')
    .replace(/❌/g, '[X]')
    .replace(/✓/g, '[OK]')
    .replace(/✗/g, '[X]')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/…/g, '...')
    .replace(/•/g, '*')
    .replace(/°/g, ' deg')
    .replace(/×/g, 'x')
    .replace(/÷/g, '/')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≠/g, '!=')
    .replace(/€/g, 'EUR')
    .replace(/¢/g, 'c')
    .replace(/™/g, '(TM)')
    .replace(/®/g, '(R)')
    .replace(/©/g, '(C)');

  sanitized = sanitized.replace(/[^\x20-\x7E\xA0-\xFF]/g, '');

  return sanitized;
}

export function wrapText(text: unknown, maxWidth: number, fontSize: number, font: any): string[] {
  const safe = sanitizePdfText(text).trim();

  if (!safe) {
    return [''];
  }

  const words = safe.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getRatingColor(rating: string): { r: number; g: number; b: number } {
  switch (rating.toLowerCase()) {
    case 'low':
      return rgb(0.13, 0.55, 0.13);
    case 'medium':
      return rgb(0.85, 0.65, 0.13);
    case 'high':
      return rgb(0.9, 0.5, 0.13);
    case 'intolerable':
      return rgb(0.8, 0.13, 0.13);
    default:
      return rgb(0.5, 0.5, 0.5);
  }
}

export function getOutcomeColor(outcome: string): { r: number; g: number; b: number } {
  switch (outcome) {
    case 'compliant':
      return rgb(0.13, 0.55, 0.13);
    case 'minor_def':
      return rgb(0.85, 0.65, 0.13);
    case 'material_def':
      return rgb(0.8, 0.13, 0.13);
    case 'info_gap':
      return rgb(0.2, 0.5, 0.8);
    case 'na':
      return rgb(0.6, 0.6, 0.6);
    default:
      return rgb(0.7, 0.7, 0.7);
  }
}

export function getOutcomeLabel(outcome: string): string {
  switch (outcome) {
    case 'compliant':
      return 'Compliant';
    case 'minor_def':
      return 'Minor Deficiency';
    case 'material_def':
      return 'Material Deficiency';
    case 'info_gap':
      return 'Information Gap';
    case 'na':
      return 'Not Applicable';
    default:
      return 'Pending';
  }
}

export function getPriorityColor(priority: string): { r: number; g: number; b: number } {
  switch (priority) {
    case 'P1':
      return rgb(0.8, 0.13, 0.13);
    case 'P2':
      return rgb(0.9, 0.5, 0.13);
    case 'P3':
      return rgb(0.85, 0.65, 0.13);
    case 'P4':
      return rgb(0.2, 0.5, 0.8);
    default:
      return rgb(0.5, 0.5, 0.5);
  }
}

export function drawDraftWatermark(page: PDFPage) {
  const width = page.getWidth();
  const height = page.getHeight();

  page.drawText('DRAFT', {
    x: width / 2 - 80,
    y: height / 2,
    size: 80,
    color: rgb(0.9, 0.9, 0.9),
    opacity: 0.3,
    rotate: { type: 'degrees', angle: -45 },
  });
}

export function addNewPage(pdfDoc: PDFDocument, isDraft: boolean, totalPages: PDFPage[]): { page: PDFPage } {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  totalPages.push(page);
  if (isDraft) {
    drawDraftWatermark(page);
  }
  return { page };
}

export function drawFooter(page: PDFPage, text: string, pageNum: number, totalPages: number, font: any) {
  const sanitizedText = sanitizePdfText(text);
  page.drawText(sanitizedText, {
    x: MARGIN,
    y: MARGIN - 30,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pageText = sanitizePdfText(`Page ${pageNum} of ${totalPages}`);
  const pageTextWidth = font.widthOfTextAtSize(pageText, 8);
  page.drawText(pageText, {
    x: PAGE_WIDTH - MARGIN - pageTextWidth,
    y: MARGIN - 30,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
}
