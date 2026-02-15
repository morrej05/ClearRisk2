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

export async function buildDsearPdf(options: BuildPdfOptions): Promise<Uint8Array> {
  const { document, moduleInstances, actions, actionRatings, organisation, renderMode } = options;

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

  const isIssuedMode = renderMode === 'issued';
  const isDraft = !isIssuedMode;
  const totalPages: PDFPage[] = [];

  console.log('[DSEAR PDF] Render mode:', isIssuedMode ? 'ISSUED' : 'DRAFT');
  console.log('[DSEAR PDF] Adding report pages with logo (cover + doc control)');

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
      name: document.responsible_person,
      site: document.scope_description,
    },
    fonts: { bold: fontBold, regular: font },
  });
  totalPages.push(coverPage, docControlPage);

  let page: PDFPage;
  let yPosition: number;

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

  // SECTION 3: Purpose and Introduction (Neutral)
  const purposeResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = purposeResult.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawPurposeAndIntroduction(page, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  // SECTION 4: Hazardous Area Classification Methodology (Canned Text)
  const hacResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = hacResult.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawHazardousAreaClassification(page, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  // SECTION 5: Zone Definitions (Canned Text)
  const zoneResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = zoneResult.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawZoneDefinitions(page, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  // SECTION 6: Scope
  if (document.scope_description) {
    const scopeResult = addNewPage(pdfDoc, isDraft, totalPages);
    page = scopeResult.page;
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawScope(page, document.scope_description, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  // SECTION 7: Limitations and Assumptions
  if (document.limitations_assumptions) {
    const limResult = addNewPage(pdfDoc, isDraft, totalPages);
    page = limResult.page;
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawLimitations(page, document.limitations_assumptions, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  // SECTION 8+: Module Sections
  const sortedModules = sortModules(moduleInstances);
  for (const module of sortedModules) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawModuleSection(page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  // SECTION 12: References and Compliance (Jurisdiction-specific)
  const refResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = refResult.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawReferencesAndCompliance(page, document.jurisdiction as Jurisdiction, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

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

  // Draw info gap quick actions if detected
  yPosition = drawInfoGapQuickActions(page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

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
    yPosition = PAGE_HEIGHT - MARGIN;
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
        yPosition = PAGE_HEIGHT - MARGIN;
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
          yPosition = PAGE_HEIGHT - MARGIN;
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
      yPosition = PAGE_HEIGHT - MARGIN;
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
        yPosition = PAGE_HEIGHT - MARGIN;
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
          yPosition = PAGE_HEIGHT - MARGIN;
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
          yPosition = PAGE_HEIGHT - MARGIN;
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
        yPosition = PAGE_HEIGHT - MARGIN;
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

function drawHazardousAreaClassification(
  page: PDFPage,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  yPosition -= 20;
  page.drawText('HAZARDOUS AREA CLASSIFICATION METHODOLOGY', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  const paragraphs = hazardousAreaClassificationText.split('\n\n');
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

function drawZoneDefinitions(
  page: PDFPage,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  yPosition -= 20;
  page.drawText('ZONE DEFINITIONS', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  const paragraphs = zoneDefinitionsText.split('\n\n');
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;

    if (paragraph.startsWith('**') && paragraph.includes('**')) {
      const match = paragraph.match(/\*\*(.+?)\*\*\s*(.*)/s);
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
          size: 12,
          font: fontBold,
          color: rgb(0, 0, 0),
        });

        yPosition -= 20;

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

        yPosition -= 10;
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

function drawScope(
  page: PDFPage,
  scopeText: string,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  yPosition -= 20;
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

  return yPosition;
}

function drawPurposeAndIntroduction(
  page: PDFPage,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  yPosition -= 20;
  page.drawText('PURPOSE AND INTRODUCTION', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  const sanitized = sanitizePdfText(explosiveAtmospheresPurposeText);
  const lines = wrapText(sanitized, CONTENT_WIDTH, 11, font);

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

  return yPosition;
}

function drawLimitations(
  page: PDFPage,
  limitationsText: string,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  yPosition -= 20;
  page.drawText('LIMITATIONS AND ASSUMPTIONS', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  const sanitized = sanitizePdfText(limitationsText);
  const lines = wrapText(sanitized, CONTENT_WIDTH, 11, font);

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

  return yPosition;
}

function drawReferencesAndCompliance(
  page: PDFPage,
  jurisdiction: Jurisdiction,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  yPosition -= 20;
  page.drawText('REFERENCES AND COMPLIANCE', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  const references = getExplosiveAtmospheresReferences(jurisdiction);

  for (const ref of references) {
    if (yPosition < MARGIN + 80) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    page.drawText(sanitizePdfText(`• ${ref.label}`), {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 16;

    if (ref.detail) {
      const detailLines = wrapText(sanitizePdfText(ref.detail), CONTENT_WIDTH - 20, 10, font);
      for (const line of detailLines) {
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
    }

    yPosition -= 8;
  }

  return yPosition;
}
