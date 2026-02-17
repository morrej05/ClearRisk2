import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import { getModuleName } from '../modules/moduleCatalog';
import { detectInfoGaps } from '../../utils/infoGapQuickActions';
import { listAttachments, type Attachment } from '../supabase/attachments';
import { type Jurisdiction, getJurisdictionConfig, getJurisdictionLabel } from '../jurisdictions';
import {
  fraRegulatoryFrameworkText,
  fraResponsiblePersonDutiesText,
} from '../reportText';
import {
  deriveExecutiveOutcome,
  checkMaterialDeficiency,
  type FraContext,
  type FraExecutiveOutcome,
} from '../modules/fra/severityEngine';
import { drawCleanAuditSection13 } from './fraSection13CleanAudit';
import { generateSectionSummary } from './sectionSummaryGenerator';
import {
  calculateSCS,
  deriveFireProtectionReliance,
  deriveStoreysForScoring,
  type FraBuildingComplexityInput,
  type FireProtectionModuleData,
} from '../modules/fra/complexityEngine';
import { scoreFraDocument, type ScoringResult } from '../fra/scoring/scoringEngine';
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
import { FRA_REPORT_STRUCTURE, getSectionTitle } from './fraReportStructure';
import { getJurisdictionTemplate, getRegulatoryFrameworkText } from './jurisdictionTemplates';

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
      name: (document as any).meta?.client?.name || document.responsible_person || '',
      site: (document as any).meta?.site?.name || document.scope_description || '',
    },
    fonts: { bold: fontBold, regular: font },
  });
  totalPages.push(coverPage, docControlPage);

  const buildingProfileModule = moduleInstances.find((m) => m.module_key === 'A2_BUILDING_PROFILE');
  const documentControlModule = moduleInstances.find((m) => m.module_key === 'A1_DOC_CONTROL');
  if (buildingProfileModule) {
    try {
      const scoringResult = scoreFraDocument({
        jurisdiction: (document.jurisdiction || 'england_wales') as any,
        buildingProfile: buildingProfileModule.data,
        moduleInstances,
      });

      const priorityActions = actions
        .filter((a) => ['P1', 'P2', 'P3'].includes(a.priority_band) && (a.status === 'open' || a.status === 'in_progress'))
        .sort((a, b) => {
          const priorityOrder = { P1: 1, P2: 2, P3: 3, P4: 4 };
          return (priorityOrder[a.priority_band as keyof typeof priorityOrder] || 99) -
                 (priorityOrder[b.priority_band as keyof typeof priorityOrder] || 99);
        });

      const riskSummaryPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      totalPages.push(riskSummaryPage);
      drawCleanAuditPage1(riskSummaryPage, scoringResult, priorityActions, font, fontBold, document, organisation, documentControlModule);

      if (isDraft) {
        drawDraftWatermark(riskSummaryPage, fontBold);
      }
    } catch (error) {
      console.warn('[PDF FRA] Failed to generate risk summary page:', error);
    }
  }

  // Add Table of Contents
  const tocPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  totalPages.push(tocPage);
  drawTableOfContents(tocPage, font, fontBold);
  if (isDraft) {
    drawDraftWatermark(tocPage, fontBold);
  }

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

  // Section-based rendering using fixed PAS-79 skeleton
  const fra4Module = moduleInstances.find((m) =>
    m.module_key === 'FRA_4_SIGNIFICANT_FINDINGS' || m.module_key === 'FRA_90_SIGNIFICANT_FINDINGS'
  );

  // Render sections 2-14 using the fixed structure
  for (const section of FRA_REPORT_STRUCTURE) {
    // Skip section 1 (cover pages handled separately above)
    if (section.id === 1) continue;

    // Find modules for this section
    const sectionModules = moduleInstances.filter(m =>
      section.moduleKeys.includes(m.module_key)
    );

    // Skip empty sections (except special sections that have custom logic)
    if (sectionModules.length === 0 && section.id !== 13 && section.id !== 14) continue;

    // Create new page for section
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN;

    // Draw section header
    yPosition = drawSectionHeader(page, section.id, section.title, font, fontBold, yPosition);
    yPosition -= 10;

    // Draw assessor summary for technical sections (5-12)
    if (section.id >= 5 && section.id <= 12) {
      const summaryWithDrivers = generateSectionSummary({
        sectionId: section.id,
        sectionTitle: section.title,
        moduleInstances: sectionModules,
      });

      if (summaryWithDrivers) {
        const summaryResult = drawAssessorSummary(
          page,
          summaryWithDrivers.summary,
          summaryWithDrivers.drivers,
          font,
          yPosition,
          pdfDoc,
          isDraft,
          totalPages
        );
        page = summaryResult.page;
        yPosition = summaryResult.yPosition;
      }
    }

    // Section-specific rendering
    switch (section.id) {
      case 2: // Premises & General Information
        yPosition = renderSection2Premises(page, sectionModules, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
        break;

      case 3: // Occupants & Vulnerability
        yPosition = renderSection3Occupants(page, sectionModules, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
        break;

      case 4: // Legislation & Duty Holder
        yPosition = renderSection4Legislation(page, sectionModules, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
        break;

      case 7: // Fire Detection, Alarm & Warning
        yPosition = renderSection7Detection(page, sectionModules, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
        break;

      case 8: // Emergency Lighting
        yPosition = renderSection8EmergencyLighting(page, sectionModules, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
        break;

      case 10: // Fixed Fire Suppression & Firefighting Facilities
        yPosition = renderSection10Suppression(page, sectionModules, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
        break;

      case 11: // Fire Safety Management & Procedures
        yPosition = renderSection11Management(page, sectionModules, moduleInstances, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
        break;

      case 13: // Significant Findings, Risk Evaluation & Action Plan
        if (fra4Module) {
          yPosition = drawCleanAuditSection13({
            page,
            fra4Module,
            actions,
            moduleInstances,
            font,
            fontBold,
            yPosition,
            pdfDoc,
            isDraft,
            totalPages,
          });
        }
        break;

      case 14: // Review & Reassessment
        yPosition = renderSection14Review(page, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
        break;

      default:
        // Generic section rendering for standard modules
        for (const module of sectionModules) {
          yPosition = drawModuleContent(page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
        }
        break;
    }
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

function getOrganisationDisplayName(organisation: Organisation): string {
  // Check if name looks like an email (contains @ and .)
  const isEmail = organisation.name && organisation.name.includes('@') && organisation.name.includes('.');

  // If name is missing or looks like an email, return placeholder
  if (!organisation.name || isEmail) {
    return 'Organisation (name not set)';
  }

  return organisation.name;
}

function drawRiskSummaryPage(
  page: PDFPage,
  scoringResult: ScoringResult,
  priorityActions: Action[],
  font: any,
  fontBold: any,
  document: Document
): void {
  let yPosition = PAGE_HEIGHT - MARGIN - 20;

  page.drawText('Overall Risk to Life Assessment', {
    x: MARGIN,
    y: yPosition,
    size: 20,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  yPosition -= 50;

  const riskColor =
    scoringResult.overallRisk === 'Intolerable' ? rgb(0.8, 0.1, 0.1) :
    scoringResult.overallRisk === 'Substantial' ? rgb(0.9, 0.5, 0) :
    scoringResult.overallRisk === 'Moderate' ? rgb(0.9, 0.7, 0) :
    scoringResult.overallRisk === 'Tolerable' ? rgb(0.7, 0.7, 0) :
    rgb(0.2, 0.6, 0.2);

  page.drawRectangle({
    x: MARGIN,
    y: yPosition - 35,
    width: CONTENT_WIDTH,
    height: 50,
    borderColor: riskColor,
    borderWidth: 2,
    color: rgb(1, 1, 1),
  });

  page.drawText(scoringResult.overallRisk.toUpperCase(), {
    x: MARGIN + 20,
    y: yPosition - 15,
    size: 24,
    font: fontBold,
    color: riskColor,
  });

  yPosition -= 60;

  if (scoringResult.provisional) {
    page.drawRectangle({
      x: MARGIN,
      y: yPosition - 40,
      width: CONTENT_WIDTH,
      height: 60 + (scoringResult.provisionalReasons.length * 15),
      borderColor: rgb(0.9, 0.7, 0),
      borderWidth: 1.5,
      color: rgb(1, 0.98, 0.9),
    });

    page.drawText('PROVISIONAL ASSESSMENT', {
      x: MARGIN + 10,
      y: yPosition - 15,
      size: 12,
      font: fontBold,
      color: rgb(0.6, 0.4, 0),
    });

    yPosition -= 30;

    for (const reason of scoringResult.provisionalReasons) {
      const reasonText = sanitizePdfText(reason);
      page.drawText(`- ${reasonText}`, {
        x: MARGIN + 15,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.4, 0.3, 0),
      });
      yPosition -= 15;
    }

    yPosition -= 25;
  }

  yPosition -= 20;

  page.drawText('Risk Determination', {
    x: MARGIN,
    y: yPosition,
    size: 14,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  yPosition -= 25;

  const likelihoodText = `Likelihood: ${scoringResult.likelihood} - The assessment of how likely harm is to occur based on identified hazards, management controls, and information completeness.`;
  const likelihoodLines = wrapText(likelihoodText, CONTENT_WIDTH, 10, font);
  for (const line of likelihoodLines) {
    page.drawText(line, {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    yPosition -= 14;
  }

  yPosition -= 10;

  const consequenceText = `Consequence: ${scoringResult.consequence} - The potential severity of harm determined by building profile factors including occupancy, vulnerability, height, and evacuation complexity.`;
  const consequenceLines = wrapText(consequenceText, CONTENT_WIDTH, 10, font);
  for (const line of consequenceLines) {
    page.drawText(line, {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    yPosition -= 14;
  }

  yPosition -= 10;

  const determinationText = `Determination: The overall risk to life is assessed as ${scoringResult.overallRisk} based on the combination of ${scoringResult.likelihood} likelihood and ${scoringResult.consequence} consequence. ${scoringResult.provisional ? 'This assessment is provisional pending resolution of critical information gaps.' : 'This assessment is based on complete information gathered during the survey.'}`;
  const determinationLines = wrapText(determinationText, CONTENT_WIDTH, 10, fontBold);
  for (const line of determinationLines) {
    page.drawText(line, {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 14;
  }

  if (priorityActions.length > 0) {
    yPosition -= 30;

    page.drawText('Priority Actions Snapshot', {
      x: MARGIN,
      y: yPosition,
      size: 14,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    yPosition -= 25;

    for (const action of priorityActions.slice(0, 5)) {
      const priorityColor =
        action.priority_band === 'P1' ? rgb(0.8, 0.1, 0.1) :
        action.priority_band === 'P2' ? rgb(0.9, 0.5, 0) :
        action.priority_band === 'P3' ? rgb(0.9, 0.7, 0) :
        rgb(0.3, 0.6, 0.8);

      page.drawRectangle({
        x: MARGIN,
        y: yPosition - 4,
        width: 30,
        height: 16,
        borderColor: priorityColor,
        borderWidth: 1,
        color: rgb(1, 1, 1),
      });

      page.drawText(action.priority_band || '', {
        x: MARGIN + 6,
        y: yPosition,
        size: 9,
        font: fontBold,
        color: priorityColor,
      });

      const actionText = sanitizePdfText(action.recommended_action).substring(0, 80);
      page.drawText(actionText, {
        x: MARGIN + 40,
        y: yPosition,
        size: 9,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });

      yPosition -= 22;
    }
  }
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
  const derivedStoreys = buildingProfile ? deriveStoreysForScoring({
    storeysBand: buildingProfile.data.storeys_band,
    storeysExact: buildingProfile.data.storeys_exact || buildingProfile.data.number_of_storeys
  }) : null;
  const fraContext: FraContext = {
    occupancyRisk: (buildingProfile?.data.occupancy_risk || 'NonSleeping') as 'NonSleeping' | 'Sleeping' | 'Vulnerable',
    storeys: derivedStoreys,
  };

  // Derive executive outcome using severity engine or stored computed summary
  const openActions = actions.filter((a) => a.status === 'open' || a.status === 'in_progress');
  const computedOutcome: FraExecutiveOutcome = deriveExecutiveOutcome(openActions);
  const { isMaterialDeficiency } = checkMaterialDeficiency(openActions, fraContext);

  // Check for override in FRA-4 module data
  const hasOverride = fra4Module.data.override?.enabled === true;
  const overrideOutcome = fra4Module.data.override?.outcome;
  const overrideReason = fra4Module.data.override?.reason;
  const outcome: FraExecutiveOutcome = hasOverride && overrideOutcome ? overrideOutcome : computedOutcome;

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

  // Override notice
  if (hasOverride && overrideReason) {
    if (yPosition < MARGIN + 80) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    page.drawText('ASSESSOR OVERRIDE APPLIED', {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0.6, 0.4, 0),
    });

    yPosition -= 16;
    const overrideLines = wrapText(`Reason: ${overrideReason}`, CONTENT_WIDTH, 9, font);
    for (const line of overrideLines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
      }
      page.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 9,
        font,
        color: rgb(0.5, 0.3, 0),
      });
      yPosition -= 14;
    }

    yPosition -= 10;
  }

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
    floorAreaM2: buildingProfileEarly?.data.floor_area_m2 || buildingProfileEarly?.data.floor_area_sqm || null,
    storeysBand: buildingProfileEarly?.data.storeys_band || null,
    storeysExact: buildingProfileEarly?.data.storeys_exact || null,
    floorAreaBand: buildingProfileEarly?.data.floor_area_band || null,
    floorAreaM2Exact: buildingProfileEarly?.data.floor_area_m2 || null,
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

      yPosition -= 14;

      // Add trigger reason for P1/P2 actions in executive summary
      if ((action.priority_band === 'P1' || action.priority_band === 'P2') && action.trigger_text) {
        const reasonText = sanitizePdfText(action.trigger_text);
        const truncatedReason = reasonText.length > 80 ? reasonText.substring(0, 77) + '...' : reasonText;

        if (yPosition < MARGIN + 60) {
          const result = addNewPage(pdfDoc, isDraft, totalPages);
          page = result.page;
          yPosition = PAGE_HEIGHT - MARGIN - 20;
        }

        page.drawText(`(${truncatedReason})`, {
          x: MARGIN + 50,
          y: yPosition,
          size: 8,
          font,
          color: rgb(0.5, 0.5, 0.5),
        });

        yPosition -= 12;
      } else {
        yPosition -= 6;
      }
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
    floorAreaM2: buildingProfile?.data.floor_area_m2 || buildingProfile?.data.floor_area_sqm || null,
    storeysBand: buildingProfile?.data.storeys_band || null,
    storeysExact: buildingProfile?.data.storeys_exact || null,
    floorAreaBand: buildingProfile?.data.floor_area_band || null,
    floorAreaM2Exact: buildingProfile?.data.floor_area_m2 || null,
    sleepingRisk: buildingProfile?.data.sleeping_risk || 'None',
    layoutComplexity: buildingProfile?.data.layout_complexity || 'Simple',
    fireProtectionReliance,
  };

  const scs = calculateSCS(scsInput);

  // Use computed tone paragraph if available, otherwise generate from SCS
  let complexityParagraph = fra4Module.data.computed?.toneParagraph || '';
  if (!complexityParagraph) {
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

  // Add assessor executive commentary if present
  if (fra4Module.data.commentary?.executiveCommentary) {
    yPosition -= 20;

    if (yPosition < 200) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    page.drawText('Assessor Commentary:', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 20;
    const commentaryLines = wrapText(fra4Module.data.commentary.executiveCommentary, CONTENT_WIDTH, 11, font);
    for (const line of commentaryLines) {
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

  // Add limitations and assumptions if present
  if (fra4Module.data.commentary?.limitationsAssumptions) {
    yPosition -= 20;

    if (yPosition < 200) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    page.drawText('Limitations and Assumptions:', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 20;
    const limitationsLines = wrapText(fra4Module.data.commentary.limitationsAssumptions, CONTENT_WIDTH, 11, font);
    for (const line of limitationsLines) {
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

    case 'A7_REVIEW_ASSURANCE':
      if (data.review) {
        const checklist = [];
        if (data.review.peerReview === 'yes') checklist.push('Peer review completed');
        if (data.review.siteInspection === 'yes') checklist.push('Site inspection completed');
        if (data.review.photos === 'yes') checklist.push('Photos taken');
        if (data.review.alarmEvidence === 'yes') checklist.push('Alarm test evidence reviewed');
        if (data.review.elEvidence === 'yes') checklist.push('EL test evidence reviewed');
        if (data.review.drillEvidence === 'yes') checklist.push('Drill evidence reviewed');
        if (data.review.maintenanceLogs === 'yes') checklist.push('Maintenance logs reviewed');
        if (data.review.rpInterview === 'yes') checklist.push('RP interview completed');
        if (checklist.length > 0) {
          keyDetails.push(['Review Activities', checklist.join('; ')]);
        }
      }
      if (data.assumptionsLimitations) keyDetails.push(['Assumptions/Limitations', data.assumptionsLimitations]);
      if (data.commentary) keyDetails.push(['Commentary', data.commentary]);
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

      if (data.electrical_safety) {
        const eicr = data.electrical_safety;
        keyDetails.push(['--- Electrical Installation (EICR) ---', '']);
        if (eicr.eicr_evidence_seen) keyDetails.push(['EICR Evidence Seen', eicr.eicr_evidence_seen === 'yes' ? 'Yes' : 'No']);
        if (eicr.eicr_date_of_test) keyDetails.push(['EICR Test Date', eicr.eicr_date_of_test]);
        if (eicr.eicr_next_test_due) keyDetails.push(['EICR Next Test Due', eicr.eicr_next_test_due]);
        if (eicr.eicr_satisfactory) keyDetails.push(['EICR Satisfactory', eicr.eicr_satisfactory === 'satisfactory' ? 'Satisfactory' : eicr.eicr_satisfactory === 'unsatisfactory' ? 'UNSATISFACTORY' : eicr.eicr_satisfactory]);
        if (eicr.eicr_outstanding_c1_c2) keyDetails.push(['Outstanding C1/C2 Defects', eicr.eicr_outstanding_c1_c2 === 'yes' ? 'YES - IMMEDIATE ACTION REQUIRED' : 'No']);
        if (eicr.pat_in_place) keyDetails.push(['PAT Testing in Place', eicr.pat_in_place]);
      }
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
      if (data.firefighting) {
        const ff = data.firefighting;

        if (ff.portable_extinguishers) {
          keyDetails.push(['--- Portable Fire Extinguishers ---', '']);
          if (ff.portable_extinguishers.present) keyDetails.push(['Extinguishers Present', ff.portable_extinguishers.present]);
          if (ff.portable_extinguishers.distribution) keyDetails.push(['Distribution', ff.portable_extinguishers.distribution]);
          if (ff.portable_extinguishers.servicing_status) keyDetails.push(['Servicing Status', ff.portable_extinguishers.servicing_status]);
          if (ff.portable_extinguishers.last_service_date) keyDetails.push(['Last Service', ff.portable_extinguishers.last_service_date]);
        }

        if (ff.hose_reels) {
          keyDetails.push(['--- Hose Reels ---', '']);
          if (ff.hose_reels.installed) keyDetails.push(['Hose Reels Installed', ff.hose_reels.installed]);
          if (ff.hose_reels.servicing_status) keyDetails.push(['Servicing Status', ff.hose_reels.servicing_status]);
          if (ff.hose_reels.last_test_date) keyDetails.push(['Last Test', ff.hose_reels.last_test_date]);
        }

        if (ff.fixed_facilities) {
          keyDetails.push(['--- Fixed Firefighting Facilities ---', '']);

          if (ff.fixed_facilities.sprinklers?.installed) {
            const spk = ff.fixed_facilities.sprinklers;
            keyDetails.push(['Sprinkler System', spk.installed === 'yes' ? 'Installed' : 'Not Installed']);
            if (spk.servicing_status) keyDetails.push(['Sprinkler Servicing', spk.servicing_status === 'defective' ? 'DEFECTIVE - CRITICAL ISSUE' : spk.servicing_status]);
          }

          if (ff.fixed_facilities.dry_riser?.installed) {
            const dr = ff.fixed_facilities.dry_riser;
            keyDetails.push(['Dry Riser', dr.installed === 'yes' ? 'Installed' : dr.installed === 'no' ? 'NOT INSTALLED' : dr.installed]);
            if (dr.servicing_status) keyDetails.push(['Dry Riser Servicing', dr.servicing_status]);
          }

          if (ff.fixed_facilities.wet_riser?.installed) {
            const wr = ff.fixed_facilities.wet_riser;
            keyDetails.push(['Wet Riser', wr.installed === 'yes' ? 'Installed' : wr.installed === 'no' ? 'NOT INSTALLED' : wr.installed]);
            if (wr.servicing_status) keyDetails.push(['Wet Riser Servicing', wr.servicing_status === 'defective' ? 'DEFECTIVE - CRITICAL ISSUE' : wr.servicing_status]);
          }

          if (ff.fixed_facilities.firefighting_lift?.present) {
            keyDetails.push(['Firefighting Lift', ff.fixed_facilities.firefighting_lift.present === 'yes' ? 'Present' : ff.fixed_facilities.firefighting_lift.present === 'no' ? 'NOT PRESENT' : ff.fixed_facilities.firefighting_lift.present]);
          }
        }
      } else {
        if (data.extinguishers_present) keyDetails.push(['Extinguishers Present', data.extinguishers_present]);
        if (data.extinguishers_servicing) keyDetails.push(['Extinguishers Servicing', data.extinguishers_servicing]);
      }
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

  // Get jurisdiction-specific configuration
  const jurisdictionConfig = getJurisdictionConfig(document.jurisdiction);

  // Draw primary legislation section
  page.drawText('Primary Legislation', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  yPosition -= 18;

  for (const legislation of jurisdictionConfig.primaryLegislation) {
    if (yPosition < MARGIN + 50) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    page.drawText(`• ${sanitizePdfText(legislation)}`, {
      x: MARGIN + 10,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 14;
  }

  yPosition -= 10;

  // Draw regulatory framework text
  const paragraphs = jurisdictionConfig.regulatoryFrameworkText.split('\n\n');
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

  // Get jurisdiction-specific configuration
  const jurisdictionConfig = getJurisdictionConfig(document.jurisdiction);

  // Draw key duties as bullet points
  for (const duty of jurisdictionConfig.responsiblePersonDuties) {
    if (yPosition < MARGIN + 50) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    const dutyLines = wrapText(`• ${duty}`, CONTENT_WIDTH - 10, 11, font);
    for (const line of dutyLines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
      }

      page.drawText(line, {
        x: MARGIN + 10,
        y: yPosition,
        size: 11,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      yPosition -= 16;
    }

    yPosition -= 4;
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
        linkedTo.push(`Section: ${mapModuleKeyToSectionName(module.module_key)}`);
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

/**
 * Clean Audit Page 1 Layout
 *
 * Modern, professional risk summary page with:
 * - Clear hierarchy
 * - Generous white space
 * - No heavy borders or matrices
 * - Clean typography
 */
/**
 * Map module key to section name for Evidence Index
 * Replaces "FRA-1: Fire Hazards" with "5. Fire Hazards & Ignition Sources"
 */
function mapModuleKeyToSectionName(moduleKey: string): string {
  // Find the section that contains this module key
  for (const section of FRA_REPORT_STRUCTURE) {
    if (section.moduleKeys.includes(moduleKey)) {
      // Special handling for split sections
      if (section.id === 7 && moduleKey === 'FRA_3_ACTIVE_SYSTEMS') {
        return '7/8. Active Fire Safety Systems';
      }
      if (section.id === 10 && moduleKey === 'FRA_8_FIREFIGHTING_EQUIPMENT') {
        return '10/11. Firefighting Facilities & Equipment';
      }
      return `${section.id}. ${section.title}`;
    }
  }

  // Fallback for legacy or unmapped modules
  return 'General Evidence';
}

/**
 * Draw Table of Contents
 */
function drawTableOfContents(
  page: PDFPage,
  font: any,
  fontBold: any
): void {
  let yPosition = PAGE_HEIGHT - MARGIN - 40;

  // Title
  page.drawText('Contents', {
    x: MARGIN,
    y: yPosition,
    size: 20,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  yPosition -= 40;

  // List all sections from FRA_REPORT_STRUCTURE
  for (const section of FRA_REPORT_STRUCTURE) {
    const sectionText = `${section.id}. ${section.title}`;

    page.drawText(sectionText, {
      x: MARGIN + 20,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    yPosition -= 18;

    // Check if we need a new page
    if (yPosition < MARGIN + 50) {
      // For simplicity, we'll just stop at one page of TOC
      // If more sections are added, this could be extended
      break;
    }
  }
}

/**
 * Draw section header with number and title
 * Replaces module key printing with clean section numbering
 */
function drawSectionHeader(
  page: PDFPage,
  sectionId: number,
  sectionTitle: string,
  font: any,
  fontBold: any,
  yPosition: number
): number {
  yPosition -= 20;

  const headerText = `${sectionId}. ${sectionTitle}`;
  page.drawText(headerText, {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  yPosition -= 30;
  return yPosition;
}

/**
 * Draw assessor summary paragraph with driver bullets for technical sections (5-12)
 * Displays summary sentence + key points based on section data
 */
function drawAssessorSummary(
  page: PDFPage,
  summaryText: string,
  drivers: string[],
  font: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  // Wrap summary text
  const summaryLines = wrapText(summaryText, CONTENT_WIDTH - 40, 11, font);

  // Calculate box height needed for summary + drivers
  const lineHeight = 16;
  const boxPadding = 15;

  // Height for summary text
  let totalHeight = (summaryLines.length * lineHeight);

  // Height for "Key points:" label + bullets
  if (drivers.length > 0) {
    totalHeight += 20; // Space before "Key points:"
    totalHeight += 14; // "Key points:" label
    // Each driver bullet (with wrapping)
    for (const driver of drivers) {
      const driverLines = wrapText(driver, CONTENT_WIDTH - 70, 10, font);
      totalHeight += (driverLines.length * 14) + 2; // Line height for bullets + small gap
    }
  }

  const boxHeight = totalHeight + (boxPadding * 2);

  // Check if we need a new page
  if (yPosition - boxHeight < MARGIN + 50) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN - 20;
  }

  // Draw light background box
  const boxY = yPosition - boxHeight + boxPadding;
  page.drawRectangle({
    x: MARGIN,
    y: boxY,
    width: CONTENT_WIDTH,
    height: boxHeight,
    color: rgb(0.96, 0.97, 0.98),
    borderColor: rgb(0.85, 0.87, 0.89),
    borderWidth: 1,
  });

  // Draw "Assessor Summary" label in smaller bold text
  yPosition -= boxPadding + 2;
  page.drawText('Assessor Summary:', {
    x: MARGIN + 15,
    y: yPosition,
    size: 9,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  yPosition -= 16;

  // Draw summary text lines
  for (const line of summaryLines) {
    page.drawText(line, {
      x: MARGIN + 15,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
    yPosition -= lineHeight;
  }

  // Draw driver bullets if present
  if (drivers.length > 0) {
    yPosition -= 20; // Space before "Key points:"

    // Draw "Key points:" label
    page.drawText('Key points:', {
      x: MARGIN + 15,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });

    yPosition -= 14;

    // Draw each driver bullet
    for (const driver of drivers) {
      const driverLines = wrapText(driver, CONTENT_WIDTH - 70, 10, font);

      // Draw bullet point
      page.drawText('•', {
        x: MARGIN + 25,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });

      // Draw first line of driver text
      page.drawText(driverLines[0], {
        x: MARGIN + 35,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });

      yPosition -= 14;

      // Draw wrapped lines (if any)
      for (let i = 1; i < driverLines.length; i++) {
        page.drawText(driverLines[i], {
          x: MARGIN + 35,
          y: yPosition,
          size: 10,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
        yPosition -= 14;
      }

      yPosition -= 2; // Small gap between bullets
    }
  }

  yPosition -= boxPadding;
  yPosition -= 10; // Extra space after summary box

  return { page, yPosition };
}

/**
 * Draw module content WITHOUT printing the module key/name
 * This is drawModuleSummary but without the title
 */
function drawModuleContent(
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
  // Outcome badge
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

  // Assessor notes
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

  // Module data
  yPosition = drawModuleKeyDetails(page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  // Info gap quick actions
  yPosition = drawInfoGapQuickActions(page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

  return yPosition;
}

/**
 * Section 2: Premises & General Information (A2_BUILDING_PROFILE)
 */
function renderSection2Premises(
  page: PDFPage,
  sectionModules: ModuleInstance[],
  document: Document,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  const a2Module = sectionModules.find(m => m.module_key === 'A2_BUILDING_PROFILE');

  if (a2Module && a2Module.data) {
    const data = a2Module.data;

    // Building-specific identity (only if differs from site)
    const showBuildingDetails = data.building_name || data.has_building_address;
    if (showBuildingDetails) {
      page.drawText('Building Details', {
        x: MARGIN,
        y: yPosition,
        size: 12,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      yPosition -= 18;

      if (data.building_name) {
        page.drawText(`Building Name: ${sanitizePdfText(data.building_name)}`, {
          x: MARGIN + 10,
          y: yPosition,
          size: 10,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
        yPosition -= 14;
      }

      // Only show building address if it differs from site address (toggle is checked)
      if (data.has_building_address) {
        const buildingAddressParts = [];
        if (data.building_address_line1) buildingAddressParts.push(data.building_address_line1);
        if (data.building_address_line2) buildingAddressParts.push(data.building_address_line2);
        if (data.building_address_city) buildingAddressParts.push(data.building_address_city);
        if (data.building_address_postcode) buildingAddressParts.push(data.building_address_postcode);

        if (buildingAddressParts.length > 0) {
          const buildingAddress = sanitizePdfText(buildingAddressParts.join(', '));
          page.drawText(`Building Address: ${buildingAddress}`, {
            x: MARGIN + 10,
            y: yPosition,
            size: 10,
            font,
            color: rgb(0.2, 0.2, 0.2),
          });
          yPosition -= 14;
        }
      }

      yPosition -= 10;
    }

    // Building characteristics
    page.drawText('Building Characteristics', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 18;

    if (data.building_use) {
      page.drawText(`Use: ${sanitizePdfText(data.building_use)}`, {
        x: MARGIN + 10,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }

    if (data.number_of_storeys) {
      page.drawText(`Number of Storeys: ${data.number_of_storeys}`, {
        x: MARGIN + 10,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }

    if (data.building_height_m) {
      page.drawText(`Building Height: ${data.building_height_m} metres`, {
        x: MARGIN + 10,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }

    if (data.gross_internal_area_sqm) {
      page.drawText(`Gross Internal Area: ${data.gross_internal_area_sqm} m²`, {
        x: MARGIN + 10,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }

    yPosition -= 10;

    // Render full module content (includes outcome, assessor notes, other fields)
    yPosition = drawModuleContent(page, a2Module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  return yPosition;
}

/**
 * Section 3: Occupants & Vulnerability (A3_PERSONS_AT_RISK)
 */
function renderSection3Occupants(
  page: PDFPage,
  sectionModules: ModuleInstance[],
  document: Document,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  const a3Module = sectionModules.find(m => m.module_key === 'A3_PERSONS_AT_RISK');

  if (a3Module && a3Module.data) {
    const data = a3Module.data;

    // Occupancy profile
    page.drawText('Occupancy Profile', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 18;

    if (data.typical_occupancy_number) {
      page.drawText(`Typical Number of Occupants: ${data.typical_occupancy_number}`, {
        x: MARGIN + 10,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }

    if (data.max_occupancy_number) {
      page.drawText(`Maximum Number of Occupants: ${data.max_occupancy_number}`, {
        x: MARGIN + 10,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }

    if (data.occupancy_type) {
      page.drawText(`Occupancy Type: ${sanitizePdfText(data.occupancy_type)}`, {
        x: MARGIN + 10,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }

    yPosition -= 10;

    // Vulnerability factors
    page.drawText('Vulnerability & Special Considerations', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 18;

    if (data.vulnerable_persons_present !== undefined) {
      const vulnerableText = data.vulnerable_persons_present ? 'Yes' : 'No';
      page.drawText(`Vulnerable Persons Present: ${vulnerableText}`, {
        x: MARGIN + 10,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }

    if (data.sleeping_accommodation !== undefined) {
      const sleepingText = data.sleeping_accommodation ? 'Yes' : 'No';
      page.drawText(`Sleeping Accommodation: ${sleepingText}`, {
        x: MARGIN + 10,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }

    if (data.lone_working !== undefined) {
      const loneText = data.lone_working ? 'Yes' : 'No';
      page.drawText(`Lone Working: ${loneText}`, {
        x: MARGIN + 10,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 14;
    }

    yPosition -= 10;

    // Render full module content (includes outcome, assessor notes, other fields)
    yPosition = drawModuleContent(page, a3Module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  return yPosition;
}

/**
 * Section 4: Legislation & Duty Holder (A1_DOC_CONTROL)
 */
function renderSection4Legislation(
  page: PDFPage,
  sectionModules: ModuleInstance[],
  document: Document,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  const a1Module = sectionModules.find(m => m.module_key === 'A1_DOC_CONTROL');

  if (a1Module) {
    yPosition = drawModuleContent(page, a1Module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  return yPosition;
}

/**
 * Section 7: Fire Detection, Alarm & Warning
 * Split from FRA_3_ACTIVE_SYSTEMS (detection fields only)
 */
function renderSection7Detection(
  page: PDFPage,
  sectionModules: ModuleInstance[],
  document: Document,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  const fra3Module = sectionModules.find(m => m.module_key === 'FRA_3_ACTIVE_SYSTEMS');

  if (fra3Module && fra3Module.data) {
    // Render detection/alarm specific fields
    const detectionFields = [
      'detection_system_type',
      'detection_system_grade',
      'detection_coverage',
      'alarm_type',
      'alarm_audibility',
      'alarm_testing',
      'alarm_maintenance'
    ];

    yPosition = renderFilteredModuleData(page, fra3Module, detectionFields, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  return yPosition;
}

/**
 * Section 8: Emergency Lighting
 * Split from FRA_3_ACTIVE_SYSTEMS (emergency lighting fields only)
 */
function renderSection8EmergencyLighting(
  page: PDFPage,
  sectionModules: ModuleInstance[],
  document: Document,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  const fra3Module = sectionModules.find(m => m.module_key === 'FRA_3_ACTIVE_SYSTEMS');

  if (fra3Module && fra3Module.data) {
    // Render emergency lighting specific fields
    const lightingFields = [
      'emergency_lighting_type',
      'emergency_lighting_coverage',
      'emergency_lighting_duration',
      'emergency_lighting_testing',
      'emergency_lighting_maintenance'
    ];

    yPosition = renderFilteredModuleData(page, fra3Module, lightingFields, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  return yPosition;
}

/**
 * Section 10: Fixed Fire Suppression & Firefighting Facilities
 * Split from FRA_8 (suppression systems only)
 */
function renderSection10Suppression(
  page: PDFPage,
  sectionModules: ModuleInstance[],
  document: Document,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  const fra8Module = sectionModules.find(m => m.module_key === 'FRA_8_FIREFIGHTING_EQUIPMENT');

  if (fra8Module && fra8Module.data) {
    // Render suppression systems (sprinklers, risers, etc.)
    const suppressionFields = [
      'sprinkler_system',
      'sprinkler_type',
      'sprinkler_coverage',
      'rising_mains',
      'dry_riser_type',
      'wet_riser_type',
      'firefighting_lift',
      'firefighting_shaft'
    ];

    yPosition = renderFilteredModuleData(page, fra8Module, suppressionFields, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  return yPosition;
}

/**
 * Section 11: Fire Safety Management & Procedures
 * Combines multiple management modules + FRA_8 portable equipment
 */
function renderSection11Management(
  page: PDFPage,
  sectionModules: ModuleInstance[],
  allModules: ModuleInstance[],
  document: Document,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  // 11.1 Management Systems
  const managementSystemsModule = sectionModules.find(m =>
    m.module_key === 'A4_MANAGEMENT_CONTROLS' || m.module_key === 'FRA_6_MANAGEMENT_SYSTEMS'
  );
  if (managementSystemsModule) {
    page.drawText('11.1 Management Systems', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 20;

    yPosition = drawModuleContent(page, managementSystemsModule, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
    yPosition -= 15;
  }

  // 11.2 Emergency Arrangements
  const emergencyArrangementsModule = sectionModules.find(m =>
    m.module_key === 'A5_EMERGENCY_ARRANGEMENTS' || m.module_key === 'FRA_7_EMERGENCY_ARRANGEMENTS'
  );
  if (emergencyArrangementsModule) {
    if (yPosition < MARGIN + 100) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN;
    }

    page.drawText('11.2 Emergency Arrangements', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 20;

    yPosition = drawModuleContent(page, emergencyArrangementsModule, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
    yPosition -= 15;
  }

  // 11.3 Review & Assurance
  const reviewAssuranceModule = sectionModules.find(m => m.module_key === 'A7_REVIEW_ASSURANCE');
  if (reviewAssuranceModule) {
    if (yPosition < MARGIN + 100) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN;
    }

    page.drawText('11.3 Review & Assurance', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 20;

    yPosition = drawModuleContent(page, reviewAssuranceModule, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
    yPosition -= 15;
  }

  // 11.4 Portable Firefighting Equipment
  const fra8Module = allModules.find(m => m.module_key === 'FRA_8_FIREFIGHTING_EQUIPMENT');
  if (fra8Module && fra8Module.data) {
    if (yPosition < MARGIN + 100) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN;
    }

    page.drawText('11.4 Portable Firefighting Equipment', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 20;

    const equipmentFields = [
      'portable_extinguishers',
      'extinguisher_types',
      'extinguisher_locations',
      'hose_reels',
      'fire_blankets'
    ];

    yPosition = renderFilteredModuleData(page, fra8Module, equipmentFields, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  return yPosition;
}

/**
 * Section 14: Review & Reassessment
 */
function renderSection14Review(
  page: PDFPage,
  document: Document,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  yPosition -= 10;

  page.drawText('Review Requirements', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  yPosition -= 20;

  const reviewText = `This fire risk assessment should be reviewed and updated:

• When there are significant changes to the building, occupancy, or use
• Following any fire or near-miss incident
• When enforcement action is taken by the fire authority
• As part of the ongoing fire safety management regime

Next formal reassessment recommended: ${document.review_date ? formatDate(document.review_date) : 'To be determined by duty holder'}`;

  const reviewLines = wrapText(reviewText, CONTENT_WIDTH, 11, font);
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
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 16;
  }

  return yPosition;
}

/**
 * Helper: Render only specific fields from a module
 */
function renderFilteredModuleData(
  page: PDFPage,
  module: ModuleInstance,
  fieldKeys: string[],
  document: Document,
  font: any,
  fontBold: any,
  yPosition: number,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): number {
  // Filter module data to only include specified fields
  const filteredModule = {
    ...module,
    data: Object.keys(module.data || {})
      .filter(key => fieldKeys.includes(key))
      .reduce((obj, key) => {
        obj[key] = module.data[key];
        return obj;
      }, {} as Record<string, any>)
  };

  // Only render if there's data
  if (Object.keys(filteredModule.data).length > 0) {
    yPosition = drawModuleContent(page, filteredModule, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);
  }

  return yPosition;
}

function drawCleanAuditPage1(
  page: PDFPage,
  scoringResult: ScoringResult,
  priorityActions: Action[],
  font: any,
  fontBold: any,
  document: Document,
  organisation: Organisation,
  a1Module?: ModuleInstance
): void {
  const centerX = PAGE_WIDTH / 2;
  let yPosition = PAGE_HEIGHT - MARGIN - 40;

  // Extract site identity from A1 module (single source of truth)
  const a1Data = a1Module?.data || {};
  const siteName = sanitizePdfText(a1Data.site?.name || document.title);
  const clientName = sanitizePdfText(a1Data.client?.name || document.responsible_person || organisation.name);

  // Build site address from A1
  const siteAddressParts = [];
  if (a1Data.site?.address?.line1) siteAddressParts.push(a1Data.site.address.line1);
  if (a1Data.site?.address?.line2) siteAddressParts.push(a1Data.site.address.line2);
  if (a1Data.site?.address?.city) siteAddressParts.push(a1Data.site.address.city);
  if (a1Data.site?.address?.postcode) siteAddressParts.push(a1Data.site.address.postcode);
  const siteAddress = sanitizePdfText(siteAddressParts.join(', '));

  // Title Block (Centered)
  page.drawText('Fire Risk Assessment', {
    x: centerX - (fontBold.widthOfTextAtSize('Fire Risk Assessment', 24) / 2),
    y: yPosition,
    size: 24,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  yPosition -= 40;

  // Site Name (Centered, larger)
  const siteNameLines = wrapText(siteName, CONTENT_WIDTH - 80, 18, fontBold);
  for (const line of siteNameLines) {
    const lineWidth = fontBold.widthOfTextAtSize(line, 18);
    page.drawText(line, {
      x: centerX - (lineWidth / 2),
      y: yPosition,
      size: 18,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 26;
  }

  // Site Address (if available)
  if (siteAddress) {
    yPosition -= 5;
    const addressLines = wrapText(siteAddress, CONTENT_WIDTH - 80, 11, font);
    for (const line of addressLines) {
      const lineWidth = font.widthOfTextAtSize(line, 11);
      page.drawText(line, {
        x: centerX - (lineWidth / 2),
        y: yPosition,
        size: 11,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
      yPosition -= 16;
    }
  }

  yPosition -= 10;

  // Metadata (Centered, smaller)
  const assessmentDate = formatDate(document.assessment_date);
  const jurisdictionDisplay = getJurisdictionLabel(document.jurisdiction);

  const metadata = [
    `Prepared for: ${clientName}`,
    `Assessment Date: ${assessmentDate}`,
    `Jurisdiction: ${jurisdictionDisplay}`
  ];

  for (const line of metadata) {
    const lineWidth = font.widthOfTextAtSize(line, 11);
    page.drawText(line, {
      x: centerX - (lineWidth / 2),
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    yPosition -= 18;
  }

  yPosition -= 40;

  // Risk Summary Panel (Clean bordered box)
  const panelHeight = 180;
  const panelY = yPosition - panelHeight + 20;

  page.drawRectangle({
    x: MARGIN + 20,
    y: panelY,
    width: CONTENT_WIDTH - 40,
    height: panelHeight,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  // Risk summary content
  let panelYPos = yPosition - 25;

  // Likelihood and Consequence (side by side)
  const colX1 = MARGIN + 40;
  const colX2 = centerX + 20;

  page.drawText('Likelihood', {
    x: colX1,
    y: panelYPos,
    size: 11,
    font: fontBold,
    color: rgb(0.3, 0.3, 0.3),
  });

  page.drawText('Consequence', {
    x: colX2,
    y: panelYPos,
    size: 11,
    font: fontBold,
    color: rgb(0.3, 0.3, 0.3),
  });

  panelYPos -= 20;

  page.drawText(scoringResult.likelihood, {
    x: colX1,
    y: panelYPos,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText(scoringResult.consequence, {
    x: colX2,
    y: panelYPos,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  panelYPos -= 35;

  // Overall Risk Category (centered, prominent)
  const riskColor =
    scoringResult.overallRisk === 'Intolerable' ? rgb(0.8, 0.1, 0.1) :
    scoringResult.overallRisk === 'Substantial' ? rgb(0.9, 0.5, 0) :
    scoringResult.overallRisk === 'Moderate' ? rgb(0.9, 0.7, 0) :
    scoringResult.overallRisk === 'Tolerable' ? rgb(0.7, 0.7, 0) :
    rgb(0.2, 0.6, 0.2);

  page.drawText('Overall Risk to Life', {
    x: colX1,
    y: panelYPos,
    size: 11,
    font: fontBold,
    color: rgb(0.3, 0.3, 0.3),
  });

  panelYPos -= 22;

  page.drawText(scoringResult.overallRisk.toUpperCase(), {
    x: colX1,
    y: panelYPos,
    size: 18,
    font: fontBold,
    color: riskColor,
  });

  panelYPos -= 35;

  // Auto narrative (wrapped)
  const narrativeText = `The likelihood of fire is assessed as ${scoringResult.likelihood} and the potential consequences are assessed as ${scoringResult.consequence}. The overall risk to life is therefore assessed as ${scoringResult.overallRisk}.`;
  const narrativeLines = wrapText(narrativeText, CONTENT_WIDTH - 80, 10, font);
  for (const line of narrativeLines) {
    page.drawText(line, {
      x: colX1,
      y: panelYPos,
      size: 10,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    panelYPos -= 13;
  }

  yPosition = panelY - 20;

  // Provisional warning (if applicable)
  if (scoringResult.provisional) {
    page.drawRectangle({
      x: MARGIN + 20,
      y: yPosition - 55,
      width: CONTENT_WIDTH - 40,
      height: 60,
      borderColor: rgb(0.9, 0.7, 0),
      borderWidth: 1,
      color: rgb(1, 0.98, 0.9),
    });

    page.drawText('PROVISIONAL ASSESSMENT', {
      x: MARGIN + 35,
      y: yPosition - 25,
      size: 11,
      font: fontBold,
      color: rgb(0.6, 0.4, 0),
    });

    page.drawText('This assessment is provisional pending resolution of critical information gaps.', {
      x: MARGIN + 35,
      y: yPosition - 42,
      size: 9,
      font,
      color: rgb(0.5, 0.3, 0),
    });

    yPosition -= 75;
  }

  yPosition -= 30;

  // Priority Summary Strip (minimal, clean)
  const p1Count = priorityActions.filter(a => a.priority_band === 'P1').length;
  const p2Count = priorityActions.filter(a => a.priority_band === 'P2').length;
  const p3Count = priorityActions.filter(a => a.priority_band === 'P3').length;
  const p4Count = priorityActions.filter(a => a.priority_band === 'P4').length;

  if (p1Count + p2Count + p3Count + p4Count > 0) {
    page.drawText('Priority Actions Summary', {
      x: MARGIN + 20,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    });

    yPosition -= 25;

    const boxWidth = 80;
    const boxHeight = 50;
    const boxSpacing = 15;
    const startX = MARGIN + 20;

    const priorities = [
      { label: 'P1', count: p1Count, color: rgb(0.8, 0.1, 0.1) },
      { label: 'P2', count: p2Count, color: rgb(0.9, 0.5, 0) },
      { label: 'P3', count: p3Count, color: rgb(0.9, 0.7, 0) },
      { label: 'P4', count: p4Count, color: rgb(0.3, 0.6, 0.8) }
    ];

    priorities.forEach((p, idx) => {
      const x = startX + (idx * (boxWidth + boxSpacing));

      page.drawRectangle({
        x,
        y: yPosition - boxHeight + 10,
        width: boxWidth,
        height: boxHeight,
        borderColor: p.color,
        borderWidth: 1,
        color: rgb(1, 1, 1),
      });

      page.drawText(p.label, {
        x: x + 10,
        y: yPosition - 15,
        size: 12,
        font: fontBold,
        color: p.color,
      });

      page.drawText(p.count.toString(), {
        x: x + 10,
        y: yPosition - 35,
        size: 20,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2),
      });
    });
  }
}
