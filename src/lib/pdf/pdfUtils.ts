import { PDFDocument, PDFPage, rgb, degrees, StandardFonts } from 'pdf-lib';

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

export function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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
  const safeLabel = sanitizePdfText(label).trim();
  const safeValue = sanitizePdfText(value).trim();

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

export function addNewPage(pdfDoc: PDFDocument, isDraft: boolean, totalPages: PDFPage[]): { page: PDFPage } {
  // Defensive initialization - prevent crashes if totalPages is undefined
  if (!totalPages) {
    console.warn('[PDF] addNewPage: totalPages was undefined, using fallback empty array');
    totalPages = [];
  }

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  totalPages.push(page);
  // Status is shown prominently on cover page - no need for repeated watermark
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
    let yPosition = PAGE_HEIGHT - MARGIN - 20;

    page.drawText('Executive Summary', {
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
          pagesAdded++;
          yPosition = PAGE_HEIGHT - MARGIN - 20;
          page.drawText(line, {
            x: MARGIN,
            y: yPosition,
            size: 11,
            font: fonts.regular,
            color: rgb(0, 0, 0),
          });
        } else {
          page.drawText(line, {
            x: MARGIN,
            y: yPosition,
            size: 11,
            font: fonts.regular,
            color: rgb(0, 0, 0),
          });
        }
        yPosition -= 14;
      }

      yPosition -= 8;
    }

    pagesAdded++;
  }

  if ((mode === 'author' || mode === 'both') && authorSummary) {
    const { page } = addNewPage(pdfDoc, isDraft, totalPages);
    let yPosition = PAGE_HEIGHT - MARGIN - 20;

    const heading = mode === 'both' ? 'Author Commentary' : 'Executive Summary';

    page.drawText(heading, {
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
          pagesAdded++;
          yPosition = PAGE_HEIGHT - MARGIN - 20;
          page.drawText(line, {
            x: MARGIN,
            y: yPosition,
            size: 11,
            font: fonts.regular,
            color: rgb(0, 0, 0),
          });
        } else {
          page.drawText(line, {
            x: MARGIN,
            y: yPosition,
            size: 11,
            font: fonts.regular,
            color: rgb(0, 0, 0),
          });
        }
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

  const titleLines = wrapText(document.title, CONTENT_WIDTH, 24, fonts.bold);
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

  const docTypeText = getDocumentTypeLabel(document.document_type);
  page.drawText(docTypeText, {
    x: pageWidth / 2 - fonts.regular.widthOfTextAtSize(docTypeText, 14) / 2,
    y: yPosition,
    size: 14,
    font: fonts.regular,
    color: rgb(0.3, 0.3, 0.3),
  });
  yPosition -= 60;

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

function getDocumentTypeLabel(type: string): string {
  switch (type) {
    case 'fire_risk_assessment':
      return 'Fire Risk Assessment';
    case 'fire_safety_design':
      return 'Fire Safety Design Review';
    case 'explosion_risk_assessment':
      return 'Explosion Risk Assessment';
    case 'combined':
      return 'Combined Assessment';
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
  let yPosition = PAGE_HEIGHT - MARGIN - 20;

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

    const valueText = sanitizePdfText(value);
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

  // Filter to open actions only (exclude closed, superseded, etc.)
  const openActions = actions.filter(a =>
    a.status === 'open' || a.status === 'in_progress'
  );

  if (openActions.length === 0) {
    return 0; // Don't add page if no open actions
  }

  // Group actions by priority
  const p1Actions = openActions.filter(a => a.priority_band === 'P1');
  const p2Actions = openActions.filter(a => a.priority_band === 'P2');
  const p3Actions = openActions.filter(a => a.priority_band === 'P3');
  const p4Actions = openActions.filter(a => a.priority_band === 'P4');

  // Use mutable object to track current page and yPosition
  const context = {
    page: addNewPage(pdfDoc, isDraft, totalPages).page,
    yPosition: PAGE_HEIGHT - MARGIN - 20,
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
      context.yPosition = PAGE_HEIGHT - MARGIN - 20;
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
    const displayActions = priorityActions.slice(0, 5);
    for (const action of displayActions) {
      if (context.yPosition < MARGIN + 40) {
        context.page = addNewPage(pdfDoc, isDraft, totalPages).page;
        context.yPosition = PAGE_HEIGHT - MARGIN - 20;
      }

      // Action text (truncated if too long)
      let actionText = sanitizePdfText(action.recommended_action);
      if (actionText.length > 100) {
        actionText = actionText.substring(0, 97) + '...';
      }

      // Reference and section - reference_number is always present from PDF processing
      const ref = action.reference_number;
      const section = action.section_reference;

      // Build display text: only include section if it exists and isn't a placeholder
      let displayText = `• ${ref}`;
      if (section && section !== 'TBD' && section !== 'unknown' && section !== '') {
        displayText += ` (${section})`;
      }
      displayText += `: ${actionText}`;

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
    let yPosition = PAGE_HEIGHT - MARGIN - 20;

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

    const aNum = a.reference_number ? parseInt(a.reference_number.replace('R-', ''), 10) : 999;
    const bNum = b.reference_number ? parseInt(b.reference_number.replace('R-', ''), 10) : 999;
    return aNum - bNum;
  });

  let pagesAdded = 0;
  const { page: firstPage } = addNewPage(pdfDoc, isDraft, totalPages);
  let page = firstPage;
  let yPosition = PAGE_HEIGHT - MARGIN - 20;
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
      yPosition = PAGE_HEIGHT - MARGIN - 20;
      pagesAdded++;
    }

    // Reference number is always present from PDF processing
    const refNum = action.reference_number;
    page.drawText(refNum, {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fonts.bold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 20;

    const descLines = wrapText(action.recommended_action, CONTENT_WIDTH - 20, 10, fonts.regular);
    for (const line of descLines) {
      if (yPosition < MARGIN + 40) {
        const { page: newPage } = addNewPage(pdfDoc, isDraft, totalPages);
        page = newPage;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
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

    const priorityText = `Priority: ${action.priority_band}`;
    const statusText = `Status: ${action.status.replace('_', ' ')}`;
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
