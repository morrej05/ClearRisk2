import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import { computeExplosionSummary } from '../dsear/criticalityEngine';
import { listAttachments, type Attachment } from '../supabase/attachments';
import { getModuleName } from '../modules/moduleCatalog';
import { normalizeJurisdiction, getJurisdictionLabel } from '../jurisdictions';
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN,
  CONTENT_WIDTH,
  PAGE_TOP_Y,
  sanitizePdfText,
  wrapText,
  formatDate,
  formatAddress,
  getPriorityColor,
  drawDraftWatermark,
  addNewPage,
  drawFooter,
  addSupersededWatermark,
} from './pdfUtils';
import { addIssuedReportPages } from './issuedPdfPages';
import { drawSectionHeaderBar } from './pdfPrimitives';

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
  renderMode: 'preview' | 'issued';
}

function drawModuleSection(
  page: PDFPage,
  module: ModuleInstance,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  // Check if we need a new page
  if (yPosition < 150) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_TOP_Y;
  }

  // Module heading
  const moduleName = getModuleName(module.module_key);
  page.drawText(sanitizePdfText(moduleName), {
    x: MARGIN,
    y: yPosition,
    size: 14,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 22;

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
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_TOP_Y;
      }
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
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_TOP_Y;
      }

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

  yPosition -= 15; // Space between modules
  return yPosition;
}

export async function buildFraDsearCombinedPdf(options: BuildPdfOptions): Promise<Uint8Array> {
  const { document, moduleInstances, actions, actionRatings, organisation, renderMode } = options;

  console.log('[FRA+DSEAR PDF] Building combined Fire + Explosion PDF with:', {
    modules: moduleInstances.length,
    actions: actions.length,
  });

  let attachments: Attachment[] = [];
  try {
    attachments = await listAttachments(document.id);
    console.log('[FRA+DSEAR PDF] Fetched', attachments.length, 'attachments');
  } catch (error) {
    console.warn('[FRA+DSEAR PDF] Failed to fetch attachments:', error);
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const isDraft = renderMode === 'preview';
  const totalPages: PDFPage[] = [];

  // Add issued report pages if needed
  if (renderMode === 'issued') {
    await addIssuedReportPages(pdfDoc, document, organisation, totalPages);
  }

  // Add cover page
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  totalPages.push(page);
  let yPosition = PAGE_TOP_Y;

  // Cover page title
  page.drawText(sanitizePdfText('Combined Fire + Explosion Report'), {
    x: MARGIN,
    y: yPosition,
    size: 20,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 30;

  page.drawText(sanitizePdfText(document.title || 'Untitled'), {
    x: MARGIN,
    y: yPosition,
    size: 14,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  yPosition -= 40;

  // Client
  const clientName = document.meta?.client?.name || document.responsible_person || '';
  if (clientName) {
    page.drawText(sanitizePdfText(`Client: ${clientName}`), {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;
  }

  // Site
  const siteName = document.meta?.site?.name || document.scope_description || '';
  if (siteName) {
    page.drawText(sanitizePdfText(`Site: ${siteName}`), {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;
  }

  // Address
  const address = document.meta?.site?.address;
  if (address) {
    const formattedAddress = formatAddress(address);
    if (formattedAddress) {
      page.drawText(sanitizePdfText(`Address: ${formattedAddress}`), {
        x: MARGIN,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 20;
    }
  }

  // Organisation
  page.drawText(sanitizePdfText(`Assessment Organisation: ${organisation.name}`), {
    x: MARGIN,
    y: yPosition,
    size: 10,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  yPosition -= 25;

  // Assessment date
  page.drawText(sanitizePdfText(`Assessment Date: ${formatDate(document.assessment_date)}`), {
    x: MARGIN,
    y: yPosition,
    size: 11,
    font: font,
    color: rgb(0, 0, 0),
  });
  yPosition -= 20;

  // Jurisdiction
  const j = normalizeJurisdiction(document.jurisdiction);
  const jurisdictionLabel = getJurisdictionLabel(j);
  page.drawText(sanitizePdfText(`Jurisdiction: ${jurisdictionLabel}`), {
    x: MARGIN,
    y: yPosition,
    size: 11,
    font: font,
    color: rgb(0, 0, 0),
  });
  yPosition -= 20;

  // Assessor
  if (document.assessor_name) {
    page.drawText(sanitizePdfText(`Assessor: ${document.assessor_name}`), {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;
  }

  // Add combined executive summary
  page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  totalPages.push(page);
  yPosition = PAGE_TOP_Y;

  yPosition = drawCombinedExecutiveSummary(
    page,
    moduleInstances,
    actions,
    font,
    fontBold,
    yPosition,
    pdfDoc,
    isDraft,
    totalPages
  );

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
    yPosition = PAGE_TOP_Y;

    yPosition = drawSectionHeaderBar({
      page,
      x: MARGIN,
      y: yPosition,
      w: CONTENT_WIDTH,
      sectionNo: 'SECTION 1',
      title: 'Fire Risk Assessment',
      product: 'fra',
      fonts: { regular: font, bold: fontBold },
    });

    // Sort modules by FRA order
    const sortedFraModules = fraModules.sort((a, b) => {
      const aIndex = FRA_MODULE_ORDER.indexOf(a.module_key);
      const bIndex = FRA_MODULE_ORDER.indexOf(b.module_key);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

    // Render each FRA module
    for (const module of sortedFraModules) {
      yPosition = drawModuleSection(
        page,
        module,
        font,
        fontBold,
        yPosition,
        pdfDoc,
        isDraft,
        totalPages
      );
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

  if (dsearModules.length > 0) {
    page = addNewPage(pdfDoc, isDraft, totalPages).page;
    yPosition = PAGE_TOP_Y;

    yPosition = drawSectionHeaderBar({
      page,
      x: MARGIN,
      y: yPosition,
      w: CONTENT_WIDTH,
      sectionNo: 'SECTION 2',
      title: 'Explosion Risk Assessment (DSEAR)',
      product: 'dsear',
      fonts: { regular: font, bold: fontBold },
    });

    // Sort modules by DSEAR order
    const sortedDsearModules = dsearModules.sort((a, b) => {
      const aIndex = DSEAR_MODULE_ORDER.indexOf(a.module_key);
      const bIndex = DSEAR_MODULE_ORDER.indexOf(b.module_key);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

    // Render each DSEAR module
    for (const module of sortedDsearModules) {
      yPosition = drawModuleSection(
        page,
        module,
        font,
        fontBold,
        yPosition,
        pdfDoc,
        isDraft,
        totalPages
      );
    }
  }

  // Combined action register (deduplicated)
  page = addNewPage(pdfDoc, isDraft, totalPages).page;
  yPosition = PAGE_TOP_Y;

  yPosition = drawCombinedActionRegister(
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
  );

  // Apply watermarks if needed
  if (isDraft) {
    totalPages.forEach((p) => drawDraftWatermark(p));
  }

  if (document.status === 'superseded') {
    totalPages.forEach((p) => addSupersededWatermark(p));
  }

  // Add footers
  totalPages.forEach((p, index) => {
    drawFooter(p, index + 1, totalPages.length, organisation.name, font);
  });

  return await pdfDoc.save();
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
): number {
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
  const fraOutcome = fra4?.data?.summary_outcome || 'Not assessed';

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
      const explosionSummary = computeExplosionSummary({ modules: dsearModules });

      page.drawText(sanitizePdfText('Explosive Atmospheres Criticality:'), {
        x: MARGIN,
        y: yPosition,
        size: 11,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      yPosition -= 18;

      page.drawText(sanitizePdfText(explosionSummary.overall), {
        x: MARGIN + 20,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 25;

      // Flags summary
      page.drawText(sanitizePdfText(`Critical: ${explosionSummary.criticalCount}, High: ${explosionSummary.highCount}`), {
        x: MARGIN + 20,
        y: yPosition,
        size: 9,
        font: font,
        color: rgb(0.4, 0.4, 0.4),
      });
      yPosition -= 25;
    } catch (error) {
      console.error('Error computing explosion summary:', error);
    }
  }

  // Action counts
  const fraActions = actions.filter(a => {
    const module = moduleInstances.find(m => m.id === a.module_instance_id);
    return module && (module.module_key.startsWith('FRA') || module.module_key.startsWith('A'));
  });

  const dsearActions = actions.filter(a => {
    const module = moduleInstances.find(m => m.id === a.module_instance_id);
    return module && module.module_key.startsWith('DSEAR');
  });

  page.drawText(sanitizePdfText('Priority Actions:'), {
    x: MARGIN,
    y: yPosition,
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  const p1Count = actions.filter(a => a.priority_band === 'P1').length;
  const p2Count = actions.filter(a => a.priority_band === 'P2').length;

  page.drawText(sanitizePdfText(`Fire: ${fraActions.length} actions | Explosion: ${dsearActions.length} actions`), {
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
  yPosition -= 25;

  // Top issues from both
  const criticalActions = actions
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

    criticalActions.forEach((action, idx) => {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_TOP_Y;
      }

      const truncated = action.trigger_text!.length > 100
        ? action.trigger_text!.substring(0, 97) + '...'
        : action.trigger_text!;

      const lines = wrapText(`${idx + 1}. ${truncated}`, CONTENT_WIDTH - 20, 9, font);
      lines.slice(0, 2).forEach(line => {
        page.drawText(sanitizePdfText(line), {
          x: MARGIN + 20,
          y: yPosition,
          size: 9,
          font: font,
          color: rgb(0.3, 0.3, 0.3),
        });
        yPosition -= 12;
      });
      yPosition -= 3;
    });
  }

  return yPosition;
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
): number {
  page.drawText(sanitizePdfText('Action Register (Fire + Explosion)'), {
    x: MARGIN,
    y: yPosition,
    size: 14,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 25;

  if (actions.length === 0) {
    page.drawText(sanitizePdfText('No actions recorded'), {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
    return yPosition - 20;
  }

  // Deduplicate actions
  const deduplicatedActions = deduplicateActions(actions, moduleInstances);

  // Sort by priority
  const sortedActions = deduplicatedActions.sort((a, b) => {
    const priority = { P1: 1, P2: 2, P3: 3, P4: 4 };
    const aPri = priority[a.priority_band as keyof typeof priority] || 999;
    const bPri = priority[b.priority_band as keyof typeof priority] || 999;
    if (aPri !== bPri) return aPri - bPri;

    // Then by status (open first)
    if (a.status !== b.status) {
      return a.status === 'open' ? -1 : 1;
    }

    // Then by target date
    if (a.target_date && b.target_date) {
      return a.target_date.localeCompare(b.target_date);
    }
    return 0;
  });

  sortedActions.forEach((action) => {
    if (yPosition < 120) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_TOP_Y;
    }

    const rating = actionRatings.find(r => r.action_id === action.id);
    const lxi = rating ? `L${rating.likelihood}xI${rating.impact}` : '-';

    // Get module type for context
    const module = moduleInstances.find(m => m.id === action.module_instance_id);
    const moduleType = module?.module_key.startsWith('FRA') ? '[Fire]' :
                       module?.module_key.startsWith('DSEAR') ? '[Explosion]' : '[General]';

    page.drawText(sanitizePdfText(`[${action.priority_band}] ${moduleType} ${action.recommended_action}`), {
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
        if (yPosition < MARGIN + 50) {
          const result = addNewPage(pdfDoc, isDraft, totalPages);
          page = result.page;
          yPosition = PAGE_TOP_Y;
        }

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
  });

  return yPosition;
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
