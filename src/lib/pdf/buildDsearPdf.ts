import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import { getModuleName } from '../modules/moduleCatalog';
import { detectInfoGaps } from '../../utils/infoGapQuickActions';
import { listAttachments, type Attachment } from '../supabase/attachments';
import {
  explosiveAtmospheresPurposeText,
  hazardousAreaClassificationText,
  zoneDefinitionsText,
  getExplosiveAtmospheresReferences,
  type Jurisdiction,
} from '../reportText';
import { getAssessmentDisplayName } from '../../utils/displayNames';
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN,
  CONTENT_WIDTH,
  PAGE_TOP_Y,
  sanitizePdfText,
  wrapText,
  formatDate,
  getOutcomeColor,
  getOutcomeLabel,
  getPriorityColor,
  drawDraftWatermark,
  addNewPage,
  drawFooter,
  addExecutiveSummaryPages,
  addSupersededWatermark,
  ensurePageSpace,
  getReportFooterTitle,
  splitNarrativeParagraphs,
  drawNarrativeParagraphs,
  parseNarrativeBlocks,
  REPORT_TITLE_TO_BODY_GAP,
} from './pdfUtils';
import { addIssuedReportPages } from './issuedPdfPages';
import {
  drawSectionHeaderBar,
  drawPageTitle,
  drawContentsRow,
  drawWrappedSubsectionHeading,
  getReportLayoutSpacing,
} from './pdfPrimitives';
import { computeExplosionSummary } from '../dsear/criticalityEngine';
import { compareActionsByDisplayReference, filterActiveActions } from './actionContracts';

const DSEAR_PDF_DEBUG = true;
void DSEAR_PDF_DEBUG;

const REPORT_LAYOUT_SPACING = getReportLayoutSpacing();

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
  jurisdiction: string;
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
  reference_number?: string | null;
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

interface BuildPdfOptions {
  document: Document;
  moduleInstances: ModuleInstance[];
  actions: Action[];
  actionRatings: ActionRating[];
  organisation: Organisation;
  renderMode?: 'preview' | 'issued';
}

const MODULE_ORDER = [
  'A1_DOC_CONTROL',
  'A2_BUILDING_PROFILE',
  'A3_PERSONS_AT_RISK',
  'DSEAR_1_DANGEROUS_SUBSTANCES',
  'DSEAR_2_PROCESS_RELEASES',
  'DSEAR_3_HAZARDOUS_AREA_CLASSIFICATION',
  'DSEAR_4_IGNITION_SOURCES',
  'DSEAR_5_EXPLOSION_PROTECTION',
  'DSEAR_6_RISK_ASSESSMENT',
  'DSEAR_10_HIERARCHY_OF_CONTROL',
  'DSEAR_11_EXPLOSION_EMERGENCY_RESPONSE',
];

/**
 * Strip "DSEAR-<n> - " prefix from module display names for PDF output
 */
function stripDsearPrefix(moduleName: string): string {
  // Remove patterns like "DSEAR-1 - ", "DSEAR-10 - ", etc.
  return moduleName.replace(/^DSEAR-\d+\s*-\s*/, '');
}

/**
 * Get section number for a module based on its position in MODULE_ORDER
 * Canned sections get numbers 1-6, modules start at 7
 */
function getModuleSectionNumber(moduleKey: string, sortedModules: ModuleInstance[]): number {
  // Find the module's position in the sorted list
  const moduleIndex = sortedModules.findIndex(m => m.module_key === moduleKey);
  if (moduleIndex === -1) return 0;

  // Canned sections: 1-6
  // Modules start at section 7
  return 7 + moduleIndex;
}

/**
 * Draw Table of Contents for DSEAR PDF with actual page numbers
 */
function drawTableOfContents(
  pdfDoc: PDFDocument,
  totalPages: PDFPage[],
  tocPage: PDFPage,
  tocEntries: Array<{ title: string; pageNo: number }>,
  font: any,
  fontBold: any
): void {
  const tocStartY = PAGE_TOP_Y - 40;
  const contentStartY = tocStartY - 12;
  const minY = MARGIN + 50;
  const rowHeight = 16;

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
  let yPosition = tocStartY;

  // Title
  yPosition = drawPageTitle(activeTocPage, MARGIN, yPosition, 'Contents', { regular: font, bold: fontBold });
  yPosition -= 12;

  // Render TOC entries with page numbers
  for (const entry of tocEntries) {
    if (yPosition < minY) {
      currentTocPageIndex += 1;
      activeTocPage = allTocPages[currentTocPageIndex];
      yPosition = drawPageTitle(activeTocPage, MARGIN, tocStartY, 'Contents', { regular: font, bold: fontBold });
      yPosition -= 12;
    }

    // Draw section title (left-aligned)
    const sanitizedTitle = sanitizePdfText(entry.title);
    activeTocPage.drawText(sanitizedTitle, {
      x: MARGIN + 20,
      y: yPosition,
      size: 11,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Draw page number (right-aligned)
    const pageNumText = (entry.pageNo + extraTocPages).toString();
    const pageNumWidth = font.widthOfTextAtSize(pageNumText, 11);
    activeTocPage.drawText(pageNumText, {
      x: PAGE_WIDTH - MARGIN - pageNumWidth,
      y: yPosition,
      size: 11,
      font: font,
      color: rgb(0, 0, 0),
    });

    yPosition -= 16;
  }
}

export async function buildDsearPdf(options: BuildPdfOptions): Promise<Uint8Array> {
  const { document, moduleInstances, actions, actionRatings, organisation, renderMode } = options;

  let attachments: Attachment[] = [];
  try {
    attachments = await listAttachments(document.id);
    } catch (error) {
    console.warn('[DSEAR PDF] Failed to fetch attachments:', error);
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const isIssuedMode = renderMode === 'issued';
  const isDraft = !isIssuedMode;
  const totalPages: PDFPage[] = [];

    // Use addIssuedReportPages for both draft and issued modes to ensure logo embedding
  const { coverPage, docControlPage } = await addIssuedReportPages({
    pdfDoc,
    document: {
      id: document.id,
      title: document.title,
      document_type: 'DSEAR',
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

  let page: PDFPage;
  let yPosition: number;

  // DSEAR technical sections must only include DSEAR_* modules.
  // A1 document control is rendered separately via addIssuedReportPages (docControlPage).
  const filteredModules = moduleInstances.filter(m => m.module_key.startsWith('DSEAR_'));

  // Sort modules once for consistency across Contents and module sections
  const sortedModules = sortModules(filteredModules);

  // Reserve TOC page (will be populated after all sections are rendered)
  const tocResult = addNewPage(pdfDoc, isDraft, totalPages);
  const tocPage = tocResult.page;

  // TOC tracking array
  const tocEntries: Array<{ title: string; pageNo: number }> = [];
  const recordToc = (title: string) => tocEntries.push({ title, pageNo: totalPages.length });

  // SECTION 2: Executive Summary (AI/Author/Both/None)
  addExecutiveSummaryPages(
    pdfDoc,
    isDraft,
    totalPages,
    (document.executive_summary_mode as 'ai' | 'author' | 'both' | 'none') || 'none',
    document.executive_summary_ai,
    document.executive_summary_author,
    { bold: fontBold, regular: font }
  );

  // SECTION 1: Computed Explosion Criticality Summary
  const explosionSummary = computeExplosionSummary({ modules: moduleInstances });
  const critResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = critResult.page;
  recordToc('1. Explosion Criticality Assessment');
  yPosition = PAGE_TOP_Y;
  ({ page, yPosition } = drawExplosionCriticalitySummary(page, explosionSummary, 1, font, fontBold, yPosition, pdfDoc, isDraft, totalPages));

  // SECTION 2: Purpose and Introduction (Neutral)
  const purposeResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = purposeResult.page;
  recordToc('2. Purpose and Introduction');
  yPosition = PAGE_TOP_Y;
  ({ page, yPosition } = drawPurposeAndIntroduction(page, 2, font, fontBold, yPosition, pdfDoc, isDraft, totalPages));

  // SECTION 3: Hazardous Area Classification Methodology (Canned Text)
  const hacResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = hacResult.page;
  recordToc('3. Hazardous Area Classification Methodology');
  yPosition = PAGE_TOP_Y;
  ({ page, yPosition } = drawHazardousAreaClassification(page, 3, font, fontBold, yPosition, pdfDoc, isDraft, totalPages));

  // SECTION 4: Zone Definitions (Canned Text)
  const zoneResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = zoneResult.page;
  recordToc('4. Zone Definitions');
  yPosition = PAGE_TOP_Y;
  ({ page, yPosition } = drawZoneDefinitions(page, 4, font, fontBold, yPosition, pdfDoc, isDraft, totalPages));

  // Dynamic section numbering for Scope and Limitations
  let nextSectionNumber = 5;

  // SECTION 5 (or skipped): Scope
  if (document.scope_description) {
    const scopeResult = addNewPage(pdfDoc, isDraft, totalPages);
    page = scopeResult.page;
    recordToc(`${nextSectionNumber}. Scope`);
    yPosition = PAGE_TOP_Y;
    ({ page, yPosition } = drawScope(page, document.scope_description, nextSectionNumber++, font, fontBold, yPosition, pdfDoc, isDraft, totalPages));
  }

  // SECTION 6 (or 5/skipped): Limitations and Assumptions
  if (document.limitations_assumptions) {
    const limResult = addNewPage(pdfDoc, isDraft, totalPages);
    page = limResult.page;
    recordToc(`${nextSectionNumber}. Limitations and Assumptions`);
    yPosition = PAGE_TOP_Y;
    ({ page, yPosition } = drawLimitations(page, document.limitations_assumptions, nextSectionNumber++, font, fontBold, yPosition, pdfDoc, isDraft, totalPages));
  }

  // SECTION 8+: Module Sections
  const MODULE_HEADER_KEEP = 56;
  const MIN_MODULE_BODY = 56;

  for (let i = 0; i < sortedModules.length; i++) {
    const module = sortedModules[i];
    const sectionNumber = nextSectionNumber + i;
    const moduleName = getModuleName(module.module_key);
    const displayName = stripDsearPrefix(moduleName);

    // Conditional page: ensure header + minimal body fit, only create new page if needed
    ({ page, yPosition } = ensurePageSpace(MODULE_HEADER_KEEP + MIN_MODULE_BODY, page, yPosition, pdfDoc, isDraft, totalPages));

    // Record TOC entry BEFORE drawing section (ensures correct page number)
    recordToc(`${sectionNumber}. ${displayName}`);

    ({ page, yPosition } = drawModuleSection(page, module, document, sectionNumber, font, fontBold, yPosition, pdfDoc, isDraft, totalPages, sortedModules));
  }

  // Update section number after all modules
  nextSectionNumber += sortedModules.length;

  // References and Compliance (Jurisdiction-specific)
  const refResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = refResult.page;
  recordToc(`${nextSectionNumber}. References and Compliance`);
  yPosition = PAGE_TOP_Y;
  ({ page, yPosition } = drawReferencesAndCompliance(page, document.jurisdiction as Jurisdiction, nextSectionNumber++, font, fontBold, yPosition, pdfDoc, isDraft, totalPages));

  // Compliance-Critical Findings (if present)
  if (explosionSummary.flags.length > 0) {
    const ccfResult = addNewPage(pdfDoc, isDraft, totalPages);
    page = ccfResult.page;
    recordToc(`${nextSectionNumber}. Compliance-Critical Findings`);
    yPosition = PAGE_TOP_Y;
    ({ page, yPosition } = drawComplianceCriticalFindings(page, explosionSummary.flags, font, fontBold, yPosition, pdfDoc, isDraft, totalPages, nextSectionNumber++));
  }

  // Action Register
  const result2 = addNewPage(pdfDoc, isDraft, totalPages);
  page = result2.page;
  recordToc(`${nextSectionNumber}. Action Register`);
  yPosition = PAGE_TOP_Y;
  ({ page, yPosition } = drawActionRegister(page, actions, actionRatings, nextSectionNumber++, font, fontBold, yPosition, pdfDoc, isDraft, totalPages));

  // Attachments Index (if present)
  if (attachments.length > 0) {
    const result2b = addNewPage(pdfDoc, isDraft, totalPages);
    page = result2b.page;
    recordToc(`${nextSectionNumber}. Attachments Index`);
    yPosition = PAGE_TOP_Y;
    ({ page, yPosition } = drawAttachmentsIndex(page, attachments, sortedModules, actions, nextSectionNumber++, font, fontBold, yPosition, pdfDoc, isDraft, totalPages));
  }

  // Now render the TOC with collected entries
  drawTableOfContents(pdfDoc, totalPages, tocPage, tocEntries, font, fontBold);

  // Add footers to all pages
  const footerReportTitle = getReportFooterTitle('DSEAR', document.title);
  totalPages.forEach((p, idx) => {
    drawFooter(p, footerReportTitle, idx + 1, totalPages.length, font);
  });

  if (document.issue_status === 'superseded') {
    await addSupersededWatermark(pdfDoc);
  }

  return await pdfDoc.save();
}

function sortModules(modules: ModuleInstance[]): ModuleInstance[] {
  return [...modules].sort((a, b) => {
    const orderA = MODULE_ORDER.indexOf(a.module_key);
    const orderB = MODULE_ORDER.indexOf(b.module_key);
    if (orderA === -1 && orderB === -1) return 0;
    if (orderA === -1) return 1;
    if (orderB === -1) return -1;
    return orderA - orderB;
  });
}

function drawCoverPage(
  page: PDFPage,
  document: Document,
  organisation: Organisation,
  font: any,
  fontBold: any,
  yPosition: number,
  renderMode?: 'preview' | 'issued'
): number {
  const centerX = PAGE_WIDTH / 2;
  const reportTitle = getAssessmentDisplayName('DSEAR', document.jurisdiction);

  page.drawText(sanitizePdfText(reportTitle), {
    x: centerX - fontBold.widthOfTextAtSize(sanitizePdfText(reportTitle), 24) / 2,
    y: yPosition,
    size: 24,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 40;

  page.drawText(sanitizePdfText(document.title || 'Untitled Assessment'), {
    x: centerX - font.widthOfTextAtSize(sanitizePdfText(document.title || 'Untitled Assessment'), 16) / 2,
    y: yPosition,
    size: 16,
    font: font,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 60;

  const a2Module = [];
  // Use renderMode to override status if provided
  let issueStatus = renderMode === 'issued' ? 'issued' : ((document as any).issue_status || document.status);

  const metadata = [
    ['Organisation', organisation.name],
    ['Assessment Date', formatDate(document.assessment_date)],
    ['Version', `v${document.version}`],
    ['Status', issueStatus.toUpperCase()],
    ['Assessor', document.assessor_name || '-'],
    ['Role', document.assessor_role || '-'],
    ['Responsible Person', document.responsible_person || '-'],
  ];

  metadata.forEach(([label, value]) => {
    page.drawText(sanitizePdfText(`${label}:`), {
      x: MARGIN + 20,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    page.drawText(sanitizePdfText(value), {
      x: MARGIN + 180,
      y: yPosition,
      size: 11,
      font: font,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 20;
  });

  return yPosition;
}

function drawExecutiveSummary(
  page: PDFPage,
  moduleInstances: ModuleInstance[],
  actions: Action[],
  actionRatings: ActionRating[],
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  page.drawText(sanitizePdfText('Executive Summary'), {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 30;

  // Substances summary
  const dsear1 = moduleInstances.find(m => m.module_key === 'DSEAR_1_DANGEROUS_SUBSTANCES');
  const substancesCount = dsear1?.data?.substances?.length || 0;
  const substanceTypes = new Set(dsear1?.data?.substances?.map((s: any) => s.physical_state).filter(Boolean) || []);

  page.drawText(sanitizePdfText('Dangerous Substances:'), {
    x: MARGIN,
    y: yPosition,
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;
  page.drawText(sanitizePdfText(`${substancesCount} substances identified (${Array.from(substanceTypes).join(', ') || 'none'})`), {
    x: MARGIN + 20,
    y: yPosition,
    size: 10,
    font: font,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 25;

  // Hazardous areas summary
  const dsear3 = moduleInstances.find(m => m.module_key === 'DSEAR_3_HAZARDOUS_AREA_CLASSIFICATION');
  const zones = dsear3?.data?.zones || [];
  const gasZones = zones.filter((z: any) => ['0', '1', '2'].includes(z.zone_type)).length;
  const dustZones = zones.filter((z: any) => ['20', '21', '22'].includes(z.zone_type)).length;

  page.drawText(sanitizePdfText('Hazardous Areas Classified:'), {
    x: MARGIN,
    y: yPosition,
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;
  page.drawText(sanitizePdfText(`Gas zones: ${gasZones}, Dust zones: ${dustZones}`), {
    x: MARGIN + 20,
    y: yPosition,
    size: 10,
    font: font,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 25;

  const activeActions = filterActiveActions(actions);

  // Priority actions summary (active actions only)
  const p1Count = activeActions.filter(a => a.priority_band === 'P1').length;
  const p2Count = activeActions.filter(a => a.priority_band === 'P2').length;
  const p34Count = activeActions.filter(a => ['P3', 'P4'].includes(a.priority_band)).length;

  page.drawText(sanitizePdfText('Priority Actions:'), {
    x: MARGIN,
    y: yPosition,
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;
  page.drawText(sanitizePdfText(`P1: ${p1Count}, P2: ${p2Count}, P3/P4: ${p34Count}`), {
    x: MARGIN + 20,
    y: yPosition,
    size: 10,
    font: font,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 25;

  // Top critical/high findings
  if (p1Count > 0 || p2Count > 0) {
    ({ page, yPosition } = ensurePageSpace(40, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText(sanitizePdfText('Compliance-Critical Findings Identified:'), {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0.7, 0, 0),
    });
    yPosition -= 18;

    const criticalActions = activeActions
      .filter(a => a.priority_band === 'P1' || a.priority_band === 'P2')
      .filter(a => a.trigger_text && a.trigger_text !== 'Priority derived from previous assessment model.')
      .slice(0, 3);

    if (criticalActions.length > 0) {
      for (const action of criticalActions) {
        ({ page, yPosition } = ensurePageSpace(40, page, yPosition, pdfDoc, isDraft, totalPages));

        const truncatedText = action.trigger_text!.length > 120
          ? action.trigger_text!.substring(0, 117) + '...'
          : action.trigger_text!;

        const wrapped = wrapText(`${criticalActions.indexOf(action) + 1}. ${truncatedText}`, CONTENT_WIDTH - 20, 9, font);
        for (const line of wrapped.slice(0, 2)) {
          ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

          page.drawText(sanitizePdfText(line), {
            x: MARGIN + 20,
            y: yPosition,
            size: 9,
            font: font,
            color: rgb(0.3, 0.3, 0.3),
          });
          yPosition -= 12;
        }
        yPosition -= 3;
      }

      yPosition -= 12;
    }
  }

  // Risk profile statement (NO OVERALL RATING)
  ({ page, yPosition } = ensurePageSpace(40, page, yPosition, pdfDoc, isDraft, totalPages));

  page.drawText(sanitizePdfText('Explosion Risk Profile:'), {
    x: MARGIN,
    y: yPosition,
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;
  const riskStatement = 'The explosion risk profile is driven by the presence of classified hazardous areas and the adequacy of controls identified. Refer to action register for priority improvements.';
  const wrappedRisk = wrapText(riskStatement, CONTENT_WIDTH - 20, 10, font);
  for (const line of wrappedRisk) {
    ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText(sanitizePdfText(line), {
      x: MARGIN + 20,
      y: yPosition,
      size: 10,
      font: font,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 14;
  }

  return { page, yPosition };
}

function drawModuleSection(
  page: PDFPage,
  module: ModuleInstance,
  document: Document,
  sectionNumber: number,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  sortedModules: ModuleInstance[]
): { page: PDFPage; yPosition: number } {
  const moduleName = getModuleName(module.module_key);
  const displayName = stripDsearPrefix(moduleName);

  // Ensure space for section header bar (requires ~60px)
  ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));

  yPosition = drawSectionHeaderBar({
    page,
    x: MARGIN,
    y: yPosition,
    w: CONTENT_WIDTH,
    sectionNo: String(sectionNumber),
    title: sanitizePdfText(displayName),
    product: 'dsear',
    fonts: { regular: font, bold: fontBold },
  });

  // Draw module-specific content
  ({ page, yPosition } = drawModuleContent(page, module, font, fontBold, yPosition, pdfDoc, isDraft, totalPages));

  // Draw assessor notes
  if (module.assessor_notes) {
    // Ensure space for "Assessor Notes:" label (requires ~25px)
    ({ page, yPosition } = ensurePageSpace(25, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText(sanitizePdfText('Assessor Notes:'), {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 15;

    const wrappedNotes = wrapText(module.assessor_notes, CONTENT_WIDTH, 9, font);
    for (const line of wrappedNotes) {
      // Ensure space for each note line (requires ~14px)
      ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

      page.drawText(sanitizePdfText(line), {
        x: MARGIN,
        y: yPosition,
        size: 9,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 12;
    }
  }

  // Draw info gap quick actions if detected
  ({ page, yPosition } = drawInfoGapQuickActions(page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages));

  return { page, yPosition };
}

function drawModuleContent(
  page: PDFPage,
  module: ModuleInstance,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  const data = module.data || {};

  switch (module.module_key) {
    case 'DSEAR_1_DANGEROUS_SUBSTANCES':
      return drawSubstancesTable(page, data.substances || [], font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

    case 'DSEAR_3_HAZARDOUS_AREA_CLASSIFICATION':
      return drawZonesTable(page, data.zones || [], data.drawings_reference, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

    case 'DSEAR_6_RISK_ASSESSMENT':
      return drawRiskAssessmentTable(page, data.risk_rows || [], font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

    default:
      // Generic data rendering
      return drawGenericModuleData(page, data, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }
}

function drawSubstancesTable(
  page: PDFPage,
  substances: any[],
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  if (!substances || substances.length === 0) {
    page.drawText(sanitizePdfText('No substances recorded'), {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
    return { page, yPosition: yPosition - 20 };
  }

  for (let idx = 0; idx < substances.length; idx++) {
    const substance = substances[idx];
    ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText(sanitizePdfText(`${idx + 1}. ${substance.name || 'Unnamed'}`), {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 15;

    const details = [
      `State: ${substance.physical_state || '-'}`,
      `Quantity: ${substance.quantity || '-'}`,
      `Location: ${substance.storage_location || '-'}`,
      `Flash Point: ${substance.flash_point || 'unknown'}`,
      `LFL/UFL: ${substance.LFL_UFL || 'unknown'}`,
    ];

    for (const detail of details) {
      ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

      page.drawText(sanitizePdfText(detail), {
        x: MARGIN + 20,
        y: yPosition,
        size: 9,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 12;
    }
    yPosition -= 5;
  }

  return { page, yPosition };
}

function drawZonesTable(
  page: PDFPage,
  zones: any[],
  drawingsRef: string,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  if (!zones || zones.length === 0) {
    page.drawText(sanitizePdfText('No zones classified'), {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
    yPosition -= 20;
  } else {
    for (const zone of zones) {
      ({ page, yPosition } = ensurePageSpace(24, page, yPosition, pdfDoc, isDraft, totalPages));

      page.drawText(sanitizePdfText(`Zone ${zone.zone_type || '?'}: ${zone.extent_description || 'No description'}`), {
        x: MARGIN,
        y: yPosition,
        size: 9,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      yPosition -= 14;
    }
  }

  if (drawingsRef) {
    ({ page, yPosition } = ensurePageSpace(24, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText(sanitizePdfText('Drawings Reference:'), {
      x: MARGIN,
      y: yPosition,
      size: 9,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 14;
    const wrapped = wrapText(drawingsRef, CONTENT_WIDTH - 20, 9, font);
    for (const line of wrapped) {
      ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

      page.drawText(sanitizePdfText(line), {
        x: MARGIN + 20,
        y: yPosition,
        size: 9,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 12;
    }
  }

  return { page, yPosition };
}

function drawRiskAssessmentTable(
  page: PDFPage,
  riskRows: any[],
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  if (!riskRows || riskRows.length === 0) {
    page.drawText(sanitizePdfText('No risk rows recorded'), {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
    return { page, yPosition: yPosition - 20 };
  }

  for (let idx = 0; idx < riskRows.length; idx++) {
    const row = riskRows[idx];
    ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText(sanitizePdfText(`${idx + 1}. ${row.activity || 'Activity not specified'}`), {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 14;

    page.drawText(sanitizePdfText(`Hazard: ${row.hazard || '-'}`), {
      x: MARGIN + 20,
      y: yPosition,
      size: 9,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });
    yPosition -= 12;

    page.drawText(sanitizePdfText(`Persons at Risk: ${row.persons_at_risk || '-'}`), {
      x: MARGIN + 20,
      y: yPosition,
      size: 9,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });
    yPosition -= 12;

    if (row.existing_controls) {
      const controlLines = wrapText(`Existing Controls: ${row.existing_controls}`, CONTENT_WIDTH - 20, 9, font);
      for (const line of controlLines.slice(0, 3)) {
        ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

        page.drawText(sanitizePdfText(line), {
          x: MARGIN + 20,
          y: yPosition,
          size: 9,
          font: font,
          color: rgb(0.3, 0.3, 0.3),
        });
        yPosition -= 12;
      }
    }

    const riskBand = row.residualRiskBand || row.residual_risk || '-';
    const bandColor = riskBand === 'Critical' ? rgb(0.7, 0, 0) :
                      riskBand === 'High' || riskBand === 'high' ? rgb(0.9, 0.5, 0) :
                      riskBand === 'Moderate' || riskBand === 'medium' ? rgb(0.9, 0.7, 0) :
                      rgb(0.3, 0.3, 0.3);

    page.drawText(sanitizePdfText(`Residual Risk: ${riskBand}`), {
      x: MARGIN + 20,
      y: yPosition,
      size: 9,
      font: fontBold,
      color: bandColor,
    });
    yPosition -= 12;

    if (row.rationale) {
      const rationaleLines = wrapText(`Rationale: ${row.rationale}`, CONTENT_WIDTH - 20, 9, font);
      for (const line of rationaleLines) {
        ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

        page.drawText(sanitizePdfText(line), {
          x: MARGIN + 20,
          y: yPosition,
          size: 8,
          font: font,
          color: rgb(0.4, 0.4, 0.4),
        });
        yPosition -= 11;
      }
    }

    yPosition -= 8;
  }

  return { page, yPosition };
}

function drawGenericModuleData(
  page: PDFPage,
  data: Record<string, any>,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  const keys = Object.keys(data).filter(k => k !== 'notes');

  if (keys.length === 0) {
    page.drawText(sanitizePdfText('No data recorded'), {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
    return { page, yPosition: yPosition - 20 };
  }

  for (const key of keys.slice(0, 5)) {
    ({ page, yPosition } = ensurePageSpace(40, page, yPosition, pdfDoc, isDraft, totalPages));

    const value = data[key];
    const displayValue = typeof value === 'object' ? JSON.stringify(value).substring(0, 100) : String(value);

    const wrapped = wrapText(`${key}: ${displayValue}`, CONTENT_WIDTH, 9, font);
    for (const line of wrapped.slice(0, 2)) {
      ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

      page.drawText(sanitizePdfText(line), {
        x: MARGIN,
        y: yPosition,
        size: 9,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 12;
    }
    yPosition -= 3;
  }

  return { page, yPosition };
}

function drawActionRegister(
  page: PDFPage,
  actions: Action[],
  actionRatings: ActionRating[],
  sectionNumber: number,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  // Ensure space for header
  ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));

  const sectionTitle = `${sectionNumber}. Action Register`;
  yPosition = drawPageTitle(page, MARGIN, yPosition, sectionTitle, { regular: font, bold: fontBold });
  yPosition -= 15;

  if (actions.length === 0) {
    page.drawText(sanitizePdfText('No actions recorded'), {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
    return { page, yPosition: yPosition - 20 };
  }

  const sortedActions = [...actions].sort(compareActionsByDisplayReference);

  for (const action of sortedActions) {
    // Ensure space for action card
    ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));

    const rating = actionRatings.find(r => r.action_id === action.id);
    const lxi = rating ? `L${rating.likelihood}xI${rating.impact}` : '-';

    const referencePrefix = action.reference_number ? `${action.reference_number} ` : '';
    page.drawText(sanitizePdfText(`[${action.priority_band}] ${referencePrefix}${action.recommended_action}`), {
      x: MARGIN,
      y: yPosition,
      size: 9,
      font: fontBold,
      color: getPriorityColor(action.priority_band),
    });
    yPosition -= 13;

    page.drawText(sanitizePdfText(`LxI: ${lxi} | Owner: ${action.owner_display_name || 'Unassigned'} | Target: ${formatDate(action.target_date)}`), {
      x: MARGIN + 20,
      y: yPosition,
      size: 8,
      font: font,
      color: rgb(0.4, 0.4, 0.4),
    });
    yPosition -= 13;

    if ((action.priority_band === 'P1' || action.priority_band === 'P2') && action.trigger_text) {
      const triggerLines = wrapText(
        `Reason: ${action.trigger_text}`,
        CONTENT_WIDTH - 20,
        8,
        font
      );

      for (const line of triggerLines.slice(0, 2)) {
        ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

        page.drawText(sanitizePdfText(line), {
          x: MARGIN + 20,
          y: yPosition,
          size: 8,
          font: font,
          color: rgb(0.5, 0.5, 0.5),
        });
        yPosition -= 11;
      }
    }

    yPosition -= 5;
  }

  return { page, yPosition };
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
  const detection = detectInfoGaps(
    module.module_key,
    module.data,
    module.outcome,
    {
      responsible_person: document.responsible_person || undefined,
      standards_selected: document.standards_selected || [],
      document_type: 'DSEAR',
      jurisdiction: document.jurisdiction
    },
    {
      documentType: 'DSEAR',
      jurisdiction: document.jurisdiction
    }
  );

  if (!detection.hasInfoGap) {
    return { page, yPosition };
  }

  // Ensure space for info gap header block
  ({ page, yPosition } = ensurePageSpace(200, page, yPosition, pdfDoc, isDraft, totalPages));

  yPosition -= REPORT_LAYOUT_SPACING.sectionHeaderToInfoGap;

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
      ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

      page.drawText(sanitizePdfText('•'), {
        x: MARGIN + 8,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });

      const reasonLines = wrapText(reason, CONTENT_WIDTH - 30, 9, font);
      for (const line of reasonLines) {
        ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

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
    ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText('Recommended actions:', {
      x: MARGIN + 8,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0.4, 0.4, 0.4),
    });

    yPosition -= 20;

    for (const quickAction of detection.quickActions) {
      ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));

      // Capture baseline Y for this action line
      const lineY = yPosition;

      // Priority badge
      const priorityColor = quickAction.priority === 'P2' ? rgb(0.9, 0.5, 0.13) : rgb(0.85, 0.65, 0.13);
      page.drawRectangle({
        x: MARGIN + 10,
        y: lineY - 3,
        width: 25,
        height: 14,
        color: priorityColor,
      });
      page.drawText(quickAction.priority, {
        x: MARGIN + 13,
        y: lineY,
        size: 8,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      // Action text - draw FIRST line aligned horizontally with badge
      const actionLines = wrapText(quickAction.action, CONTENT_WIDTH - 55, 10, font);
      if (actionLines.length > 0) {
        page.drawText(actionLines[0], {
          x: MARGIN + 42,
          y: lineY,
          size: 10,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });
      }

      // Move down after badge + first line
      yPosition = lineY - 14;

      // Draw remaining lines (if any) below the badge
      for (let i = 1; i < actionLines.length; i++) {
        ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

        page.drawText(actionLines[i], {
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
        ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

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
      ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

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
  return { page, yPosition };
}

function drawAttachmentsIndex(
  page: PDFPage,
  attachments: Attachment[],
  moduleInstances: ModuleInstance[],
  actions: Action[],
  sectionNumber: number,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));

  const sectionTitle = `${sectionNumber}. Attachments Index`;
  yPosition = drawPageTitle(page, MARGIN, yPosition, sectionTitle, { regular: font, bold: fontBold });

  yPosition -= 20;

  if (attachments.length === 0) {
    page.drawText('No attachments recorded.', {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    return { page, yPosition: yPosition - 20 };
  }

  for (let i = 0; i < attachments.length; i++) {
    const attachment = attachments[i];

    ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));

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
        ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

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

    const linkedTo: string[] = [];

    if (attachment.module_instance_id) {
      const module = moduleInstances.find((m) => m.id === attachment.module_instance_id);
      if (module) {
        linkedTo.push(`Module: ${getModuleName(module.module_key)}`);
      }
    }

    if (attachment.action_id) {
      const action = actions.find((a) => a.id === attachment.action_id);
      if (action) {
        linkedTo.push(`Action: [${action.priority_band}] ${action.recommended_action.substring(0, 40)}...`);
      }
    }

    if (linkedTo.length > 0) {
      page.drawText(`Linked to: ${sanitizePdfText(linkedTo.join(', '))}`, {
        x: MARGIN + 10,
        y: yPosition,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
      yPosition -= 12;
    }

    const uploadDate = formatDate(attachment.taken_at || attachment.created_at);
    const fileSize = attachment.file_size_bytes
      ? `${Math.round(attachment.file_size_bytes / 1024)} KB`
      : '';

    page.drawText(`Uploaded: ${uploadDate}${fileSize ? ` | Size: ${fileSize}` : ''}`, {
      x: MARGIN + 10,
      y: yPosition,
      size: 8,
      font,
      color: rgb(0.6, 0.6, 0.6),
    });

    yPosition -= 20;

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

function drawHazardousAreaClassification(
  page: PDFPage,
  sectionNumber: number,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  const sectionTitle = `${sectionNumber}. Hazardous Area Classification Methodology`;
  yPosition = drawPageTitle(page, MARGIN, yPosition, sectionTitle, { regular: font, bold: fontBold });

  yPosition -= REPORT_TITLE_TO_BODY_GAP;
    const paragraphs = splitNarrativeParagraphs(hazardousAreaClassificationText);
  ({ page, yPosition } = drawNarrativeParagraphs({
    page,
    yPosition,
    paragraphs,
    font,
    pdfDoc,
    isDraft,
    totalPages,
  }));

  return { page, yPosition };
}

function drawZoneDefinitions(
  page: PDFPage,
  sectionNumber: number,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  const sectionTitle = `${sectionNumber}. Zone Definitions`;
  yPosition = drawPageTitle(page, MARGIN, yPosition, sectionTitle, { regular: font, bold: fontBold });

  yPosition -= REPORT_TITLE_TO_BODY_GAP;

  const narrativeBlocks = parseNarrativeBlocks(zoneDefinitionsText);
  for (const block of narrativeBlocks) {
    if (block.kind === 'heading') {
      ({ page, yPosition } = ensurePageSpace(40, page, yPosition, pdfDoc, isDraft, totalPages));
      yPosition = drawWrappedSubsectionHeading(page, MARGIN, yPosition, block.text, { regular: font, bold: fontBold }, CONTENT_WIDTH);
      continue;
    }
({ page, yPosition } = ensurePageSpace(40, page, yPosition, pdfDoc, isDraft, totalPages));
    const lines = wrapText(block.text, CONTENT_WIDTH, 11, font);
    for (const line of lines) {
      ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));
      page.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 11,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      yPosition -= 16;
    }
     yPosition -= 10;
  }

  return { page, yPosition };
}

function drawScope(
  page: PDFPage,
  scopeText: string,
  sectionNumber: number,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  const sectionTitle = `${sectionNumber}. Scope`;
  yPosition = drawPageTitle(page, MARGIN, yPosition, sectionTitle, { regular: font, bold: fontBold });

  yPosition -= 20;

  const sanitized = sanitizePdfText(scopeText);
  const lines = wrapText(sanitized, CONTENT_WIDTH, 11, font);

  for (const line of lines) {
    ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText(line, {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 16;
  }

  return { page, yPosition };
}

function drawPurposeAndIntroduction(
  page: PDFPage,
  sectionNumber: number,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  const sectionTitle = `${sectionNumber}. Purpose and Introduction`;
  yPosition = drawPageTitle(page, MARGIN, yPosition, sectionTitle, { regular: font, bold: fontBold });

  yPosition -= 20;

  const sanitized = sanitizePdfText(explosiveAtmospheresPurposeText);
  const lines = wrapText(sanitized, CONTENT_WIDTH, 11, font);

  for (const line of lines) {
    ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));
    page.drawText(line, {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 16;
  }

  return { page, yPosition };
}

function drawLimitations(
  page: PDFPage,
  limitationsText: string,
  sectionNumber: number,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  const sectionTitle = `${sectionNumber}. Limitations and Assumptions`;
  yPosition = drawPageTitle(page, MARGIN, yPosition, sectionTitle, { regular: font, bold: fontBold });

  yPosition -= 20;

  const sanitized = sanitizePdfText(limitationsText);
  const lines = wrapText(sanitized, CONTENT_WIDTH, 11, font);

  for (const line of lines) {
    ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));
    page.drawText(line, {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 16;
  }

  return { page, yPosition };
}

function drawReferencesAndCompliance(
  page: PDFPage,
  jurisdiction: Jurisdiction,
  sectionNumber: number,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));

  const sectionTitle = `${sectionNumber}. References and Compliance`;
  yPosition = drawPageTitle(page, MARGIN, yPosition, sectionTitle, { regular: font, bold: fontBold });

  yPosition -= 28;

  const bulletX = MARGIN;
  const bulletTextX = MARGIN + 12;
  const bulletWrapWidth = CONTENT_WIDTH - (bulletTextX - MARGIN);

  const references = getExplosiveAtmospheresReferences(jurisdiction);

  for (const ref of references) {
    ({ page, yPosition } = ensurePageSpace(24, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText(sanitizePdfText('•'), {
      x: bulletX,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    
    const labelLines = wrapText(sanitizePdfText(ref.label), bulletWrapWidth, 11, fontBold);
    for (const line of labelLines) {
      ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));
      page.drawText(line, {
        x: bulletTextX,
        y: yPosition,
        size: 11,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      yPosition -= 14;
    }

    yPosition -= 16;

    if (ref.detail) {
      const detailLines = wrapText(sanitizePdfText(ref.detail), bulletWrapWidth, 10, font);
      for (const line of detailLines) {
        ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

        page.drawText(line, {
          x: bulletTextX,
          y: yPosition,
          size: 10,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
        yPosition -= 14;
      }
    }

    yPosition -= 8;
  }

  return { page, yPosition };
}

function drawExplosionCriticalitySummary(
  page: PDFPage,
  explosionSummary: ReturnType<typeof computeExplosionSummary>,
  sectionNumber: number,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));

  const sectionTitle = `${sectionNumber}. Explosion Criticality Assessment`;
  yPosition = drawPageTitle(page, MARGIN, yPosition, sectionTitle, { regular: font, bold: fontBold });

  yPosition -= 20;

  const criticalityColors: Record<string, ReturnType<typeof rgb>> = {
    Critical: rgb(0.8, 0, 0),
    High: rgb(0.9, 0.5, 0),
    Moderate: rgb(0.9, 0.7, 0),
    Low: rgb(0.2, 0.7, 0.2),
  };

  const criticalityStatements: Record<string, string> = {
    Critical: 'Compliance-critical deficiencies identified which require urgent attention.',
    High: 'Significant explosion safety issues identified which require prompt remediation.',
    Moderate: 'Areas of improvement identified; explosion risk controls should be strengthened.',
    Low: 'Explosion risk controls appear broadly appropriate within the scope assessed.',
  };

  const criticalityColor = criticalityColors[explosionSummary.overall] || rgb(0, 0, 0);
  const criticalityStatement = criticalityStatements[explosionSummary.overall] || '';

  page.drawRectangle({
    x: MARGIN,
    y: yPosition - 5,
    width: CONTENT_WIDTH,
    height: 30,
    color: criticalityColor,
  });

  page.drawText(`OVERALL CRITICALITY: ${explosionSummary.overall.toUpperCase()}`, {
    x: MARGIN + 10,
    y: yPosition + 5,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  yPosition -= 45;

  const statementLines = wrapText(criticalityStatement, CONTENT_WIDTH, 11, font);
  for (const line of statementLines) {
    ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText(line, {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 16;
  }

  yPosition -= 10;

  if (explosionSummary.flags.length > 0) {
    ({ page, yPosition } = ensurePageSpace(24, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText('Top Compliance Issues:', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 22;

    const levelColors: Record<string, ReturnType<typeof rgb>> = {
      critical: rgb(0.7, 0, 0),
      high: rgb(0.9, 0.5, 0),
      moderate: rgb(0, 0.5, 0.7),
    };

    const levelLabels: Record<string, string> = {
      critical: 'CRITICAL',
      high: 'HIGH',
      moderate: 'MODERATE',
    };

    const topFlags = explosionSummary.flags.slice(0, 3);
    for (const flag of topFlags) {
      ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));

      const levelLabel = levelLabels[flag.level] || flag.level.toUpperCase();
      const levelColor = levelColors[flag.level] || rgb(0, 0, 0);

      page.drawText(`[${levelLabel}] ${sanitizePdfText(flag.title)}`, {
        x: MARGIN + 10,
        y: yPosition,
        size: 10,
        font: fontBold,
        color: levelColor,
      });

      yPosition -= 16;

      const detailLines = wrapText(sanitizePdfText(flag.detail), CONTENT_WIDTH - 30, 9, font);
      for (const line of detailLines.slice(0, 2)) {
        ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

        page.drawText(line, {
          x: MARGIN + 20,
          y: yPosition,
          size: 9,
          font,
          color: rgb(0.3, 0.3, 0.3),
        });
        yPosition -= 13;
      }

      yPosition -= 10;
    }
  }

  yPosition -= 10;

  page.drawText('Summary of Findings:', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 20;

  page.drawText(`• Critical issues: ${explosionSummary.criticalCount}`, {
    x: MARGIN + 10,
    y: yPosition,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 16;

  page.drawText(`• High priority issues: ${explosionSummary.highCount}`, {
    x: MARGIN + 10,
    y: yPosition,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 16;

  page.drawText(`• Moderate concerns: ${explosionSummary.moderateCount}`, {
    x: MARGIN + 10,
    y: yPosition,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 16;

  return { page, yPosition };
}

function drawComplianceCriticalFindings(
  page: PDFPage,
  flags: ReturnType<typeof computeExplosionSummary>['flags'],
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  sectionNumber: number
): { page: PDFPage; yPosition: number } {
  ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));

  const sectionTitle = `${sectionNumber}. Compliance-Critical Findings`;
  yPosition = drawPageTitle(page, MARGIN, yPosition, sectionTitle, { regular: font, bold: fontBold });

  yPosition -= 10;

  page.drawText('The following compliance issues have been identified through automated checks:', {
    x: MARGIN,
    y: yPosition,
    size: 11,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  yPosition -= 30;

  if (flags.length === 0) {
    page.drawText('All compliance checks passed. No critical issues identified.', {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.2, 0.6, 0.2),
    });
    return { page, yPosition };
  }

  const levelColors: Record<string, ReturnType<typeof rgb>> = {
    critical: rgb(0.7, 0, 0),
    high: rgb(0.9, 0.5, 0),
    moderate: rgb(0, 0.5, 0.7),
  };

  const levelLabels: Record<string, string> = {
    critical: 'CRITICAL',
    high: 'HIGH',
    moderate: 'MODERATE',
  };

  for (let i = 0; i < flags.length; i++) {
    const flag = flags[i];

    ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawRectangle({
      x: MARGIN,
      y: yPosition - 5,
      width: CONTENT_WIDTH,
      height: 1,
      color: rgb(0.7, 0.7, 0.7),
    });

    yPosition -= 15;

    const levelLabel = levelLabels[flag.level] || flag.level.toUpperCase();
    const levelColor = levelColors[flag.level] || rgb(0, 0, 0);

    page.drawRectangle({
      x: MARGIN,
      y: yPosition - 3,
      width: 60,
      height: 16,
      color: levelColor,
    });

    page.drawText(levelLabel, {
      x: MARGIN + 5,
      y: yPosition,
      size: 9,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawText(sanitizePdfText(flag.title), {
      x: MARGIN + 70,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 22;

    const detailText = sanitizePdfText(flag.detail);
    const detailLines = wrapText(detailText, CONTENT_WIDTH - 20, 10, font);
    for (const line of detailLines) {
      ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

      page.drawText(line, {
        x: MARGIN + 10,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      yPosition -= 14;
    }

    yPosition -= 12;
  }

  return { page, yPosition };
}
