import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import { getModuleName } from '../modules/moduleCatalog';
import { detectInfoGaps } from '../../utils/infoGapQuickActions';
import { listAttachments, type Attachment } from '../supabase/attachments';
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN,
  CONTENT_WIDTH,
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

export async function buildDsearPdf(options: BuildPdfOptions): Promise<Uint8Array> {
  const { document, moduleInstances, actions, actionRatings, organisation } = options;

  let attachments: Attachment[] = [];
  try {
    attachments = await listAttachments(document.id);
    console.log('[DSEAR PDF] Fetched', attachments.length, 'attachments');
  } catch (error) {
    console.warn('[DSEAR PDF] Failed to fetch attachments:', error);
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

  // SECTION 1: Cover Page
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

  // SECTION 2: Executive Summary (NO OVERALL RATING)
  const result1 = addNewPage(pdfDoc, isDraft, totalPages);
  page = result1.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawExecutiveSummary(page, moduleInstances, actions, actionRatings, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  // SECTION 3-12: Module Sections
  const sortedModules = sortModules(moduleInstances);
  for (const module of sortedModules) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawModuleSection(page, module, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  // SECTION 13: Action Register
  const result2 = addNewPage(pdfDoc, isDraft, totalPages);
  page = result2.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawActionRegister(page, actions, actionRatings, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  // SECTION 13.5: Attachments Index
  if (attachments.length > 0) {
    const result2b = addNewPage(pdfDoc, isDraft, totalPages);
    page = result2b.page;
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawAttachmentsIndex(page, attachments, sortedModules, actions, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  // SECTION 14: Information Gaps Appendix
  const infoGaps = detectInfoGaps(moduleInstances);
  if (infoGaps.length > 0) {
    const result3 = addNewPage(pdfDoc, isDraft, totalPages);
    page = result3.page;
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawInfoGapsAppendix(page, infoGaps, actions, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  // Add footers to all pages
  totalPages.forEach((p, idx) => {
    drawFooter(p, idx + 1, totalPages.length, document.title, font);
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
  yPosition: number
): number {
  const centerX = PAGE_WIDTH / 2;

  page.drawText(sanitizePdfText('DSEAR / Explosion Risk Assessment'), {
    x: centerX - fontBold.widthOfTextAtSize(sanitizePdfText('DSEAR / Explosion Risk Assessment'), 24) / 2,
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
  const metadata = [
    ['Organisation', organisation.name],
    ['Assessment Date', formatDate(document.assessment_date)],
    ['Version', `v${document.version}`],
    ['Status', document.status.toUpperCase()],
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
): number {
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

  // Priority actions summary
  const p1Count = actions.filter(a => a.priority_band === 'P1').length;
  const p2Count = actions.filter(a => a.priority_band === 'P2').length;
  const p34Count = actions.filter(a => ['P3', 'P4'].includes(a.priority_band)).length;

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

  // Risk profile statement (NO OVERALL RATING)
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
  wrappedRisk.forEach(line => {
    page.drawText(sanitizePdfText(line), {
      x: MARGIN + 20,
      y: yPosition,
      size: 10,
      font: font,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 14;
  });

  return yPosition;
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
  const moduleName = getModuleName(module.module_key);

  page.drawText(sanitizePdfText(moduleName), {
    x: MARGIN,
    y: yPosition,
    size: 14,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 25;

  // Draw module-specific content
  yPosition = drawModuleContent(page, module, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  // Draw assessor notes
  if (module.assessor_notes) {
    if (yPosition < 150) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN;
    }

    page.drawText(sanitizePdfText('Assessor Notes:'), {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 15;

    const wrappedNotes = wrapText(module.assessor_notes, CONTENT_WIDTH, 9, font);
    wrappedNotes.forEach(line => {
      if (yPosition < 80) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN;
      }
      page.drawText(sanitizePdfText(line), {
        x: MARGIN,
        y: yPosition,
        size: 9,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 12;
    });
  }

  return yPosition;
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
): number {
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
): number {
  if (!substances || substances.length === 0) {
    page.drawText(sanitizePdfText('No substances recorded'), {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
    return yPosition - 20;
  }

  substances.forEach((substance, idx) => {
    if (yPosition < 150) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN;
    }

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

    details.forEach(detail => {
      page.drawText(sanitizePdfText(detail), {
        x: MARGIN + 20,
        y: yPosition,
        size: 9,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 12;
    });
    yPosition -= 5;
  });

  return yPosition;
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
): number {
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
    zones.forEach((zone, idx) => {
      if (yPosition < 120) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN;
      }

      page.drawText(sanitizePdfText(`Zone ${zone.zone_type || '?'}: ${zone.extent_description || 'No description'}`), {
        x: MARGIN,
        y: yPosition,
        size: 9,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      yPosition -= 14;
    });
  }

  if (drawingsRef) {
    if (yPosition < 80) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN;
    }
    page.drawText(sanitizePdfText('Drawings Reference:'), {
      x: MARGIN,
      y: yPosition,
      size: 9,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 14;
    const wrapped = wrapText(drawingsRef, CONTENT_WIDTH - 20, 9, font);
    wrapped.forEach(line => {
      page.drawText(sanitizePdfText(line), {
        x: MARGIN + 20,
        y: yPosition,
        size: 9,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 12;
    });
  }

  return yPosition;
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
): number {
  if (!riskRows || riskRows.length === 0) {
    page.drawText(sanitizePdfText('No risk rows recorded'), {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
    return yPosition - 20;
  }

  riskRows.forEach((row, idx) => {
    if (yPosition < 150) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN;
    }

    page.drawText(sanitizePdfText(`${idx + 1}. ${row.activity || 'Activity not specified'}`), {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 14;

    const details = [
      `Hazard: ${row.hazard || '-'}`,
      `Likelihood: ${row.likelihood || '-'}, Severity: ${row.severity || '-'}`,
      `Residual Risk: ${row.residual_risk || '-'}`,
    ];

    details.forEach(detail => {
      page.drawText(sanitizePdfText(detail), {
        x: MARGIN + 20,
        y: yPosition,
        size: 9,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 12;
    });
    yPosition -= 5;
  });

  return yPosition;
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
): number {
  const keys = Object.keys(data).filter(k => k !== 'notes');

  if (keys.length === 0) {
    page.drawText(sanitizePdfText('No data recorded'), {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
    return yPosition - 20;
  }

  keys.slice(0, 5).forEach(key => {
    if (yPosition < 100) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN;
    }

    const value = data[key];
    const displayValue = typeof value === 'object' ? JSON.stringify(value).substring(0, 100) : String(value);

    const wrapped = wrapText(`${key}: ${displayValue}`, CONTENT_WIDTH, 9, font);
    wrapped.slice(0, 2).forEach(line => {
      page.drawText(sanitizePdfText(line), {
        x: MARGIN,
        y: yPosition,
        size: 9,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 12;
    });
    yPosition -= 3;
  });

  return yPosition;
}

function drawActionRegister(
  page: PDFPage,
  actions: Action[],
  actionRatings: ActionRating[],
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  page.drawText(sanitizePdfText('Action Register'), {
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

  const sortedActions = [...actions].sort((a, b) => {
    const priority = { P1: 1, P2: 2, P3: 3, P4: 4 };
    return (priority[a.priority_band as keyof typeof priority] || 999) - (priority[b.priority_band as keyof typeof priority] || 999);
  });

  sortedActions.forEach((action, idx) => {
    if (yPosition < 120) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN;
    }

    const rating = actionRatings.find(r => r.action_id === action.id);
    const lxi = rating ? `L${rating.likelihood}xI${rating.impact}` : '-';

    page.drawText(sanitizePdfText(`[${action.priority_band}] ${action.recommended_action}`), {
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
    yPosition -= 15;
  });

  return yPosition;
}

function drawInfoGapsAppendix(
  page: PDFPage,
  infoGaps: any[],
  actions: Action[],
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  page.drawText(sanitizePdfText('Appendix: Information Gaps'), {
    x: MARGIN,
    y: yPosition,
    size: 14,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 25;

  infoGaps.forEach((gap, idx) => {
    if (yPosition < 100) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN;
    }

    page.drawText(sanitizePdfText(`${idx + 1}. ${gap.moduleName || 'Unknown Module'}`), {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 14;

    const wrapped = wrapText(gap.description || 'No description', CONTENT_WIDTH - 20, 9, font);
    wrapped.forEach(line => {
      if (yPosition < 80) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN;
      }
      page.drawText(sanitizePdfText(line), {
        x: MARGIN + 20,
        y: yPosition,
        size: 9,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 12;
    });
    yPosition -= 5;
  });

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
