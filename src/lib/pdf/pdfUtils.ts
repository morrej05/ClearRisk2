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
    const response = await fetch(signedUrl);

    if (!response.ok) {
      console.warn('Failed to fetch logo:', response.statusText);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    let image;
    if (logoPath.toLowerCase().endsWith('.png')) {
      image = await pdfDoc.embedPng(uint8Array);
    } else if (logoPath.toLowerCase().endsWith('.jpg') || logoPath.toLowerCase().endsWith('.jpeg')) {
      image = await pdfDoc.embedJpg(uint8Array);
    } else {
      console.warn('Unsupported logo format:', logoPath);
      return null;
    }

    const dims = image.scale(1);
    return { image, width: dims.width, height: dims.height };
  } catch (error) {
    console.error('Error embedding logo:', error);
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

interface ActionForPdf {
  id: string;
  reference_number: string | null;
  recommended_action: string;
  priority_band: string;
  status: string;
  first_raised_in_version: number | null;
  closed_at: string | null;
  superseded_by_action_id: string | null;
  superseded_at: string | null;
}

export function drawRecommendationsSection(
  pdfDoc: PDFDocument,
  actions: ActionForPdf[],
  fonts: { bold: any; regular: any },
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
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

    const refNum = action.reference_number || 'R-??';
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
