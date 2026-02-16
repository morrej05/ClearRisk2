import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import { computeExplosionSummary } from '../dsear/criticalityEngine';
import { listAttachments, type Attachment } from '../supabase/attachments';
import { getModuleName } from '../modules/moduleCatalog';
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN,
  CONTENT_WIDTH,
  sanitizePdfText,
  wrapText,
  formatDate,
  getPriorityColor,
  drawDraftWatermark,
  addNewPage,
  drawFooter,
  addSupersededWatermark,
} from './pdfUtils';
import { addIssuedReportPages } from './issuedPdfPages';

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
  let yPosition = PAGE_HEIGHT - MARGIN;

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

  // Organisation
  page.drawText(sanitizePdfText(`Organisation: ${organisation.name}`), {
    x: MARGIN,
    y: yPosition,
    size: 11,
    font: font,
    color: rgb(0, 0, 0),
  });
  yPosition -= 20;

  // Assessment date
  page.drawText(sanitizePdfText(`Assessment Date: ${formatDate(document.assessment_date)}`), {
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
  yPosition = PAGE_HEIGHT - MARGIN;

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

  // FRA section modules (simplified - add actual FRA rendering here)
  const fraModules = moduleInstances.filter(m => m.module_key.startsWith('FRA'));
  if (fraModules.length > 0) {
    page = addNewPage(pdfDoc, isDraft, totalPages).page;
    yPosition = PAGE_HEIGHT - MARGIN;

    page.drawText(sanitizePdfText('SECTION 1: FIRE RISK ASSESSMENT'), {
      x: MARGIN,
      y: yPosition,
      size: 16,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 30;

    page.drawText(sanitizePdfText('(FRA sections would be rendered here using existing FRA helpers)'), {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  // DSEAR section modules
  const dsearModules = moduleInstances.filter(m => m.module_key.startsWith('DSEAR'));
  if (dsearModules.length > 0) {
    page = addNewPage(pdfDoc, isDraft, totalPages).page;
    yPosition = PAGE_HEIGHT - MARGIN;

    page.drawText(sanitizePdfText('SECTION 2: EXPLOSION RISK ASSESSMENT (DSEAR)'), {
      x: MARGIN,
      y: yPosition,
      size: 16,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 30;

    page.drawText(sanitizePdfText('(DSEAR sections would be rendered here using existing DSEAR helpers)'), {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  // Combined action register (deduplicated)
  page = addNewPage(pdfDoc, isDraft, totalPages).page;
  yPosition = PAGE_HEIGHT - MARGIN;

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
        yPosition = PAGE_HEIGHT - MARGIN;
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
      yPosition = PAGE_HEIGHT - MARGIN;
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
          yPosition = PAGE_HEIGHT - MARGIN;
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
