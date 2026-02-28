/**
 * Render Key Points block in PDF
 *
 * Compact bullet list after assessor summary, before detailed section content.
 */

import { PDFPage, PDFDocument, rgb } from 'pdf-lib';
import {
  MARGIN,
  CONTENT_WIDTH,
  PAGE_HEIGHT,
  PAGE_TOP_Y,
  wrapText,
  sanitizePdfText,
  addNewPage,
} from '../pdfUtils';

interface DrawKeyPointsBlockInput {
  page: PDFPage;
  keyPoints: string[];
  font: any;
  fontBold: any;
  yPosition: number;
  pdfDoc: PDFDocument;
  isDraft: boolean;
  totalPages: PDFPage[];
}

interface DrawKeyPointsBlockResult {
  page: PDFPage;
  yPosition: number;
}

/**
 * Ensure enough space on current page, or create new page
 */
function ensureSpace(
  requiredHeight: number,
  currentPage: PDFPage,
  currentY: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  if (currentY - requiredHeight < MARGIN + 50) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    return { page: result.page, yPosition: PAGE_TOP_Y };
  }
  return { page: currentPage, yPosition: currentY };
}

/**
 * Draw Key Points block
 */
export function drawKeyPointsBlock(input: DrawKeyPointsBlockInput): DrawKeyPointsBlockResult {
  let { page, keyPoints, font, fontBold, yPosition, pdfDoc, isDraft, totalPages } = input;
    // Remove any existing bullet markers from input strings
  const normalizePoint = (s: string) =>
  (s ?? '')
    .toString()
    .trim()
    // strip common bullets including weird PDF substitutions
    .replace(/^([•\u2022\u25CF\u25A0\u25AA\-\*\u00B7]+)\s+/, '');

  // Early return: don't reserve space or draw heading if no points
  if (!keyPoints?.length) return { page, yPosition };

  // Filter out empty points
  const validPoints = keyPoints.filter(p => normalizePoint(String(p ?? '')));
  if (!validPoints.length) return { page, yPosition };

  // Typography + spacing constants (tuned for compact, premium feel)
  const headingSize = 10.5;
  const bulletSize = 10;
  const lineGap = 12;          // line height
  const blockTopGap = 4;       // space before heading
  const headingGap = 16;        // space after heading
  const bulletGap = 2;         // space between bullets

  const bulletIndentX = MARGIN + 12;
  const textIndentX = MARGIN + 26;
  const maxWidth = CONTENT_WIDTH - (textIndentX - MARGIN);

  // Ensure space for heading + at least 1 line of bullet
  ({ page, yPosition } = ensureSpace(40, page, yPosition, pdfDoc, isDraft, totalPages));

  // Top gap (small, consistent with other blocks)
  yPosition -= blockTopGap;

  // Heading (no colon)
  page.drawText('Key Points', {
    x: MARGIN,
    y: yPosition,
    size: headingSize,
    font: fontBold,
    color: rgb(0.12, 0.12, 0.12),
  });

  yPosition -= headingGap;

  // Bullets
  for (const rawPoint of validPoints) {
        const point = normalizePoint(String(rawPoint ?? ''));
if (!point) continue;

const wrappedLines = wrapText(point, maxWidth, bulletSize, font);

    // Estimate height needed for this bullet (lines + small gap)
    const needed = Math.max(1, wrappedLines.length) * lineGap + bulletGap;
    ({ page, yPosition } = ensureSpace(needed + 8, page, yPosition, pdfDoc, isDraft, totalPages));

    // First line with bullet glyph
    const first = sanitizePdfText(wrappedLines[0] ?? point);
    page.drawText(sanitizePdfText('•'), {
      x: bulletIndentX,
      y: yPosition,
      size: bulletSize,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    page.drawText(first, {
      x: textIndentX,
      y: yPosition,
      size: bulletSize,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= lineGap;

    // Continuation lines
    for (let i = 1; i < wrappedLines.length; i++) {
      ({ page, yPosition } = ensureSpace(lineGap + 4, page, yPosition, pdfDoc, isDraft, totalPages));
      const line = sanitizePdfText(wrappedLines[i]);
      page.drawText(line, {
        x: textIndentX,
        y: yPosition,
        size: bulletSize,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= lineGap;
    }

    // Small spacing between bullets
    yPosition -= bulletGap;
  }

  // Small spacing after block (keep compact)
  yPosition -= 6;

  return { page, yPosition };
}
