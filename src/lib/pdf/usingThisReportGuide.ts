/**
 * "Using This Report" Guide Section
 *
 * Provides a concise, professional guide on how to interpret and act on the FRA report.
 * Inserted after table of contents, before executive summary.
 */

import { PDFPage, rgb, PDFDocument } from 'pdf-lib';
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN,
  CONTENT_WIDTH,
  PAGE_TOP_Y,
  wrapText,
  addNewPage,
  sanitizePdfText,
} from './pdfUtils';

/**
 * Draw "Using This Report" guide section
 */
export function drawUsingThisReportSection(
  pdfDoc: PDFDocument,
  font: any,
  boldFont: any,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  // Add new page for this section
  const result = addNewPage(pdfDoc, isDraft, totalPages);
  let page = result.page;
  let yPosition = PAGE_TOP_Y;

  // Section title
  page.drawText(sanitizePdfText('Using This Report'), {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  yPosition -= 30;

  // Introduction paragraph
  const introText = 'This Fire Risk Assessment provides a systematic evaluation of fire safety compliance and risk management. The report is structured to support both immediate action planning and long-term fire safety governance.';
  const introLines = wrapText(introText, CONTENT_WIDTH, 11, font);

  for (const line of introLines) {
    page.drawText(line, {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 16;
  }

  yPosition -= 10;

  // Subsection 1: Report Structure
  page.drawText(sanitizePdfText('Report Structure'), {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: boldFont,
    color: rgb(0.25, 0.25, 0.25),
  });

  yPosition -= 20;

  const structureItems = [
    {
      label: 'Executive Summary:',
      text: 'High-level overview of critical findings, material deficiencies, and key actions required.',
    },
    {
      label: 'Action Plan:',
      text: 'Prioritized recommendations with target dates and responsible persons. Actions are prioritised using a Severity Tier (T1–T4) mapped to a Priority Band (P1–P4).',
    },
    {
      label: 'Detailed Assessment:',
      text: 'Section-by-section evaluation covering fire hazards, means of escape, fire protection systems, and management controls.',
    },
  ];

  for (const item of structureItems) {
    // Draw label in bold
    page.drawText(sanitizePdfText(item.label), {
      x: MARGIN + 10,
      y: yPosition,
      size: 10,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    yPosition -= 14;

    // Draw wrapped description (wrapText already sanitizes)
    const descLines = wrapText(item.text, CONTENT_WIDTH - 20, 10, font);
    for (const line of descLines) {
      page.drawText(line, {
        x: MARGIN + 10,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 14;
    }

    yPosition -= 6; // Gap between items
  }

  yPosition -= 10;

  // Subsection 2: Priority Bands
  page.drawText(sanitizePdfText('Priority Bands'), {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: boldFont,
    color: rgb(0.25, 0.25, 0.25),
  });

  yPosition -= 20;

  const priorityItems = [
    {
      label: 'T4 → P1:',
      text: 'Material Life Safety Risk. Immediate action required to address significant risk to life safety.',
    },
    {
      label: 'T3 → P2:',
      text: 'Significant Deficiency. Urgent action required to resolve material compliance or protection gaps.',
    },
    {
      label: 'T2 → P3:',
      text: 'Improvement Required. Action needed to meet best practice standards and enhance fire safety resilience.',
    },
    {
      label: 'T1 → P4:',
      text: 'Minor. Governance or incremental improvements to maintain fire safety management standards.',
    },
  ];

  for (const item of priorityItems) {
    // Draw label in bold (sanitize to convert → to ->)
    page.drawText(sanitizePdfText(item.label), {
      x: MARGIN + 10,
      y: yPosition,
      size: 10,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    yPosition -= 14;

    // Draw wrapped description (wrapText already sanitizes)
    const descLines = wrapText(item.text, CONTENT_WIDTH - 20, 10, font);
    for (const line of descLines) {
      page.drawText(line, {
        x: MARGIN + 10,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 14;
    }

    yPosition -= 6; // Gap between items
  }

  yPosition -= 10;

  // Subsection 3: Key Information Blocks
  page.drawText(sanitizePdfText('Key Information Blocks'), {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: boldFont,
    color: rgb(0.25, 0.25, 0.25),
  });

  yPosition -= 20;

  const infoBlocks = [
    {
      label: 'Assessor Summary:',
      text: 'Qualitative overview of section findings, highlighting overall compliance status.',
    },
    {
      label: 'Key Points:',
      text: 'Specific observations derived from assessment data, including non-compliances and notable conditions.',
    },
    {
      label: 'Key Details:',
      text: 'Granular field-level data captured during the assessment, providing evidential basis for conclusions.',
    },
  ];

  for (const item of infoBlocks) {
    // Draw label in bold
    page.drawText(sanitizePdfText(item.label), {
      x: MARGIN + 10,
      y: yPosition,
      size: 10,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    yPosition -= 14;

    // Draw wrapped description (wrapText already sanitizes)
    const descLines = wrapText(item.text, CONTENT_WIDTH - 20, 10, font);
    for (const line of descLines) {
      page.drawText(line, {
        x: MARGIN + 10,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 14;
    }

    yPosition -= 6; // Gap between items
  }

  yPosition -= 10;

  // Subsection 4: Recommended Actions
  page.drawText(sanitizePdfText('Recommended Actions'), {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: boldFont,
    color: rgb(0.25, 0.25, 0.25),
  });

  yPosition -= 20;

  const actionText = 'Review the Action Plan immediately and assign responsibilities. P1 and P2 actions should be prioritised for prompt attention, with P3 and P4 addressed as part of planned improvement. Maintain records of completed actions and any interim risk control measures implemented. Schedule a review meeting with key stakeholders within 7 days of receiving this report.';
  const actionLines = wrapText(actionText, CONTENT_WIDTH - 20, 10, font);

  for (const line of actionLines) {
    page.drawText(line, {
      x: MARGIN + 10,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    yPosition -= 14;
  }

  yPosition -= 20;

  // Footer note
  const footerText = 'For questions or clarifications regarding this report, contact the named assessor.';
  const footerLines = wrapText(footerText, CONTENT_WIDTH, 9, font);

  for (const line of footerLines) {
    page.drawText(line, {
      x: MARGIN,
      y: yPosition,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    yPosition -= 13;
  }

  return { page, yPosition };
}

/**
 * Draw compact "Assurance Gaps" block (replaces verbose "Assessment notes" list)
 */
export function drawAssuranceGapsBlock(
  page: PDFPage,
  gaps: string[],
  font: any,
  boldFont: any,
  yPosition: number
): number {
  if (gaps.length === 0) return yPosition;

  // Title
  page.drawText(sanitizePdfText('Assurance Gaps'), {
    x: MARGIN,
    y: yPosition,
    size: 11,
    font: boldFont,
    color: rgb(0.8, 0.4, 0.1), // Amber warning color
  });

  yPosition -= 18;

  // Draw up to 2 gaps as bullets
  for (const gap of gaps.slice(0, 2)) {
    // Bullet
    page.drawText(sanitizePdfText('•'), {
      x: MARGIN + 5,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Wrap gap text (wrapText already sanitizes)
    const gapLines = wrapText(gap, CONTENT_WIDTH - 20, 10, font);
    for (let i = 0; i < gapLines.length; i++) {
      page.drawText(gapLines[i], {
        x: MARGIN + 15,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 14;
    }
  }

  yPosition -= 10; // Extra space after block

  return yPosition;
}
