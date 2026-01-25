import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import { getModuleName } from '../modules/moduleCatalog';
import { detectInfoGaps } from '../../utils/infoGapQuickActions';
import { listAttachments, type Attachment } from '../supabase/attachments';
import {
  fraRegulatoryFrameworkText,
  fraResponsiblePersonDutiesText,
  fsdPurposeAndScopeText,
  fsdLimitationsText,
} from '../reportText';
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN,
  CONTENT_WIDTH,
  sanitizePdfText,
  wrapText,
  formatDate,
  getRatingColor,
  getOutcomeColor,
  getOutcomeLabel,
  getPriorityColor,
  drawDraftWatermark,
  addNewPage,
  drawFooter,
  addSupersededWatermark,
  addExecutiveSummaryPages,
} from './pdfUtils';

interface Document {
  id: string;
  document_type: string;
  title: string;
  status: string;
  version: number;
  assessment_date: string;
  review_date: string | null;
  assessor_name: string | null;
  assessor_role: string | null;
  responsible_person: string | null;
  scope_description: string | null;
  limitations_assumptions: string | null;
  standards_selected: string[];
  created_at: string;
  updated_at: string;
  executive_summary_ai?: string | null;
  executive_summary_author?: string | null;
  executive_summary_mode?: string | null;
  enabled_modules?: string[];
  jurisdiction?: 'UK' | 'IE';
}

interface ModuleInstance {
  id: string;
  module_key: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
  completed_at: string | null;
  updated_at: string;
}

interface Action {
  id: string;
  recommended_action: string;
  priority_band: string;
  status: string;
  owner_user_id: string | null;
  owner_display_name?: string;
  target_date: string | null;
  module_instance_id: string;
  created_at: string;
}

interface ActionRating {
  action_id: string;
  likelihood: number;
  impact: number;
  score: number;
  rated_at: string;
}

interface Organisation {
  id: string;
  name: string;
}

interface BuildPdfOptions {
  document: Document;
  moduleInstances: ModuleInstance[];
  actions: Action[];
  actionRatings: ActionRating[];
  organisation: Organisation;
  renderMode?: 'preview' | 'issued';
}

const FRA_MODULE_ORDER = [
  'A1_DOC_CONTROL',
  'FRA_4_SIGNIFICANT_FINDINGS',
  'FRA_1_HAZARDS',
  'A4_MANAGEMENT_CONTROLS',
  'A5_EMERGENCY_ARRANGEMENTS',
  'FRA_2_ESCAPE_ASIS',
  'FRA_3_PROTECTION_ASIS',
  'FRA_5_EXTERNAL_FIRE_SPREAD',
];

const FSD_MODULE_ORDER = [
  'FSD_1_REG_BASIS',
  'FSD_2_EVAC_STRATEGY',
  'FSD_3_ESCAPE_DESIGN',
  'FSD_4_PASSIVE_PROTECTION',
  'FSD_5_ACTIVE_SYSTEMS',
  'FSD_6_FIRE_SERVICE_ACCESS',
  'FSD_7_DRAWINGS_INDEX',
  'FSD_8_SMOKE_CONTROL',
  'FSD_9_CONSTRUCTION_PHASE',
];

const COMMON_MODULES = ['A1_DOC_CONTROL', 'A2_BUILDING_PROFILE', 'A3_PERSONS_AT_RISK'];

export async function buildCombinedPdf(options: BuildPdfOptions): Promise<Uint8Array> {
  const { document, moduleInstances, actions, actionRatings, organisation, renderMode } = options;

  console.log('[Combined PDF] Building combined FRA + FSD PDF with:', {
    modules: moduleInstances.length,
    actions: actions.length,
    ratings: actionRatings.length,
  });

  let attachments: Attachment[] = [];
  try {
    attachments = await listAttachments(document.id);
    console.log('[Combined PDF] Fetched', attachments.length, 'attachments');
  } catch (error) {
    console.warn('[Combined PDF] Failed to fetch attachments:', error);
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const isDraft = document.status !== 'issued';
  const totalPages: PDFPage[] = [];

  // Cover Page
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  totalPages.push(page);
  let yPosition = PAGE_HEIGHT - MARGIN;

  if (isDraft) {
    drawDraftWatermark(page);
  }

  yPosition = drawCombinedCoverPage(page, document, organisation, font, fontBold, yPosition, renderMode);

  // Executive Summary
  addExecutiveSummaryPages(
    pdfDoc,
    isDraft,
    totalPages,
    (document.executive_summary_mode as 'ai' | 'author' | 'both' | 'none') || 'none',
    document.executive_summary_ai,
    document.executive_summary_author,
    { bold: fontBold, regular: font }
  );

  // Table of Contents
  const tocResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = tocResult.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawTableOfContents(page, font, fontBold, yPosition);

  // Common Sections (if any)
  const commonModules = moduleInstances.filter(m => COMMON_MODULES.includes(m.module_key));
  if (commonModules.length > 0) {
    const commonResult = addNewPage(pdfDoc, isDraft, totalPages);
    page = commonResult.page;
    yPosition = PAGE_HEIGHT - MARGIN;

    page.drawText('Common Sections', {
      x: MARGIN,
      y: yPosition,
      size: 16,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 30;

    for (const module of commonModules) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN;
      yPosition = drawModuleSummary(page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
    }
  }

  // Part 1: Fire Risk Assessment (FRA)
  const fraResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = fraResult.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawPartHeader(page, 'Part 1: Fire Risk Assessment (FRA)', font, fontBold, yPosition);

  // FRA Regulatory Framework
  const fraRegResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = fraRegResult.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  const jurisdiction = (document.jurisdiction || 'UK') as 'UK' | 'IE';
  yPosition = drawTextSection(page, 'Regulatory Framework', fraRegulatoryFrameworkText(jurisdiction), font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  // FRA Responsible Person Duties
  const fraRespResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = fraRespResult.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawTextSection(page, 'Responsible Person Duties', fraResponsiblePersonDutiesText(jurisdiction), font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  // FRA Modules
  const fraModules = sortModulesByOrder(
    moduleInstances.filter(m => m.module_key.startsWith('FRA_') && !COMMON_MODULES.includes(m.module_key)),
    FRA_MODULE_ORDER
  );

  for (const module of fraModules) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawModuleSummary(page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  // Part 2: Fire Strategy Document (FSD)
  const fsdResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = fsdResult.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawPartHeader(page, 'Part 2: Fire Strategy Document (FSD)', font, fontBold, yPosition);

  // FSD Purpose and Scope
  const fsdPurposeResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = fsdPurposeResult.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawTextSection(page, 'Purpose and Scope', fsdPurposeAndScopeText(jurisdiction), font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  // FSD Modules
  const fsdModules = sortModulesByOrder(
    moduleInstances.filter(m => m.module_key.startsWith('FSD_') && !COMMON_MODULES.includes(m.module_key)),
    FSD_MODULE_ORDER
  );

  for (const module of fsdModules) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawModuleSummary(page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  // Appendix: Action Register
  const actionsResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = actionsResult.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawActionRegister(page, actions, actionRatings, moduleInstances, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  // Appendix: Attachments Index
  if (attachments.length > 0) {
    const attachResult = addNewPage(pdfDoc, isDraft, totalPages);
    page = attachResult.page;
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawAttachmentsIndex(page, attachments, moduleInstances, actions, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  // Appendix: Assumptions and Limitations
  if (document.scope_description || document.limitations_assumptions) {
    const limResult = addNewPage(pdfDoc, isDraft, totalPages);
    page = limResult.page;
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawAssumptionsAndLimitations(page, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  // Add FSD Limitations
  const fsdLimResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = fsdLimResult.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawTextSection(page, 'Fire Strategy Limitations', fsdLimitationsText(jurisdiction), font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  // Add page numbers and footers
  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const footerText = `Combined FRA + FSD Report — ${document.title} — v${document.version} — Generated ${today}`;

  for (let i = 1; i < totalPages.length; i++) {
    drawFooter(totalPages[i], footerText, i, totalPages.length - 1, font);
  }

  if (document.status === 'superseded') {
    for (const p of totalPages) {
      addSupersededWatermark(p);
    }
  }

  return await pdfDoc.save();
}

function drawCombinedCoverPage(
  page: PDFPage,
  document: Document,
  organisation: Organisation,
  font: any,
  fontBold: any,
  yPosition: number,
  renderMode?: 'preview' | 'issued'
): number {
  yPosition -= 80;

  page.drawText('Combined Fire Risk Assessment', {
    x: MARGIN,
    y: yPosition,
    size: 22,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  yPosition -= 30;

  page.drawText('and Fire Strategy Document', {
    x: MARGIN,
    y: yPosition,
    size: 22,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  yPosition -= 60;

  page.drawText(sanitizePdfText(document.title), {
    x: MARGIN,
    y: yPosition,
    size: 18,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 50;

  page.drawText(`Organisation: ${sanitizePdfText(organisation.name)}`, {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  yPosition -= 25;

  if (document.assessment_date) {
    page.drawText(`Assessment Date: ${formatDate(document.assessment_date)}`, {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });
    yPosition -= 25;
  }

  if (document.assessor_name) {
    page.drawText(`Prepared by: ${sanitizePdfText(document.assessor_name)}`, {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });
    yPosition -= 25;
  }

  page.drawText(`Version: ${document.version}`, {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  yPosition -= 25;

  let issueStatus = renderMode === 'issued' ? 'issued' : ((document as any).issue_status || document.status);

  page.drawText(`Status: ${issueStatus.toUpperCase()}`, {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: issueStatus === 'issued' ? rgb(0, 0.5, 0) : rgb(0.6, 0.6, 0.6),
  });
  yPosition -= 60;

  return yPosition;
}

function drawTableOfContents(
  page: PDFPage,
  font: any,
  fontBold: any,
  yPosition: number
): number {
  page.drawText('Table of Contents', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 30;

  const sections = [
    'Part 1: Fire Risk Assessment (FRA)',
    '  - Regulatory Framework',
    '  - Responsible Person Duties',
    '  - Fire Hazards',
    '  - Management Controls',
    '  - Emergency Arrangements',
    '  - Means of Escape',
    '  - Fire Protection Measures',
    '',
    'Part 2: Fire Strategy Document (FSD)',
    '  - Purpose and Scope',
    '  - Regulatory Basis',
    '  - Evacuation Strategy',
    '  - Means of Escape Design',
    '  - Passive Fire Protection',
    '  - Active Fire Systems',
    '  - Fire Service Access',
    '',
    'Appendices',
    '  - Action Register',
    '  - Attachments Index',
    '  - Assumptions and Limitations',
  ];

  for (const section of sections) {
    page.drawText(section, {
      x: MARGIN + (section.startsWith('  ') ? 20 : 0),
      y: yPosition,
      size: section === '' ? 10 : 11,
      font: section.startsWith('Part') ? fontBold : font,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= section === '' ? 10 : 20;
  }

  return yPosition;
}

function drawPartHeader(
  page: PDFPage,
  title: string,
  font: any,
  fontBold: any,
  yPosition: number
): number {
  const boxHeight = 60;
  const boxY = yPosition - boxHeight;

  page.drawRectangle({
    x: MARGIN,
    y: boxY,
    width: CONTENT_WIDTH,
    height: boxHeight,
    color: rgb(0.95, 0.95, 0.97),
  });

  page.drawText(sanitizePdfText(title), {
    x: MARGIN + 20,
    y: boxY + 20,
    size: 18,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  return boxY - 30;
}

function drawTextSection(
  page: PDFPage,
  title: string,
  text: string,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  page.drawText(title, {
    x: MARGIN,
    y: yPosition,
    size: 14,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 25;

  const paragraphs = text.split('\n\n');

  for (const para of paragraphs) {
    const cleanPara = sanitizePdfText(para.trim());
    if (!cleanPara) continue;

    const lines = wrapText(cleanPara, CONTENT_WIDTH, font, 10);

    for (const line of lines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN;
      }

      page.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }

    yPosition -= 8;
  }

  return yPosition - 20;
}

function sortModulesByOrder(modules: ModuleInstance[], order: string[]): ModuleInstance[] {
  return modules.sort((a, b) => {
    const aIdx = order.indexOf(a.module_key);
    const bIdx = order.indexOf(b.module_key);
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
}

function drawModuleSummary(
  page: PDFPage,
  module: ModuleInstance,
  document: Document,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  const moduleName = getModuleName(module.module_key);

  page.drawText(sanitizePdfText(moduleName), {
    x: MARGIN,
    y: yPosition,
    size: 13,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 25;

  if (module.outcome) {
    const outcomeLabel = getOutcomeLabel(module.outcome);
    const outcomeColor = getOutcomeColor(module.outcome);

    page.drawText(`Outcome: ${outcomeLabel}`, {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: outcomeColor,
    });
    yPosition -= 20;
  }

  if (module.assessor_notes && module.assessor_notes.trim()) {
    const notes = sanitizePdfText(module.assessor_notes);
    const lines = wrapText(notes, CONTENT_WIDTH, font, 10);

    for (const line of lines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN;
      }

      page.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }
  }

  // Draw info gap quick actions if detected
  yPosition = drawInfoGapQuickActions(page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  yPosition -= 30;
  return yPosition;
}

function drawInfoGapQuickActions(
  page: PDFPage,
  module: ModuleInstance,
  document: Document,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  const detection = detectInfoGaps(
    module.module_key,
    module.data,
    module.outcome,
    {
      responsible_person: document.responsible_person || undefined,
      standards_selected: document.standards_selected || []
    }
  );

  if (!detection.hasInfoGap) {
    return yPosition;
  }

  // Check if we need a new page
  if (yPosition < MARGIN + 200) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN - 20;
  }

  yPosition -= 20;

  // Neutral callout - light border instead of warning banner
  // Draw subtle border box
  const boxStartY = yPosition + 5;
  page.drawRectangle({
    x: MARGIN,
    y: yPosition - (detection.reasons.length * 18) - 45,
    width: CONTENT_WIDTH,
    height: (detection.reasons.length * 18) + 55,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.98),
  });

  yPosition -= 5;

  // Title section with neutral info icon
  page.drawText(sanitizePdfText('i'), {
    x: MARGIN + 8,
    y: yPosition,
    size: 11,
    font: fontBold,
    color: rgb(0.5, 0.5, 0.5),
  });

  page.drawText(sanitizePdfText('Assessment notes (incomplete information)'), {
    x: MARGIN + 25,
    y: yPosition,
    size: 11,
    font: fontBold,
    color: rgb(0.4, 0.4, 0.4),
  });

  yPosition -= 25;

  // Reasons - neutral styling
  if (detection.reasons.length > 0) {
    for (const reason of detection.reasons) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
      }

      page.drawText(sanitizePdfText('•'), {
        x: MARGIN + 8,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });

      const reasonLines = wrapText(reason, CONTENT_WIDTH - 30, 9, font);
      for (const line of reasonLines) {
        if (yPosition < MARGIN + 50) {
          const result = addNewPage(pdfDoc, isDraft, totalPages);
          page = result.page;
          yPosition = PAGE_HEIGHT - MARGIN - 20;
        }
        page.drawText(line, {
          x: MARGIN + 18,
          y: yPosition,
          size: 9,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
        yPosition -= 13;
      }
    }
    yPosition -= 10;
  }

  // Quick Actions - neutral styling
  if (detection.quickActions.length > 0) {
    if (yPosition < MARGIN + 100) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    page.drawText('Recommended actions:', {
      x: MARGIN + 8,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0.4, 0.4, 0.4),
    });

    yPosition -= 20;

    for (const quickAction of detection.quickActions) {
      if (yPosition < MARGIN + 100) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
      }

      // Priority badge
      const priorityColor = quickAction.priority === 'P2' ? rgb(0.9, 0.5, 0.13) : rgb(0.85, 0.65, 0.13);
      page.drawRectangle({
        x: MARGIN + 10,
        y: yPosition - 3,
        width: 25,
        height: 14,
        color: priorityColor,
      });
      page.drawText(quickAction.priority, {
        x: MARGIN + 13,
        y: yPosition,
        size: 8,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      yPosition -= 18;

      // Action text
      const actionLines = wrapText(quickAction.action, CONTENT_WIDTH - 30, 10, font);
      for (const line of actionLines) {
        if (yPosition < MARGIN + 50) {
          const result = addNewPage(pdfDoc, isDraft, totalPages);
          page = result.page;
          yPosition = PAGE_HEIGHT - MARGIN - 20;
        }
        page.drawText(line, {
          x: MARGIN + 15,
          y: yPosition,
          size: 10,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });
        yPosition -= 14;
      }

      // Reason (why)
      const reasonText = `Why: ${quickAction.reason}`;
      const reasonLines = wrapText(reasonText, CONTENT_WIDTH - 30, 9, font);
      for (const line of reasonLines) {
        if (yPosition < MARGIN + 50) {
          const result = addNewPage(pdfDoc, isDraft, totalPages);
          page = result.page;
          yPosition = PAGE_HEIGHT - MARGIN - 20;
        }
        page.drawText(line, {
          x: MARGIN + 15,
          y: yPosition,
          size: 9,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
        yPosition -= 13;
      }

      yPosition -= 10;
    }

    // Tip at the bottom
    yPosition -= 5;
    const tipText = 'Tip: Address these information gaps to improve assessment completeness and reduce risk uncertainty.';
    const tipLines = wrapText(tipText, CONTENT_WIDTH - 20, 8, font);
    for (const line of tipLines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
      }
      page.drawText(line, {
        x: MARGIN + 10,
        y: yPosition,
        size: 8,
        font,
        color: rgb(0.6, 0.4, 0),
      });
      yPosition -= 12;
    }
  }

  yPosition -= 15;
  return yPosition;
}

function drawActionRegister(
  page: PDFPage,
  actions: Action[],
  actionRatings: ActionRating[],
  moduleInstances: ModuleInstance[],
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  page.drawText('Action Register', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 30;

  const openActions = actions.filter(a => a.status !== 'complete');

  if (openActions.length === 0) {
    page.drawText('No open actions.', {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: font,
      color: rgb(0.4, 0.4, 0.4),
    });
    yPosition -= 30;
    return yPosition;
  }

  for (let i = 0; i < openActions.length; i++) {
    const action = openActions[i];

    if (yPosition < MARGIN + 100) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN;
    }

    const priorityColor = getPriorityColor(action.priority_band);

    page.drawText(`${i + 1}. [${action.priority_band || 'N/A'}] ${sanitizePdfText(action.recommended_action)}`, {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: font,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 18;

    if (action.owner_display_name) {
      page.drawText(`   Owner: ${sanitizePdfText(action.owner_display_name)}`, {
        x: MARGIN,
        y: yPosition,
        size: 9,
        font: font,
        color: rgb(0.4, 0.4, 0.4),
      });
      yPosition -= 14;
    }

    if (action.target_date) {
      page.drawText(`   Target: ${formatDate(action.target_date)}`, {
        x: MARGIN,
        y: yPosition,
        size: 9,
        font: font,
        color: rgb(0.4, 0.4, 0.4),
      });
      yPosition -= 14;
    }

    yPosition -= 10;
  }

  return yPosition;
}

function drawAttachmentsIndex(
  page: PDFPage,
  attachments: Attachment[],
  moduleInstances: ModuleInstance[],
  actions: Action[],
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  page.drawText('Attachments Index', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 30;

  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i];

    if (yPosition < MARGIN + 60) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN;
    }

    page.drawText(`${i + 1}. ${sanitizePdfText(att.filename)}`, {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: font,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 18;

    if (att.description) {
      const desc = sanitizePdfText(att.description);
      page.drawText(`   ${desc}`, {
        x: MARGIN,
        y: yPosition,
        size: 9,
        font: font,
        color: rgb(0.4, 0.4, 0.4),
      });
      yPosition -= 14;
    }

    yPosition -= 8;
  }

  return yPosition;
}

function drawAssumptionsAndLimitations(
  page: PDFPage,
  document: Document,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  page.drawText('Assumptions and Limitations', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 30;

  if (document.scope_description) {
    page.drawText('Scope:', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;

    const scopeLines = wrapText(sanitizePdfText(document.scope_description), CONTENT_WIDTH, font, 10);
    for (const line of scopeLines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN;
      }

      page.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }
    yPosition -= 20;
  }

  if (document.limitations_assumptions) {
    page.drawText('Limitations and Assumptions:', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;

    const limLines = wrapText(sanitizePdfText(document.limitations_assumptions), CONTENT_WIDTH, font, 10);
    for (const line of limLines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN;
      }

      page.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }
  }

  return yPosition;
}
