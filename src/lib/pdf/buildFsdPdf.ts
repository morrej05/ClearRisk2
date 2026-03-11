import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import { getModuleName } from '../modules/moduleCatalog';
import { detectInfoGaps } from '../../utils/infoGapQuickActions';
import { listAttachments, type Attachment } from '../supabase/attachments';
import {
  fsdPurposeAndScopeText,
  fsdLimitationsText,
} from '../reportText';
import { normalizeFsdJurisdiction } from '../reportText/fsd/jurisdiction';
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN,
  CONTENT_WIDTH,
  PAGE_TOP_Y,
  sanitizePdfText,
  wrapText,
  formatDate,
  getOutcomeLabel,
  getPriorityColor,
  addNewPage,
  drawFooter,
  addExecutiveSummaryPages,
  addSupersededWatermark,
  ensurePageSpace,
  getReportFooterTitle,
} from './pdfUtils';
import { addIssuedReportPages } from './issuedPdfPages';
import { computeFsdSummary } from '../fsd/fsdAssuranceEngine';
import { drawSectionHeaderBar, drawOutcomeBadge, drawPageTitle } from './pdfPrimitives';
import { PDF_THEME } from './pdfStyles';
import { compareActionsByDisplayReference } from './actionContracts';

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
  executive_summary_ai: string | null;
  executive_summary_author: string | null;
  executive_summary_mode: string | null;
  issue_status: string;
  jurisdiction?: string | null;
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
  trigger_id?: string | null;
  trigger_text?: string | null;
  owner_user_id: string | null;
  owner_display_name?: string;
  target_date: string | null;
  module_instance_id: string;
  created_at: string;
  reference_number?: string | null;
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
  branding_logo_path?: string | null;
}

interface BuildFsdPdfOptions {
  document: Document;
  moduleInstances: ModuleInstance[];
  actions: Action[];
  actionRatings: ActionRating[];
  organisation: Organisation;
  renderMode?: 'preview' | 'issued';
}

const MODULE_ORDER = [
  'A1_DOC_CONTROL',
  'FSD_1_REG_BASIS',
  'FSD_2_EVAC_STRATEGY',
  'A2_BUILDING_PROFILE',
  'A3_PERSONS_AT_RISK',
  'FSD_3_ESCAPE_DESIGN',
  'FSD_4_PASSIVE_PROTECTION',
  'FSD_5_ACTIVE_SYSTEMS',
  'FSD_6_FRS_ACCESS',
  'FSD_7_DRAWINGS',
  'FSD_8_SMOKE_CONTROL',
  'FSD_9_CONSTRUCTION_PHASE',
];

const FSD_ALLOWED_MODULE_KEYS = new Set([
  'A2_BUILDING_PROFILE',
  'A3_PERSONS_AT_RISK',
  ...MODULE_ORDER.filter((key) => key.startsWith('FSD_')),
]);

function drawTableOfContents(
  pdfDoc: PDFDocument,
  totalPages: PDFPage[],
  tocPage: PDFPage,
  tocEntries: Array<{ title: string; pageNo: number }>,
  font: any,
  fontBold: any
): void {
  const tocStartY = PAGE_TOP_Y - 40;
  const tocTitleLineHeight = 24;
  const tocTitleSpacingBelow = 20;
  const tocContentGap = 12;
  const contentStartY = tocStartY - tocTitleLineHeight - tocTitleSpacingBelow - tocContentGap;
  const minY = MARGIN + 50;
  const rowHeight = 16;

  const drawTocHeader = (page: PDFPage): number => {
    drawPageTitle(page, MARGIN, tocStartY, 'Contents', { regular: font, bold: fontBold });
    return contentStartY;
  };
  const countNeededTocPages = (): number => {
    let pageCount = 1;
    let yPosition = contentStartY;

    for (let i = 0; i < tocEntries.length; i += 1) {
      if (yPosition < minY) {
        pageCount += 1;
        yPosition = contentStartY;
      }
      yPosition -= rowHeight;
    }

    return pageCount;
  };

  const tocPageCount = countNeededTocPages();
  const extraTocPages = Math.max(0, tocPageCount - 1);

  if (extraTocPages > 0) {
    const tocPageIndex = totalPages.indexOf(tocPage);
    for (let i = 0; i < extraTocPages; i += 1) {
      const inserted = pdfDoc.insertPage(tocPageIndex + 1 + i, [PAGE_WIDTH, PAGE_HEIGHT]);
      totalPages.splice(tocPageIndex + 1 + i, 0, inserted);
    }
  }

  const tocPageIndex = totalPages.indexOf(tocPage);
  const allTocPages = totalPages.slice(tocPageIndex, tocPageIndex + tocPageCount);
  let currentTocPageIndex = 0;
  let activeTocPage = allTocPages[currentTocPageIndex];
  let yPosition = drawTocHeader(activeTocPage);

  for (const entry of tocEntries) {
    if (yPosition < minY) {
      currentTocPageIndex += 1;
      activeTocPage = allTocPages[currentTocPageIndex];
      yPosition = drawTocHeader(activeTocPage);
    }

    const sanitizedTitle = sanitizePdfText(entry.title);
    activeTocPage.drawText(sanitizedTitle, {
      x: MARGIN + 20,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0, 0, 0),
    });

    const pageNumText = (entry.pageNo + extraTocPages).toString();
    const pageNumWidth = font.widthOfTextAtSize(pageNumText, 11);
    activeTocPage.drawText(pageNumText, {
      x: PAGE_WIDTH - MARGIN - pageNumWidth,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0, 0, 0),
    });

    yPosition -= rowHeight;
  }
}

export async function buildFsdPdf(options: BuildFsdPdfOptions): Promise<Uint8Array> {
  const { document, moduleInstances, actions, organisation, renderMode } = options;
  const jurisdiction = normalizeFsdJurisdiction(document.jurisdiction || (document as any).meta?.jurisdiction || null);

  let attachments: Attachment[] = [];
  try {
    attachments = await listAttachments(document.id);
  } catch (error) {
    console.warn('[FSD PDF] Failed to fetch attachments:', error);
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const isIssuedMode = renderMode === 'issued';
  const isDraft = !isIssuedMode;
  const totalPages: PDFPage[] = [];

  const { coverPage, docControlPage } = await addIssuedReportPages({
    pdfDoc,
    document: {
      id: document.id,
      title: document.title,
      document_type: 'FSD',
      version_number: (document as any).version_number || document.version || 1,
      issue_date: (document as any).issue_date || new Date().toISOString(),
      issue_status: isIssuedMode ? 'issued' : 'draft',
      assessor_name: document.assessor_name,
      base_document_id: (document as any).base_document_id,
    },
    organisation: {
      id: organisation.id,
      name: organisation.name,
      branding_logo_path: organisation.branding_logo_path,
    },
    client: {
      name: (document as any).meta?.client?.name || document.responsible_person || '',
      site: (document as any).meta?.site?.name || document.scope_description || '',
    },
    fonts: { bold: fontBold, regular: font },
  });
  totalPages.push(coverPage, docControlPage);

  const filteredModules = moduleInstances.filter((m) => FSD_ALLOWED_MODULE_KEYS.has(m.module_key));
  const sortedModules = sortModules(filteredModules);
  const computedSummary = computeFsdSummary({ modules: filteredModules });

  const { page: tocPage } = addNewPage(pdfDoc, isDraft, totalPages);
  const tocEntries: Array<{ title: string; pageNo: number }> = [];
  const recordToc = (title: string, pageNo = totalPages.length) => tocEntries.push({ title, pageNo });

  const executiveSummaryMode = (document.executive_summary_mode as 'ai' | 'author' | 'both' | 'none') || 'none';
  const hasExecutiveSummary =
    (executiveSummaryMode === 'ai' || executiveSummaryMode === 'both') && !!document.executive_summary_ai ||
    (executiveSummaryMode === 'author' || executiveSummaryMode === 'both') && !!document.executive_summary_author;

  if (hasExecutiveSummary) {
    const executiveSummaryStartPage = totalPages.length + 1;
    addExecutiveSummaryPages(
      pdfDoc,
      isDraft,
      totalPages,
      executiveSummaryMode,
      document.executive_summary_ai,
      document.executive_summary_author,
      { bold: fontBold, regular: font }
    );
    recordToc('Executive Summary', executiveSummaryStartPage);
  }

  let page: PDFPage;
  let yPosition: number;

  ({ page, yPosition } = addNewPage(pdfDoc, isDraft, totalPages));
  recordToc('Computed Assurance Summary');
  page = drawComputedAssuranceSummary(page, computedSummary, pdfDoc, isDraft, totalPages, font, fontBold);

  if (computedSummary.deviations.length > 0) {
    ({ page, yPosition } = addNewPage(pdfDoc, isDraft, totalPages));
    recordToc('Deviation Register');
    page = drawDeviationRegister(page, computedSummary.deviations, pdfDoc, isDraft, totalPages, font, fontBold);
  }

  if (computedSummary.assuranceFlags.length > 0) {
    ({ page, yPosition } = addNewPage(pdfDoc, isDraft, totalPages));
    recordToc('Assurance Checks');
    page = drawAssuranceChecks(page, computedSummary.assuranceFlags, pdfDoc, isDraft, totalPages, font, fontBold);
  }

  ({ page, yPosition } = addNewPage(pdfDoc, isDraft, totalPages));
  recordToc('Purpose and Scope');
  page = drawPurposeAndScope(page, jurisdiction, pdfDoc, isDraft, totalPages, font, fontBold);

  if (document.scope_description) {
    ({ page, yPosition } = addNewPage(pdfDoc, isDraft, totalPages));
    recordToc('Document Scope');
    page = drawDocumentScope(page, document.scope_description, pdfDoc, isDraft, totalPages, font, fontBold);
  }

  ({ page, yPosition } = addNewPage(pdfDoc, isDraft, totalPages));
  recordToc('Limitations and Assumptions');
  page = drawFsdLimitations(page, jurisdiction, pdfDoc, isDraft, totalPages, font, fontBold);

  if (document.limitations_assumptions) {
    page = drawDocumentLimitations(page, document.limitations_assumptions, pdfDoc, isDraft, totalPages, font, fontBold);
  }

  if (sortedModules.length > 0) {
    ({ page, yPosition } = addNewPage(pdfDoc, isDraft, totalPages));
    recordToc('Module Summaries');
    for (const moduleInstance of sortedModules) {
      ({ page, yPosition } = drawModuleSummary(page, yPosition, moduleInstance, document, pdfDoc, isDraft, totalPages, font, fontBold));
    }
  }

  if (actions.length > 0) {
    ({ page, yPosition } = addNewPage(pdfDoc, isDraft, totalPages));
    recordToc('Action Register');
    ({ page, yPosition } = drawActionRegister(page, yPosition, actions, pdfDoc, isDraft, totalPages, font, fontBold));
  }

  if (attachments.length > 0) {
    ({ page, yPosition } = addNewPage(pdfDoc, isDraft, totalPages));
    recordToc('Attachments Index');
    ({ page, yPosition } = drawAttachmentsIndex(page, yPosition, attachments, filteredModules, actions, pdfDoc, isDraft, totalPages, font, fontBold));
  }

  drawTableOfContents(pdfDoc, totalPages, tocPage, tocEntries, font, fontBold);

  const footerReportTitle = getReportFooterTitle('FSD', document.title);
  for (let i = 0; i < totalPages.length; i++) {
    drawFooter(totalPages[i], footerReportTitle, i + 1, totalPages.length, font);
  }

  if (document.issue_status === 'superseded') {
    await addSupersededWatermark(pdfDoc);
  }

  return await pdfDoc.save();
}

function sortModules(moduleInstances: ModuleInstance[]): ModuleInstance[] {
  return [...moduleInstances].sort((a, b) => {
    const aIndex = MODULE_ORDER.indexOf(a.module_key);
    const bIndex = MODULE_ORDER.indexOf(b.module_key);

    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;

    return aIndex - bIndex;
  });
}

function drawModuleSummary(
  page: PDFPage,
  startY: number,
  moduleInstance: ModuleInstance,
  document: Document,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  font: any,
  fontBold: any
): { page: PDFPage; yPosition: number } {
  let currentPage = page;
  let yPosition = startY;

  ({ page: currentPage, yPosition } = ensurePageSpace(90, currentPage, yPosition, pdfDoc, isDraft, totalPages));

  const moduleName = getModuleName(moduleInstance.module_key);
  yPosition = drawSectionHeaderBar({
    page: currentPage,
    x: MARGIN,
    y: yPosition,
    w: CONTENT_WIDTH,
    title: sanitizePdfText(moduleName),
    product: 'fsd',
    fonts: { regular: font, bold: fontBold },
  });

  const outcome = moduleInstance.outcome || 'pending';
  drawOutcomeBadge({
    page: currentPage,
    x: MARGIN,
    y: yPosition,
    outcome: getOutcomeLabel(outcome),
    fonts: { regular: font, bold: fontBold },
  });
  yPosition -= 24;

  if (moduleInstance.assessor_notes && moduleInstance.assessor_notes.trim()) {
    ({ page: currentPage, yPosition } = ensurePageSpace(30, currentPage, yPosition, pdfDoc, isDraft, totalPages));
    currentPage.drawText('Assessor Notes:', {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 16;

    const notesLines = wrapText(moduleInstance.assessor_notes, CONTENT_WIDTH, 9, font);
    for (const line of notesLines) {
      ({ page: currentPage, yPosition } = ensurePageSpace(14, currentPage, yPosition, pdfDoc, isDraft, totalPages));
      currentPage.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 9,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 12;
    }
    yPosition -= 10;
  }

  ({ page: currentPage, yPosition } = drawModuleKeyDetails(currentPage, moduleInstance, yPosition, pdfDoc, isDraft, totalPages, font, fontBold));
  ({ page: currentPage, yPosition } = drawInfoGapQuickActions(currentPage, moduleInstance, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages));

  yPosition -= 16;
  return { page: currentPage, yPosition };
}

function drawModuleKeyDetails(
  page: PDFPage,
  moduleInstance: ModuleInstance,
  startY: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  font: any,
  fontBold: any
): { page: PDFPage; yPosition: number } {
  let currentPage = page;
  let yPosition = startY;
  const data = moduleInstance.data;

  if (!data || Object.keys(data).length === 0) {
    return { page: currentPage, yPosition };
  }

  ({ page: currentPage, yPosition } = ensurePageSpace(24, currentPage, yPosition, pdfDoc, isDraft, totalPages));
  currentPage.drawText('Key Details:', {
    x: MARGIN,
    y: yPosition,
    size: 10,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 16;

  const details: string[] = [];

  switch (moduleInstance.module_key) {
    case 'A2_BUILDING_PROFILE':
      if (data.building_height_m) details.push(`Height: ${data.building_height_m}m`);
      if (data.number_of_storeys) details.push(`Storeys: ${data.number_of_storeys}`);
      if (data.total_floor_area_sqm) details.push(`Area: ${data.total_floor_area_sqm} sqm`);
      if (data.primary_use) details.push(`Use: ${data.primary_use}`);
      if (data.frame_type) details.push(`Frame: ${data.frame_type}`);
      break;

    case 'A3_PERSONS_AT_RISK':
      if (data.max_occupancy) details.push(`Max Occupancy: ${data.max_occupancy}`);
      if (data.normal_occupancy) details.push(`Normal Occupancy: ${data.normal_occupancy}`);
      if (data.vulnerable_groups_present === 'yes') {
        details.push('Vulnerable groups present');
      }
      break;

    case 'FSD_1_REG_BASIS':
      if (data.regulatory_framework_selected) details.push(`Framework: ${data.regulatory_framework_selected}`);
      if (data.standards_list) {
        const standardsCount = Array.isArray(data.standards_list) ? data.standards_list.length : 0;
        details.push(`Standards: ${standardsCount} referenced`);
      }
      break;

    case 'FSD_2_EVAC_STRATEGY':
      if (data.evacuation_strategy_type) details.push(`Strategy: ${data.evacuation_strategy_type}`);
      if (data.travel_distance_compliance) details.push(`Travel distances: ${data.travel_distance_compliance}`);
      break;

    case 'FSD_3_ESCAPE_DESIGN':
      if (data.escape_route_adequacy) details.push(`Escape routes: ${data.escape_route_adequacy}`);
      if (data.signage_lighting) details.push(`Signage/lighting: ${data.signage_lighting}`);
      break;

    case 'FSD_4_PASSIVE_PROTECTION':
      if (data.compartmentation_adequacy) details.push(`Compartmentation: ${data.compartmentation_adequacy}`);
      if (data.fire_doors_status) details.push(`Fire doors: ${data.fire_doors_status}`);
      break;

    case 'FSD_5_ACTIVE_SYSTEMS':
      if (data.detection_system_present) details.push(`Detection: ${data.detection_system_present}`);
      if (data.suppression_system_present) details.push(`Suppression: ${data.suppression_system_present}`);
      break;

    case 'FSD_6_FRS_ACCESS':
      if (data.access_adequacy) details.push(`Access: ${data.access_adequacy}`);
      if (data.vehicle_access) details.push(`Vehicle access: ${data.vehicle_access}`);
      break;

    case 'FSD_7_DRAWINGS':
      if (data.drawings_checklist) {
        const checked = Object.values(data.drawings_checklist).filter(Boolean).length;
        const total = Object.keys(data.drawings_checklist).length;
        details.push(`Drawings: ${checked}/${total} types provided`);
      }
      break;

    case 'FSD_8_SMOKE_CONTROL':
      if (data.smoke_control_present) details.push(`Smoke control: ${data.smoke_control_present}`);
      if (data.system_type && data.smoke_control_present === 'yes') {
        details.push(`Type: ${data.system_type}`);
      }
      break;

    case 'FSD_9_CONSTRUCTION_PHASE':
      if (data.construction_phase_applicable) details.push(`Applicable: ${data.construction_phase_applicable}`);
      if (data.fire_plan_exists && data.construction_phase_applicable === 'yes') {
        details.push(`Fire plan: ${data.fire_plan_exists}`);
      }
      break;
  }

  for (const detail of details) {
    const lines = wrapText(detail, CONTENT_WIDTH - 10, 9, font);
    ({ page: currentPage, yPosition } = ensurePageSpace((lines.length * 12) + 6, currentPage, yPosition, pdfDoc, isDraft, totalPages));
    for (const line of lines) {
      currentPage.drawText(`• ${line}`, {
        x: MARGIN + 10,
        y: yPosition,
        size: 9,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 12;
    }
  }

  return { page: currentPage, yPosition };
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
): { page: PDFPage; yPosition: number } {
  let currentPage = page;
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
    return { page: currentPage, yPosition };
  }

  ({ page: currentPage, yPosition } = ensurePageSpace(220, currentPage, yPosition, pdfDoc, isDraft, totalPages));

  yPosition -= 20;

  currentPage.drawRectangle({
    x: MARGIN,
    y: yPosition - (detection.reasons.length * 18) - 45,
    width: CONTENT_WIDTH,
    height: (detection.reasons.length * 18) + 55,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.98),
  });

  yPosition -= 5;

  currentPage.drawText(sanitizePdfText('i'), {
    x: MARGIN + 8,
    y: yPosition,
    size: 11,
    font: fontBold,
    color: rgb(0.5, 0.5, 0.5),
  });

  currentPage.drawText(sanitizePdfText('Assessment notes (incomplete information)'), {
    x: MARGIN + 25,
    y: yPosition,
    size: 11,
    font: fontBold,
    color: rgb(0.4, 0.4, 0.4),
  });

  yPosition -= 25;

  if (detection.reasons.length > 0) {
    for (const reason of detection.reasons) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        currentPage = result.page;
        yPosition = PAGE_TOP_Y;
      }

      currentPage.drawText(sanitizePdfText('•'), {
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
          currentPage = result.page;
          yPosition = PAGE_TOP_Y;
        }
        currentPage.drawText(line, {
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

  if (detection.quickActions.length > 0) {
    if (yPosition < MARGIN + 100) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      currentPage = result.page;
      yPosition = PAGE_TOP_Y;
    }

    currentPage.drawText('Recommended actions:', {
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
        currentPage = result.page;
        yPosition = PAGE_TOP_Y;
      }

      const priorityColor = quickAction.priority === 'P2' ? PDF_THEME.colours.risk.medium.fg : PDF_THEME.colours.risk.medium.fg;
      currentPage.drawRectangle({
        x: MARGIN + 10,
        y: yPosition - 3,
        width: 25,
        height: 14,
        color: priorityColor,
      });
      currentPage.drawText(quickAction.priority, {
        x: MARGIN + 13,
        y: yPosition,
        size: 8,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      yPosition -= 18;

      const actionLines = wrapText(quickAction.action, CONTENT_WIDTH - 30, 10, font);
      for (const line of actionLines) {
        if (yPosition < MARGIN + 50) {
          const result = addNewPage(pdfDoc, isDraft, totalPages);
          currentPage = result.page;
          yPosition = PAGE_TOP_Y;
        }
        currentPage.drawText(line, {
          x: MARGIN + 15,
          y: yPosition,
          size: 10,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });
        yPosition -= 14;
      }

      const reasonText = `Why: ${quickAction.reason}`;
      const reasonLines = wrapText(reasonText, CONTENT_WIDTH - 30, 9, font);
      for (const line of reasonLines) {
        if (yPosition < MARGIN + 50) {
          const result = addNewPage(pdfDoc, isDraft, totalPages);
          currentPage = result.page;
          yPosition = PAGE_TOP_Y;
        }
        currentPage.drawText(line, {
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

    yPosition -= 5;
    const tipText = 'Tip: Address these information gaps to improve assessment completeness and reduce risk uncertainty.';
    const tipLines = wrapText(tipText, CONTENT_WIDTH - 20, 8, font);
    for (const line of tipLines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        currentPage = result.page;
        yPosition = PAGE_TOP_Y;
      }
      currentPage.drawText(line, {
        x: MARGIN + 10,
        y: yPosition,
        size: 8,
        font,
        color: PDF_THEME.colours.risk.medium.fg,
      });
      yPosition -= 12;
    }
  }

  yPosition -= 15;
  return { page: currentPage, yPosition };
}

function drawActionRegister(
  page: PDFPage,
  startY: number,
  actions: Action[],
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  font: any,
  fontBold: any
): { page: PDFPage; yPosition: number } {
  let currentPage = page;
  let yPosition = startY;

  ({ page: currentPage, yPosition } = ensurePageSpace(90, currentPage, yPosition, pdfDoc, isDraft, totalPages));

  currentPage.drawText('Action Register', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  yPosition -= 30;

  const colX1 = MARGIN;
  const colX2 = MARGIN + 320;
  const colX3 = MARGIN + 395;
  const colX4 = MARGIN + 445;
  const rowHeight = 14;

  currentPage.drawText('#', { x: colX1, y: yPosition, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText('Action', { x: colX1 + 15, y: yPosition, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText('Priority', { x: colX2, y: yPosition, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText('Status', { x: colX3, y: yPosition, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText('Target', { x: colX4, y: yPosition, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  yPosition -= rowHeight + 2;

  currentPage.drawLine({
    start: { x: MARGIN, y: yPosition + 2 },
    end: { x: PAGE_WIDTH - MARGIN, y: yPosition + 2 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  yPosition -= 4;

  const sortedActions = [...actions].sort(compareActionsByDisplayReference);

  sortedActions.forEach((action, index) => {
    ({ page: currentPage, yPosition } = ensurePageSpace(18, currentPage, yPosition, pdfDoc, isDraft, totalPages));

    const actionText = action.recommended_action?.trim() || '(No action text provided)';
    const ownerDisplay = action.owner_display_name?.trim() || '-';
    const actionLines = wrapText(`${actionText} (Owner: ${ownerDisplay})`, 300, 7, font);
    const firstLine = actionLines[0] || '';

    currentPage.drawText(`${index + 1}`, {
      x: colX1,
      y: yPosition,
      size: 7,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    currentPage.drawText(firstLine, {
      x: colX1 + 15,
      y: yPosition,
      size: 7,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    const priorityBand = action.priority_band?.trim() || '-';
    const priorityColor = getPriorityColor(priorityBand);
    currentPage.drawRectangle({
      x: colX2,
      y: yPosition - 2,
      width: 30,
      height: 10,
      color: priorityColor,
    });
    currentPage.drawText(sanitizePdfText(priorityBand), {
      x: colX2 + 5,
      y: yPosition,
      size: 7,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    currentPage.drawText(sanitizePdfText(action.status?.trim() || '-'), {
      x: colX3,
      y: yPosition,
      size: 7,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    const targetDate = action.target_date ? formatDate(action.target_date) : '-';
    currentPage.drawText(targetDate, {
      x: colX4,
      y: yPosition,
      size: 7,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    yPosition -= rowHeight;
  });

  return { page: currentPage, yPosition };
}

function drawAttachmentsIndex(
  page: PDFPage,
  startY: number,
  attachments: Attachment[],
  moduleInstances: ModuleInstance[],
  actions: Action[],
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  font: any,
  fontBold: any
): { page: PDFPage; yPosition: number } {
  let yPosition = startY;

  page.drawText('ATTACHMENTS & EVIDENCE INDEX', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  if (attachments.length === 0) {
    page.drawText('No attachments recorded.', {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    return { page, yPosition };
  }

  for (let i = 0; i < attachments.length; i++) {
    const attachment = attachments[i];

    ({ page, yPosition } = ensurePageSpace(110, page, yPosition, pdfDoc, isDraft, totalPages));

    const refNum = `E-${String(i + 1).padStart(3, '0')}`;

    page.drawText(`${refNum} ${sanitizePdfText(attachment.file_name)}`, {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 14;

    if (attachment.caption) {
      const captionLines = wrapText(attachment.caption, CONTENT_WIDTH - 20, 9, font);
      for (const line of captionLines) {
        if (yPosition < MARGIN + 50) {
          ({ page } = addNewPage(pdfDoc, isDraft, totalPages));
          yPosition = PAGE_TOP_Y;
        }
        page.drawText(line, {
          x: MARGIN + 10,
          y: yPosition,
          size: 9,
          font,
          color: rgb(0.3, 0.3, 0.3),
        });
        yPosition -= 12;
      }
    }

    if (attachment.linked_module_instance_id) {
      const linkedModule = moduleInstances.find((m) => m.id === attachment.linked_module_instance_id);
      if (linkedModule) {
        const moduleName = getModuleName(linkedModule.module_key);
        page.drawText(`Linked to: ${sanitizePdfText(moduleName)}`, {
          x: MARGIN + 10,
          y: yPosition,
          size: 8,
          font,
          color: rgb(0.5, 0.5, 0.5),
        });
        yPosition -= 12;
      }
    }

    if (attachment.linked_action_id) {
      const linkedAction = actions.find((a) => a.id === attachment.linked_action_id);
      if (linkedAction) {
        const actionRef = linkedAction.reference_number || 'Action';
        page.drawText(`Linked to: ${sanitizePdfText(actionRef)}`, {
          x: MARGIN + 10,
          y: yPosition,
          size: 8,
          font,
          color: rgb(0.5, 0.5, 0.5),
        });
        yPosition -= 12;
      }
    }

    yPosition -= 8;

    page.drawLine({
      start: { x: MARGIN, y: yPosition },
      end: { x: PAGE_WIDTH - MARGIN, y: yPosition },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });

    yPosition -= 15;
  }

  return { page, yPosition };
}

function drawPurposeAndScope(
  page: PDFPage,
  jurisdiction: string,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  font: any,
  fontBold: any
): PDFPage {
  let yPosition = PAGE_TOP_Y;

  ({ page, yPosition } = ensurePageSpace(70, page, yPosition, pdfDoc, isDraft, totalPages));
  page.drawText('PURPOSE AND SCOPE', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  const purposeAndScopeText = normalizeNarrativeReportText(fsdPurposeAndScopeText(jurisdiction));
  const paragraphs = purposeAndScopeText.split('\n\n');
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;

    const lines = wrapText(paragraph, CONTENT_WIDTH, 11, font);
    for (const line of lines) {
      ({ page, yPosition } = ensurePageSpace(18, page, yPosition, pdfDoc, isDraft, totalPages));
      page.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 11,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      yPosition -= 16;
    }

    yPosition -= 8;
  }

  return page;
}

function drawFsdLimitations(
  page: PDFPage,
  jurisdiction: string,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  font: any,
  fontBold: any
): PDFPage {
  let yPosition = PAGE_TOP_Y;

  ({ page, yPosition } = ensurePageSpace(70, page, yPosition, pdfDoc, isDraft, totalPages));
  page.drawText('LIMITATIONS AND ASSUMPTIONS', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  const limitationsText = normalizeNarrativeReportText(fsdLimitationsText(jurisdiction));
  const paragraphs = limitationsText.split('\n\n');
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;

    const lines = wrapText(paragraph, CONTENT_WIDTH, 11, font);
    for (const line of lines) {
      ({ page, yPosition } = ensurePageSpace(18, page, yPosition, pdfDoc, isDraft, totalPages));
      page.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 11,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      yPosition -= 16;
    }

    yPosition -= 8;
  }

  return page;
}
function normalizeNarrativeReportText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'function') {
    return normalizeNarrativeReportText(value());
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeNarrativeReportText(entry))
      .filter((entry) => entry.trim().length > 0)
      .join('\n\n');
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if (typeof record.text === 'string') {
      return record.text;
    }

    if (typeof record.content === 'string') {
      return record.content;
    }

    if (Array.isArray(record.paragraphs)) {
      return normalizeNarrativeReportText(record.paragraphs);
    }

    if (Array.isArray(record.content)) {
      return normalizeNarrativeReportText(record.content);
    }
  }

  return '';
}

function drawDocumentScope(
  page: PDFPage,
  scopeText: string,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  font: any,
  fontBold: any
): PDFPage {
  let yPosition = PAGE_TOP_Y;

  ({ page, yPosition } = ensurePageSpace(70, page, yPosition, pdfDoc, isDraft, totalPages));
  page.drawText('SCOPE', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  const sanitized = sanitizePdfText(scopeText);
  const lines = wrapText(sanitized, CONTENT_WIDTH, 11, font);

  for (const line of lines) {
    if (yPosition < MARGIN + 50) {
      ({ page } = addNewPage(pdfDoc, isDraft, totalPages));
      yPosition = PAGE_TOP_Y;
    }
    page.drawText(line, {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 16;
  }

  return page;
}

function drawDocumentLimitations(
  page: PDFPage,
  limitationsText: string,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  font: any,
  fontBold: any
): PDFPage {
  let yPosition = PAGE_TOP_Y;

  if (totalPages[totalPages.length - 1] === page) {
    yPosition = PAGE_HEIGHT - MARGIN - 60;
  }

  ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));
  page.drawText('PROJECT-SPECIFIC LIMITATIONS', {
    x: MARGIN,
    y: yPosition,
    size: 14,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 25;

  const sanitized = sanitizePdfText(limitationsText);
  const lines = wrapText(sanitized, CONTENT_WIDTH, 11, font);

  for (const line of lines) {
    if (yPosition < MARGIN + 50) {
      ({ page } = addNewPage(pdfDoc, isDraft, totalPages));
      yPosition = PAGE_TOP_Y;
    }
    page.drawText(line, {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 16;
  }

  return page;
}

function drawComputedAssuranceSummary(
  page: PDFPage,
  summary: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  font: any,
  fontBold: any
): PDFPage {
  let yPosition = PAGE_TOP_Y;
  const safeString = (value: unknown, fallback = ''): string => {
    if (typeof value === 'string') {
      const normalized = value.trim();
      return normalized.length > 0 ? normalized : fallback;
    }
    return fallback;
  };

  const mappedLevel = summary?.computedOutcome === 'compliant' ? 'high' :
                      summary?.computedOutcome === 'minor_def' || summary?.computedOutcome === 'info_gap' ? 'medium' :
                      summary?.computedOutcome === 'material_def' ? 'low' :
                      undefined;

  const overallLevel = safeString(summary?.overallLevel, mappedLevel || 'Unknown').toLowerCase();
  const overallLevelLabel = safeString(overallLevel, 'unknown').toUpperCase();
  const levelReason = safeString(summary?.levelReason);
  const deviations = Array.isArray(summary?.deviations) ? summary.deviations : [];
  const infoGaps = Array.isArray(summary?.infoGaps) ? summary.infoGaps : [];

  page.drawText('COMPUTED ASSURANCE SUMMARY', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  page.drawText('Overall Assurance Level:', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 20;

  const levelColor = overallLevel === 'high' ? rgb(0, 0.6, 0) :
                     overallLevel === 'medium' ? rgb(0.8, 0.6, 0) :
    rgb(0.8, 0, 0);

  page.drawText(overallLevelLabel, {
    x: MARGIN + 10,
    y: yPosition,
    size: 14,
    font: fontBold,
    color: levelColor,
  });

  yPosition -= 30;

  if (levelReason) {
    page.drawText('Reason:', {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 18;

    const reasonLines = wrapText(levelReason, CONTENT_WIDTH - 10, 10, font);
    for (const line of reasonLines) {
      if (yPosition < MARGIN + 50) {
        ({ page } = addNewPage(pdfDoc, isDraft, totalPages));
        yPosition = PAGE_TOP_Y;
      }
      page.drawText(line, {
        x: MARGIN + 10,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }
  }

  yPosition -= 20;

  if (deviations.length > 0) {
    page.drawText('Deviations from Standards:', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 22;

    const displayDeviations = deviations.slice(0, 3);
    for (let i = 0; i < displayDeviations.length; i++) {
      const deviation = displayDeviations[i];

      if (yPosition < MARGIN + 80) {
        ({ page } = addNewPage(pdfDoc, isDraft, totalPages));
        yPosition = PAGE_TOP_Y;
      }

      const deviationText = safeString(deviation?.deviation, 'Not Assessed');
      const truncatedDeviation = deviationText.length > 80
        ? deviationText.substring(0, 77) + '...'
        : deviationText;

      const qualityIndicator = deviation?.score < 4 ? ' [Incomplete justification]' : '';
      page.drawText(`${i + 1}. ${safeString(deviation?.topic, 'Unspecified')}: ${sanitizePdfText(truncatedDeviation)}${qualityIndicator}`, {
        x: MARGIN + 10,
        y: yPosition,
        size: 10,
        font,
        color: deviation?.score < 4 ? PDF_THEME.colours.risk.high.fg : PDF_THEME.colours.text.primary,
      });

      yPosition -= 20;
    }

    if (deviations.length > 3) {
      page.drawText(`... and ${deviations.length - 3} more. See Deviation Register for full details.`, {
        x: MARGIN + 10,
        y: yPosition,
        size: 9,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
      yPosition -= 18;
    }
  }

  yPosition -= 10;

  if (infoGaps.length > 0) {
    ({ page, yPosition } = ensurePageSpace(110, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText('Information Gaps:', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 22;

    const displayGaps = infoGaps.slice(0, 5);
    for (const gap of displayGaps) {
      if (yPosition < MARGIN + 60) {
        ({ page } = addNewPage(pdfDoc, isDraft, totalPages));
        yPosition = PAGE_TOP_Y;
      }

      const gapTitle = safeString(gap?.title, 'Unknown');
      const gapText = safeString(gap?.note)
        ? `${gapTitle}: ${sanitizePdfText(safeString(gap.note))}`
        : gapTitle;

      const truncatedGap = gapText.length > 90
        ? gapText.substring(0, 87) + '...'
        : gapText;

      page.drawText(`• ${truncatedGap}`, {
        x: MARGIN + 10,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });

      yPosition -= 18;
    }

    if (infoGaps.length > 5) {
      page.drawText(`... and ${infoGaps.length - 5} more information gaps.`, {
        x: MARGIN + 10,
        y: yPosition,
        size: 9,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
      yPosition -= 18;
    }
  }

  return page;
}

function drawDeviationRegister(
  page: PDFPage,
  deviations: any[],
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  font: any,
  fontBold: any
): PDFPage {
  let yPosition = PAGE_TOP_Y;

  page.drawText('DEVIATION REGISTER', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  page.drawText('The following deviations from regulatory standards have been identified:', {
    x: MARGIN,
    y: yPosition,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  yPosition -= 25;

  for (let i = 0; i < deviations.length; i++) {
    const deviation = deviations[i];

    if (yPosition < MARGIN + 200) {
      ({ page } = addNewPage(pdfDoc, isDraft, totalPages));
      yPosition = PAGE_TOP_Y;
    }

    yPosition -= 15;

    page.drawText(`Deviation ${i + 1}`, {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 20;

    page.drawText('Topic:', {
      x: MARGIN + 10,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    yPosition -= 15;
    const topicText = sanitizePdfText(deviation.topic || 'Not specified');
    const topicLines = wrapText(topicText, CONTENT_WIDTH - 20, 10, font);
    for (const line of topicLines) {
      ({ page, yPosition } = ensurePageSpace(18, page, yPosition, pdfDoc, isDraft, totalPages));
      page.drawText(line, {
        x: MARGIN + 20,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      yPosition -= 14;
    }

    yPosition -= 5;
    page.drawText('Deviation:', {
      x: MARGIN + 10,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    yPosition -= 15;
    const deviationText = sanitizePdfText(deviation.deviation || 'Not specified');
    const deviationLines = wrapText(deviationText, CONTENT_WIDTH - 20, 10, font);
    for (const line of deviationLines) {
      ({ page, yPosition } = ensurePageSpace(18, page, yPosition, pdfDoc, isDraft, totalPages));
      page.drawText(line, {
        x: MARGIN + 20,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      yPosition -= 14;
    }

    yPosition -= 5;
    page.drawText('Justification:', {
      x: MARGIN + 10,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    yPosition -= 15;
    if (deviation.justification && deviation.justification.trim().length > 0) {
      const justificationText = sanitizePdfText(deviation.justification);
      const justificationLines = wrapText(justificationText, CONTENT_WIDTH - 20, 10, font);
      for (const line of justificationLines) {
        if (yPosition < MARGIN + 50) {
          ({ page } = addNewPage(pdfDoc, isDraft, totalPages));
          yPosition = PAGE_TOP_Y;
        }
        page.drawText(line, {
          x: MARGIN + 20,
          y: yPosition,
          size: 10,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
        yPosition -= 14;
      }
    } else {
      page.drawText('No justification provided', {
        x: MARGIN + 20,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.6, 0, 0),
      });
      yPosition -= 14;
    }

    yPosition -= 15;

    page.drawLine({
      start: { x: MARGIN, y: yPosition },
      end: { x: PAGE_WIDTH - MARGIN, y: yPosition },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });

    yPosition -= 10;
  }

  return page;
}

function drawAssuranceChecks(
  page: PDFPage,
  flags: any[],
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  font: any,
  fontBold: any
): PDFPage {
  let yPosition = PAGE_TOP_Y;

  page.drawText('ASSURANCE CHECKS', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  page.drawText('The following quality assurance checks have been flagged:', {
    x: MARGIN,
    y: yPosition,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  yPosition -= 25;

  for (const flag of flags) {
    if (yPosition < MARGIN + 120) {
      ({ page } = addNewPage(pdfDoc, isDraft, totalPages));
      yPosition = PAGE_TOP_Y;
    }

    const severityColor = flag.severity === 'critical' ? rgb(0.8, 0, 0) :
                          flag.severity === 'high' ? rgb(0.9, 0.4, 0) :
                          flag.severity === 'medium' ? rgb(0.8, 0.6, 0) :
                          rgb(0.5, 0.5, 0.5);

    page.drawRectangle({
      x: MARGIN,
      y: yPosition - 3,
      width: 50,
      height: 14,
      color: severityColor,
    });

    page.drawText(flag.severity.toUpperCase(), {
      x: MARGIN + 5,
      y: yPosition,
      size: 8,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawText(flag.id, {
      x: MARGIN + 60,
      y: yPosition,
      size: 9,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });

    yPosition -= 18;

    page.drawText('Detail:', {
      x: MARGIN + 10,
      y: yPosition,
      size: 9,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    });

    yPosition -= 14;

    const detailText = sanitizePdfText(flag.detail);
    const detailLines = wrapText(detailText, CONTENT_WIDTH - 30, 9, font);
    for (const line of detailLines) {
      ({ page, yPosition } = ensurePageSpace(18, page, yPosition, pdfDoc, isDraft, totalPages));
      page.drawText(line, {
        x: MARGIN + 20,
        y: yPosition,
        size: 9,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      yPosition -= 13;
    }

    yPosition -= 10;
  }

  return page;
}
