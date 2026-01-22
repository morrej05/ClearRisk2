import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import { getModuleName } from '../modules/moduleCatalog';
import { detectInfoGaps } from '../../utils/infoGapQuickActions';
import { listAttachments, type Attachment } from '../supabase/attachments';
import {
  fraRegulatoryFrameworkText,
  fraResponsiblePersonDutiesText,
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
}

const MODULE_ORDER = [
  'A1_DOC_CONTROL',
  'FRA_4_SIGNIFICANT_FINDINGS',
  'FRA_1_HAZARDS',
  'A4_MANAGEMENT_CONTROLS',
  'A5_EMERGENCY_ARRANGEMENTS',
  'FRA_2_ESCAPE_ASIS',
  'FRA_3_PROTECTION_ASIS',
  'FRA_5_EXTERNAL_FIRE_SPREAD',
];

export async function buildFraPdf(options: BuildPdfOptions): Promise<Uint8Array> {
  const { document, moduleInstances, actions, actionRatings, organisation } = options;

  console.log('[PDF] Building PDF with:', {
    modules: moduleInstances.length,
    actions: actions.length,
    ratings: actionRatings.length,
  });

  console.log('[PDF] Sanitization test:', {
    input: '⚠ test ✅ ❌ — "quotes" •',
    output: sanitizePdfText('⚠ test ✅ ❌ — "quotes" •'),
    expected: '! test [OK] [X] - "quotes" *',
  });

  console.log('[PDF] £ symbol test:', {
    input: '£100',
    output: sanitizePdfText('£100'),
    expected: '£100',
  });

  let attachments: Attachment[] = [];
  try {
    attachments = await listAttachments(document.id);
    console.log('[PDF] Fetched', attachments.length, 'attachments');
  } catch (error) {
    console.warn('[PDF] Failed to fetch attachments:', error);
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const isDraft = document.status !== 'issued';
  const totalPages: PDFPage[] = [];

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  totalPages.push(page);
  let yPosition = PAGE_HEIGHT - MARGIN;

  if (isDraft) {
    drawDraftWatermark(page);
  }

  yPosition = drawCoverPage(page, document, organisation, font, fontBold, yPosition);

  addExecutiveSummaryPages(
    pdfDoc,
    isDraft,
    totalPages,
    (document.executive_summary_mode as 'ai' | 'author' | 'both' | 'none') || 'none',
    document.executive_summary_ai,
    document.executive_summary_author,
    { bold: fontBold, regular: font }
  );

  const regFrameworkResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = regFrameworkResult.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawRegulatoryFramework(page, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  const respPersonResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = respPersonResult.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawResponsiblePersonDuties(page, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  const sortedModules = sortModules(moduleInstances);
  const fra4Module = sortedModules.find((m) => m.module_key === 'FRA_4_SIGNIFICANT_FINDINGS');

  if (fra4Module) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawExecutiveSummary(page, fra4Module, actions, actionRatings, moduleInstances, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  for (const module of sortedModules) {
    if (module.module_key === 'FRA_4_SIGNIFICANT_FINDINGS') continue;

    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawModuleSummary(page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  const result1 = addNewPage(pdfDoc, isDraft, totalPages);
  page = result1.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawActionRegister(page, actions, actionRatings, moduleInstances, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  if (attachments.length > 0) {
    const result1b = addNewPage(pdfDoc, isDraft, totalPages);
    page = result1b.page;
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawAttachmentsIndex(page, attachments, moduleInstances, actions, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  const result2 = addNewPage(pdfDoc, isDraft, totalPages);
  page = result2.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawAssumptionsAndLimitations(page, document, fra4Module, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  // Add page numbers and footers to all pages except cover
  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const footerText = `FRA Report — ${document.title} — v${document.version} — Generated ${today}`;

  for (let i = 1; i < totalPages.length; i++) {
    drawFooter(totalPages[i], footerText, i, totalPages.length - 1, font);
  }

  if (document.issue_status === 'superseded') {
    await addSupersededWatermark(pdfDoc);
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
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

function drawCoverPage(
  page: PDFPage,
  document: Document,
  organisation: Organisation,
  font: any,
  fontBold: any,
  yPosition: number
): number {
  const centerX = PAGE_WIDTH / 2;

  yPosition -= 80;
  page.drawText('FIRE RISK ASSESSMENT', {
    x: centerX - 150,
    y: yPosition,
    size: 24,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 60;
  const titleLines = wrapText(document.title, CONTENT_WIDTH - 100, 18, font);
  for (const line of titleLines) {
    page.drawText(line, {
      x: centerX - (font.widthOfTextAtSize(line, 18) / 2),
      y: yPosition,
      size: 18,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 25;
  }

  yPosition -= 40;
  const statusColor = document.status === 'issued' ? rgb(0.13, 0.55, 0.13) : rgb(0.5, 0.5, 0.5);
  page.drawRectangle({
    x: centerX - 50,
    y: yPosition - 5,
    width: 100,
    height: 25,
    color: statusColor,
  });
  const statusText = sanitizePdfText(document.status.toUpperCase());
  page.drawText(statusText, {
    x: centerX - font.widthOfTextAtSize(statusText, 12) / 2,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  yPosition -= 80;
  page.drawLine({
    start: { x: MARGIN, y: yPosition },
    end: { x: PAGE_WIDTH - MARGIN, y: yPosition },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  yPosition -= 30;
  const infoItems = [
    ['Organisation:', organisation.name],
    ['Document Type:', 'Fire Risk Assessment (FRA)'],
    ['Assessment Date:', formatDate(document.assessment_date)],
    ['Assessor:', document.assessor_name || 'Not recorded'],
    ['Assessor Role:', document.assessor_role || 'Not recorded'],
    ['Responsible Person:', document.responsible_person || 'Not recorded'],
    ['Version:', `v${document.version}`],
    ['Status:', document.status.toUpperCase()],
  ];

  for (const [label, value] of infoItems) {
    page.drawText(sanitizePdfText(label), {
      x: MARGIN + 20,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    });
    page.drawText(sanitizePdfText(value), {
      x: MARGIN + 180,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 22;
  }

  yPosition -= 40;
  page.drawText('Generated by ClearRisk', {
    x: centerX - 80,
    y: MARGIN + 10,
    size: 10,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  return yPosition;
}

function computeFallbackRating(actions: Action[], actionRatings: ActionRating[], moduleInstances: ModuleInstance[]): string {
  // Get open/in_progress actions
  const openActions = actions.filter((a) => a.status === 'open' || a.status === 'in_progress');
  const p1Actions = openActions.filter((a) => a.priority_band === 'P1').length;
  const p2Actions = openActions.filter((a) => a.priority_band === 'P2').length;

  // Count module outcomes
  const materialDefCount = moduleInstances.filter((m) => m.outcome === 'material_def').length;
  const minorDefCount = moduleInstances.filter((m) => m.outcome === 'minor_def').length;

  // Fallback logic
  if (p1Actions > 0) {
    return 'intolerable';
  }
  if (p2Actions >= 3 || materialDefCount > 0) {
    return 'high';
  }
  if (p2Actions > 0 || minorDefCount >= 2) {
    return 'medium';
  }
  return 'low';
}

function drawExecutiveSummary(
  page: PDFPage,
  fra4Module: ModuleInstance,
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
  yPosition -= 20;
  page.drawText('EXECUTIVE SUMMARY', {
    x: MARGIN,
    y: yPosition,
    size: 18,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  // Determine stored rating from FRA-4 and compute fallback
  const storedRating = fra4Module.data.overall_risk_rating;
  const storedOverrideJustification = fra4Module.data.override_justification;
  const fallbackRating = computeFallbackRating(actions, actionRatings, moduleInstances);

  const openActions = actions.filter((a) => a.status === 'open' || a.status === 'in_progress');
  const p1OpenCount = openActions.filter((a) => a.priority_band === 'P1').length;

  // Debug logging
  console.log('[PDF] Rating Analysis:', {
    storedRating,
    fallbackRating,
    p1OpenCount,
    overrideJustificationPresent: !!storedOverrideJustification,
  });

  // Determine primary rating: use stored if present, else fallback
  let primaryRating = storedRating && storedRating !== 'unknown' && storedRating.trim()
    ? storedRating
    : fallbackRating;

  // Check for override scenario: stored rating conflicts with P1-derived INTOLERABLE
  const isOverride =
    storedRating &&
    storedRating !== 'unknown' &&
    storedRating.trim() &&
    fallbackRating.toLowerCase() === 'intolerable' &&
    storedRating.toLowerCase() !== 'intolerable';

  const ratingLabel = isOverride
    ? `${primaryRating.toUpperCase()} (OVERRIDDEN)`
    : primaryRating.toUpperCase();
  const ratingColor = getRatingColor(primaryRating);

  page.drawText('Overall Fire Risk Rating:', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 25;
  page.drawRectangle({
    x: MARGIN,
    y: yPosition - 5,
    width: isOverride ? 250 : 150,
    height: 30,
    color: ratingColor,
  });
  page.drawText(ratingLabel, {
    x: MARGIN + 10,
    y: yPosition + 3,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  yPosition -= 40;

  // Show override details if applicable
  if (isOverride) {
    const justificationText = storedOverrideJustification && storedOverrideJustification.trim()
      ? storedOverrideJustification
      : '(Not provided - please record justification in FRA-4)';

    page.drawText('Override justification:', {
      x: MARGIN + 10,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    });

    yPosition -= 15;
    const justificationLines = wrapText(justificationText, CONTENT_WIDTH - 20, 10, font);
    for (const line of justificationLines) {
      if (yPosition < MARGIN + 50) {
        const result = checkPageBreak(yPosition, pdfDoc, totalPages, isDraft, font);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
      }
      page.drawText(line, {
        x: MARGIN + 15,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
      yPosition -= 14;
    }

    yPosition -= 5;
    page.drawText(`System suggested rating: ${fallbackRating.toUpperCase()} (based on open P1 actions)`, {
      x: MARGIN + 10,
      y: yPosition,
      size: 9,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    yPosition -= 25;
  } else {
    yPosition -= 5;
  }

  const p2Actions = openActions.filter((a) => a.priority_band === 'P2').length;

  page.drawText('Priority Actions Summary:', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 22;
  page.drawText(`P1 (Immediate): ${p1OpenCount}`, {
    x: MARGIN + 10,
    y: yPosition,
    size: 11,
    font,
    color: rgb(0.7, 0, 0),
  });

  yPosition -= 18;
  page.drawText(`P2 (Urgent): ${p2Actions}`, {
    x: MARGIN + 10,
    y: yPosition,
    size: 11,
    font,
    color: rgb(0.8, 0.4, 0),
  });

  yPosition -= 18;
  page.drawText(`Total Open Actions: ${openActions.length}`, {
    x: MARGIN + 10,
    y: yPosition,
    size: 11,
    font,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  const materialDefCount = moduleInstances.filter((m) => m.outcome === 'material_def').length;
  const infoGapCount = moduleInstances.filter((m) => m.outcome === 'info_gap').length;

  page.drawText('Module Outcomes:', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 22;
  page.drawText(`Material Deficiencies: ${materialDefCount}`, {
    x: MARGIN + 10,
    y: yPosition,
    size: 11,
    font,
    color: materialDefCount > 0 ? rgb(0.7, 0, 0) : rgb(0, 0, 0),
  });

  yPosition -= 18;
  page.drawText(`Information Gaps: ${infoGapCount}`, {
    x: MARGIN + 10,
    y: yPosition,
    size: 11,
    font,
    color: infoGapCount > 0 ? rgb(0.6, 0.4, 0) : rgb(0, 0, 0),
  });

  if (fra4Module.data.executive_summary) {
    yPosition -= 30;

    if (yPosition < 200) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    page.drawText('Summary:', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 20;
    const summaryLines = wrapText(fra4Module.data.executive_summary, CONTENT_WIDTH, 11, font);
    for (const line of summaryLines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
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
  }

  if (fra4Module.data.review_recommendation) {
    yPosition -= 20;

    if (yPosition < 200) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    page.drawText('Review Recommendation:', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 20;
    const reviewLines = wrapText(fra4Module.data.review_recommendation, CONTENT_WIDTH, 11, font);
    for (const line of reviewLines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
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
  }

  return yPosition;
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

  yPosition -= 20;
  page.drawText(moduleName, {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 25;

  if (module.outcome) {
    const outcomeLabel = getOutcomeLabel(module.outcome);
    const outcomeColor = getOutcomeColor(module.outcome);

    page.drawText('Outcome:', {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    page.drawRectangle({
      x: MARGIN + 70,
      y: yPosition - 3,
      width: 140,
      height: 18,
      color: outcomeColor,
    });
    page.drawText(outcomeLabel, {
      x: MARGIN + 75,
      y: yPosition,
      size: 10,
      font,
      color: rgb(1, 1, 1),
    });

    yPosition -= 25;
  }

  if (module.assessor_notes && module.assessor_notes.trim()) {
    page.drawText('Assessor Notes:', {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 18;
    const notesLines = wrapText(module.assessor_notes, CONTENT_WIDTH, 10, font);
    for (const line of notesLines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
      }
      page.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }
    yPosition -= 10;
  }

  yPosition = drawModuleKeyDetails(page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  // Draw info gap quick actions if detected
  yPosition = drawInfoGapQuickActions(page, module, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  return yPosition;
}

function safeArray(value: any): string[] {
  if (Array.isArray(value)) return value.filter(v => v != null);
  if (typeof value === 'string') return [value];
  return [];
}

function drawModuleKeyDetails(
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
  const data = module.data || {};
  const keyDetails: Array<[string, string]> = [];

  switch (module.module_key) {
    case 'A1_DOC_CONTROL':
      if (document.responsible_person) keyDetails.push(['Responsible Person', document.responsible_person]);
      if (document.assessor_name) keyDetails.push(['Assessor Name', document.assessor_name]);
      if (document.assessor_role) keyDetails.push(['Assessor Role', document.assessor_role]);
      if (document.assessment_date) keyDetails.push(['Assessment Date', formatDate(document.assessment_date)]);
      if (document.review_date) keyDetails.push(['Review Date', formatDate(document.review_date)]);
      if (document.scope_description) {
        const truncated = document.scope_description.length > 200
          ? document.scope_description.substring(0, 200) + '...'
          : document.scope_description;
        keyDetails.push(['Scope', truncated]);
      }
      if (document.limitations_assumptions) {
        const truncated = document.limitations_assumptions.length > 200
          ? document.limitations_assumptions.substring(0, 200) + '...'
          : document.limitations_assumptions;
        keyDetails.push(['Limitations', truncated]);
      }
      if (document.standards_selected && document.standards_selected.length > 0) {
        keyDetails.push(['Standards Selected', document.standards_selected.join(', ')]);
      }
      break;

    case 'A4_MANAGEMENT_CONTROLS':
      if (data.responsibilities_defined) keyDetails.push(['Responsibilities Defined', data.responsibilities_defined]);
      if (data.fire_safety_policy) keyDetails.push(['Fire Policy Exists', data.fire_safety_policy]);
      if (data.training_induction) keyDetails.push(['Induction Training', data.training_induction]);
      if (data.training_refresher) keyDetails.push(['Refresher Training', data.training_refresher]);
      if (data.ptw_hot_work) keyDetails.push(['PTW Hot Work', data.ptw_hot_work]);
      if (data.testing_records) keyDetails.push(['Testing Records Available', data.testing_records]);
      if (data.housekeeping_rating) keyDetails.push(['Housekeeping Rating', data.housekeeping_rating]);
      if (data.change_management_exists) keyDetails.push(['Change Management Exists', data.change_management_exists]);
      break;

    case 'A5_EMERGENCY_ARRANGEMENTS':
      if (data.emergency_plan_exists) keyDetails.push(['Emergency Plan Exists', data.emergency_plan_exists]);
      if (data.assembly_points_defined) keyDetails.push(['Assembly Points Defined', data.assembly_points_defined]);
      if (data.drill_frequency) keyDetails.push(['Drill Frequency', data.drill_frequency]);
      if (data.peeps_in_place) keyDetails.push(['PEEPs in Place', data.peeps_in_place]);
      if (data.utilities_isolation_known) keyDetails.push(['Utilities Isolation Known', data.utilities_isolation_known]);
      if (data.emergency_services_info) keyDetails.push(['Emergency Services Info', data.emergency_services_info]);
      break;

    case 'FRA_1_HAZARDS':
      if (data.ignition_sources && safeArray(data.ignition_sources).length > 0) {
        keyDetails.push(['Ignition Sources', safeArray(data.ignition_sources).join(', ')]);
      }
      if (data.fuel_sources && safeArray(data.fuel_sources).length > 0) {
        keyDetails.push(['Fuel Sources', safeArray(data.fuel_sources).join(', ')]);
      }
      if (data.oxygen_enrichment) keyDetails.push(['Oxygen Enrichment', data.oxygen_enrichment]);
      if (data.high_risk_activities && safeArray(data.high_risk_activities).length > 0) {
        keyDetails.push(['High-Risk Activities', safeArray(data.high_risk_activities).join(', ')]);
      }
      if (data.arson_risk) keyDetails.push(['Arson Risk', data.arson_risk]);
      if (data.housekeeping_fire_load) keyDetails.push(['Housekeeping Fire Load', data.housekeeping_fire_load]);
      break;

    case 'FRA_2_ESCAPE_ASIS':
      if (data.escape_strategy) keyDetails.push(['Escape Strategy', data.escape_strategy]);
      if (data.travel_distances_compliant) keyDetails.push(['Travel Distances Compliant', data.travel_distances_compliant]);
      if (data.final_exits_adequate) keyDetails.push(['Final Exits Adequate', data.final_exits_adequate]);
      if (data.stair_protection_status) keyDetails.push(['Stair Protection Status', data.stair_protection_status]);
      if (data.signage_adequacy) keyDetails.push(['Signage Adequacy', data.signage_adequacy]);
      if (data.disabled_egress_adequacy) keyDetails.push(['Disabled Egress Adequacy', data.disabled_egress_adequacy]);
      break;

    case 'FRA_3_PROTECTION_ASIS':
      if (data.alarm_present) keyDetails.push(['Alarm Present', data.alarm_present]);
      if (data.alarm_category) keyDetails.push(['Alarm Category', data.alarm_category]);
      if (data.alarm_testing_evidence) keyDetails.push(['Alarm Testing Evidence', data.alarm_testing_evidence]);
      if (data.emergency_lighting_present) keyDetails.push(['Emergency Lighting Present', data.emergency_lighting_present]);
      if (data.emergency_lighting_testing) keyDetails.push(['Emergency Lighting Testing', data.emergency_lighting_testing]);
      if (data.fire_doors_condition) keyDetails.push(['Fire Doors Condition', data.fire_doors_condition]);
      if (data.compartmentation_condition) keyDetails.push(['Compartmentation Condition', data.compartmentation_condition]);
      if (data.fire_stopping_confidence) keyDetails.push(['Fire Stopping Confidence', data.fire_stopping_confidence]);
      if (data.extinguishers_present) keyDetails.push(['Extinguishers Present', data.extinguishers_present]);
      if (data.extinguishers_servicing) keyDetails.push(['Extinguishers Servicing', data.extinguishers_servicing]);
      break;

    case 'FRA_5_EXTERNAL_FIRE_SPREAD':
      if (data.building_height_m) {
        const heightText = `${data.building_height_m}m${data.building_height_m >= 18 ? ' (≥18m)' : ''}`;
        keyDetails.push(['Building Height', heightText]);
      }
      if (data.cladding_present) keyDetails.push(['Cladding Present', data.cladding_present]);
      if (data.insulation_combustibility_known) keyDetails.push(['Insulation Combustibility Known', data.insulation_combustibility_known]);
      if (data.cavity_barriers_status) keyDetails.push(['Cavity Barriers Status', data.cavity_barriers_status]);
      if (data.pas9980_or_equivalent_appraisal) keyDetails.push(['PAS9980 Appraisal Status', data.pas9980_or_equivalent_appraisal]);
      if (data.interim_measures) {
        const truncated = data.interim_measures.length > 150
          ? data.interim_measures.substring(0, 150) + '...'
          : data.interim_measures;
        keyDetails.push(['Interim Measures', truncated]);
      }
      break;

    case 'FRA_4_SIGNIFICANT_FINDINGS':
      if (data.overall_risk_rating) keyDetails.push(['Overall Risk Rating', data.overall_risk_rating.toUpperCase()]);
      if (data.executive_summary) {
        const truncated = data.executive_summary.length > 200
          ? data.executive_summary.substring(0, 200) + '...'
          : data.executive_summary;
        keyDetails.push(['Executive Summary', truncated]);
      }
      if (data.key_assumptions) {
        const truncated = data.key_assumptions.length > 200
          ? data.key_assumptions.substring(0, 200) + '...'
          : data.key_assumptions;
        keyDetails.push(['Key Assumptions', truncated]);
      }
      if (data.review_recommendation) {
        const truncated = data.review_recommendation.length > 200
          ? data.review_recommendation.substring(0, 200) + '...'
          : data.review_recommendation;
        keyDetails.push(['Review Recommendation', truncated]);
      }
      if (data.override_justification) keyDetails.push(['Override Justification', data.override_justification]);
      break;
  }

  if (keyDetails.length === 0) {
    page.drawText('No structured details recorded in this module.', {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    return yPosition - 20;
  }

  page.drawText('Key Details:', {
    x: MARGIN,
    y: yPosition,
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  for (const [label, value] of keyDetails) {
    if (yPosition < MARGIN + 80) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    page.drawText(`${label}:`, {
      x: MARGIN + 5,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    });

    yPosition -= 14;
    const valueLines = wrapText(value, CONTENT_WIDTH - 30, 10, font);
    for (const line of valueLines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
      }
      page.drawText(line, {
        x: MARGIN + 15,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }
    yPosition -= 5;
  }

  return yPosition;
}

function drawInfoGapQuickActions(
  page: PDFPage,
  module: ModuleInstance,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  const detection = detectInfoGaps(module.module_key, module.data, module.outcome);

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

  // Title section with warning icon (using exclamation mark instead of Unicode warning)
  page.drawText(sanitizePdfText('⚠'), {
    x: MARGIN,
    y: yPosition,
    size: 14,
    font,
    color: rgb(0.9, 0.6, 0),
  });

  page.drawText(sanitizePdfText('Information Gaps Detected'), {
    x: MARGIN + 20,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: rgb(0.9, 0.6, 0),
  });

  yPosition -= 25;

  // Reasons
  if (detection.reasons.length > 0) {
    for (const reason of detection.reasons) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
      }

      page.drawText(sanitizePdfText('•'), {
        x: MARGIN + 5,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.6, 0.4, 0),
      });

      const reasonLines = wrapText(reason, CONTENT_WIDTH - 25, 10, font);
      for (const line of reasonLines) {
        if (yPosition < MARGIN + 50) {
          const result = addNewPage(pdfDoc, isDraft, totalPages);
          page = result.page;
          yPosition = PAGE_HEIGHT - MARGIN - 20;
        }
        page.drawText(line, {
          x: MARGIN + 15,
          y: yPosition,
          size: 10,
          font,
          color: rgb(0.5, 0.3, 0),
        });
        yPosition -= 14;
      }
    }
    yPosition -= 10;
  }

  // Quick Actions
  if (detection.quickActions.length > 0) {
    if (yPosition < MARGIN + 100) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    page.drawText('Recommended Actions to Resolve:', {
      x: MARGIN + 5,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0.9, 0.6, 0),
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
  yPosition -= 20;
  page.drawText('ACTION REGISTER', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  // Build rating map (latest per action)
  const ratingMap = new Map<string, ActionRating>();
  for (const rating of actionRatings) {
    const existing = ratingMap.get(rating.action_id);
    if (!existing || new Date(rating.rated_at) > new Date(existing.rated_at)) {
      ratingMap.set(rating.action_id, rating);
    }
  }

  // Sort actions: open/in_progress first, then by priority, then by target_date, then by created_at desc
  const sortedActions = [...actions].sort((a, b) => {
    const aComplete = a.status === 'complete';
    const bComplete = b.status === 'complete';
    if (aComplete !== bComplete) return aComplete ? 1 : -1;

    const priorityOrder = ['P1', 'P2', 'P3', 'P4'];
    const aPriority = priorityOrder.indexOf(a.priority_band || 'P4');
    const bPriority = priorityOrder.indexOf(b.priority_band || 'P4');
    if (aPriority !== bPriority) return aPriority - bPriority;

    if (a.target_date && b.target_date) {
      const dateCompare = new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
      if (dateCompare !== 0) return dateCompare;
    }
    if (a.target_date && !b.target_date) return -1;
    if (!a.target_date && b.target_date) return 1;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (sortedActions.length === 0) {
    page.drawText('No actions have been created for this assessment.', {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    return yPosition - 20;
  }

  for (const action of sortedActions) {
    if (!action.recommended_action || typeof action.recommended_action !== 'string') {
      console.warn('[PDF] Action missing recommended_action:', {
        id: action.id,
        recommended_action: action.recommended_action,
        priority_band: action.priority_band,
        status: action.status,
      });
    }

    if (yPosition < MARGIN + 120) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    const priorityBand = action.priority_band || 'P4';
    const priorityColor = getPriorityColor(priorityBand);
    page.drawRectangle({
      x: MARGIN,
      y: yPosition - 3,
      width: 30,
      height: 16,
      color: priorityColor,
    });
    page.drawText(priorityBand, {
      x: MARGIN + 4,
      y: yPosition,
      size: 9,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    // Get latest rating
    const rating = ratingMap.get(action.id);
    if (rating) {
      page.drawText(`L${rating.likelihood} × I${rating.impact} = ${rating.score}`, {
        x: MARGIN + 35,
        y: yPosition,
        size: 9,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
    } else {
      page.drawText('(Rating not set)', {
        x: MARGIN + 35,
        y: yPosition,
        size: 9,
        font,
        color: rgb(0.6, 0.6, 0.6),
      });
    }

    yPosition -= 18;

    const actionText = action.recommended_action || '(No action text provided)';
    const actionLines = wrapText(actionText, CONTENT_WIDTH - 10, 10, font);
    for (const line of actionLines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
      }
      page.drawText(line, {
        x: MARGIN + 5,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      yPosition -= 14;
    }

    const metaInfo: string[] = [];
    const owner = action.owner_display_name || '(Unassigned)';
    metaInfo.push(`Owner: ${owner}`);
    if (action.target_date) {
      metaInfo.push(`Target: ${formatDate(action.target_date)}`);
    }
    const status = action.status || 'open';
    metaInfo.push(`Status: ${status}`);

    page.drawText(metaInfo.join(' | '), {
      x: MARGIN + 5,
      y: yPosition,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
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

  return yPosition;
}

function drawAssumptionsAndLimitations(
  page: PDFPage,
  document: Document,
  fra4Module: ModuleInstance | undefined,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  yPosition -= 20;
  page.drawText('ASSUMPTIONS & LIMITATIONS', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  const hasDocumentLimitations = document.limitations_assumptions && document.limitations_assumptions.trim();
  const hasFra4Assumptions = fra4Module?.data?.key_assumptions && fra4Module.data.key_assumptions.trim();

  if (!hasDocumentLimitations && !hasFra4Assumptions) {
    page.drawText('No specific assumptions or limitations recorded.', {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    return yPosition - 20;
  }

  if (hasDocumentLimitations) {
    page.drawText('Assessment Limitations:', {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 18;
    const limitationLines = wrapText(document.limitations_assumptions!, CONTENT_WIDTH, 10, font);
    for (const line of limitationLines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
      }
      page.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }
    yPosition -= 10;
  }

  if (hasFra4Assumptions) {
    if (yPosition < MARGIN + 100) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    page.drawText('Key Assumptions:', {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 18;
    const assumptionLines = wrapText(fra4Module!.data.key_assumptions, CONTENT_WIDTH, 10, font);
    for (const line of assumptionLines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
      }
      page.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }
  }

  if (document.scope_description && document.scope_description.trim()) {
    yPosition -= 20;

    if (yPosition < MARGIN + 100) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    page.drawText('Scope:', {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 18;
    const scopeLines = wrapText(document.scope_description, CONTENT_WIDTH, 10, font);
    for (const line of scopeLines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
      }
      page.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }
  }

  return yPosition;
}

function drawRegulatoryFramework(
  page: PDFPage,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  yPosition -= 20;
  page.drawText('REGULATORY FRAMEWORK', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  const paragraphs = fraRegulatoryFrameworkText.split('\n\n');
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;

    const lines = wrapText(paragraph, CONTENT_WIDTH, 11, font);
    for (const line of lines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
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

    yPosition -= 8;
  }

  return yPosition;
}

function drawResponsiblePersonDuties(
  page: PDFPage,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  yPosition -= 20;
  page.drawText('WHAT IS REQUIRED OF THE RESPONSIBLE PERSON', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  const paragraphs = fraResponsiblePersonDutiesText.split('\n\n');
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;

    if (paragraph.startsWith('**') && paragraph.includes('**')) {
      const match = paragraph.match(/\*\*(.+?)\*\*:?\s*(.*)/s);
      if (match) {
        const heading = match[1];
        const content = match[2];

        if (yPosition < MARGIN + 100) {
          const result = addNewPage(pdfDoc, isDraft, totalPages);
          page = result.page;
          yPosition = PAGE_HEIGHT - MARGIN - 20;
        }

        page.drawText(heading, {
          x: MARGIN,
          y: yPosition,
          size: 11,
          font: fontBold,
          color: rgb(0, 0, 0),
        });

        yPosition -= 18;

        if (content.trim()) {
          const lines = wrapText(content, CONTENT_WIDTH, 11, font);
          for (const line of lines) {
            if (yPosition < MARGIN + 50) {
              const result = addNewPage(pdfDoc, isDraft, totalPages);
              page = result.page;
              yPosition = PAGE_HEIGHT - MARGIN - 20;
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
        }

        yPosition -= 8;
      }
    } else {
      const lines = wrapText(paragraph, CONTENT_WIDTH, 11, font);
      for (const line of lines) {
        if (yPosition < MARGIN + 50) {
          const result = addNewPage(pdfDoc, isDraft, totalPages);
          page = result.page;
          yPosition = PAGE_HEIGHT - MARGIN - 20;
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

      yPosition -= 8;
    }
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
  yPosition -= 20;
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
    return yPosition - 20;
  }

  for (let i = 0; i < attachments.length; i++) {
    const attachment = attachments[i];

    if (yPosition < MARGIN + 100) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

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
          const result = addNewPage(pdfDoc, isDraft, totalPages);
          page = result.page;
          yPosition = PAGE_HEIGHT - MARGIN - 20;
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

  return yPosition;
}
