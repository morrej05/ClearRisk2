import { PDFDocument, PDFPage, rgb, degrees, StandardFonts } from 'pdf-lib';
import { compareActionsByDisplayReference, filterActiveActions } from './actionContracts';

export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
export const MARGIN = 50;
export const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
export const PAGE_TOP_Y = PAGE_HEIGHT - MARGIN;
export const REPORT_TITLE_TO_BODY_GAP = 20;
export const REPORT_BODY_TEXT_SIZE = 11;
export const REPORT_BODY_LINE_GAP = 16;
export const REPORT_BODY_PARAGRAPH_GAP = 10;

// PDF Debug Layout Mode - developer-only overlay for spacing/pagination tuning
// export const PDF_DEBUG_LAYOUT = import.meta.env.VITE_PDF_DEBUG_LAYOUT === 'true';
export const PDF_DEBUG_LAYOUT = false;

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
    .replace(/©/g, '(C)')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/⇒/g, '=>');

  // Preserve line breaks/tabs for narrative rendering while still stripping
  // unsupported control characters for PDF font output.
  sanitized = sanitized
    .replace(/\r\n?/g, '\n')
    .replace(/[^\n\t\x20-\x7E\xA0-\xFF]/g, '');

  return sanitized;
}

export function wrapText(text: unknown, maxWidth: number, fontSize: number, font: any): string[] {
  const safe = sanitizePdfText(text).trim();

  if (!safe) {
    return [''];
  }

  // Split by newlines first to preserve paragraph structure
  const paragraphs = safe.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();

    // Empty line means paragraph break
    if (trimmed === '') {
      lines.push('');
      continue;
    }

    const words = trimmed.split(' ');
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
  }

  return lines;
}

export function splitNarrativeParagraphs(text: string): string[] {
  return sanitizePdfText(text)
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
export type NarrativeBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string };

export function parseNarrativeBlocks(text: string): NarrativeBlock[] {
  const chunks = sanitizePdfText(text)
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const blocks: NarrativeBlock[] = [];

  for (const chunk of chunks) {
    const headingWithBodyMatch = chunk.match(/^\*\*(.+?)\*\*\s+([\s\S]+)$/);
    if (headingWithBodyMatch) {
      blocks.push({ kind: 'heading', text: headingWithBodyMatch[1].trim() });
      blocks.push({ kind: 'paragraph', text: headingWithBodyMatch[2].trim() });
      continue;
    }

    const headingOnlyMatch = chunk.match(/^\*\*(.+?)\*\*$/);
    if (headingOnlyMatch) {
      blocks.push({ kind: 'heading', text: headingOnlyMatch[1].trim() });
      continue;
    }

    blocks.push({ kind: 'paragraph', text: chunk });
  }

  return blocks;
}

export function drawNarrativeParagraphs(args: {
  page: PDFPage;
  yPosition: number;
  paragraphs: string[];
  font: any;
  pdfDoc: PDFDocument;
  isDraft: boolean;
  totalPages: PDFPage[];
  x?: number;
  maxWidth?: number;
  lineHeight?: number;
  paragraphGap?: number;
  fontSize?: number;
  color?: ReturnType<typeof rgb>;
}): { page: PDFPage; yPosition: number } {
  const {
    page,
    yPosition,
    paragraphs,
    font,
    pdfDoc,
    isDraft,
    totalPages,
    x = MARGIN,
    maxWidth = CONTENT_WIDTH,
    lineHeight = REPORT_BODY_LINE_GAP,
    paragraphGap = REPORT_BODY_PARAGRAPH_GAP,
    fontSize = REPORT_BODY_TEXT_SIZE,
    color = rgb(0.1, 0.1, 0.1),
  } = args;

  let currentPage = page;
  let cursorY = yPosition;

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;
    ({ page: currentPage, yPosition: cursorY } = ensurePageSpace(40, currentPage, cursorY, pdfDoc, isDraft, totalPages));

    const lines = wrapText(paragraph, maxWidth, fontSize, font);
    for (const line of lines) {
      ({ page: currentPage, yPosition: cursorY } = ensurePageSpace(lineHeight - 2, currentPage, cursorY, pdfDoc, isDraft, totalPages));
      currentPage.drawText(line, {
        x,
        y: cursorY,
        size: fontSize,
        font,
        color,
      });
      cursorY -= lineHeight;
    }

    cursorY -= paragraphGap;
  }

  return { page: currentPage, yPosition: cursorY };
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Derive a concise title from a system-generated action for PDF snapshot display.
 * Manual actions are returned unchanged. System actions are shortened to first clause.
 */
export function deriveSystemActionTitle(action: { recommended_action?: string; source?: string }): string {
  const text = String(action?.recommended_action || '').trim();
  if (!text) return '(No action text provided)';

  const src = String(action?.source || '').toLowerCase();
  if (src !== 'system') return text; // only shorten system actions

  // Keep first clause (imperative), strip rationale tails, remove urgency prefix
  let title = text.split(/\n|;|\.(\s|$)/)[0].trim();
  title = title.replace(/^(urgent|immediate)\s*[:\-]\s*/i, '').trim();
  title = title.replace(/\s+\b(to|in order to|so that)\b.*$/i, '').trim();

  const max = 95;
  if (title.length > max) title = title.slice(0, max - 1).trimEnd() + '…';

  return title || text;
}

/**
 * Derive ultra-short title for system actions in Action Plan Snapshot.
 * Hard cap at 70 characters for snapshot readability and clean scanning.
 * Manual actions are returned unchanged.
 */
export function deriveSystemSnapshotTitle(action: { recommended_action?: string; source?: string }): string {
  const text = String(action?.recommended_action || '').trim();
  if (!text) return '(No action text provided)';

  const src = String(action?.source || '').toLowerCase();
  if (src !== 'system') return text;

  // Remove common filler starts (optional but helps)
  let t = text
    .replace(/^(urgent|immediate)\s*[:\-]\s*/i, '')
    .replace(/^confirm (requirement )?for\s+/i, '')
    .replace(/^provide\s+/i, '')
    .trim();

  // Hard cap for snapshot readability
  const max = 70;
  if (t.length > max) t = t.slice(0, max - 1).trimEnd() + '…';
  return t;
}

export function formatAddress(addr?: any): string {
  if (!addr) return '';
  const parts = [
    addr.line1,
    addr.line2,
    addr.city,
    addr.county,
    addr.postcode,
    addr.country
  ].filter(Boolean);
  return parts.join(', ');
}

/**
 * Format field value for PDF, suppressing empty/unknown values
 * Returns formatted value or empty string if value should be suppressed
 * Use this to avoid rendering "unknown", "N/A", "-", empty strings, etc.
 *
 * @param value - The field value to format
 * @param defaultText - Optional custom text for empty values (default: empty string)
 * @returns Formatted value or empty string if value is empty/unknown
 */
export function formatFieldValue(value: unknown, defaultText: string = ''): string {
  // Null/undefined check
  if (value === null || value === undefined) return defaultText;

  // Convert to string
  const str = String(value).trim().toLowerCase();

  // Empty string check
  if (str === '') return defaultText;

  // Common "unknown" or "not applicable" values to suppress
  const suppressValues = [
    'unknown',
    'n/a',
    'na',
    'not applicable',
    'none',
    '-',
    '--',
    'not specified',
    'not recorded',
    'no information',
  ];

  if (suppressValues.includes(str)) return defaultText;

  // Value is valid, return it
  return String(value).trim();
}

export function normalizeDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  const s = raw.toLowerCase();

  if (['yes', 'y', 'true', '1'].includes(s)) return 'Yes';
  if (['no', 'n', 'false', '0'].includes(s)) return 'No';
  if (['na', 'n/a', 'not applicable', 'not_applicable'].includes(s)) return 'N/A';
  if (['unknown', 'not known', 'not_known'].includes(s)) return 'Unknown';

  // Auto Title Case for fully lowercase words/phrases
  if (/^[a-z\s]+$/.test(raw)) {
    return raw
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  return raw;
}

/**
 * Check if a subsection has any meaningful content
 * Used to determine whether to render subsection or show "No information recorded."
 *
 * @param data - Object with field values
 * @param fields - Array of field keys to check
 * @returns true if at least one field has meaningful content
 */
export function hasSubsectionContent(data: Record<string, any>, fields: string[]): boolean {
  return fields.some(field => {
    const value = data[field];
    return formatFieldValue(value) !== '';
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
    case 'information_incomplete':
      return rgb(0.2, 0.5, 0.8);
    case 'na':
    case 'not_applicable':
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
    case 'information_incomplete':
      return 'Information Gap';
    case 'na':
    case 'not_applicable':
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

/**
 * Draw a key/value row with proper column widths and text wrapping
 * Prevents label/value text overlap by constraining both to fixed widths
 *
 * @param page - PDF page to draw on
 * @param x - Starting x position (typically MARGIN)
 * @param y - Starting y position
 * @param label - Label text (will be wrapped if needed)
 * @param value - Value text (will be wrapped if needed)
 * @param fontBold - Bold font for label
 * @param fontRegular - Regular font for value
 * @param labelSize - Font size for label (default 9)
 * @param valueSize - Font size for value (default 10)
 * @param lineHeight - Line height for multi-line content (default 12)
 * @param labelWidth - Fixed width for label column (default 210)
 * @param gap - Gap between label and value columns (default 14)
 * @returns New y position after drawing the row
 */
export function drawKeyValueRow(
  page: PDFPage,
  x: number,
  y: number,
  label: string,
  value: string,
  fontBold: any,
  fontRegular: any,
  labelSize: number = 9,
  valueSize: number = 10,
  lineHeight: number = 12,
  labelWidth: number = 210,
  gap: number = 14
): number {
  const safeLabel = sanitizePdfText(normalizeDisplayValue(label)).trim();
  const safeValue = sanitizePdfText(normalizeDisplayValue(value)).trim();

  if (!safeLabel || !safeValue) {
    return y; // Skip empty rows
  }

  // Calculate column positions and widths
  const labelX = x;
  const valueX = x + labelWidth + gap;
  const valueWidth = CONTENT_WIDTH - labelWidth - gap;

  // Wrap both label and value to their respective column widths
  const labelLines = wrapText(safeLabel, labelWidth, labelSize, fontBold);
  const valueLines = wrapText(safeValue, valueWidth, valueSize, fontRegular);

  // Determine how many lines we need (max of label or value)
  const maxLines = Math.max(labelLines.length, valueLines.length);

  let currentY = y;

  // Draw label lines
  for (let i = 0; i < labelLines.length; i++) {
    page.drawText(labelLines[i], {
      x: labelX,
      y: currentY - (i * lineHeight),
      size: labelSize,
      font: fontBold,
      color: rgb(0.42, 0.42, 0.42),
    });
  }

  // Draw value lines
  for (let i = 0; i < valueLines.length; i++) {
    page.drawText(valueLines[i], {
      x: valueX,
      y: currentY - (i * lineHeight),
      size: valueSize,
      font: fontRegular,
      color: rgb(0.18, 0.18, 0.18),
    });
  }

  // Return new y position: move down by maxLines * lineHeight + small gap
  return currentY - (maxLines * lineHeight) - 4;
}

/**
 * Debug helper: Draw baseline grid for visual spacing alignment
 */
export function drawBaselineGrid(page: PDFPage, step = 12) {
  if (!PDF_DEBUG_LAYOUT) return;
  const light = rgb(0.85, 0.90, 1.0); // very light blue
  for (let y = MARGIN; y < PAGE_HEIGHT - MARGIN; y += step) {
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.25,
      color: light,
      opacity: 0.25,
    });
  }
}

/**
 * Debug helper: Draw margin guides to visualize page boundaries
 */
export function drawMarginGuides(page: PDFPage) {
  if (!PDF_DEBUG_LAYOUT) return;
  const c = rgb(0.2, 0.6, 1.0);
  // top/bottom margin lines
  page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - MARGIN },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - MARGIN },
    thickness: 0.5,
    color: c,
    opacity: 0.35,
  });
  page.drawLine({
    start: { x: MARGIN, y: MARGIN },
    end: { x: PAGE_WIDTH - MARGIN, y: MARGIN },
    thickness: 0.5,
    color: c,
    opacity: 0.35,
  });
  // left/right margin lines
  page.drawLine({
    start: { x: MARGIN, y: MARGIN },
    end: { x: MARGIN, y: PAGE_HEIGHT - MARGIN },
    thickness: 0.5,
    color: c,
    opacity: 0.35,
  });
  page.drawLine({
    start: { x: PAGE_WIDTH - MARGIN, y: MARGIN },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - MARGIN },
    thickness: 0.5,
    color: c,
    opacity: 0.35,
  });
}

/**
 * Debug helper: Draw small text label for debugging layout
 */
export function drawDebugLabel(page: PDFPage, x: number, y: number, text: string, font?: any) {
  if (!PDF_DEBUG_LAYOUT) return;
  page.drawText(text, {
    x,
    y,
    size: 6,
    font,
    color: rgb(0.2, 0.6, 1.0),
    opacity: 0.9,
  });
}

export function addNewPage(pdfDoc: PDFDocument, isDraft: boolean, totalPages: PDFPage[]): { page: PDFPage; yPosition: number } {
  // Defensive initialization - prevent crashes if totalPages is undefined
  if (!totalPages) {
    console.warn('[PDF] addNewPage: totalPages was undefined, using fallback empty array');
    totalPages = [];
  }

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  // Draw debug overlays when flag is enabled
  if (PDF_DEBUG_LAYOUT) {
    drawBaselineGrid(page, 12);
    drawMarginGuides(page);
  }

  totalPages.push(page);
  // Status is shown prominently on cover page - no need for repeated watermark
  return { page, yPosition: PAGE_TOP_Y };
}

/**
 * Ensure sufficient vertical space remains on current page for upcoming content block.
 * Creates a new page if required height would overflow into bottom margin threshold.
 *
 * @param requiredHeight - Total height needed for the content block (including heading, lines, spacing)
 * @param page - Current PDF page
 * @param yPosition - Current vertical cursor position
 * @param pdfDoc - PDF document instance
 * @param isDraft - Whether document is in draft mode
 * @param totalPages - Array tracking all pages in document
 * @returns Updated page and yPosition (new page if overflow, unchanged if sufficient space)
 */
export function ensurePageSpace(
  requiredHeight: number,
  page: PDFPage,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  const BOTTOM_THRESHOLD = MARGIN + 50;

  if (yPosition - requiredHeight < BOTTOM_THRESHOLD) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    return {
      page: result.page,
      yPosition: PAGE_TOP_Y,
    };
  }

  return { page, yPosition };
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

export async function addSupersededWatermark(pdfDoc: PDFDocument): Promise<void> {
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const watermarkText = 'SUPERSEDED';
  const fontSize = 80;
  const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
  const textHeight = font.heightAtSize(fontSize);

  for (const page of pages) {
    const { width, height } = page.getSize();

    const x = (width - textWidth) / 2;
    const y = (height - textHeight) / 2;

    page.drawText(watermarkText, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.8, 0, 0),
      opacity: 0.3,
      rotate: degrees(-45),
    });
  }
}

export function addExecutiveSummaryPages(
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  mode: 'ai' | 'author' | 'both' | 'none',
  aiSummary: string | null,
  authorSummary: string | null,
  fonts: { bold: any; regular: any }
): number {
  // Defensive check - ensure totalPages is defined
  if (!totalPages) {
    console.warn('[PDF] addExecutiveSummaryPages: totalPages was undefined, cannot render');
    return 0;
  }

  if (mode === 'none') {
    return 0;
  }

  let pagesAdded = 0;

  if ((mode === 'ai' || mode === 'both') && aiSummary) {
    const { page } = addNewPage(pdfDoc, isDraft, totalPages);
    let currentPage = page;
    let yPosition = PAGE_TOP_Y;

    currentPage.drawText('Executive Summary', {
      x: MARGIN,
      y: yPosition,
      size: 18,
      font: fonts.bold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 30;

    const paragraphs = aiSummary.split('\n\n');
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) continue;

      const lines = wrapText(paragraph, CONTENT_WIDTH, 11, fonts.regular);

      for (const line of lines) {
        if (yPosition < MARGIN + 40) {
          const { page: newPage } = addNewPage(pdfDoc, isDraft, totalPages);
          currentPage = newPage;
          pagesAdded++;
          yPosition = PAGE_TOP_Y;
          
        }
        currentPage.drawText(line, {
          x: MARGIN,
          y: yPosition,
          size: 11,
          font: fonts.regular,
          color: rgb(0, 0, 0),
        });
        yPosition -= 14;
      }

      yPosition -= 8;
    }

    pagesAdded++;
  }

  if ((mode === 'author' || mode === 'both') && authorSummary) {
    const { page } = addNewPage(pdfDoc, isDraft, totalPages);
    let currentPage = page;
    let yPosition = PAGE_TOP_Y;

    const heading = 'Executive Summary';

    currentPage.drawText(heading, {
      x: MARGIN,
      y: yPosition,
      size: 18,
      font: fonts.bold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 30;

    const paragraphs = authorSummary.split('\n\n');
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) continue;

      const lines = wrapText(paragraph, CONTENT_WIDTH, 11, fonts.regular);

      for (const line of lines) {
        if (yPosition < MARGIN + 40) {
          const { page: newPage } = addNewPage(pdfDoc, isDraft, totalPages);
          currentPage = newPage;
          pagesAdded++;
          yPosition = PAGE_TOP_Y;
          
        }
        currentPage.drawText(line, {
          x: MARGIN,
          y: yPosition,
          size: 11,
          font: fonts.regular,
          color: rgb(0, 0, 0),
        });
        yPosition -= 14;
      }

      yPosition -= 8;
    }

    pagesAdded++;
  }

  return pagesAdded;
}

export async function fetchAndEmbedLogo(
  pdfDoc: PDFDocument,
  logoPath: string | null,
  signedUrl: string | null
): Promise<{ image: any; width: number; height: number } | null> {
  if (!logoPath || !signedUrl) return null;

  try {
    // Add timeout to fetch operation
    const response = await Promise.race([
      fetch(signedUrl),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('Logo fetch timed out after 3 seconds')), 3000)
      )
    ]);

    if (!response.ok) {
      console.warn('[PDF Logo] Failed to fetch logo:', response.statusText);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    let image;
    if (logoPath.toLowerCase().endsWith('.png')) {
      // Add timeout to embed operation
      image = await Promise.race([
        pdfDoc.embedPng(uint8Array),
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('PNG embed timed out after 2 seconds')), 2000)
        )
      ]);
    } else if (logoPath.toLowerCase().endsWith('.jpg') || logoPath.toLowerCase().endsWith('.jpeg')) {
      // Add timeout to embed operation
      image = await Promise.race([
        pdfDoc.embedJpg(uint8Array),
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('JPG embed timed out after 2 seconds')), 2000)
        )
      ]);
    } else {
      console.warn('[PDF Logo] Unsupported logo format:', logoPath);
      return null;
    }

    const dims = image.scale(1);
    return { image, width: dims.width, height: dims.height };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PDF Logo] Error embedding logo:', errorMsg);
    return null;
  }
}

export async function drawCoverPage(
  page: PDFPage,
  fonts: { bold: any; regular: any },
  document: {
    title: string;
    document_type: string;
    version_number: number;
    issue_date: string | null;
    issue_status: 'draft' | 'issued' | 'superseded';
  },
  organisation: { name: string },
  client: { name?: string; site?: string } | null,
  logoData: { image: any; width: number; height: number } | null
): Promise<void> {
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const margin = 56.7;

  let yPosition = pageHeight - margin;

  if (logoData) {
    const maxLogoWidth = 340.2;
    const maxLogoHeight = 85.05;

    const scale = Math.min(
      maxLogoWidth / logoData.width,
      maxLogoHeight / logoData.height,
      1
    );

    const scaledWidth = logoData.width * scale;
    const scaledHeight = logoData.height * scale;

    page.drawImage(logoData.image, {
      x: margin,
      y: yPosition - scaledHeight,
      width: scaledWidth,
      height: scaledHeight,
    });

    yPosition -= scaledHeight + 40;
  } else {
    page.drawText('EziRisk', {
      x: margin,
      y: yPosition,
      size: 24,
      font: fonts.bold,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 50;
  }

  yPosition -= 60;

  const coverContent = getCoverTitleContent(document.document_type, document.title);
  const titleLines = wrapText(coverContent.title, CONTENT_WIDTH, 24, fonts.bold);
  for (const line of titleLines) {
    page.drawText(line, {
      x: pageWidth / 2 - fonts.bold.widthOfTextAtSize(line, 24) / 2,
      y: yPosition,
      size: 24,
      font: fonts.bold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 30;
  }

  yPosition -= 20;

  if (coverContent.subtitle) {
    page.drawText(coverContent.subtitle, {
      x: pageWidth / 2 - fonts.regular.widthOfTextAtSize(coverContent.subtitle, 14) / 2,
      y: yPosition,
      size: 14,
      font: fonts.regular,
      color: rgb(0.3, 0.3, 0.3),
    });
    yPosition -= 60;
  } else {
    yPosition -= 40;
  }

  if (client) {
    if (client.name) {
      const clientText = `Client: ${client.name}`;
      page.drawText(clientText, {
        x: pageWidth / 2 - fonts.regular.widthOfTextAtSize(clientText, 12) / 2,
        y: yPosition,
        size: 12,
        font: fonts.regular,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;
    }

    if (client.site) {
      const siteText = `Site: ${client.site}`;
      page.drawText(siteText, {
        x: pageWidth / 2 - fonts.regular.widthOfTextAtSize(siteText, 12) / 2,
        y: yPosition,
        size: 12,
        font: fonts.regular,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;
    }
  }

  const versionText = `Version ${document.version_number}.0`;
  const issueDateText = document.issue_date ? formatDate(document.issue_date) : 'DRAFT';
  const statusText = document.issue_status === 'issued' ? 'INFORMATION' : 'DRAFT';

  page.drawText(versionText, {
    x: pageWidth - margin - fonts.bold.widthOfTextAtSize(versionText, 11),
    y: margin + 40,
    size: 11,
    font: fonts.bold,
    color: rgb(0, 0, 0),
  });

  page.drawText(issueDateText, {
    x: pageWidth - margin - fonts.regular.widthOfTextAtSize(issueDateText, 10),
    y: margin + 25,
    size: 10,
    font: fonts.regular,
    color: rgb(0, 0, 0),
  });

  page.drawText(statusText, {
    x: pageWidth - margin - fonts.bold.widthOfTextAtSize(statusText, 10),
    y: margin + 10,
    size: 10,
    font: fonts.bold,
    color: document.issue_status === 'issued' ? rgb(0, 0, 0) : rgb(0.7, 0, 0),
  });
}
export function getCoverTitleContent(documentType: string, rawTitle: string | null | undefined): {
  title: string;
  subtitle: string | null;
  productLabel: string;
} {
  const productLabel = getDocumentTypeLabel(documentType);
  const normalizedDocumentType = (documentType || '').toUpperCase();
  const isFraReport = normalizedDocumentType === 'FRA' || documentType === 'fire_risk_assessment';
  const isDsearReport = normalizedDocumentType === 'DSEAR' || documentType === 'explosion_risk_assessment';
  const isCombinedReport = documentType === 'FIRE_EXPLOSION_COMBINED' || documentType === 'combined';
   // Combined reports should always render as a single canonical title line.
  // This prevents duplicate hierarchy (title + repeated/competing subtitle).
  if (isCombinedReport) {
    return {
      title: productLabel,
      subtitle: null,
      productLabel,
    };
  }

  const inputTitle = (rawTitle || '').trim();

  // Guard against single-output PDFs derived from a combined/base document title.
  // In FRA-only/DSEAR-only modes, cover should show only the product label.
  const isSingleFraOrDsear = isFraReport || isDsearReport;
  const hasCombinedBaseTitle = /(fire\s*\+\s*explosion|fra\s*\+\s*dsear|\bcombined\b)/i.test(inputTitle);
  if (isSingleFraOrDsear && hasCombinedBaseTitle) {
    return {
      title: productLabel,
      subtitle: null,
      productLabel,
    };
  }

  const stripCombinedPhrases = (text: string): string => text
    .replace(/combined\s+fire\s*\+\s*explosion\s+report/gi, '')
    .replace(/combined\s+fra\s*\+\s*dsear\s+report/gi, '')
    .replace(/fire\s*\+\s*explosion\s+combined\s+report/gi, '')
    .replace(/combined\s+report/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const cleanedTitle = stripCombinedPhrases(inputTitle);
  const title = cleanedTitle || productLabel;
  const subtitle = title.toLowerCase() === productLabel.toLowerCase() ? null : productLabel;

  return { title, subtitle, productLabel };
}

export function getReportFooterTitle(documentType: string, rawTitle: string | null | undefined): string {
  return getCoverTitleContent(documentType, rawTitle).productLabel;
}
function getDocumentTypeLabel(type: string): string {
  switch (type) {
    case 'FRA':
    case 'fire_risk_assessment':
    return 'Fire Risk Assessment';
    case 'FSD':
    case 'fire_safety_design':
      return 'Fire Safety Design Review';
      case 'DSEAR':
    case 'explosion_risk_assessment':
      return 'Explosive Atmospheres Assessment';
    case 'FIRE_EXPLOSION_COMBINED':
    case 'combined':
      return 'Combined Fire + Explosion Report';
    case 'RE':
      return 'Risk Engineering Survey';
    default:
      return type;
  }
}

export async function drawDocumentControlPage(
  page: PDFPage,
  fonts: { bold: any; regular: any },
  document: {
    title: string;
    version_number: number;
    issue_date: string | null;
    issue_status: string;
    assessor_name: string | null;
    issued_by_name?: string | null;
  },
  organisation: { name: string },
  client: { name?: string; site?: string } | null,
  revisionHistory: Array<{
    version_number: number;
    issue_date: string;
    change_summary: string | null;
    issued_by_name: string | null;
  }>
): Promise<void> {
  let yPosition = PAGE_TOP_Y;

  page.drawText('DOCUMENT CONTROL & REVISION HISTORY', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fonts.bold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 40;

  page.drawText('Document Control', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fonts.bold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 25;

  const controlItems = [
    ['Report Title', document.title],
    ['Client', client?.name || '-'],
    ['Site', client?.site || '-'],
    ['Version', `${document.version_number}.0`],
    ['Issue Date', document.issue_date ? formatDate(document.issue_date) : 'DRAFT'],
    ['Issue Status', document.issue_status === 'issued' ? 'Information' : 'Draft'],
    ['Prepared By', document.assessor_name || '-'],
    ['Issued By', document.issued_by_name || '-'],
    ['Supersedes', document.version_number > 1 ? `Version ${document.version_number - 1}.0` : '-'],
  ];

  for (const [label, value] of controlItems) {
    page.drawText(`${label}:`, {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: fonts.bold,
      color: rgb(0, 0, 0),
    });

    const valueText = sanitizePdfText(
      normalizeDisplayValue(value)
    );
    page.drawText(valueText, {
      x: MARGIN + 150,
      y: yPosition,
      size: 10,
      font: fonts.regular,
      color: rgb(0, 0, 0),
    });

    yPosition -= 18;
  }

  yPosition -= 30;

  page.drawText('Revision History', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fonts.bold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 25;

  const tableHeaders = ['Version', 'Date', 'Change Summary', 'Issued By'];
  const colWidths = [60, 80, 230, 100];
  let xPosition = MARGIN;

  for (let i = 0; i < tableHeaders.length; i++) {
    page.drawText(tableHeaders[i], {
      x: xPosition,
      y: yPosition,
      size: 9,
      font: fonts.bold,
      color: rgb(0, 0, 0),
    });
    xPosition += colWidths[i];
  }

  yPosition -= 15;

  page.drawLine({
    start: { x: MARGIN, y: yPosition },
    end: { x: PAGE_WIDTH - MARGIN, y: yPosition },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });

  yPosition -= 12;

  const sortedHistory = [...revisionHistory].sort((a, b) => b.version_number - a.version_number);

  for (const revision of sortedHistory) {
    if (yPosition < MARGIN + 60) break;

    xPosition = MARGIN;

    const rowData = [
      `${revision.version_number}.0`,
      formatDate(revision.issue_date),
      revision.change_summary || 'Initial issue',
      revision.issued_by_name || '-',
    ];

    for (let i = 0; i < rowData.length; i++) {
      const text = sanitizePdfText(rowData[i]);
      const wrappedLines = wrapText(text, colWidths[i] - 5, 8, fonts.regular);

      page.drawText(wrappedLines[0] || '', {
        x: xPosition,
        y: yPosition,
        size: 8,
        font: fonts.regular,
        color: rgb(0, 0, 0),
      });

      xPosition += colWidths[i];
    }

    yPosition -= 15;
  }

  yPosition = MARGIN + 20;
  const footerText = 'Document controlled and issued using EziRisk';
  const footerWidth = fonts.regular.widthOfTextAtSize(footerText, 8);
  page.drawText(footerText, {
    x: (PAGE_WIDTH - footerWidth) / 2,
    y: yPosition,
    size: 8,
    font: fonts.regular,
    color: rgb(0.5, 0.5, 0.5),
  });
}

export interface ActionForPdf {
  id: string;
  reference_number: string | null;
  recommended_action: string;
  priority_band: string;
  status: string;
  section_reference?: string | null;
  module_instance_id?: string;
  first_raised_in_version: number | null;
  closed_at: string | null;
  superseded_by_action_id: string | null;
  superseded_at: string | null;
}

/**
 * Draw Action Plan Snapshot section after Executive Summary
 * Shows actions grouped by priority (P1-P4) with section references
 * Provides a quick overview of remedial actions required
 */
export function drawActionPlanSnapshot(
  pdfDoc: PDFDocument,
  actions: ActionForPdf[],
  fonts: { bold: any; regular: any },
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  // Defensive check - ensure totalPages is defined
  if (!totalPages) {
    console.warn('[PDF] drawActionPlanSnapshot: totalPages was undefined, cannot render');
    return 0;
  }

  // Filter to active actions only (exclude closed, superseded, etc.)
  const openActions = filterActiveActions(actions);

  if (openActions.length === 0) {
    return 0; // Don't add page if no open actions
  }

  // Group actions by priority
  const p1Actions = openActions.filter(a => a.priority_band === 'P1');
  const p2Actions = openActions.filter(a => a.priority_band === 'P2');
  const p3Actions = openActions.filter(a => a.priority_band === 'P3');
  const p4Actions = openActions.filter(a => a.priority_band === 'P4');

  // Use mutable object to track current page and yPosition
  const result = addNewPage(pdfDoc, isDraft, totalPages);
  const context = {
    page: result.page,
    yPosition: result.yPosition,
  };

  // Section title
  context.page.drawText('ACTION PLAN SNAPSHOT', {
    x: MARGIN,
    y: context.yPosition,
    size: 16,
    font: fonts.bold,
    color: rgb(0, 0, 0),
  });

  context.yPosition -= 10;

  // Introductory text
  const intro = 'This section provides a summary of remedial actions required, grouped by priority level. Full details are provided in Section 13 (Recommendations).';
  const introLines = wrapText(intro, CONTENT_WIDTH, 10, fonts.regular);

  context.yPosition -= 20;
  for (const line of introLines) {
    context.page.drawText(line, {
      x: MARGIN,
      y: context.yPosition,
      size: 10,
      font: fonts.regular,
      color: rgb(0.3, 0.3, 0.3),
    });
    context.yPosition -= 14;
  }

  context.yPosition -= 10;

  // Helper function to draw priority group
  const drawPriorityGroup = (
    priorityLabel: string,
    priorityActions: ActionForPdf[],
    color: { r: number; g: number; b: number }
  ): void => {
    if (priorityActions.length === 0) return;

    // Check if we need a new page
    if (context.yPosition < MARGIN + 100) {
      context.page = addNewPage(pdfDoc, isDraft, totalPages).page;
      context.yPosition = PAGE_TOP_Y;
    }

    // Priority heading
    context.page.drawText(`${priorityLabel} (${priorityActions.length})`, {
      x: MARGIN,
      y: context.yPosition,
      size: 12,
      font: fonts.bold,
      color,
    });

    context.yPosition -= 20;

    // List actions (max 5 per priority to keep snapshot concise)
    const sortedActions = [...priorityActions].sort(compareActionsByDisplayReference);

    const displayActions = sortedActions.slice(0, 5);
    for (const action of displayActions) {
      if (context.yPosition < MARGIN + 40) {
        context.page = addNewPage(pdfDoc, isDraft, totalPages).page;
        context.yPosition = PAGE_TOP_Y;
      }

      // Derive ultra-short title for snapshot (70 char max for system actions)
      const actionTitle = deriveSystemSnapshotTitle(action);
      let actionText = sanitizePdfText(actionTitle);
      if (actionText.length > 100) {
        actionText = actionText.substring(0, 97) + '...';
      }

      // Reference and section - reference_number from DB or undefined
      const ref = action.reference_number;
      const section = action.section_reference;

      // Build display text: only include ref and section if they exist
      let displayText = '• ';
      if (ref) {
        displayText += ref;
        if (section && section !== 'TBD' && section !== 'unknown' && section !== '') {
          displayText += ` (${section})`;
        }
        displayText += ': ';
      }
      displayText += actionText;

      context.page.drawText(displayText, {
        x: MARGIN + 10,
        y: context.yPosition,
        size: 9,
        font: fonts.regular,
        color: rgb(0.2, 0.2, 0.2),
      });

      context.yPosition -= 16;
    }

    // If more actions than displayed, show count
    if (priorityActions.length > 5) {
      context.page.drawText(`  ... and ${priorityActions.length - 5} more ${priorityLabel} action(s)`, {
        x: MARGIN + 10,
        y: context.yPosition,
        size: 9,
        font: fonts.regular,
        color: rgb(0.5, 0.5, 0.5),
      });
      context.yPosition -= 16;
    }

    context.yPosition -= 10; // Spacing between priority groups
  };

  // Draw each priority group
  drawPriorityGroup('P1 - Immediate Action Required', p1Actions, rgb(0.8, 0.1, 0.1));
  drawPriorityGroup('P2 - Urgent Action Required', p2Actions, rgb(0.9, 0.5, 0.1));
  drawPriorityGroup('P3 - Action Required', p3Actions, rgb(0.9, 0.7, 0.1));
  drawPriorityGroup('P4 - Improvement Recommended', p4Actions, rgb(0.2, 0.5, 0.8));

  return 1; // One page added (may span multiple if many actions)
}

export function drawRecommendationsSection(
  pdfDoc: PDFDocument,
  actions: ActionForPdf[],
  fonts: { bold: any; regular: any },
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  // Defensive check - ensure totalPages is defined
  if (!totalPages) {
    console.warn('[PDF] drawRecommendationsSection: totalPages was undefined, cannot render');
    return 0;
  }

  if (actions.length === 0) {
    const { page } = addNewPage(pdfDoc, isDraft, totalPages);
    let yPosition = PAGE_TOP_Y;

    page.drawText('RECOMMENDATIONS', {
      x: MARGIN,
      y: yPosition,
      size: 16,
      font: fonts.bold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 40;

    page.drawText('No recommendations were identified at the time of inspection.', {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font: fonts.regular,
      color: rgb(0.3, 0.3, 0.3),
    });

    return 1;
  }

  const sortedActions = [...actions].sort((a, b) => {
    const statusOrder = { open: 1, in_progress: 2, closed: 3, superseded: 4, deferred: 5, not_applicable: 6 };
    const priorityOrder = { P1: 1, P2: 2, P3: 3, P4: 4 };

    if (a.status !== b.status) {
      return (statusOrder[a.status as keyof typeof statusOrder] || 99) - (statusOrder[b.status as keyof typeof statusOrder] || 99);
    }

    if (a.priority_band !== b.priority_band) {
      return (priorityOrder[a.priority_band as keyof typeof priorityOrder] || 99) - (priorityOrder[b.priority_band as keyof typeof priorityOrder] || 99);
    }

    // Extract numeric sequence from FRA-YYYY-### format (last 3 digits)
    const extractSeq = (ref: string | null | undefined): number => {
      if (!ref) return 999;
      const match = ref.match(/^FRA-\d{4}-(\d{3})$/);
      if (match) return parseInt(match[1], 10);
      // Legacy R-xx format fallback
      const legacyMatch = ref.match(/^R-(\d+)$/);
      if (legacyMatch) return parseInt(legacyMatch[1], 10);
      return 999;
    };

    const aNum = extractSeq(a.reference_number);
    const bNum = extractSeq(b.reference_number);
    return aNum - bNum;
  });

  let pagesAdded = 0;
  const { page: firstPage } = addNewPage(pdfDoc, isDraft, totalPages);
  let page = firstPage;
  let yPosition = PAGE_TOP_Y;
  pagesAdded++;

  page.drawText('RECOMMENDATIONS', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fonts.bold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 40;

  for (const action of sortedActions) {
    const spaceNeeded = 120;
    if (yPosition < MARGIN + spaceNeeded) {
      const { page: newPage } = addNewPage(pdfDoc, isDraft, totalPages);
      page = newPage;
      yPosition = PAGE_TOP_Y;
      pagesAdded++;
    }

    // Reference number from DB or undefined
    const refNum = action.reference_number;
    if (refNum) {
      page.drawText(refNum, {
        x: MARGIN,
        y: yPosition,
        size: 12,
        font: fonts.bold,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;
    }

    // Derive short title for auto actions, full text for manual actions
    const actionTitle = deriveAutoActionTitle(action);
    const descLines = wrapText(actionTitle, CONTENT_WIDTH - 20, 10, fonts.regular);
    for (const line of descLines) {
      if (yPosition < MARGIN + 40) {
        const { page: newPage } = addNewPage(pdfDoc, isDraft, totalPages);
        page = newPage;
        yPosition = PAGE_TOP_Y;
        pagesAdded++;
      }

      page.drawText(line, {
        x: MARGIN + 10,
        y: yPosition,
        size: 10,
        font: fonts.regular,
        color: rgb(0, 0, 0),
      });
      yPosition -= 13;
    }

    yPosition -= 5;

    const safeStatus = sanitizePdfText(
      normalizeDisplayValue((action.status || '').replaceAll('_', ' '))
    ).trim();

    const priorityText = `Priority: ${action.priority_band}`;
    const statusText = `Status: ${safeStatus}`;
    const versionText = action.first_raised_in_version ? `First raised: Version ${action.first_raised_in_version}.0` : '';

    page.drawText(priorityText, {
      x: MARGIN + 10,
      y: yPosition,
      size: 9,
      font: fonts.regular,
      color: getPriorityColor(action.priority_band),
    });

    page.drawText(statusText, {
      x: MARGIN + 150,
      y: yPosition,
      size: 9,
      font: fonts.regular,
      color: rgb(0.3, 0.3, 0.3),
    });

    if (versionText) {
      page.drawText(versionText, {
        x: MARGIN + 280,
        y: yPosition,
        size: 9,
        font: fonts.regular,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    yPosition -= 15;

    if (action.closed_at) {
      const closedText = `Closed: ${formatDate(action.closed_at)}`;
      page.drawText(closedText, {
        x: MARGIN + 10,
        y: yPosition,
        size: 8,
        font: fonts.regular,
        color: rgb(0.5, 0.5, 0.5),
      });
      yPosition -= 12;
    }

    if (action.superseded_by_action_id) {
      const supersededText = 'Superseded by newer recommendation';
      page.drawText(supersededText, {
        x: MARGIN + 10,
        y: yPosition,
        size: 8,
        font: fonts.regular,
        color: rgb(0.7, 0, 0),
      });
      yPosition -= 12;
    }

    yPosition -= 15;

    page.drawLine({
      start: { x: MARGIN, y: yPosition },
      end: { x: PAGE_WIDTH - MARGIN, y: yPosition },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9),
    });

    yPosition -= 20;
  }

  return pagesAdded;
}

/**
 * Derives a short, punchy action title from auto-generated actions for PDF headings.
 * Manual actions pass through unchanged.
 *
 * @param action - Action object with recommended_action and source fields
 * @returns Shortened title for auto actions, full text for manual actions
 */
export function deriveAutoActionTitle(action: { recommended_action?: string; source?: string }): string {
  const text = String(action?.recommended_action || '').trim();
  if (!text) return '(No action text provided)';

  const src = String(action?.source || '').toLowerCase();

  // Treat anything non-manual as auto unless explicitly marked manual
  const isManual = src === 'manual' || src === 'user' || src === 'author';
  if (isManual) return text;

  // Shorten: take first clause; remove rationale tails; drop urgency prefix
  let title = text.split(/\n|;|\.(\s|$)/)[0].trim();
  title = title.replace(/^(urgent|immediate)\s*[:\-]\s*/i, '').trim();
  title = title.replace(/\s+\b(to|in order to|so that)\b.*$/i, '').trim();

  // Cap length
  const max = 95;
  if (title.length > max) title = title.slice(0, max - 1).trimEnd() + '…';

  return title || text;
}
