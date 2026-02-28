/**
 * FRA PDF Common Drawing Functions
 * Shared utilities for rendering FRA PDF sections
 */

import { PDFDocument, PDFPage, rgb } from 'pdf-lib';
import type { Cursor } from '../pdfCursor';
import { MARGIN, CONTENT_WIDTH, PAGE_TOP_Y, sanitizePdfText, wrapText, addNewPage } from '../pdfUtils';
import { PDF_STYLES } from '../pdfStyles';

/**
 * Draw section header with ID and title
 * INVARIANT: cursor.page must not be undefined
 */
export function drawSectionHeader(
  cursor: Cursor,
  sectionId: number,
  sectionTitle: string,
  font: any,
  fontBold: any
): Cursor {
  const { page, yPosition: initialY } = cursor;

  if (!page) {
    throw new Error(`[PDF] drawSectionHeader received missing page (section=${sectionId} ${sectionTitle})`);
  }

  let yPosition = initialY - PDF_STYLES.spacing.lg;

  const headerBarH = 32;

  // Subtle header band
  page.drawRectangle({
    x: MARGIN,
    y: yPosition - headerBarH,
    width: CONTENT_WIDTH,
    height: headerBarH,
    color: PDF_STYLES.colours.divider,
  });

  // Left accent rule
  page.drawRectangle({
    x: MARGIN,
    y: yPosition - headerBarH,
    width: 3,
    height: headerBarH,
    color: rgb(0.3, 0.3, 0.3),
  });

  const headerText = `${sectionId}. ${sectionTitle}`;

  // Center text vertically in bar
  const textYOffset = (headerBarH - PDF_STYLES.fontSizes.h1) / 2 + 2;

  page.drawText(headerText, {
    x: MARGIN + 10,
    y: yPosition - headerBarH + textYOffset,
    size: PDF_STYLES.fontSizes.h1,
    font: fontBold,
    color: PDF_STYLES.colours.h1,
  });

  // Bottom spacing
  yPosition -= headerBarH + PDF_STYLES.spacing.md;

  return { page, yPosition };
}
