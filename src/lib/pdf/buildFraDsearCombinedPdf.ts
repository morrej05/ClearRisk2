import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import { computeExplosionSummary } from '../dsear/criticalityEngine';
import { compareActionsByDisplayReference, filterActiveActions } from './actionContracts';
import { listAttachments, type Attachment } from '../supabase/attachments';
import { getModuleName } from '../modules/moduleCatalog';
import { resolveExplosionRegime } from '../jurisdictions';
import { detectInfoGapsForModule } from '../../utils/infoGapQuickActions';
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN,
  CONTENT_WIDTH,
  PAGE_TOP_Y,
  sanitizePdfText,
  wrapText,
  formatDate,
  getPriorityColor,
  drawDraftWatermark,
  addNewPage,
  drawFooter,
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
  drawSectionTitle,
  drawWrappedSubsectionHeading,
  getReportLayoutSpacing,
} from './pdfPrimitives';
import { FRA_REPORT_STRUCTURE } from './fraReportStructure';
import {
  drawRegulatoryFramework,
  drawResponsiblePersonDuties,
} from './fra/fraCoreDraw';
import {
  explosiveAtmospheresPurposeText,
  hazardousAreaClassificationText,
  zoneDefinitionsText,
  getExplosiveAtmospheresReferences,
  type Jurisdiction,
} from '../reportText';

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
  executive_summary_ai?: string | null;
  executive_summary_author?: string | null;
  executive_summary_mode?: string | null;
  enabled_modules?: string[];
  jurisdiction?: string;
  meta?: any;
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
const REPORT_LAYOUT_SPACING = getReportLayoutSpacing();
const INFO_GAP_TOP_SPACING = REPORT_LAYOUT_SPACING.sectionHeaderToInfoGap + 2;
const PART1_SECTION_TO_CONTENT_SPACING = REPORT_TITLE_TO_BODY_GAP;

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
  renderMode: 'preview' | 'issued';
}

const NOT_ASSESSED_LABEL = 'Not assessed';

function hasMeaningfulText(value: unknown, minLength = 3): boolean {
  return typeof value === 'string' && value.trim().length >= minLength;
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return hasMeaningfulText(value);
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).some(hasMeaningfulValue);
  return false;
}

function mapExplosionCriticalityLabel(overall: string): string {
  if (overall === 'Moderate') return 'Medium';
  return overall;
}

function getExplosionCriticalityLabel(dsearModules: ModuleInstance[]): {
  label: string;
  summary: ReturnType<typeof computeExplosionSummary> | null;
} {
  if (!hasMeaningfulDsearAssessment(dsearModules)) {
    return { label: NOT_ASSESSED_LABEL, summary: null };
  }

  const summary = computeExplosionSummary({ modules: dsearModules });
  return { label: mapExplosionCriticalityLabel(summary.overall), summary };
}

function hasMeaningfulFraAssessment(fraModules: ModuleInstance[]): boolean {
  return fraModules.some((module) => {
    if (module.outcome && module.outcome !== 'not_assessed') return true;
    if (hasMeaningfulText(module.assessor_notes, 10)) return true;
    return hasMeaningfulValue(module.data);
  });
}

function hasMeaningfulDsearAssessment(dsearModules: ModuleInstance[]): boolean {
  return dsearModules.some((module) => {
    if (module.outcome && module.outcome !== 'not_assessed') return true;
    if (hasMeaningfulText(module.assessor_notes, 10)) return true;
    return hasMeaningfulValue(module.data);
  });
}
function drawModuleSection(
  page: PDFPage,
  module: ModuleInstance,
  document: Document,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  contextDocumentType?: 'FRA' | 'DSEAR',
  options?: {
    showModuleHeading?: boolean;
  }
): { page: PDFPage; yPosition: number } {
  const showModuleHeading = options?.showModuleHeading ?? (contextDocumentType !== 'DSEAR');
  // Ensure space for module header
  ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));

  if (showModuleHeading) {
    // Module heading - strip DSEAR prefix if DSEAR module
    const moduleName = getModuleName(module.module_key);
    const displayName = module.module_key.startsWith('DSEAR')
      ? moduleName.replace(/^DSEAR-\d+\s*-\s*/, '')
      : moduleName;
    yPosition = drawSectionTitle(page, MARGIN, yPosition, displayName, { regular: font, bold: fontBold });
  }

  // Outcome badge if present
  if (module.outcome) {
    const outcomeLabels: Record<string, string> = {
      satisfactory: 'Satisfactory',
      adequate: 'Adequate',
      requires_improvement: 'Requires Improvement',
      unsatisfactory: 'Unsatisfactory',
      not_assessed: 'Not Assessed',
    };
    const outcomeColors: Record<string, any> = {
      satisfactory: rgb(0.2, 0.7, 0.3),
      adequate: rgb(0.4, 0.6, 0.9),
      requires_improvement: rgb(0.95, 0.7, 0.2),
      unsatisfactory: rgb(0.9, 0.3, 0.3),
      not_assessed: rgb(0.6, 0.6, 0.6),
    };

    const outcomeLabel = outcomeLabels[module.outcome] || module.outcome;
    const outcomeColor = outcomeColors[module.outcome] || rgb(0.6, 0.6, 0.6);

    page.drawText('Outcome:', {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    page.drawRectangle({
      x: MARGIN + 60,
      y: yPosition - 2,
      width: 120,
      height: 16,
      color: outcomeColor,
    });

    page.drawText(outcomeLabel, {
      x: MARGIN + 65,
      y: yPosition,
      size: 9,
      font,
      color: rgb(1, 1, 1),
    });

    yPosition -= 20;
  }

  // Assessor notes if present
  if (module.assessor_notes && module.assessor_notes.trim()) {
    ({ page, yPosition } = ensurePageSpace(24, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText('Notes:', {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 14;

    const notesLines = wrapText(module.assessor_notes, CONTENT_WIDTH, 9, font);
    for (const line of notesLines.slice(0, 5)) {
      ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

      page.drawText(sanitizePdfText(line), {
        x: MARGIN + 10,
        y: yPosition,
        size: 9,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 12;
    }
    yPosition -= 5;
  }

  // Key data summary from module.data
  if (module.data && Object.keys(module.data).length > 0) {
    ({ page, yPosition } = ensurePageSpace(24, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText('Key Data:', {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 14;

    let itemCount = 0;
    for (const [key, value] of Object.entries(module.data)) {
      if (itemCount >= 8) break; // Limit to 8 items per module
      ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));

      // Format key (convert snake_case to Title Case)
      const formattedKey = key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Format value
      let formattedValue = '';
      if (value === null || value === undefined) {
        continue; // Skip null/undefined
      } else if (typeof value === 'boolean') {
        formattedValue = value ? 'Yes' : 'No';
      } else if (Array.isArray(value)) {
        formattedValue = `${value.length} items`;
      } else if (typeof value === 'object') {
        formattedValue = 'Complex data';
      } else {
        formattedValue = String(value).substring(0, 80);
      }

      if (formattedValue && formattedValue !== 'Complex data') {
        page.drawText(sanitizePdfText(`${formattedKey}: ${formattedValue}`), {
          x: MARGIN + 10,
          y: yPosition,
          size: 8,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
        yPosition -= 11;
        itemCount++;
      }
    }
  }

  // Info-gap quick actions detection
  const detection = detectInfoGapsForModule(
    module,
    {
      responsible_person: document.responsible_person || undefined,
      standards_selected: document.standards_selected || [],
      document_type: contextDocumentType || document.document_type,
      jurisdiction: document.jurisdiction
    },
    {
      documentType: contextDocumentType || document.document_type || 'FRA',
      jurisdiction: document.jurisdiction || 'GB-ENG'
    }
  );

  let infoGapRendered = false;
  if (detection.hasInfoGap && detection.quickActions.length > 0) {
    const reasons = detection.reasons.slice(0, 3);
    const quickActions = detection.quickActions.slice(0, 3);
    const boxHeight = 44 + (reasons.length * 16) + (quickActions.length * 24);

    ({ page, yPosition } = ensurePageSpace(boxHeight + 12 + INFO_GAP_TOP_SPACING, page, yPosition, pdfDoc, isDraft, totalPages));
    yPosition -= INFO_GAP_TOP_SPACING;
    const boxTopY = yPosition;
    const boxBottomY = boxTopY - boxHeight;

    page.drawRectangle({
      x: MARGIN,
      y: boxBottomY,
      width: CONTENT_WIDTH,
      height: boxHeight,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1,
      color: rgb(0.98, 0.98, 0.98),
    });
    let boxY = boxTopY - 14;
    page.drawText('i', {
      x: MARGIN + 8,
      y: boxY,
      size: 11,
      font: fontBold,
      color: rgb(0.5, 0.5, 0.5),
    });
    page.drawText('Assessment notes (incomplete information)', {
      x: MARGIN + 25,
      y: boxY,
      size: 11,
      font: fontBold,
      color: rgb(0.4, 0.4, 0.4),
    });

      boxY -= 18;
    for (const reason of reasons) {
      page.drawText('•', {
        x: MARGIN + 8,
        y: boxY,
        size: 10,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
const reasonLines = wrapText(reason, CONTENT_WIDTH - 30, 9, font);
      for (const line of reasonLines.slice(0, 2)) {
        page.drawText(sanitizePdfText(line), {
          x: MARGIN + 18,
          y: boxY,
          size: 9,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
        boxY -= 11;
      }
      boxY -= 4;
    }

    for (const action of quickActions) {
      const actionLines = wrapText(`[${action.priority}] ${action.action}`, CONTENT_WIDTH - 26, 9, font);
      for (const line of actionLines.slice(0, 2)) {
        page.drawText(sanitizePdfText(line), {
          x: MARGIN + 12,
          y: boxY,
          size: 9,
          font,
          color: rgb(0.35, 0.35, 0.35),
        });
        boxY -= 11;
      }
      boxY -= 2;
    }
    
     yPosition = boxBottomY - REPORT_LAYOUT_SPACING.sectionToNextHeader;
    infoGapRendered = true;
  }

  if (!infoGapRendered) {
    yPosition -= REPORT_LAYOUT_SPACING.sectionToNextHeader; // Space between modules
  }
  return { page, yPosition };
}

export async function buildFraDsearCombinedPdf(options: BuildPdfOptions): Promise<Uint8Array> {
  const { document, moduleInstances, actions, actionRatings, organisation, renderMode } = options;

  let attachments: Attachment[] = [];
  try {
    attachments = await listAttachments(document.id);
    
  } catch (error) {
    console.warn('[FRA+DSEAR PDF] Failed to fetch attachments:', error);
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const isDraft = renderMode === 'preview';
  const totalPages: PDFPage[] = [];

  // Helper: Strip "DSEAR-<n> - " prefix from module names
  const stripDsearPrefix = (moduleName: string): string => {
    return moduleName.replace(/^DSEAR-\d+\s*-\s*/, '');
  };

  // TOC tracking array
  const tocEntries: Array<{ title: string; pageNo: number }> = [];
  const recordToc = (title: string) => tocEntries.push({ title, pageNo: totalPages.length });

  let page: PDFPage;
  let yPosition = PAGE_TOP_Y;

  // Use shared cover + document-control rendering for both draft and issued modes.
  const { coverPage, docControlPage } = await addIssuedReportPages({
    pdfDoc,
    document: {
      id: document.id,
      title: document.title,
      document_type: 'FIRE_EXPLOSION_COMBINED',
      version_number: (document as any).version_number || document.version || 1,
      issue_date: (document as any).issue_date || new Date().toISOString(),
      issue_status: ((document as any).issue_status || 'draft') as 'draft' | 'issued' | 'superseded',
      assessor_name: document.assessor_name,
      base_document_id: (document as any).base_document_id,
    },
    organisation,
    client: {
      name: document.meta?.client?.name || document.responsible_person || '',
      site: document.meta?.site?.name || document.scope_description || '',
    },
    fonts: { bold: fontBold, regular: font },
  });
  totalPages.push(coverPage, docControlPage);
  page = docControlPage; // Start from doc control page
  
  // Reserve TOC page immediately after cover (will be populated after all sections are rendered)
  const tocPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  totalPages.push(tocPage);

  // Add combined executive summary
  page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  totalPages.push(page);
  recordToc('Executive Summary');
  yPosition = PAGE_TOP_Y;

  ({ page, yPosition } = drawCombinedExecutiveSummary(
    page,
    moduleInstances,
    actions,
    font,
    fontBold,
    yPosition,
    pdfDoc,
    isDraft,
    totalPages
  ));

  // FRA section modules - render in order
  const FRA_MODULE_ORDER = [
    'A1_DOC_CONTROL',
    'A2_BUILDING_PROFILE',
    'A3_PERSONS_AT_RISK',
    'FRA_4_SIGNIFICANT_FINDINGS',
    'FRA_90_SIGNIFICANT_FINDINGS',
    'FRA_1_HAZARDS',
    'A4_MANAGEMENT_CONTROLS',
    'FRA_6_MANAGEMENT_SYSTEMS',
    'A5_EMERGENCY_ARRANGEMENTS',
    'FRA_7_EMERGENCY_ARRANGEMENTS',
    'A7_REVIEW_ASSURANCE',
    'FRA_2_ESCAPE_ASIS',
    'FRA_3_ACTIVE_SYSTEMS',
    'FRA_3_PROTECTION_ASIS',
    'FRA_4_PASSIVE_PROTECTION',
    'FRA_8_FIREFIGHTING_EQUIPMENT',
    'FRA_5_EXTERNAL_FIRE_SPREAD',
  ];

  const fraModules = moduleInstances.filter(m =>
    m.module_key.startsWith('FRA') || m.module_key.startsWith('A')
  );

  if (fraModules.length > 0) {
    page = addNewPage(pdfDoc, isDraft, totalPages).page;
    recordToc('Part 1 — Fire Risk Assessment');
    yPosition = PAGE_TOP_Y;

    yPosition = drawSectionHeaderBar({
      page,
      x: MARGIN,
      y: yPosition,
      w: CONTENT_WIDTH,
      sectionNo: '',
      title: 'Part 1 — Fire Risk Assessment',
      product: 'fra',
      fonts: { regular: font, bold: fontBold },
    });
    
    // Sort modules by FRA order
    const sortedFraModules = fraModules.sort((a, b) => {
      const aIndex = FRA_MODULE_ORDER.indexOf(a.module_key);
      const bIndex = FRA_MODULE_ORDER.indexOf(b.module_key);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
    const modulesByKey = new Map<string, ModuleInstance[]>();
    for (const module of sortedFraModules) {
       const existing = modulesByKey.get(module.module_key) ?? [];
      existing.push(module);
      modulesByKey.set(module.module_key, existing);
    }

    // Render Part 1 body by FRA_REPORT_STRUCTURE so TOC and body always align
    const renderedModuleIds = new Set<string>();
    for (const fraSection of FRA_REPORT_STRUCTURE) {
      const isRegulationSection = fraSection.id === 4;
      const sectionModules = fraSection.moduleKeys.flatMap((moduleKey) => {
        if (isRegulationSection && moduleKey === 'A1_DOC_CONTROL') {
          return [];
        }
        return modulesByKey.get(moduleKey) ?? [];
      });

      if (!isRegulationSection && sectionModules.length === 0) continue;

      const sectionNumber = fraSection.displayNumber ?? fraSection.id;
      const fraSectionLabel = `${sectionNumber}. ${fraSection.title}`;
      recordToc(`  ${fraSectionLabel}`);

      ({ page, yPosition } = ensurePageSpace(42, page, yPosition, pdfDoc, isDraft, totalPages));
      yPosition = drawPageTitle(page, MARGIN, yPosition, fraSectionLabel, { regular: font, bold: fontBold });
      yPosition -= PART1_SECTION_TO_CONTENT_SPACING;

      if (isRegulationSection) {
        ({ page, yPosition } = drawRegulatoryFramework(
          { page, yPosition },
          document,
          font,
          fontBold,
          pdfDoc,
          isDraft,
          totalPages
        ));

        ({ page, yPosition } = drawResponsiblePersonDuties(
          { page, yPosition },
          document,
          font,
          fontBold,
          pdfDoc,
          isDraft,
          totalPages
        ));
      }

      for (const module of sectionModules) {
        renderedModuleIds.add(module.id);
        ({ page, yPosition } = drawModuleSection(
          page,
          module,
          document,
          font,
          fontBold,
          yPosition,
          pdfDoc,
          isDraft,
          totalPages,
          'FRA',
          { showModuleHeading: false }
        ));
      }
    }

    // Fallback for any FRA module not yet mapped into FRA_REPORT_STRUCTURE
    for (const module of sortedFraModules) {
      if (renderedModuleIds.has(module.id)) continue;
      ({ page, yPosition } = drawModuleSection(
        page,
        module,
        document,
        font,
        fontBold,
        yPosition,
        pdfDoc,
        isDraft,
        totalPages,
        'FRA',
        { showModuleHeading: false }
      ));
    }
  }

  // DSEAR section modules - render in order
  const DSEAR_MODULE_ORDER = [
    'DSEAR_1_DANGEROUS_SUBSTANCES',
    'DSEAR_2_PROCESS_RELEASES',
    'DSEAR_3_HAZARDOUS_AREA_CLASSIFICATION',
    'DSEAR_4_IGNITION_SOURCES',
    'DSEAR_5_EXPLOSION_PROTECTION',
    'DSEAR_6_RISK_ASSESSMENT',
    'DSEAR_10_HIERARCHY_OF_CONTROL',
    'DSEAR_11_EXPLOSION_EMERGENCY_RESPONSE',
  ];

  const dsearModules = moduleInstances.filter(m => m.module_key.startsWith('DSEAR'));
  let explosionSummary: ReturnType<typeof getExplosionCriticalityLabel>['summary'] | null = null;

  if (dsearModules.length > 0) {
    const explosionCriticality = getExplosionCriticalityLabel(dsearModules);
    explosionSummary = explosionCriticality.summary;

    page = addNewPage(pdfDoc, isDraft, totalPages).page;
    recordToc('Part 2 — Explosive Atmospheres Assessment');
    yPosition = PAGE_TOP_Y;

    yPosition = drawSectionHeaderBar({
      page,
      x: MARGIN,
      y: yPosition,
      w: CONTENT_WIDTH,
      sectionNo: '',
      title: 'Part 2 — Explosive Atmospheres Assessment',
      product: 'dsear',
      fonts: { regular: font, bold: fontBold },
    });

    let dsearSectionNumber = 1;
    const formatPart2Section = (sectionNumber: number) => `2.${sectionNumber}`;

    // 2.1 Explosion Criticality Assessment
    page = addNewPage(pdfDoc, isDraft, totalPages).page;
    recordToc('2.1 Explosion Criticality Assessment');
    yPosition = PAGE_TOP_Y;
    const criticalityTitle = '2.1 Explosion Criticality Assessment';
    yPosition = drawPageTitle(page, MARGIN, yPosition, criticalityTitle, { regular: font, bold: fontBold });
    yPosition -= 20;

    // Render explosion criticality summary (simplified inline version)
    const criticalityLevel = explosionCriticality.label;
    const criticalityColors: Record<string, ReturnType<typeof rgb>> = {
      'Not assessed': rgb(0.5, 0.5, 0.5),
      Critical: rgb(0.8, 0, 0),
      High: rgb(0.9, 0.5, 0),
      Medium: rgb(0.9, 0.7, 0),
      Low: rgb(0.2, 0.7, 0.2),
    };
    page.drawText(`Overall Criticality: ${criticalityLevel}`, {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: criticalityColors[criticalityLevel] || rgb(0, 0, 0),
    });
    yPosition -= 30;

    // 2.2 Purpose and Introduction
    page = addNewPage(pdfDoc, isDraft, totalPages).page;
    dsearSectionNumber = 2;
    recordToc('2.2 Purpose and Introduction');
    yPosition = PAGE_TOP_Y;
    const purposeTitle = '2.2 Purpose and Introduction';
    yPosition = drawPageTitle(page, MARGIN, yPosition, purposeTitle, { regular: font, bold: fontBold });
    yPosition -= REPORT_TITLE_TO_BODY_GAP;

    const purposeParagraphs = splitNarrativeParagraphs(explosiveAtmospheresPurposeText);
    ({ page, yPosition } = drawNarrativeParagraphs({
      page,
      yPosition,
      paragraphs: purposeParagraphs,
      font,
      pdfDoc,
      isDraft,
      totalPages,
    }));

    // 2.3 Hazardous Area Classification Methodology
    page = addNewPage(pdfDoc, isDraft, totalPages).page;
    dsearSectionNumber = 3;
    recordToc('2.3 Hazardous Area Classification Methodology');
    yPosition = PAGE_TOP_Y;
    const hacTitle = '2.3 Hazardous Area Classification Methodology';
    yPosition = drawPageTitle(page, MARGIN, yPosition, hacTitle, { regular: font, bold: fontBold });
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

    // 2.4 Zone Definitions
    page = addNewPage(pdfDoc, isDraft, totalPages).page;
    dsearSectionNumber = 4;
    recordToc('2.4 Zone Definitions');
    yPosition = PAGE_TOP_Y;
    const zoneTitle = '2.4 Zone Definitions';
    yPosition = drawPageTitle(page, MARGIN, yPosition, zoneTitle, { regular: font, bold: fontBold });
    yPosition -= REPORT_TITLE_TO_BODY_GAP;

    const zoneBlocks = parseNarrativeBlocks(zoneDefinitionsText);
    for (const block of zoneBlocks) {
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

    // 2.5 Scope (if present)
    dsearSectionNumber = 5;
    if (document.scope_description?.trim()) {
      page = addNewPage(pdfDoc, isDraft, totalPages).page;
      recordToc('2.5 Scope');
      yPosition = PAGE_TOP_Y;
      const scopeTitle = '2.5 Scope';
      yPosition = drawPageTitle(page, MARGIN, yPosition, scopeTitle, { regular: font, bold: fontBold });
      yPosition -= 20;

      const scopeLines = wrapText(document.scope_description, CONTENT_WIDTH, 11, font);
      for (const line of scopeLines) {
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
      dsearSectionNumber = 6;
    }

    // 2.X Limitations and Assumptions (if present)
    if (document.limitations_assumptions?.trim()) {
      page = addNewPage(pdfDoc, isDraft, totalPages).page;
      recordToc(`${formatPart2Section(dsearSectionNumber)} Limitations and Assumptions`);
      yPosition = PAGE_TOP_Y;
      const limTitle = `${formatPart2Section(dsearSectionNumber)} Limitations and Assumptions`;
      yPosition = drawPageTitle(page, MARGIN, yPosition, limTitle, { regular: font, bold: fontBold });
      yPosition -= 20;

      const limLines = wrapText(document.limitations_assumptions, CONTENT_WIDTH, 11, font);
      for (const line of limLines) {
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
      dsearSectionNumber += 1;
    }

    // Sort modules by DSEAR order
    const sortedDsearModules = dsearModules.sort((a, b) => {
      const aIndex = DSEAR_MODULE_ORDER.indexOf(a.module_key);
      const bIndex = DSEAR_MODULE_ORDER.indexOf(b.module_key);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

    // Render each DSEAR module with section numbers
    for (const module of sortedDsearModules) {
      const moduleName = getModuleName(module.module_key);
      const displayName = stripDsearPrefix(moduleName);
       const numberedModuleName = `${formatPart2Section(dsearSectionNumber)} ${displayName}`;
      recordToc(numberedModuleName);

      page = addNewPage(pdfDoc, isDraft, totalPages).page;
      yPosition = PAGE_TOP_Y;
      yPosition = drawPageTitle(page, MARGIN, yPosition, numberedModuleName, { regular: font, bold: fontBold });
      yPosition -= 10;

      ({ page, yPosition } = drawModuleSection(
        page,
        module,
        document,
        font,
        fontBold,
        yPosition,
        pdfDoc,
        isDraft,
        totalPages,
        'DSEAR',
        { showModuleHeading: false }
      ));
      dsearSectionNumber += 1;
    }

    // 2.X References and Compliance
    page = addNewPage(pdfDoc, isDraft, totalPages).page;
    recordToc(`${formatPart2Section(dsearSectionNumber)} References and Compliance`);
    yPosition = PAGE_TOP_Y;
    const refTitle = `${formatPart2Section(dsearSectionNumber)} References and Compliance`;
    yPosition = drawPageTitle(page, MARGIN, yPosition, refTitle, { regular: font, bold: fontBold });
    yPosition -= 28;

    const bulletX = MARGIN;
    const bulletTextX = MARGIN + 12;
    const bulletWrapWidth = CONTENT_WIDTH - (bulletTextX - MARGIN);

    const explosionRegime = resolveExplosionRegime(document.jurisdiction);
    const references = getExplosiveAtmospheresReferences(explosionRegime);
    for (const ref of references) {
      const formattedReference = ref.detail ? `${ref.label} — ${ref.detail}` : ref.label;
       const wrappedReferenceLines = wrapText(sanitizePdfText(formattedReference), bulletWrapWidth, 10, font);
      ({ page, yPosition } = ensurePageSpace(18, page, yPosition, pdfDoc, isDraft, totalPages));
      page.drawText(sanitizePdfText('•'), {
        x: bulletX,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      for (const line of wrappedReferenceLines) {
        ({ page, yPosition } = ensurePageSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));
        page.drawText(line, {
          x: bulletTextX,
          y: yPosition,
          size: 10,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
        yPosition -= 14;
      }

      yPosition -= 8;
    }
    dsearSectionNumber += 1;

    // 2.X Compliance-Critical Findings (if present)
     if (explosionSummary?.flags.length) {
      page = addNewPage(pdfDoc, isDraft, totalPages).page;
      recordToc(`${formatPart2Section(dsearSectionNumber)} Compliance-Critical Findings`);
      yPosition = PAGE_TOP_Y;
      const ccfTitle = `${formatPart2Section(dsearSectionNumber)} Compliance-Critical Findings`;
      yPosition = drawPageTitle(page, MARGIN, yPosition, ccfTitle, { regular: font, bold: fontBold });
      yPosition -= 20;

      page.drawText('The following compliance issues have been identified:', {
        x: MARGIN,
        y: yPosition,
        size: 11,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 30;

      for (const flag of explosionSummary.flags.slice(0, 5)) {
        ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));
        page.drawText(sanitizePdfText(`• ${flag.description}`), {
          x: MARGIN,
          y: yPosition,
          size: 10,
          font,
          color: rgb(0.8, 0, 0),
        });
        yPosition -= 40;
      }
    }
  }

  // Combined action register (deduplicated)
  page = addNewPage(pdfDoc, isDraft, totalPages).page;
  recordToc('Action Register (Fire + Explosion)');
  yPosition = PAGE_TOP_Y;

  ({ page, yPosition } = drawCombinedActionRegister(
    page,
    actions,
    actionRatings,
    moduleInstances,
    font,
    fontBold,
    yPosition,
    pdfDoc,
    isDraft,
    totalPages
  ));

  // Attachments Index (if present)
  if (attachments.length > 0) {
    page = addNewPage(pdfDoc, isDraft, totalPages).page;
    recordToc('Attachments Index');
    yPosition = PAGE_TOP_Y;

    page.drawText('Attachments Index', {
      x: MARGIN,
      y: yPosition,
      size: 18,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 30;

    page.drawText(`Total attachments: ${attachments.length}`, {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    yPosition -= 30;

    for (const attachment of attachments) {
      ({ page, yPosition } = ensurePageSpace(40, page, yPosition, pdfDoc, isDraft, totalPages));
      page.drawText(sanitizePdfText(`• ${attachment.file_name}`), {
        x: MARGIN,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      yPosition -= 20;
    }
  }

  // Now render the TOC with collected entries (flowing to extra TOC pages if needed)
  drawTableOfContents(pdfDoc, totalPages, tocPage, tocEntries, font, fontBold);

  // Apply watermarks if needed
  if (isDraft) {
    totalPages.forEach((p) => drawDraftWatermark(p));
  }

  if (document.status === 'superseded') {
    totalPages.forEach((p) => addSupersededWatermark(p));
  }

  // Add footers
  const footerReportTitle = getReportFooterTitle('FIRE_EXPLOSION_COMBINED', document.title);
  totalPages.forEach((p, index) => {
     drawFooter(p, footerReportTitle, index + 1, totalPages.length, font);
  });

  return await pdfDoc.save();
}

/**
 * Draw Table of Contents for Combined PDF with actual page numbers
 */
function drawTableOfContents(
  pdfDoc: PDFDocument,
  totalPages: PDFPage[],
  tocPage: PDFPage,
  tocEntries: Array<{ title: string; pageNo: number }>,
  font: any,
  fontBold: any
): void {
  const tocStartY = PAGE_TOP_Y - 36;
  const contentStartY = tocStartY - 42;
  const minY = MARGIN + 50;
  const pageNumberX = PAGE_WIDTH - MARGIN;
  const topLevelIndentX = MARGIN + 18;
  const childIndentX = MARGIN + 40;
  const partHeadingIndentX = MARGIN + 8;

  const entryHeight = (title: string): number => {
    const displayTitle = title.trim();
    const isPartHeading = /^Part\s+[12]\b/.test(displayTitle);
    return isPartHeading ? 34 : title.startsWith('  ') ? 17 : 19;
  };

  const countNeededTocPages = (): number => {
    let pageCount = 1;
    let yPosition = contentStartY;

    for (const entry of tocEntries) {
      const height = entryHeight(entry.title);
      if (yPosition - height < minY) {
        pageCount += 1;
        yPosition = contentStartY;
      }
      yPosition -= height;
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
  let tocPageOffset = extraTocPages;
  let currentTocPageIndex = 0;
  let activePage = allTocPages[currentTocPageIndex];
  let yPosition = tocStartY;

  const drawTocTitle = (targetPage: PDFPage) => {
    targetPage.drawText(sanitizePdfText('Contents'), {
      x: MARGIN,
      y: tocStartY,
      size: 19,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
  };

  drawTocTitle(activePage);
  yPosition = contentStartY;

  // Render TOC entries with page numbers
  for (const entry of tocEntries) {
    const neededHeight = entryHeight(entry.title);
    if (yPosition - neededHeight < minY) {
      currentTocPageIndex += 1;
      const nextExistingPage = allTocPages[currentTocPageIndex];
      if (nextExistingPage) {
        activePage = nextExistingPage;
      } else {
        const inserted = pdfDoc.insertPage(tocPageIndex + currentTocPageIndex, [PAGE_WIDTH, PAGE_HEIGHT]);
        totalPages.splice(tocPageIndex + currentTocPageIndex, 0, inserted);
        allTocPages.push(inserted);
        activePage = inserted;
        tocPageOffset += 1;
      }
      drawTocTitle(activePage);
      yPosition = contentStartY;
    }

    const isIndented = entry.title.startsWith('  ');
    const displayTitle = entry.title.trim();
    const isPartHeading = /^Part\s+[12]\b/.test(displayTitle);
    const titleSize = isPartHeading ? 12.5 : isIndented ? 11 : 12;
    const titleFont = isPartHeading ? fontBold : isIndented ? font : fontBold;
    const xOffset = isPartHeading ? partHeadingIndentX : isIndented ? childIndentX : topLevelIndentX;

    if (isPartHeading) {
      yPosition -= 12;
    }

    // Draw section title (left-aligned)
    const sanitizedTitle = sanitizePdfText(displayTitle);
    activePage.drawText(sanitizedTitle, {
      x: xOffset,
      y: yPosition,
      size: titleSize,
      font: titleFont,
      color: rgb(0, 0, 0),
    });

    // Draw page number (right-aligned)
    const pageNumText = (entry.pageNo + tocPageOffset).toString();
    const pageNumSize = 11;
    const pageNumWidth = font.widthOfTextAtSize(pageNumText, pageNumSize);
    activePage.drawText(pageNumText, {
      x: pageNumberX - pageNumWidth,
      y: yPosition,
      size: pageNumSize,
      font: font,
      color: rgb(0, 0, 0),
    });

     yPosition -= isPartHeading ? 22 : isIndented ? 17 : 19;
  }
}

function drawCombinedExecutiveSummary(
  page: PDFPage,
  moduleInstances: ModuleInstance[],
  actions: Action[],
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

  // FRA section
  const fraModules = moduleInstances.filter(m => m.module_key.startsWith('FRA') || m.module_key.startsWith('A'));
  const fra4 = fraModules.find(m => m.module_key === 'FRA_4_SIGNIFICANT_FINDINGS');
   const fraOutcome = hasMeaningfulFraAssessment(fraModules)
    ? (fra4?.data?.summary_outcome || NOT_ASSESSED_LABEL)
    : NOT_ASSESSED_LABEL;

  page.drawText(sanitizePdfText('Fire Risk Assessment Outcome:'), {
    x: MARGIN,
    y: yPosition,
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  page.drawText(sanitizePdfText(fraOutcome), {
    x: MARGIN + 20,
    y: yPosition,
    size: 10,
    font: font,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 25;

  // DSEAR section
  const dsearModules = moduleInstances.filter(m => m.module_key.startsWith('DSEAR'));
  if (dsearModules.length > 0) {
    try {
      const explosionCriticality = getExplosionCriticalityLabel(dsearModules);

      page.drawText(sanitizePdfText('Explosive Atmospheres Criticality:'), {
        x: MARGIN,
        y: yPosition,
        size: 11,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      yPosition -= 18;

      page.drawText(sanitizePdfText(explosionCriticality.label), {
        x: MARGIN + 20,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 16;

      if (explosionCriticality.summary) {
        page.drawText(sanitizePdfText(`Critical: ${explosionCriticality.summary.criticalCount}, High: ${explosionCriticality.summary.highCount}`), {
          x: MARGIN + 20,
          y: yPosition,
          size: 9,
          font: font,
          color: rgb(0.4, 0.4, 0.4),
        });
        yPosition -= 25;
      }

      } catch (error) {
      console.error('Error computing explosion summary:', error);
    }
  }
const deduplicatedActions = deduplicateActions(actions, moduleInstances);
  const activeActions = filterActiveActions(deduplicatedActions);
  // Action counts (active actions only for executive summary)
  const fraActions = activeActions.filter(a => {
    const module = moduleInstances.find(m => m.id === a.module_instance_id);
    return module && (module.module_key.startsWith('FRA') || module.module_key.startsWith('A'));
  });

  const dsearActions = activeActions.filter(a => {
    const module = moduleInstances.find(m => m.id === a.module_instance_id);
    return module && module.module_key.startsWith('DSEAR');
  });

  page.drawText(sanitizePdfText('Priority Actions (Active only):'), {
    x: MARGIN,
    y: yPosition,
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  const p1Count = activeActions.filter(a => a.priority_band === 'P1').length;
  const p2Count = activeActions.filter(a => a.priority_band === 'P2').length;

  page.drawText(sanitizePdfText(`Active actions — Fire: ${fraActions.length} | Explosion: ${dsearActions.length}`), {
    x: MARGIN + 20,
    y: yPosition,
    size: 10,
    font: font,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 16;

  page.drawText(sanitizePdfText(`Total P1: ${p1Count}, P2: ${p2Count}`), {
    x: MARGIN + 20,
    y: yPosition,
    size: 10,
    font: font,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 16;

  page.drawText(sanitizePdfText(`Total actions (register scope): ${deduplicatedActions.length}`), {
    x: MARGIN + 20,
    y: yPosition,
    size: 10,
    font: font,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 25;

  // Top issues from both
  const criticalActions = activeActions
    .filter(a => (a.priority_band === 'P1' || a.priority_band === 'P2') && a.trigger_text)
    .slice(0, 5);

  if (criticalActions.length > 0) {
    page.drawText(sanitizePdfText('Key Findings:'), {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 18;

    for (let idx = 0; idx < criticalActions.length; idx++) {
      const action = criticalActions[idx];
      ({ page, yPosition } = ensurePageSpace(40, page, yPosition, pdfDoc, isDraft, totalPages));

      const truncated = action.trigger_text!.length > 100
        ? action.trigger_text!.substring(0, 97) + '...'
        : action.trigger_text!;

      const lines = wrapText(`${idx + 1}. ${truncated}`, CONTENT_WIDTH - 20, 9, font);
      for (const line of lines.slice(0, 2)) {
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
  }

  return { page, yPosition };
}

function drawCombinedActionRegister(
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
): { page: PDFPage; yPosition: number } {
  yPosition = drawSectionTitle(page, MARGIN, yPosition, 'Action Register (Fire + Explosion)', { regular: font, bold: fontBold });
page.drawText(sanitizePdfText('Includes all deduplicated actions (active and closed).'), {
    x: MARGIN,
    y: yPosition,
    size: 9,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
  yPosition -= 16;

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

  // Deduplicate actions
  const deduplicatedActions = deduplicateActions(actions, moduleInstances);

  // Shared display sort contract: reference number first, deterministic fallback
  const sortedActions = deduplicatedActions.sort(compareActionsByDisplayReference);

  for (const action of sortedActions) {
    ({ page, yPosition } = ensurePageSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));

    const rating = actionRatings.find(r => r.action_id === action.id);
    const lxi = rating ? `L${rating.likelihood}xI${rating.impact}` : '-';

    // Get module type for context
    const module = moduleInstances.find(m => m.id === action.module_instance_id);
    const moduleType = module?.module_key.startsWith('FRA') ? '[Fire]' :
                       module?.module_key.startsWith('DSEAR') ? '[Explosion]' : '[General]';

    const referencePrefix = action.reference_number ? `${action.reference_number} ` : '';
    page.drawText(sanitizePdfText(`[${action.priority_band}] ${moduleType} ${referencePrefix}${action.recommended_action}`), {
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

    // Show trigger text for P1/P2
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

function deduplicateActions(actions: Action[], moduleInstances: ModuleInstance[]): Action[] {
  const seen = new Map<string, Action>();

  actions.forEach(action => {
    // Create dedupe key
    const module = moduleInstances.find(m => m.id === action.module_instance_id);
    const moduleKey = module?.module_key || '';

    let dedupeKey: string;

    if (action.trigger_id && action.trigger_text) {
      // Use trigger-based key
      const normalizedText = action.trigger_text.toLowerCase().trim().slice(0, 100);
      dedupeKey = `${action.trigger_id}:${normalizedText}:${moduleKey}`;
    } else {
      // Fallback to action text
      const normalizedAction = action.recommended_action.toLowerCase().trim().slice(0, 100);
      dedupeKey = `${normalizedAction}:${moduleKey}`;
    }

    const existing = seen.get(dedupeKey);

    if (!existing) {
      seen.set(dedupeKey, action);
    } else {
      // Keep the one with higher priority (P1 > P2 > P3 > P4)
      const priority = { P1: 1, P2: 2, P3: 3, P4: 4 };
      const existingPri = priority[existing.priority_band as keyof typeof priority] || 999;
      const currentPri = priority[action.priority_band as keyof typeof priority] || 999;

      if (currentPri < existingPri) {
        seen.set(dedupeKey, action);
      }
    }
  });

  return Array.from(seen.values());
}
