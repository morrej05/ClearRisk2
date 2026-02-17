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

  // Nothing to render if no key points
  if (!keyPoints || keyPoints.length === 0) {
    return { page, yPosition };
  }

  // Ensure space for heading + at least first bullet
  const spaceResult = ensureSpace(80, page, yPosition, pdfDoc, isDraft, totalPages);
  page = spaceResult.page;
  yPosition = spaceResult.yPosition;

  // Draw "Key Points" subheading
  yPosition -= 20;
  page.drawText('Key Points:', {
    x: MARGIN,
    y: yPosition,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  yPosition -= 18;

  // Draw each bullet
  for (const point of keyPoints) {
    // Ensure space for this bullet (estimate ~3 lines max per bullet)
    const bulletResult = ensureSpace(50, page, yPosition, pdfDoc, isDraft, totalPages);
    page = bulletResult.page;
    yPosition = bulletResult.yPosition;

    // Wrap text for bullet
    const wrappedLines = wrapText(point, CONTENT_WIDTH - 20, 10, font);

    // Draw first line with bullet
    if (wrappedLines.length > 0) {
      const firstLine = sanitizePdfText('• ' + wrappedLines[0]);
      page.drawText(firstLine, {
        x: MARGIN + 5,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }

    // Draw subsequent wrapped lines (indented, no bullet)
    for (let i = 1; i < wrappedLines.length; i++) {
      const lineResult = ensureSpace(14, page, yPosition, pdfDoc, isDraft, totalPages);
      page = lineResult.page;
      yPosition = lineResult.yPosition;

      const line = sanitizePdfText(wrappedLines[i]);
      page.drawText(line, {
        x: MARGIN + 15, // Indent continuation lines
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }

    // Small spacing between bullets
    yPosition -= 4;
  }

  // Add spacing after Key Points block (before next section content)
  yPosition -= 10;

  return { page, yPosition };
}
