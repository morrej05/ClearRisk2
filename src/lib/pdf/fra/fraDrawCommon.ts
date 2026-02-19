/**
 * FRA PDF Common Drawing Functions
 * Shared utilities for rendering FRA PDF sections
 */

import { PDFDocument, PDFPage, rgb } from 'pdf-lib';
import type { Cursor } from '../pdfCursor';
import { MARGIN, CONTENT_WIDTH, sanitizePdfText, wrapText, addNewPage } from '../pdfUtils';
import { PAGE_TOP_Y } from '../pdfCursor';

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

  let yPosition = initialY - 20;

  const headerText = `${sectionId}. ${sectionTitle}`;
  page.drawText(headerText, {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  yPosition -= 30;
  return { page, yPosition };
}
