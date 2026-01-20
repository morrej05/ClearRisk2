import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';

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
  action: string;
  likelihood: number;
  impact: number;
  priority_score: number;
  priority_band: string;
  status: string;
  owner: string | null;
  target_date: string | null;
  module_instance_id: string;
}

interface Organisation {
  id: string;
  name: string;
}

interface BuildPdfOptions {
  document: Document;
  moduleInstances: ModuleInstance[];
  actions: Action[];
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

const MODULE_NAMES: Record<string, string> = {
  A1_DOC_CONTROL: 'Document Control & Governance',
  A4_MANAGEMENT_CONTROLS: 'Management Systems & Controls',
  A5_EMERGENCY_ARRANGEMENTS: 'Emergency Arrangements',
  FRA_1_HAZARDS: 'Fire Hazards & Ignition Sources',
  FRA_2_ESCAPE_ASIS: 'Means of Escape',
  FRA_3_PROTECTION_ASIS: 'Fire Protection Measures',
  FRA_4_SIGNIFICANT_FINDINGS: 'Significant Findings Summary',
  FRA_5_EXTERNAL_FIRE_SPREAD: 'External Fire Spread',
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

export async function buildFraPdf(options: BuildPdfOptions): Promise<Uint8Array> {
  const { document, moduleInstances, actions, organisation } = options;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const isDraft = document.status !== 'issued';

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let yPosition = PAGE_HEIGHT - MARGIN;

  if (isDraft) {
    drawDraftWatermark(page);
  }

  yPosition = drawCoverPage(page, document, organisation, font, fontBold, yPosition);

  const sortedModules = sortModules(moduleInstances);
  const fra4Module = sortedModules.find((m) => m.module_key === 'FRA_4_SIGNIFICANT_FINDINGS');

  if (fra4Module) {
    page = addNewPage(pdfDoc, isDraft);
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawExecutiveSummary(page, fra4Module, actions, moduleInstances, font, fontBold, yPosition, pdfDoc, isDraft);
  }

  for (const module of sortedModules) {
    if (module.module_key === 'FRA_4_SIGNIFICANT_FINDINGS') continue;

    page = addNewPage(pdfDoc, isDraft);
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawModuleSummary(page, module, font, fontBold, yPosition, pdfDoc, isDraft);
  }

  page = addNewPage(pdfDoc, isDraft);
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawActionRegister(page, actions, moduleInstances, font, fontBold, yPosition, pdfDoc, isDraft);

  page = addNewPage(pdfDoc, isDraft);
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawAssumptionsAndLimitations(page, document, fra4Module, font, fontBold, yPosition, pdfDoc, isDraft);

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

function drawDraftWatermark(page: PDFPage) {
  const width = page.getWidth();
  const height = page.getHeight();

  page.drawText('DRAFT', {
    x: width / 2 - 80,
    y: height / 2,
    size: 80,
    color: rgb(0.9, 0.9, 0.9),
    opacity: 0.3,
    rotate: { type: 'degrees', angle: -45 },
  });
}

function addNewPage(pdfDoc: PDFDocument, isDraft: boolean): PDFPage {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  if (isDraft) {
    drawDraftWatermark(page);
  }
  return page;
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
  page.drawText(document.status.toUpperCase(), {
    x: centerX - font.widthOfTextAtSize(document.status.toUpperCase(), 12) / 2,
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
    ['Assessment Date:', formatDate(document.assessment_date)],
    ['Assessor:', document.assessor_name || '—'],
    ['Role:', document.assessor_role || '—'],
    ['Responsible Person:', document.responsible_person || '—'],
    ['Version:', `v${document.version}`],
    ['Document Type:', document.document_type],
  ];

  for (const [label, value] of infoItems) {
    page.drawText(label, {
      x: MARGIN + 20,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    });
    page.drawText(value, {
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

function drawExecutiveSummary(
  page: PDFPage,
  fra4Module: ModuleInstance,
  actions: Action[],
  moduleInstances: ModuleInstance[],
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean
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

  const overallRating = fra4Module.data.overall_risk_rating || 'unknown';
  const ratingLabel = overallRating.toUpperCase();
  const ratingColor = getRatingColor(overallRating);

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
    width: 150,
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

  yPosition -= 45;

  const openActions = actions.filter((a) => a.status !== 'completed');
  const p1Actions = openActions.filter((a) => a.priority_band === 'P1').length;
  const p2Actions = openActions.filter((a) => a.priority_band === 'P2').length;

  page.drawText('Priority Actions Summary:', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 22;
  page.drawText(`P1 (Immediate): ${p1Actions}`, {
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
      page = addNewPage(pdfDoc, isDraft);
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
        page = addNewPage(pdfDoc, isDraft);
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
      page = addNewPage(pdfDoc, isDraft);
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
        page = addNewPage(pdfDoc, isDraft);
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
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean
): number {
  const moduleName = MODULE_NAMES[module.module_key] || module.module_key;

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
        page = addNewPage(pdfDoc, isDraft);
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

  yPosition = drawModuleKeyFields(page, module, font, fontBold, yPosition, pdfDoc, isDraft);

  return yPosition;
}

function drawModuleKeyFields(
  page: PDFPage,
  module: ModuleInstance,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean
): number {
  const data = module.data || {};

  switch (module.module_key) {
    case 'FRA_1_HAZARDS':
      if (data.ignition_sources?.length > 0) {
        yPosition = drawKeyField(page, 'Ignition Sources', data.ignition_sources.join(', '), font, fontBold, yPosition, pdfDoc, isDraft);
      }
      if (data.fuel_sources?.length > 0) {
        yPosition = drawKeyField(page, 'Fuel Sources', data.fuel_sources.join(', '), font, fontBold, yPosition, pdfDoc, isDraft);
      }
      if (data.arson_risk && data.arson_risk !== 'unknown') {
        yPosition = drawKeyField(page, 'Arson Risk', data.arson_risk, font, fontBold, yPosition, pdfDoc, isDraft);
      }
      break;

    case 'FRA_5_EXTERNAL_FIRE_SPREAD':
      if (data.building_height_relevant) {
        yPosition = drawKeyField(page, 'Building Height', `${data.building_height_relevant}m`, font, fontBold, yPosition, pdfDoc, isDraft);
      }
      if (data.pas9980_or_equivalent_appraisal) {
        yPosition = drawKeyField(page, 'PAS 9980 Appraisal', data.pas9980_or_equivalent_appraisal.replace(/_/g, ' '), font, fontBold, yPosition, pdfDoc, isDraft);
      }
      break;

    case 'A4_MANAGEMENT_CONTROLS':
      if (data.fire_safety_policy) {
        yPosition = drawKeyField(page, 'Fire Safety Policy', data.fire_safety_policy, font, fontBold, yPosition, pdfDoc, isDraft);
      }
      break;

    case 'A5_EMERGENCY_ARRANGEMENTS':
      if (data.evacuation_strategy) {
        yPosition = drawKeyField(page, 'Evacuation Strategy', data.evacuation_strategy, font, fontBold, yPosition, pdfDoc, isDraft);
      }
      break;
  }

  return yPosition;
}

function drawKeyField(
  page: PDFPage,
  label: string,
  value: string,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean
): number {
  if (yPosition < MARGIN + 100) {
    page = addNewPage(pdfDoc, isDraft);
    yPosition = PAGE_HEIGHT - MARGIN - 20;
  }

  page.drawText(`${label}:`, {
    x: MARGIN,
    y: yPosition,
    size: 10,
    font: fontBold,
    color: rgb(0.3, 0.3, 0.3),
  });

  yPosition -= 14;
  const valueLines = wrapText(value, CONTENT_WIDTH - 20, 10, font);
  for (const line of valueLines) {
    if (yPosition < MARGIN + 50) {
      page = addNewPage(pdfDoc, isDraft);
      yPosition = PAGE_HEIGHT - MARGIN - 20;
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

  yPosition -= 5;
  return yPosition;
}

function drawActionRegister(
  page: PDFPage,
  actions: Action[],
  moduleInstances: ModuleInstance[],
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean
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

  const sortedActions = [...actions].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;

    const priorityOrder = ['P1', 'P2', 'P3', 'P4'];
    const aPriority = priorityOrder.indexOf(a.priority_band);
    const bPriority = priorityOrder.indexOf(b.priority_band);

    if (aPriority !== bPriority) return aPriority - bPriority;

    if (a.target_date && b.target_date) {
      return new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
    }
    if (a.target_date) return -1;
    if (b.target_date) return 1;

    return 0;
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
    if (yPosition < MARGIN + 120) {
      page = addNewPage(pdfDoc, isDraft);
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    const priorityColor = getPriorityColor(action.priority_band);
    page.drawRectangle({
      x: MARGIN,
      y: yPosition - 3,
      width: 30,
      height: 16,
      color: priorityColor,
    });
    page.drawText(action.priority_band, {
      x: MARGIN + 4,
      y: yPosition,
      size: 9,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawText(`L${action.likelihood} × I${action.impact} = ${action.priority_score}`, {
      x: MARGIN + 35,
      y: yPosition,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });

    yPosition -= 18;

    const actionLines = wrapText(action.action, CONTENT_WIDTH - 10, 10, font);
    for (const line of actionLines) {
      if (yPosition < MARGIN + 50) {
        page = addNewPage(pdfDoc, isDraft);
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
    if (action.owner) metaInfo.push(`Owner: ${action.owner}`);
    if (action.target_date) metaInfo.push(`Target: ${formatDate(action.target_date)}`);
    metaInfo.push(`Status: ${action.status}`);

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
  isDraft: boolean
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
        page = addNewPage(pdfDoc, isDraft);
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
      page = addNewPage(pdfDoc, isDraft);
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
        page = addNewPage(pdfDoc, isDraft);
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
      page = addNewPage(pdfDoc, isDraft);
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
        page = addNewPage(pdfDoc, isDraft);
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

function wrapText(text: string, maxWidth: number, fontSize: number, font: any): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getRatingColor(rating: string): { r: number; g: number; b: number } {
  switch (rating) {
    case 'low':
      return rgb(0.13, 0.55, 0.13);
    case 'medium':
      return rgb(0.85, 0.65, 0.13);
    case 'high':
      return rgb(0.9, 0.5, 0.13);
    case 'intolerable':
      return rgb(0.8, 0.13, 0.13);
    default:
      return rgb(0.5, 0.5, 0.5);
  }
}

function getOutcomeColor(outcome: string): { r: number; g: number; b: number } {
  switch (outcome) {
    case 'compliant':
      return rgb(0.13, 0.55, 0.13);
    case 'minor_def':
      return rgb(0.85, 0.65, 0.13);
    case 'material_def':
      return rgb(0.8, 0.13, 0.13);
    case 'info_gap':
      return rgb(0.2, 0.5, 0.8);
    case 'na':
      return rgb(0.6, 0.6, 0.6);
    default:
      return rgb(0.7, 0.7, 0.7);
  }
}

function getOutcomeLabel(outcome: string): string {
  switch (outcome) {
    case 'compliant':
      return 'Compliant';
    case 'minor_def':
      return 'Minor Deficiency';
    case 'material_def':
      return 'Material Deficiency';
    case 'info_gap':
      return 'Information Gap';
    case 'na':
      return 'Not Applicable';
    default:
      return 'Pending';
  }
}

function getPriorityColor(priority: string): { r: number; g: number; b: number } {
  switch (priority) {
    case 'P1':
      return rgb(0.8, 0.13, 0.13);
    case 'P2':
      return rgb(0.9, 0.5, 0.13);
    case 'P3':
      return rgb(0.85, 0.65, 0.13);
    case 'P4':
      return rgb(0.2, 0.5, 0.8);
    default:
      return rgb(0.5, 0.5, 0.5);
  }
}
