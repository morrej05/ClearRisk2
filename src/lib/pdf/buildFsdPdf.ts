import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import { getModuleName } from '../modules/moduleCatalog';
import { detectInfoGaps } from '../../utils/infoGapQuickActions';
import { listAttachments, type Attachment } from '../supabase/attachments';
import {
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
  getOutcomeColor,
  getOutcomeLabel,
  getPriorityColor,
  addNewPage,
  drawFooter,
  addExecutiveSummaryPages,
  addSupersededWatermark,
  drawDraftWatermark,
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

export async function buildFsdPdf(options: BuildFsdPdfOptions): Promise<Uint8Array> {
  const { document, moduleInstances, actions, actionRatings, organisation, renderMode } = options;

  console.log('[FSD PDF] Building PDF with:', {
    modules: moduleInstances.length,
    actions: actions.length,
    ratings: actionRatings.length,
  });

  let attachments: Attachment[] = [];
  try {
    attachments = await listAttachments(document.id);
    console.log('[FSD PDF] Fetched', attachments.length, 'attachments');
  } catch (error) {
    console.warn('[FSD PDF] Failed to fetch attachments:', error);
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const isIssuedMode = renderMode === 'issued';
  const isDraft = !isIssuedMode;
  const totalPages: PDFPage[] = [];

  console.log('[FSD PDF] Render mode:', isIssuedMode ? 'ISSUED' : 'DRAFT');
  console.log('[FSD PDF] Adding report pages with logo (cover + doc control)');

  // Use addIssuedReportPages for both draft and issued modes to ensure logo embedding
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
      name: document.responsible_person,
      site: document.scope_description,
    },
    fonts: { bold: fontBold, regular: font },
  });
  totalPages.push(coverPage, docControlPage);

  addExecutiveSummaryPages(
    pdfDoc,
    isDraft,
    totalPages,
    (document.executive_summary_mode as 'ai' | 'author' | 'both' | 'none') || 'none',
    document.executive_summary_ai,
    document.executive_summary_author,
    { bold: fontBold, regular: font }
  );

  ({ page } = addNewPage(pdfDoc, isDraft, totalPages));
  page = drawPurposeAndScope(page, pdfDoc, isDraft, totalPages, font, fontBold);

  if (document.scope_description) {
    ({ page } = addNewPage(pdfDoc, isDraft, totalPages));
    page = drawDocumentScope(page, document.scope_description, pdfDoc, isDraft, totalPages, font, fontBold);
  }

  ({ page } = addNewPage(pdfDoc, isDraft, totalPages));
  page = drawFsdLimitations(page, pdfDoc, isDraft, totalPages, font, fontBold);

  if (document.limitations_assumptions) {
    page = drawDocumentLimitations(page, document.limitations_assumptions, pdfDoc, isDraft, totalPages, font, fontBold);
  }

  const sortedModules = sortModules(moduleInstances);
  for (const moduleInstance of sortedModules) {
    ({ page } = drawModuleSummary(page, moduleInstance, document, pdfDoc, isDraft, totalPages, font, fontBold));
  }

  if (actions.length > 0) {
    ({ page } = drawActionRegister(page, actions, actionRatings, moduleInstances, pdfDoc, isDraft, totalPages, font, fontBold));
  }

  if (attachments.length > 0) {
    ({ page } = drawAttachmentsIndex(page, attachments, moduleInstances, actions, pdfDoc, isDraft, totalPages, font, fontBold));
  }

  for (let i = 0; i < totalPages.length; i++) {
    drawFooter(
      totalPages[i],
      `${sanitizePdfText(document.title)} - Fire Strategy Document`,
      i + 1,
      totalPages.length,
      font
    );
  }

  if (document.issue_status === 'superseded') {
    await addSupersededWatermark(pdfDoc);
  }

  const pdfBytes = await pdfDoc.save();
  console.log('[FSD PDF] PDF generated successfully');
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
  renderMode?: 'preview' | 'issued'
) {
  let yPosition = PAGE_HEIGHT - 150;

  page.drawText(sanitizePdfText(organisation.name), {
    x: MARGIN,
    y: yPosition,
    size: 14,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  yPosition -= 60;

  page.drawText('Fire Strategy Document', {
    x: MARGIN,
    y: yPosition,
    size: 24,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  yPosition -= 40;

  const titleLines = wrapText(document.title, CONTENT_WIDTH, 18, fontBold);
  for (const line of titleLines) {
    page.drawText(line, {
      x: MARGIN,
      y: yPosition,
      size: 18,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 24;
  }
  yPosition -= 20;

  const leftCol = MARGIN;
  const rightCol = MARGIN + 180;

  let issueStatus = renderMode === 'issued' ? 'issued' : ((document as any).issue_status || document.status);

  const fields = [
    ['Status:', document.status === 'draft' ? 'DRAFT' : 'Final'],
    ['Version:', `v${document.version}`],
    ['Assessment Date:', formatDate(document.assessment_date)],
    ['Review Date:', formatDate(document.review_date)],
    ['Assessor:', sanitizePdfText(document.assessor_name || '-')],
    ['Role:', sanitizePdfText(document.assessor_role || '-')],
    ['Responsible Person:', sanitizePdfText(document.responsible_person || '-')],
  ];

  for (const [label, value] of fields) {
    page.drawText(sanitizePdfText(label), {
      x: leftCol,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    });
    page.drawText(sanitizePdfText(value), {
      x: rightCol,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 18;
  }

  yPosition = 150;
  page.drawText('Generated on ' + formatDate(new Date().toISOString()), {
    x: MARGIN,
    y: yPosition,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
}

function drawExecutiveSummary(
  page: PDFPage,
  document: Document,
  moduleInstances: ModuleInstance[],
  actions: Action[],
  font: any,
  fontBold: any
) {
  let yPosition = PAGE_HEIGHT - MARGIN - 20;

  page.drawText('Executive Summary', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  yPosition -= 30;

  const fsd1 = moduleInstances.find((m) => m.module_key === 'FSD_1_REG_BASIS');
  const fsd2 = moduleInstances.find((m) => m.module_key === 'FSD_2_EVAC_STRATEGY');
  const a2 = moduleInstances.find((m) => m.module_key === 'A2_BUILDING_PROFILE');

  page.drawText('Strategy Framework', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 18;

  const framework = fsd1?.data?.regulatory_framework_selected || 'Not specified';
  const frameworkLines = wrapText(`Framework: ${framework}`, CONTENT_WIDTH, 10, font);
  for (const line of frameworkLines) {
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

  page.drawText('Building Overview', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 18;

  if (a2) {
    const height = a2.data.building_height_m ? `${a2.data.building_height_m}m` : 'Not specified';
    const storeys = a2.data.number_of_storeys || 'Not specified';
    const use = a2.data.primary_use || 'Not specified';

    const buildingInfo = `Height: ${height}, Storeys: ${storeys}, Use: ${use}`;
    const buildingLines = wrapText(buildingInfo, CONTENT_WIDTH, 10, font);
    for (const line of buildingLines) {
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
  yPosition -= 10;

  page.drawText('Evacuation Strategy', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 18;

  const evacStrategy = fsd2?.data?.evacuation_strategy_type || 'Not specified';
  const evacLines = wrapText(`Strategy: ${evacStrategy}`, CONTENT_WIDTH, 10, font);
  for (const line of evacLines) {
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

  page.drawText('Actions Summary', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 18;

  const p1Count = actions.filter((a) => a.priority_band === 'P1').length;
  const p2Count = actions.filter((a) => a.priority_band === 'P2').length;
  const p3Count = actions.filter((a) => a.priority_band === 'P3').length;
  const p4Count = actions.filter((a) => a.priority_band === 'P4').length;

  page.drawText(sanitizePdfText(`Total Actions: ${actions.length} (P1: ${p1Count}, P2: ${p2Count}, P3: ${p3Count}, P4: ${p4Count})`), {
    x: MARGIN,
    y: yPosition,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });
}

function drawModuleSummary(
  page: PDFPage,
  moduleInstance: ModuleInstance,
  document: Document,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  font: any,
  fontBold: any
): { page: PDFPage } {
  let yPosition = PAGE_HEIGHT - MARGIN - 20;

  if (yPosition < MARGIN + 150) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN - 20;
  }

  const moduleName = getModuleName(moduleInstance.module_key);
  page.drawText(sanitizePdfText(moduleName), {
    x: MARGIN,
    y: yPosition,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  yPosition -= 25;

  const outcome = moduleInstance.outcome || 'pending';
  const outcomeLabel = getOutcomeLabel(outcome);
  const outcomeColor = getOutcomeColor(outcome);

  page.drawRectangle({
    x: MARGIN,
    y: yPosition - 12,
    width: 120,
    height: 16,
    color: outcomeColor,
  });

  page.drawText(sanitizePdfText(`Outcome: ${outcomeLabel}`), {
    x: MARGIN + 5,
    y: yPosition - 10,
    size: 9,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  yPosition -= 30;

  if (moduleInstance.assessor_notes && moduleInstance.assessor_notes.trim()) {
    page.drawText('Assessor Notes:', {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 16;

    const notesLines = wrapText(moduleInstance.assessor_notes, CONTENT_WIDTH, 9, font);
    for (const line of notesLines) {
      if (yPosition < MARGIN + 40) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
      }
      page.drawText(line, {
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

  yPosition = drawModuleKeyDetails(page, moduleInstance, yPosition, pdfDoc, isDraft, totalPages, font, fontBold);

  // Draw info gap quick actions if detected
  yPosition = drawInfoGapQuickActions(page, moduleInstance, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  yPosition -= 15;

  return { page };
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
): number {
  let yPosition = startY;
  const data = moduleInstance.data;

  if (!data || Object.keys(data).length === 0) {
    return yPosition;
  }

  page.drawText('Key Details:', {
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
      if (data.fire_safety_objectives) details.push(`Objectives: ${data.fire_safety_objectives}`);
      if (data.deviations_from_guidance && Array.isArray(data.deviations_from_guidance)) {
        details.push(`Deviations: ${data.deviations_from_guidance.length} noted`);
      }
      break;

    case 'FSD_2_EVAC_STRATEGY':
      if (data.evacuation_strategy_type) details.push(`Strategy: ${data.evacuation_strategy_type}`);
      if (data.alarm_communication_method) details.push(`Alarm: ${data.alarm_communication_method}`);
      break;

    case 'FSD_3_ESCAPE_DESIGN':
      if (data.travel_distance_basis) details.push(`Travel basis: ${data.travel_distance_basis}`);
      if (data.exit_capacity_calculation_done) details.push(`Exit calcs: ${data.exit_capacity_calculation_done}`);
      if (data.stairs_strategy) details.push(`Stairs: ${data.stairs_strategy}`);
      break;

    case 'FSD_4_PASSIVE_PROTECTION':
      if (data.fire_resistance_standard) details.push(`FR Standard: ${data.fire_resistance_standard}`);
      if (data.compartmentation_strategy) details.push(`Compartmentation: ${data.compartmentation_strategy}`);
      break;

    case 'FSD_5_ACTIVE_SYSTEMS':
      if (data.detection_alarm_design_category) details.push(`Detection: ${data.detection_alarm_design_category}`);
      if (data.sprinkler_provision) details.push(`Sprinklers: ${data.sprinkler_provision}`);
      if (data.sprinkler_standard && data.sprinkler_provision === 'yes') {
        details.push(`Sprinkler std: ${data.sprinkler_standard}`);
      }
      break;

    case 'FSD_6_FRS_ACCESS':
      if (data.water_supplies_hydrants) details.push(`Hydrants: ${data.water_supplies_hydrants}`);
      if (data.dry_riser) details.push(`Dry riser: ${data.dry_riser}`);
      if (data.wet_riser) details.push(`Wet riser: ${data.wet_riser}`);
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
    if (yPosition < MARGIN + 40) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    const lines = wrapText(detail, CONTENT_WIDTH - 10, 9, font);
    for (const line of lines) {
      page.drawText(`• ${line}`, {
        x: MARGIN + 10,
        y: yPosition,
        size: 9,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 12;
    }
  }

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
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  font: any,
  fontBold: any
): { page: PDFPage } {
  let yPosition = PAGE_HEIGHT - MARGIN - 20;

  if (yPosition < MARGIN + 200) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN - 20;
  }

  page.drawText('Action Register', {
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

  page.drawText('#', { x: colX1, y: yPosition, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Action', { x: colX1 + 15, y: yPosition, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Priority', { x: colX2, y: yPosition, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Status', { x: colX3, y: yPosition, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Target', { x: colX4, y: yPosition, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  yPosition -= rowHeight + 2;

  page.drawLine({
    start: { x: MARGIN, y: yPosition + 2 },
    end: { x: PAGE_WIDTH - MARGIN, y: yPosition + 2 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  yPosition -= 4;

  const sortedActions = [...actions].sort((a, b) => {
    const priorityOrder = { P1: 0, P2: 1, P3: 2, P4: 3 };
    return (priorityOrder[a.priority_band as keyof typeof priorityOrder] || 4) -
           (priorityOrder[b.priority_band as keyof typeof priorityOrder] || 4);
  });

  sortedActions.forEach((action, index) => {
    if (yPosition < MARGIN + 60) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    const actionLines = wrapText(action.recommended_action, 300, 7, font);
    const firstLine = actionLines[0] || '';

    page.drawText(`${index + 1}`, {
      x: colX1,
      y: yPosition,
      size: 7,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    page.drawText(firstLine, {
      x: colX1 + 15,
      y: yPosition,
      size: 7,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    const priorityColor = getPriorityColor(action.priority_band);
    page.drawRectangle({
      x: colX2,
      y: yPosition - 2,
      width: 30,
      height: 10,
      color: priorityColor,
    });
    page.drawText(sanitizePdfText(action.priority_band), {
      x: colX2 + 5,
      y: yPosition,
      size: 7,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawText(sanitizePdfText(action.status), {
      x: colX3,
      y: yPosition,
      size: 7,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    page.drawText(formatDate(action.target_date), {
      x: colX4,
      y: yPosition,
      size: 7,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    yPosition -= rowHeight;
  });

  return { page };
}

function drawAssumptionsAndLimitations(
  page: PDFPage,
  document: Document,
  moduleInstances: ModuleInstance[],
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  font: any,
  fontBold: any
): { page: PDFPage } {
  let yPosition = PAGE_HEIGHT - MARGIN - 20;

  if (yPosition < MARGIN + 150) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN - 20;
  }

  page.drawText('Assumptions & Limitations', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  yPosition -= 30;

  if (document.limitations_assumptions && document.limitations_assumptions.trim()) {
    const lines = wrapText(document.limitations_assumptions, CONTENT_WIDTH, 10, font);
    for (const line of lines) {
      if (yPosition < MARGIN + 40) {
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
  } else {
    page.drawText('No specific assumptions or limitations documented.', {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  return { page };
}

function drawAttachmentsIndex(
  page: PDFPage,
  attachments: Attachment[],
  moduleInstances: ModuleInstance[],
  actions: Action[],
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  font: any,
  fontBold: any
): { page: PDFPage } {
  ({ page } = addNewPage(pdfDoc, isDraft, totalPages));
  let yPosition = PAGE_HEIGHT - MARGIN - 20;

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
    return { page };
  }

  for (let i = 0; i < attachments.length; i++) {
    const attachment = attachments[i];

    if (yPosition < MARGIN + 100) {
      ({ page } = addNewPage(pdfDoc, isDraft, totalPages));
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
          ({ page } = addNewPage(pdfDoc, isDraft, totalPages));
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

  return { page };
}

function drawPurposeAndScope(
  page: PDFPage,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  font: any,
  fontBold: any
): PDFPage {
  let yPosition = PAGE_HEIGHT - MARGIN - 20;

  page.drawText('PURPOSE AND SCOPE', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  const paragraphs = fsdPurposeAndScopeText.split('\n\n');
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;

    const lines = wrapText(paragraph, CONTENT_WIDTH, 11, font);
    for (const line of lines) {
      if (yPosition < MARGIN + 50) {
        ({ page } = addNewPage(pdfDoc, isDraft, totalPages));
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

  return page;
}

function drawFsdLimitations(
  page: PDFPage,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  font: any,
  fontBold: any
): PDFPage {
  let yPosition = PAGE_HEIGHT - MARGIN - 20;

  page.drawText('LIMITATIONS AND ASSUMPTIONS', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  const paragraphs = fsdLimitationsText.split('\n\n');
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;

    const lines = wrapText(paragraph, CONTENT_WIDTH, 11, font);
    for (const line of lines) {
      if (yPosition < MARGIN + 50) {
        ({ page } = addNewPage(pdfDoc, isDraft, totalPages));
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

  return page;
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
  let yPosition = PAGE_HEIGHT - MARGIN - 20;

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
  let yPosition = PAGE_HEIGHT - MARGIN - 20;

  if (totalPages[totalPages.length - 1] === page) {
    yPosition = PAGE_HEIGHT - MARGIN - 60;
  }

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

  return page;
}
