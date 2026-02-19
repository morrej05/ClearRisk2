/**
 * FRA PDF Common Drawing Functions
 * Shared utilities for rendering FRA PDF sections
 */

import { PDFDocument, PDFPage, rgb } from 'pdf-lib';
import type { Cursor } from '../pdfCursor';
import { MARGIN, CONTENT_WIDTH, sanitizePdfText, wrapText, addNewPage } from '../pdfUtils';
import { PAGE_TOP_Y } from '../pdfCursor';
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

  const headerText = `${sectionId}. ${sectionTitle}`;
  page.drawText(headerText, {
    x: MARGIN,
    y: yPosition,
    size: PDF_STYLES.fontSizes.h1,
    font: fontBold,
    color: PDF_STYLES.colours.h1,
  });

  // Divider
  yPosition -= PDF_STYLES.spacing.sm;

  page.drawLine({
    start: { x: MARGIN, y: yPosition },
    end: { x: MARGIN + CONTENT_WIDTH, y: yPosition },
    thickness: 1,
    color: PDF_STYLES.colours.divider,
  });

  // Bottom spacing
  yPosition -= PDF_STYLES.spacing.md;

  return { page, yPosition };
}
