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
    return { page: result.page, yPosition: PAGE_HEIGHT - MARGIN };
  }
  return { page: currentPage, yPosition: currentY };
}

/**
 * Draw Key Points block
 */
export function drawKeyPointsBlock(input: DrawKeyPointsBlockInput): DrawKeyPointsBlockResult {
  let { page, keyPoints, font, fontBold, yPosition, pdfDoc, isDraft, totalPages } = input;

  if (!keyPoints?.length) return { page, yPosition };

  // Typography + spacing constants (tuned for compact, premium feel)
  const headingSize = 10.5;
  const bulletSize = 10;
  const lineGap = 13;          // line height
  const blockTopGap = 10;      // space before heading
  const headingGap = 8;        // space after heading
  const bulletGap = 3;         // space between bullets

  const bulletIndentX = MARGIN + 8;
  const textIndentX = MARGIN + 20;
  const maxWidth = CONTENT_WIDTH - (textIndentX - MARGIN);

  // Ensure space for heading + at least 1–2 lines of bullets
  ({ page, yPosition } = ensureSpace(55, page, yPosition, pdfDoc, isDraft, totalPages));

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
  for (const rawPoint of keyPoints) {
    const point = (rawPoint ?? '').trim();
    if (!point) continue;

    // Wrap to available width; keep wrap params consistent with font size
    const wrappedLines = wrapText(point, maxWidth, bulletSize, font);

    // Estimate height needed for this bullet (lines + small gap)
    const needed = Math.max(1, wrappedLines.length) * lineGap + bulletGap;
    ({ page, yPosition } = ensureSpace(needed + 8, page, yPosition, pdfDoc, isDraft, totalPages));

    // First line with bullet glyph
    const first = sanitizePdfText(wrappedLines[0] ?? point);
    page.drawText('-', {
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
