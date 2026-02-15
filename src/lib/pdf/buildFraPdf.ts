import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import { getModuleName } from '../modules/moduleCatalog';
import { detectInfoGaps } from '../../utils/infoGapQuickActions';
import { listAttachments, type Attachment } from '../supabase/attachments';
import {
  fraRegulatoryFrameworkText,
  fraResponsiblePersonDutiesText,
  type Jurisdiction,
} from '../reportText';
import {
  deriveExecutiveOutcome,
  checkMaterialDeficiency,
  type FraContext,
  type FraExecutiveOutcome,
} from '../modules/fra/severityEngine';
import {
  calculateSCS,
  deriveFireProtectionReliance,
  type FraBuildingComplexityInput,
  type FireProtectionModuleData,
} from '../modules/fra/complexityEngine';
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
  drawRecommendationsSection,
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
  executive_summary_ai?: string | null;
  executive_summary_author?: string | null;
  executive_summary_mode?: string | null;
  jurisdiction?: string;
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
  finding_category?: string | null;
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

const MODULE_ORDER_LEGACY = [
  'A1_DOC_CONTROL',
  'FRA_4_SIGNIFICANT_FINDINGS',
  'FRA_90_SIGNIFICANT_FINDINGS',
  'FRA_1_HAZARDS',
  'A4_MANAGEMENT_CONTROLS',
  'FRA_6_MANAGEMENT_SYSTEMS',
  'A5_EMERGENCY_ARRANGEMENTS',
  'FRA_7_EMERGENCY_ARRANGEMENTS',
  'FRA_2_ESCAPE_ASIS',
  'FRA_3_PROTECTION_ASIS',
  'FRA_5_EXTERNAL_FIRE_SPREAD',
];

const MODULE_ORDER_SPLIT = [
  'A1_DOC_CONTROL',
  'FRA_4_SIGNIFICANT_FINDINGS',
  'FRA_90_SIGNIFICANT_FINDINGS',
  'FRA_1_HAZARDS',
  'A4_MANAGEMENT_CONTROLS',
  'FRA_6_MANAGEMENT_SYSTEMS',
  'A5_EMERGENCY_ARRANGEMENTS',
  'FRA_7_EMERGENCY_ARRANGEMENTS',
  'FRA_2_ESCAPE_ASIS',
  'FRA_3_ACTIVE_SYSTEMS',
  'FRA_4_PASSIVE_PROTECTION',
  'FRA_8_FIREFIGHTING_EQUIPMENT',
  'FRA_5_EXTERNAL_FIRE_SPREAD',
];

export async function buildFraPdf(options: BuildPdfOptions): Promise<Uint8Array> {
  console.log('[PDF FRA] Starting FRA PDF build');
  const { document, moduleInstances, actions, actionRatings, organisation, renderMode } = options;

  console.log('[PDF FRA] Build options:', {
    documentId: document.id,
    title: document.title,
    renderMode,
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

  console.log('[PDF FRA] Fetching attachments...');
  let attachments: Attachment[] = [];
  try {
    attachments = await listAttachments(document.id);
    console.log('[PDF FRA] Fetched', attachments.length, 'attachments');
  } catch (error) {
    console.warn('[PDF FRA] Failed to fetch attachments:', error);
  }

  console.log('[PDF FRA] Creating PDF document and embedding fonts');
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  console.log('[PDF FRA] Fonts embedded successfully');

  const isIssuedMode = renderMode === 'issued';
  const isDraft = !isIssuedMode;
  const totalPages: PDFPage[] = [];

  let page: PDFPage;
  let yPosition: number;

  console.log('[PDF FRA] Render mode:', isIssuedMode ? 'ISSUED' : 'DRAFT');

  // Use addIssuedReportPages for both draft and issued modes to ensure logo embedding
  console.log('[PDF FRA] Adding report pages with logo (cover + doc control)');
  const { coverPage, docControlPage } = await addIssuedReportPages({
    pdfDoc,
    document: {
      id: document.id,
      title: document.title,
      document_type: 'FRA',
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

  const regFrameworkResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = regFrameworkResult.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawRegulatoryFramework(page, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  const respPersonResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = respPersonResult.page;
  yPosition = PAGE_HEIGHT - MARGIN;
  yPosition = drawResponsiblePersonDuties(page, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  if (document.scope_description) {
    const scopeResult = addNewPage(pdfDoc, isDraft, totalPages);
    page = scopeResult.page;
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawScope(page, document.scope_description, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  if (document.limitations_assumptions) {
    const limResult = addNewPage(pdfDoc, isDraft, totalPages);
    page = limResult.page;
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawLimitations(page, document.limitations_assumptions, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  const sortedModules = sortModules(moduleInstances);
  const fra4Module = sortedModules.find((m) =>
    m.module_key === 'FRA_4_SIGNIFICANT_FINDINGS' || m.module_key === 'FRA_90_SIGNIFICANT_FINDINGS'
  );

  if (fra4Module) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawExecutiveSummary(page, fra4Module, actions, actionRatings, moduleInstances, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

    // Add Risk Rating Explanation immediately after Executive Summary
    yPosition = drawRiskRatingExplanation(page, fra4Module, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  for (const module of sortedModules) {
    if (module.module_key === 'FRA_4_SIGNIFICANT_FINDINGS' || module.module_key === 'FRA_90_SIGNIFICANT_FINDINGS') continue;

    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawModuleSummary(page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  if (isIssuedMode && actions.length > 0) {
    const actionsForPdf = actions.map((action: any) => ({
      id: action.id,
      reference_number: action.reference_number || null,
      recommended_action: action.recommended_action,
      priority_band: action.priority_band,
      status: action.status,
      first_raised_in_version: action.first_raised_in_version || null,
      closed_at: action.closed_at || null,
      superseded_by_action_id: action.superseded_by_action_id || null,
      superseded_at: action.superseded_at || null,
    }));

    drawRecommendationsSection(
      pdfDoc,
      actionsForPdf,
      { bold: fontBold, regular: font },
      isDraft,
      totalPages
    );
  } else {
    const resultLI = addNewPage(pdfDoc, isDraft, totalPages);
    page = resultLI.page;
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawLikelihoodConsequenceExplanation(page, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

    const result1 = addNewPage(pdfDoc, isDraft, totalPages);
    page = result1.page;
    yPosition = PAGE_HEIGHT - MARGIN;
    yPosition = drawActionRegister(page, actions, actionRatings, moduleInstances, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

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

  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const footerText = `FRA Report — ${document.title} —     v${document.version_number}.0 — Generated ${today}`;

  console.log('[PDF FRA] Drawing footers for', totalPages.length, 'pages');
  const startPageForFooters = isIssuedMode ? 2 : 1;
  for (let i = startPageForFooters; i < totalPages.length; i++) {
    drawFooter(totalPages[i], footerText, i, totalPages.length - 1, font);
  }

  if ((document as any).issue_status === 'superseded') {
    console.log('[PDF FRA] Adding superseded watermark');
    await addSupersededWatermark(pdfDoc);
  }

  console.log('[PDF FRA] Saving PDF document...');
  const pdfBytes = await pdfDoc.save();
  console.log('[PDF FRA] PDF saved successfully,', pdfBytes.length, 'bytes');
  console.log('[PDF FRA] Build complete');
  return pdfBytes;
}

function sortModules(moduleInstances: ModuleInstance[]): ModuleInstance[] {
  const hasLegacyProtection = moduleInstances.some((module) => module.module_key === 'FRA_3_PROTECTION_ASIS');
  const moduleOrder = hasLegacyProtection ? MODULE_ORDER_LEGACY : MODULE_ORDER_SPLIT;

  return [...moduleInstances]
    .filter((module) => !(hasLegacyProtection && [
      'FRA_3_ACTIVE_SYSTEMS',
      'FRA_4_PASSIVE_PROTECTION',
      'FRA_8_FIREFIGHTING_EQUIPMENT',
    ].includes(module.module_key)))
    .sort((a, b) => {
      const aIndex = moduleOrder.indexOf(a.module_key);
      const bIndex = moduleOrder.indexOf(b.module_key);

      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;

      return aIndex - bIndex;
    });
}

function getOrganisationDisplayName(organisation: Organisation): string {
  // Check if name looks like an email (contains @ and .)
  const isEmail = organisation.name && organisation.name.includes('@') && organisation.name.includes('.');

  // If name is missing or looks like an email, return placeholder
  if (!organisation.name || isEmail) {
    return 'Organisation (name not set)';
  }

  return organisation.name;
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

  // Title - larger and more prominent
  yPosition -= 100;
  page.drawText('FIRE RISK ASSESSMENT', {
    x: centerX - 170,
    y: yPosition,
    size: 28,
    font: fontBold,
    color: rgb(0.7, 0.1, 0.1), // Brand red for title
  });

  // Site name
  yPosition -= 50;
  const titleLines = wrapText(document.title, CONTENT_WIDTH - 100, 20, font);
  for (const line of titleLines) {
    page.drawText(line, {
      x: centerX - (font.widthOfTextAtSize(line, 20) / 2),
      y: yPosition,
      size: 20,
      font: fontBold,
      color: rgb(0.15, 0.15, 0.15),
    });
    yPosition -= 28;
  }

  // Client name - proper display, no email
  yPosition -= 15;
  const orgDisplayName = getOrganisationDisplayName(organisation);
  const orgLines = wrapText(orgDisplayName, CONTENT_WIDTH - 100, 14, font);
  for (const line of orgLines) {
    page.drawText(line, {
      x: centerX - (font.widthOfTextAtSize(line, 14) / 2),
      y: yPosition,
      size: 14,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    yPosition -= 20;
  }

  // Status badge - shown ONCE prominently on cover
  yPosition -= 30;
  // Use renderMode to override status if provided
  let issueStatus = renderMode === 'issued' ? 'issued' : ((document as any).issue_status || document.status);
  const isIssued = issueStatus === 'issued';
  const isSuperseded = issueStatus === 'superseded';
  const statusColor = isIssued ? rgb(0.13, 0.55, 0.13) : isSuperseded ? rgb(0.7, 0.5, 0) : rgb(0.5, 0.5, 0.5);
  const statusText = sanitizePdfText(issueStatus ? issueStatus.toUpperCase() : 'DRAFT');
  const statusWidth = font.widthOfTextAtSize(statusText, 13) + 30;

  page.drawRectangle({
    x: centerX - statusWidth / 2,
    y: yPosition - 5,
    width: statusWidth,
    height: 28,
    color: statusColor,
  });
  page.drawText(statusText, {
    x: centerX - font.widthOfTextAtSize(statusText, 13) / 2,
    y: yPosition + 2,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // Divider line
  yPosition -= 50;
  page.drawLine({
    start: { x: MARGIN + 40, y: yPosition },
    end: { x: PAGE_WIDTH - MARGIN - 40, y: yPosition },
    thickness: 1.5,
    color: rgb(0.7, 0.7, 0.7),
  });

  // Metadata - clean 2-column layout
  yPosition -= 35;
  const col1X = MARGIN + 50;
  const col2X = PAGE_WIDTH / 2 + 20;
  const labelSize = 10;
  const valueSize = 11;
  const rowHeight = 24;

  // Get jurisdiction display name
  const jurisdictionName = document.jurisdiction === 'UK' ? 'United Kingdom' : document.jurisdiction === 'IE' ? 'Ireland' : document.jurisdiction || 'Not specified';

  const leftColumn = [
    ['Assessment Date:', formatDate(document.assessment_date)],
    ['Assessor:', document.assessor_name || '—'],
    ['Version:', `v${document.version}`],
  ];

  const rightColumn = [
    ['Jurisdiction:', jurisdictionName],
    ['Responsible Person:', document.responsible_person || '—'],
    ['Review Date:', document.review_date ? formatDate(document.review_date) : '—'],
  ];

  // Draw left column
  for (const [label, value] of leftColumn) {
    page.drawText(sanitizePdfText(label), {
      x: col1X,
      y: yPosition,
      size: labelSize,
      font: fontBold,
      color: rgb(0.5, 0.5, 0.5),
    });
    page.drawText(sanitizePdfText(value), {
      x: col1X,
      y: yPosition - 14,
      size: valueSize,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
    yPosition -= rowHeight;
  }

  // Reset y for right column
  yPosition += (rowHeight * leftColumn.length);

  // Draw right column
  for (const [label, value] of rightColumn) {
    page.drawText(sanitizePdfText(label), {
      x: col2X,
      y: yPosition,
      size: labelSize,
      font: fontBold,
      color: rgb(0.5, 0.5, 0.5),
    });
    page.drawText(sanitizePdfText(value), {
      x: col2X,
      y: yPosition - 14,
      size: valueSize,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
    yPosition -= rowHeight;
  }

  // Footer
  page.drawText('Generated by EziRisk', {
    x: centerX - 65,
    y: MARGIN + 10,
    size: 9,
    font,
    color: rgb(0.6, 0.6, 0.6),
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

  // Build context for severity engine
  const buildingProfile = moduleInstances.find((m) => m.module_key === 'A2_BUILDING_PROFILE');
  const fraContext: FraContext = {
    occupancyRisk: (buildingProfile?.data.occupancy_risk || 'NonSleeping') as 'NonSleeping' | 'Sleeping' | 'Vulnerable',
    storeys: buildingProfile?.data.number_of_storeys || null,
  };

  // Derive executive outcome using severity engine
  const openActions = actions.filter((a) => a.status === 'open' || a.status === 'in_progress');
  const outcome: FraExecutiveOutcome = deriveExecutiveOutcome(openActions);
  const { isMaterialDeficiency } = checkMaterialDeficiency(openActions, fraContext);

  // Map outcome to display text
  const outcomeLabels: Record<FraExecutiveOutcome, string> = {
    MaterialLifeSafetyRiskPresent: 'MATERIAL LIFE SAFETY RISK PRESENT',
    SignificantDeficiencies: 'SIGNIFICANT DEFICIENCIES IDENTIFIED',
    ImprovementsRequired: 'IMPROVEMENTS REQUIRED',
    SatisfactoryWithImprovements: 'SATISFACTORY WITH IMPROVEMENTS',
  };

  const outcomeColors: Record<FraExecutiveOutcome, ReturnType<typeof rgb>> = {
    MaterialLifeSafetyRiskPresent: rgb(0.7, 0, 0),
    SignificantDeficiencies: rgb(0.8, 0.3, 0),
    ImprovementsRequired: rgb(0.9, 0.6, 0),
    SatisfactoryWithImprovements: rgb(0.2, 0.6, 0.2),
  };

  const outcomeLabel = outcomeLabels[outcome];
  const outcomeColor = outcomeColors[outcome];

  page.drawText('Overall Fire Safety Assessment:', {
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
    width: Math.min(CONTENT_WIDTH, outcomeLabel.length * 8),
    height: 30,
    color: outcomeColor,
  });
  page.drawText(outcomeLabel, {
    x: MARGIN + 10,
    y: yPosition + 3,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  yPosition -= 40;

  // Material deficiency warning
  if (isMaterialDeficiency) {
    if (yPosition < MARGIN + 80) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    const warningText = 'Material fire safety deficiencies have been identified which require urgent attention.';
    page.drawText(warningText, {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0.7, 0, 0),
    });

    yPosition -= 25;
  }

  const p1OpenCount = openActions.filter((a) => a.priority_band === 'P1').length;
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

  // Calculate SCS for top issues weighting (early calculation)
  const buildingProfileEarly = moduleInstances.find((m) => m.module_key === 'A2_BUILDING_PROFILE');
  const protectionModuleEarly = moduleInstances.find((m) => m.module_key === 'FRA_3_FIRE_PROTECTION');
  const protectionDataEarly: FireProtectionModuleData = {
    hasDetectionSystem: protectionModuleEarly?.data?.detection_system_present === true,
    hasEmergencyLighting: protectionModuleEarly?.data?.emergency_lighting_present === true,
    hasSuppressionSystem: protectionModuleEarly?.data?.suppression_system_present === true,
    hasSmokeControl: protectionModuleEarly?.data?.smoke_control_present === true,
    compartmentationCritical: protectionModuleEarly?.outcome === 'material_def',
    engineeredEvacuationStrategy: protectionModuleEarly?.data?.engineered_strategy === true,
  };
  const fireProtectionRelianceEarly = deriveFireProtectionReliance(protectionDataEarly);
  const scsInputEarly: FraBuildingComplexityInput = {
    storeys: buildingProfileEarly?.data.number_of_storeys || null,
    floorAreaM2: buildingProfileEarly?.data.floor_area_m2 || null,
    sleepingRisk: buildingProfileEarly?.data.sleeping_risk || 'None',
    layoutComplexity: buildingProfileEarly?.data.layout_complexity || 'Simple',
    fireProtectionReliance: fireProtectionRelianceEarly,
  };
  const scsEarly = calculateSCS(scsInputEarly);

  // Top Issues section with SCS-weighted sorting
  if (openActions.length > 0) {
    yPosition -= 10;
    if (yPosition < MARGIN + 150) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    page.drawText('Key Issues Requiring Attention:', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 22;

    // Sort actions with SCS weighting
    const sortedTopActions = [...openActions].sort((a, b) => {
      const priorityOrder = { P1: 1, P2: 2, P3: 3, P4: 4 };
      const aPriority = priorityOrder[a.priority_band as keyof typeof priorityOrder] || 5;
      const bPriority = priorityOrder[b.priority_band as keyof typeof priorityOrder] || 5;

      if (aPriority !== bPriority) return aPriority - bPriority;

      // If same priority and SCS is High or VeryHigh, prefer critical categories
      if (scsEarly.band === 'High' || scsEarly.band === 'VeryHigh') {
        const criticalCategories = ['MeansOfEscape', 'DetectionAlarm', 'Compartmentation'];
        const aIsCritical = criticalCategories.includes(a.finding_category || '');
        const bIsCritical = criticalCategories.includes(b.finding_category || '');

        if (aIsCritical && !bIsCritical) return -1;
        if (!aIsCritical && bIsCritical) return 1;
      }

      return 0;
    });

    const topActions = sortedTopActions.slice(0, 3);

    for (let i = 0; i < topActions.length; i++) {
      const action = topActions[i];
      const actionText = action.recommended_action || '(No action text)';
      const truncatedText = actionText.length > 100 ? actionText.substring(0, 100) + '...' : actionText;

      if (yPosition < MARGIN + 80) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
      }

      const priorityColor = getPriorityColor(action.priority_band);
      page.drawRectangle({
        x: MARGIN + 10,
        y: yPosition - 2,
        width: 30,
        height: 12,
        color: priorityColor,
      });
      page.drawText(action.priority_band, {
        x: MARGIN + 15,
        y: yPosition,
        size: 9,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      const issueLines = wrapText(truncatedText, CONTENT_WIDTH - 50, 10, font);
      page.drawText(issueLines[0] || '', {
        x: MARGIN + 50,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });

      yPosition -= 20;
    }

    yPosition -= 10;
  }

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

  // Calculate and display Structural Complexity Score context
  yPosition -= 30;
  if (yPosition < MARGIN + 100) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN - 20;
  }

  // Derive fire protection reliance from modules
  const protectionModule = moduleInstances.find((m) => m.module_key === 'FRA_3_FIRE_PROTECTION');
  const protectionData: FireProtectionModuleData = {
    hasDetectionSystem: protectionModule?.data?.detection_system_present === true,
    hasEmergencyLighting: protectionModule?.data?.emergency_lighting_present === true,
    hasSuppressionSystem: protectionModule?.data?.suppression_system_present === true,
    hasSmokeControl: protectionModule?.data?.smoke_control_present === true,
    compartmentationCritical: protectionModule?.outcome === 'material_def',
    engineeredEvacuationStrategy: protectionModule?.data?.engineered_strategy === true,
  };

  const fireProtectionReliance = deriveFireProtectionReliance(protectionData);

  // Build SCS input
  const scsInput: FraBuildingComplexityInput = {
    storeys: buildingProfile?.data.number_of_storeys || null,
    floorAreaM2: buildingProfile?.data.floor_area_m2 || null,
    sleepingRisk: buildingProfile?.data.sleeping_risk || 'None',
    layoutComplexity: buildingProfile?.data.layout_complexity || 'Simple',
    fireProtectionReliance,
  };

  const scs = calculateSCS(scsInput);

  // Add complexity context paragraph based on SCS band
  let complexityParagraph = '';
  switch (scs.band) {
    case 'VeryHigh':
      complexityParagraph = 'The premises comprises a complex building with significant reliance on structural and active fire protection systems. Effective maintenance and management controls are critical.';
      break;
    case 'High':
      complexityParagraph = 'The building presents structural and occupancy complexity which increases reliance on fire protection measures.';
      break;
    case 'Moderate':
      complexityParagraph = 'The premises is of moderate complexity and requires structured management of fire safety systems.';
      break;
    case 'Low':
    default:
      complexityParagraph = 'The premises is of relatively straightforward layout and use.';
  }

  page.drawText('Building Complexity:', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 20;
  const complexityLines = wrapText(complexityParagraph, CONTENT_WIDTH, 11, font);
  for (const line of complexityLines) {
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

function drawRiskRatingExplanation(
  page: PDFPage,
  fra4Module: ModuleInstance,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  const storedOverrideJustification = fra4Module.data.override_justification;
  const hasOverride = !!storedOverrideJustification;

  yPosition -= 40;

  if (yPosition < MARGIN + 250) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN - 20;
  }

  page.drawText('How the Overall Risk Rating Is Determined', {
    x: MARGIN,
    y: yPosition,
    size: 14,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.15),
  });

  yPosition -= 25;

  const explanationText =
    'The overall fire risk rating reflects the assessor\'s professional judgement based on hazards identified, ' +
    'fire protection measures observed, management arrangements, and the prioritised actions in this report. ' +
    'Individual recommendations are prioritised to support risk reduction, but the overall rating is not ' +
    'calculated from a numerical formula.';

  const explLines = wrapText(explanationText, CONTENT_WIDTH, 10, font);
  for (const line of explLines) {
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
    yPosition -= 15;
  }

  yPosition -= 10;

  const ratingsText = [
    'LOW: The risk from fire is adequately controlled. Minor improvements may be identified.',
    'MEDIUM: The risk from fire is tolerable but improvements are required to further reduce risk.',
    'HIGH: The risk from fire is unacceptable. Urgent action is required.',
  ];

  for (const ratingLine of ratingsText) {
    if (yPosition < MARGIN + 50) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    const lines = wrapText(ratingLine, CONTENT_WIDTH - 15, 10, font);
    for (const line of lines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
      }
      page.drawText(sanitizePdfText('• ' + line), {
        x: MARGIN + 5,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 15;
    }
  }

  if (hasOverride) {
    yPosition -= 10;
    const overrideText =
      'Where shown, an overridden rating reflects the assessor\'s professional judgement, ' +
      'taking account of specific site factors and context.';

    const overrideLines = wrapText(overrideText, CONTENT_WIDTH, 10, font);
    for (const line of overrideLines) {
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
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 15;
    }
  }

  return yPosition;
}

function drawLikelihoodConsequenceExplanation(
  page: PDFPage,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  yPosition -= 40;

  if (yPosition < MARGIN + 300) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN - 20;
  }

  page.drawText('Likelihood and Consequence scoring', {
    x: MARGIN,
    y: yPosition,
    size: 14,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.15),
  });

  yPosition -= 25;

  page.drawText('Likelihood (L):', {
    x: MARGIN,
    y: yPosition,
    size: 11,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  yPosition -= 18;

  const likelihoodScales = [
    'L1 - Very unlikely',
    'L2 - Unlikely',
    'L3 - Possible',
    'L4 - Likely',
    'L5 - Very likely',
  ];

  for (const scale of likelihoodScales) {
    if (yPosition < MARGIN + 50) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }
    page.drawText(sanitizePdfText(scale), {
      x: MARGIN + 10,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    yPosition -= 14;
  }

  yPosition -= 10;

  page.drawText('Consequence / Impact (I):', {
    x: MARGIN,
    y: yPosition,
    size: 11,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  yPosition -= 18;

  const consequenceScales = [
    'I1 - Minor injury or damage',
    'I2 - Slight injury or limited damage',
    'I3 - Moderate injury or damage',
    'I4 - Serious injury or significant damage',
    'I5 - Multiple fatalities or major loss',
  ];

  for (const scale of consequenceScales) {
    if (yPosition < MARGIN + 50) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }
    page.drawText(sanitizePdfText(scale), {
      x: MARGIN + 10,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    yPosition -= 14;
  }

  yPosition -= 15;

  const clarificationText =
    'The risk score shown in the Action Register (e.g. L4 x I5) is used to prioritise actions ' +
    'and does not replace professional judgement.';

  const clarLines = wrapText(clarificationText, CONTENT_WIDTH, 10, font);
  for (const line of clarLines) {
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
      color: rgb(0.3, 0.3, 0.3),
    });
    yPosition -= 15;
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
  yPosition = drawInfoGapQuickActions(page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

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
    case 'FRA_6_MANAGEMENT_SYSTEMS':
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
    case 'FRA_7_EMERGENCY_ARRANGEMENTS':
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
    case 'FRA_3_ACTIVE_SYSTEMS':
      if (data.alarm_present) keyDetails.push(['Alarm Present', data.alarm_present]);
      if (data.alarm_category) keyDetails.push(['Alarm Category', data.alarm_category]);
      if (data.alarm_testing_evidence) keyDetails.push(['Alarm Testing Evidence', data.alarm_testing_evidence]);
      if (data.emergency_lighting_present) keyDetails.push(['Emergency Lighting Present', data.emergency_lighting_present]);
      if (data.emergency_lighting_testing) keyDetails.push(['Emergency Lighting Testing', data.emergency_lighting_testing]);
      break;

    case 'FRA_4_PASSIVE_PROTECTION':
      if (data.fire_doors_condition) keyDetails.push(['Fire Doors Condition', data.fire_doors_condition]);
      if (data.compartmentation_condition) keyDetails.push(['Compartmentation Condition', data.compartmentation_condition]);
      if (data.fire_stopping_confidence) keyDetails.push(['Fire Stopping Confidence', data.fire_stopping_confidence]);
      break;

    case 'FRA_8_FIREFIGHTING_EQUIPMENT':
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
    case 'FRA_90_SIGNIFICANT_FINDINGS':
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
    // Skip empty message - will be handled in appendix
    // Just add minimal space
    yPosition -= 10;
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

    // Add reason for priority for P1/P2 actions
    if ((action.priority_band === 'P1' || action.priority_band === 'P2') && action.trigger_text) {
      yPosition -= 2;
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
      }
      page.drawText(`Reason: ${sanitizePdfText(action.trigger_text)}`, {
        x: MARGIN + 5,
        y: yPosition,
        size: 9,
        font,
        color: rgb(0.6, 0.3, 0.3),
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
  document: Document,
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

  const jurisdiction = (document.jurisdiction as Jurisdiction) || 'UK';
  const frameworkText = fraRegulatoryFrameworkText(jurisdiction);
  const paragraphs = frameworkText.split('\n\n');
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
  document: Document,
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

  const jurisdiction = (document.jurisdiction as Jurisdiction) || 'UK';
  const dutiesText = fraResponsiblePersonDutiesText(jurisdiction);
  const paragraphs = dutiesText.split('\n\n');
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
