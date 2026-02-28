import { PDFDocument, PDFPage } from 'pdf-lib';
import { addNewPage, PAGE_HEIGHT, MARGIN, PAGE_TOP_Y, PDF_DEBUG_LAYOUT, drawDebugLabel } from './pdfUtils';

/**
 * Cursor type for tracking current page and Y position during PDF layout.
 * This ensures page ownership propagates correctly through layout functions,
 * preventing overlapping content when addNewPage() is called internally.
 *
 * INVARIANT: page is NEVER undefined. All functions guarantee this.
 */
export type Cursor = { page: PDFPage; yPosition: number };

/**
 * Ensures we have a valid Cursor with non-undefined page.
 * If cursor is missing or page is undefined, creates/reuses a page.
 *
 * @param cursor - Partial cursor (may be null/undefined or have missing page)
 * @param pdfDoc - PDF document
 * @param isDraft - Whether this is a draft (for watermark)
 * @param totalPages - Array of all pages created
 * @returns Valid Cursor with guaranteed non-undefined page
 */
export function ensureCursor(
  cursor: Partial<Cursor> | null | undefined,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): Cursor {
  // If we have a valid page, use it
  if (cursor?.page) {
    return {
      page: cursor.page,
      yPosition: typeof cursor.yPosition === 'number' ? cursor.yPosition : PAGE_TOP_Y,
    };
  }

  // Otherwise, try to reuse last page or create new one
  const existingPage = totalPages[totalPages.length - 1];
  if (existingPage) {
    return {
      page: existingPage,
      yPosition: typeof cursor?.yPosition === 'number' ? cursor.yPosition : PAGE_TOP_Y,
    };
  }

  // No pages exist yet - create first page
  const init = addNewPage(pdfDoc, isDraft, totalPages);
  return {
    page: init.page,
    yPosition: PAGE_TOP_Y,
  };
}

/**
 * Ensures sufficient vertical space is available on current page.
 * If not enough space, creates a new page and returns updated cursor.
 *
 * @param requiredHeight - Height needed in points
 * @param cursor - Current cursor position
 * @param pdfDoc - PDF document
 * @param isDraft - Whether this is a draft
 * @param totalPages - Array of all pages
 * @returns Updated cursor with guaranteed space
 */
export function ensureSpace(
  requiredHeight: number,
  cursor: Cursor,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): Cursor {
  // Check if we have enough space
  if (cursor.yPosition - requiredHeight < MARGIN + 50) {
    // Annotate page break trigger in debug mode
    if (PDF_DEBUG_LAYOUT && cursor.page) {
      drawDebugLabel(
        cursor.page,
        MARGIN,
        cursor.yPosition + 6,
        `PAGE BREAK: y=${Math.round(cursor.yPosition)} need=${Math.round(requiredHeight)}`
      );
    }

    // Not enough space - create new page
    const init = addNewPage(pdfDoc, isDraft, totalPages);
    return {
      page: init.page,
      yPosition: PAGE_TOP_Y,
    };
  }

  // Enough space - return unchanged
  return cursor;
}
