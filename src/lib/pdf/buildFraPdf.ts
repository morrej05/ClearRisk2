import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import { getModuleName } from '../modules/moduleCatalog';
import { listAttachments, type Attachment } from '../supabase/attachments';
import { type Jurisdiction, getJurisdictionConfig, getJurisdictionLabel } from '../jurisdictions';
import {
  deriveExecutiveOutcome,
  checkMaterialDeficiency,
  type FraContext,
  type FraExecutiveOutcome,
} from '../modules/fra/severityEngine';
import { drawCleanAuditSection13 } from './fraSection13CleanAudit';
import { generateSectionSummary, generateAssessorSummary, getHasEmergencyLightingSystemFromActiveSystems } from './sectionSummaryGenerator';
import { buildEvidenceRefMap } from './fra/fraCoreDraw';
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
  PAGE_TOP_Y,
  sanitizePdfText,
  normalizeDisplayValue,
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
  drawActionPlanSnapshot,
  drawRecommendationsSection,
  ensurePageSpace,
  getReportFooterTitle,
  type ActionForPdf,
} from './pdfUtils';
import { addIssuedReportPages } from './issuedPdfPages';
import { FRA_REPORT_STRUCTURE, getSectionTitle } from './fraReportStructure';
import {
  drawSectionHeaderBar,
  drawExecutiveRiskHeader,
  drawRiskBadge,
  drawRiskBand,
  drawLikelihoodConsequenceBlock,
} from './pdfPrimitives';
import { generateSectionKeyPoints, generateFiredSentences, generateSectionEvaluation } from './keyPoints/generateSectionKeyPoints';
import { drawKeyPointsBlock } from './keyPoints/drawKeyPointsBlock';
import {
  validateReportQuality,
  standardizeOutcomeLabel,
  getDisplayableOwner,
} from './reportQualityGates';
import { drawUsingThisReportSection, drawAssuranceGapsBlock } from './usingThisReportGuide';
import { Cursor, ensureCursor, ensureSpace as ensureSpaceCursor } from './pdfCursor';
import { drawSectionHeader as drawSectionHeaderCommon } from './fra/fraDrawCommon';
import { PDF_STYLES } from './pdfStyles';
import { compareActionsByDisplayReference } from './actionContracts';

// Import from refactored FRA modules
import type { Document, ModuleInstance, Action, ActionRating, Organisation, BuildPdfOptions } from './fra/fraTypes';
import { CRITICAL_FIELDS } from './fra/fraConstants';
import {
  shouldRenderSection,
  calculateSectionDensity,
  isMeaningfulValue,
  ensureSpace,
  getOrganisationDisplayName,
  computeFallbackRating,
  safeArray,
  mapModuleKeyToSectionName,
} from './fra/fraUtils';
import {
  drawModuleKeyDetails,
  drawInfoGapQuickActions,
  drawSectionHeader,
  drawAssessorSummary,
  drawModuleContent,
  renderFilteredModuleData,
  drawActionRegister,
  drawAssumptionsAndLimitations,
  drawRegulatoryFramework,
  drawResponsiblePersonDuties,
  drawAttachmentsIndex,
  drawScope,
  drawLimitations,
  drawTableOfContents,
  drawCleanAuditPage1,
} from './fra/fraCoreDraw';

import {
  renderSection1AssessmentDetails,
  renderSection2Premises,
  renderSection3Occupants,
  renderSection4Legislation,
  renderSection5FireHazards,
  renderSection7Detection,
  renderSection10Suppression,
  renderSection11Management,
  renderSection14Review,
} from './fra/fraSections';

/**
 * Get display section number (uses displayNumber if available, otherwise falls back to id)
 */
function getDisplaySectionNumber(sectionId: number): number {
  const section = FRA_REPORT_STRUCTURE.find(s => s.id === sectionId);
  return section?.displayNumber ?? section?.id ?? sectionId;
}

/**
 * Render a standard section with consistent header, evidence, and numbering
 */
async function renderStandardSection(
  cursor: Cursor,
  section: PdfSection,
  sectionModules: ModuleInstance[],
  document: Document,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  attachments: Attachment[],
  evidenceRefMap: Map<string, string>,
  moduleInstances: ModuleInstance[],
  actions: Action[],
  actionIdToSectionId: Map<string, number>
): Promise<Cursor> {
  let { page, yPosition } = cursor;

  // Section heading is drawn once in the shared section pass above.
  // Keep only module content rendering here to prevent duplicated headings.

  // Render each module in this section with full evidence support
  for (const module of sectionModules) {
    
    ({ page, yPosition } = await drawModuleContent(
      { page, yPosition },
      module,
      document,
      font,
      fontBold,
      pdfDoc,
      isDraft,
      totalPages,
      undefined, // keyPoints - let drawModuleContent handle it
      section.moduleKeys, // expectedModuleKeys - for info gap filtering
      section.id, // sectionId - for section-specific filtering
      attachments, // Pass attachments for inline evidence
      evidenceRefMap, // Pass evidence reference map
      moduleInstances, // Pass module instances for evidence linking
      actions, // Pass actions for action-linked evidence
      actionIdToSectionId // Pass action->section map for null module_instance_id fallback
    ));
  }

  return { page, yPosition };
}

export async function buildFraPdf(options: BuildPdfOptions): Promise<Uint8Array> {
  const { document, moduleInstances, actions, actionRatings, organisation, renderMode } = options;
  let attachments: Attachment[] = [];
  try {
    attachments = await listAttachments(document.id);
    } catch (error) {
    console.warn('[PDF FRA] Failed to fetch attachments:', error);
  }

  // Build evidence reference map for consistent E-00X numbering
  const evidenceRefMap = buildEvidenceRefMap(attachments);
  
  // Build actionId -> sectionId map for action-linked evidence matching
  // This allows attachments to match sections even when action.module_instance_id is null
  const actionIdToSectionId = new Map<string, number>();
  for (const action of actions) {
    if (action.module_instance_id) {
      const module = moduleInstances.find(m => m.id === action.module_instance_id);
      if (module) {
        // Use existing MODULE_KEY_TO_SECTION_ID map from fraCoreDraw
        // For now, inline the same logic here
        const section = FRA_REPORT_STRUCTURE.find(s => s.moduleKeys.includes(module.module_key));
        if (section) {
          actionIdToSectionId.set(action.id, section.id);
        }
      }
    }
    // Note: If action.module_instance_id is null/invalid and no section_reference exists,
    // the action won't be mapped. This is acceptable as we can't determine the section.
  }
  
  // Run quality gate validation
  const qualityResult = validateReportQuality(moduleInstances, actions);
  
  // ============================================================================
  // CANONICAL ACTION SORTING FOR FRA PDF
  // This is the SINGLE source of truth for action order throughout the FRA PDF
  // ============================================================================

 
  // Sort actions using canonical comparator (used everywhere in FRA PDF)
  const sortedActions = [...actions].sort(compareActionsByDisplayReference);

  // Build module_instance_id -> FRA section mapping
  const moduleToSectionMap = new Map<string, number>();
  for (const section of FRA_REPORT_STRUCTURE) {
    for (const moduleKey of section.moduleKeys) {
      const module = moduleInstances.find(m => m.module_key === moduleKey);
      if (module) {
        moduleToSectionMap.set(module.id, section.id);
      }
    }
  }

  // Prepare actions for PDF (NO fallback reference generation)
  // Use canonical DB reference_number exactly as stored, or undefined if not set
  const actionsWithRefs = sortedActions.map((action) => {
    const sectionId = moduleToSectionMap.get(action.module_instance_id);
    // Use displayNumber for section references
    const sectionRef = sectionId ? `Section ${getDisplaySectionNumber(sectionId)}` : null;

    return {
      ...action,
      // Keep original reference_number (no fallback injection)
      reference_number: action.reference_number,
      section_reference: sectionRef,
      owner_display_name: getDisplayableOwner(action.owner_display_name),
    };
  });

  console.log('[PDF FRA] Creating PDF document and embedding fonts');
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const isIssuedMode = renderMode === 'issued';
  const isDraft = !isIssuedMode;
  const totalPages: PDFPage[] = [];

  // A) DECLARE CURSOR EARLY (TDZ FIX)
  let page: PDFPage | undefined;
  let yPosition: number | undefined;

    // Use addIssuedReportPages for both draft and issued modes to ensure logo embedding
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

  // B) INITIALISE CURSOR ONCE, BEFORE ANY USE
  // ✅ Ensure we have a working cursor before any rendering logic
  if (!page || typeof yPosition !== 'number') {
    const last = totalPages[totalPages.length - 1];
    if (last) {
      page = last;
      yPosition = PAGE_TOP_Y;
    } else {
      const init = addNewPage(pdfDoc, isDraft, totalPages);
      page = init.page;
      yPosition = PAGE_TOP_Y;
    }
  }

  // Compute scoring result once for use in both Page 1 and Section 13
  let scoringResult: ScoringResult | null = null;
  if (buildingProfileModule) {
    try {
      scoringResult = scoreFraDocument({
        jurisdiction: (document.jurisdiction || 'england_wales') as any,
        buildingProfile: buildingProfileModule.data,
        moduleInstances,
      });

      const priorityActions = actions
        .filter((a) => ['P1', 'P2', 'P3'].includes(a.priority_band) && (a.status === 'open' || a.status === 'in_progress'))
        .sort(compareActionsByDisplayReference);

      const riskSummaryResult = addNewPage(pdfDoc, isDraft, totalPages);
      page = riskSummaryResult.page;
      yPosition = PAGE_TOP_Y;
      drawCleanAuditPage1(
        page,
        scoringResult,
        priorityActions,
        font,
        fontBold,
        document,
        organisation,
        documentControlModule
      );

    } catch (error) {
      console.warn('[PDF FRA] Failed to generate risk summary page:', error);
    }
  }

  // Add Table of Contents
  const r = addNewPage(pdfDoc, isDraft, totalPages);
page = r.page;
yPosition = PAGE_TOP_Y;
drawTableOfContents(page, font, fontBold);

  // Add "Using This Report" guide section (after TOC, before exec summary)
  drawUsingThisReportSection(pdfDoc, font, fontBold, isDraft, totalPages);

  addExecutiveSummaryPages(
    pdfDoc,
    isDraft,
    totalPages,
    (document.executive_summary_mode as 'ai' | 'author' | 'both' | 'none') || 'none',
    document.executive_summary_ai,
    document.executive_summary_author,
    { bold: fontBold, regular: font }
  );

  // Add Assurance Gaps block if quality issues detected (after exec summary)
  if (qualityResult.assuranceGaps.length > 0) {
    const gapsResult = addNewPage(pdfDoc, isDraft, totalPages);
    page = gapsResult.page;
    yPosition = PAGE_TOP_Y;

    // Move down to give breathing room at top
    yPosition -= 60;

    // Title - match consultancy hierarchy style
    page.drawText('Assessment Completeness', {
      x: MARGIN,
      y: yPosition,
      size: 26,
      font: fontBold,
      color: rgb(0.12, 0.16, 0.22),
    });

    // Rule line beneath heading
    page.drawLine({
      start: { x: MARGIN, y: yPosition - 8 },
      end: { x: MARGIN + CONTENT_WIDTH, y: yPosition - 8 },
      thickness: 1,
      color: rgb(0.8, 0.82, 0.85),
    });

    yPosition -= 32;

    // Note
    const noteText = 'The following areas require additional information to complete the assessment:';
    const noteLines = wrapText(noteText, CONTENT_WIDTH, 11, font);
    for (const line of noteLines) {
      page.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 11,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 16;
    }

    yPosition -= 10;

    // Draw assurance gaps
    yPosition = drawAssuranceGapsBlock(page, qualityResult.assuranceGaps, font, fontBold, yPosition);
  }

  // Add Action Plan Snapshot (after exec summary / assurance gaps)
  // Convert actions to ActionForPdf format with stable reference numbers and section refs
  const actionsForPdf: ActionForPdf[] = actionsWithRefs.map(a => ({
    id: a.id,
    reference_number: a.reference_number, // Deterministic display ref (FRA-YYYY-001, FRA-YYYY-002...) from DB
    recommended_action: a.recommended_action,
    priority_band: a.priority_band,
    status: a.status,
    section_reference: a.section_reference, // Derived from FRA_REPORT_STRUCTURE
    module_instance_id: a.module_instance_id,
    source: a.source, // Needed for deriveSystemActionTitle
    first_raised_in_version: null,
    closed_at: null,
    superseded_by_action_id: null,
    superseded_at: null,
  }));
  
  drawActionPlanSnapshot(
    pdfDoc,
    actionsForPdf,
    { bold: fontBold, regular: font },
    isDraft,
    totalPages
  );

  const regFrameworkResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = regFrameworkResult.page;
  yPosition = PAGE_TOP_Y;
  ({ page, yPosition } = drawRegulatoryFramework({ page, yPosition }, document, font, fontBold, pdfDoc, isDraft, totalPages));

  const respPersonResult = addNewPage(pdfDoc, isDraft, totalPages);
  page = respPersonResult.page;
  yPosition = PAGE_TOP_Y;
  ({ page, yPosition } = drawResponsiblePersonDuties({ page, yPosition }, document, font, fontBold, pdfDoc, isDraft, totalPages));

  // Scope page removed — Scope is now rendered within Sections 2/4 to prevent empty standalone pages
  // if (document.scope_description) {
  //   const scopeResult = addNewPage(pdfDoc, isDraft, totalPages);
  //   page = scopeResult.page;
  //   yPosition = PAGE_TOP_Y;
  //   ({ page, yPosition } = drawScope({ page, yPosition }, document.scope_description, font, fontBold, pdfDoc, isDraft, totalPages));
  // }

  if (document.limitations_assumptions) {
    const limResult = addNewPage(pdfDoc, isDraft, totalPages);
    page = limResult.page;
    yPosition = PAGE_TOP_Y;
    ({ page, yPosition } = drawLimitations({ page, yPosition }, document.limitations_assumptions, font, fontBold, pdfDoc, isDraft, totalPages));
  }

  // Section-based rendering using fixed PAS-79 skeleton
  const fra4Module = moduleInstances.find((m) =>
    m.module_key === 'FRA_4_SIGNIFICANT_FINDINGS' || m.module_key === 'FRA_90_SIGNIFICANT_FINDINGS'
  );

  // PRE-PASS: Decide which sections will be rendered compactly later
  const compactSectionIds = new Set<number>();
  const lowDensitySections: Array<{ section: any; modules: ModuleInstance[]; actions: any[] }> = [];

  for (const section of FRA_REPORT_STRUCTURE) {
    const sectionModules = moduleInstances.filter(m =>
      section.moduleKeys.includes(m.module_key)
    );

    // Skip empty sections
    if (sectionModules.length === 0 && section.id !== 13 && section.id !== 14) {
  continue;
}

    const moduleIds = sectionModules.map(m => m.id);
    const sectionActions = actionsWithRefs
      .filter(a => moduleIds.includes(a.module_instance_id))
      .map(a => ({
        id: a.id,
        reference_number: a.reference_number,
        priority: a.priority_band === 'P1' ? 1 : a.priority_band === 'P2' ? 2 : a.priority_band === 'P3' ? 3 : 4,
        status: a.status,
        recommended_action: a.recommended_action,
        priority_band: a.priority_band,
      }));

    // FORCE: Section 4 must always render (front matter governance)
    if (section.id === 4) {
      continue;
    }

    // Sections 2 & 3 must always render full (custom renderers)
    if (section.id === 2 || section.id === 3) {
      continue;
    }

    // Check if this section should be rendered compactly
    if (section.id >= 2 && section.id <= 12) {
      const shouldRender = shouldRenderSection(section.id, sectionModules, sectionActions, document);

      if (!shouldRender) {
        compactSectionIds.add(section.id);
        lowDensitySections.push({ section, modules: sectionModules, actions: sectionActions });
      }
    }
  }

  // Conditional page: only create if we don't have one yet
  if (!page) {
    const sectionStartResult = addNewPage(pdfDoc, isDraft, totalPages);
    page = sectionStartResult.page;
    yPosition = PAGE_TOP_Y;
  }

  // Section renderer map for explicit delegation
  const SECTION_RENDERERS: Record<number, (cursor: Cursor, modules: ModuleInstance[], doc: Document, f: any, fb: any, pdf: PDFDocument, draft: boolean, pages: PDFPage[], att?: any, eMap?: any, mInst?: ModuleInstance[], acts?: Action[], actToSec?: Map<string, number>) => Promise<Cursor> | Cursor> = {
    1: renderSection1AssessmentDetails,
    2: renderSection2Premises,
    3: renderSection3Occupants,
    4: renderSection4Legislation,
    5: renderSection5FireHazards,
    7: async (cursor, modules, doc, f, fb, pdf, draft, pages, att, eMap, mInst, acts, actToSec) => await renderSection7Detection(cursor, modules, doc, f, fb, pdf, draft, pages, att, eMap, mInst, acts, actToSec),
    10: async (cursor, modules, doc, f, fb, pdf, draft, pages, att, eMap, mInst, acts, actToSec) => await renderSection10Suppression(cursor, modules, doc, f, fb, pdf, draft, pages, att, eMap, mInst, acts, actToSec),
    11: async (cursor, modules, doc, f, fb, pdf, draft, pages, att, eMap, mInst, acts, actToSec) => await renderSection11Management(cursor, modules, moduleInstances, doc, f, fb, pdf, draft, pages, att, eMap, mInst, acts, actToSec),
    14: renderSection14Review,
  };

  // Render sections 1-14 using the fixed structure with flowing layout
  for (const section of FRA_REPORT_STRUCTURE) {
    // Skip sections that will be rendered compactly
    if (compactSectionIds.has(section.id)) {
      continue;
    }

    // Find modules for this section
    const sectionModules = moduleInstances.filter(m =>
      section.moduleKeys.includes(m.module_key)
    );

    // DIAGNOSTIC: Check Section 4 module key matching
    if (section.id === 4) {
      
    }

    // Skip empty sections (except special sections that have custom logic)
    if (sectionModules.length === 0 && section.id !== 13 && section.id !== 14) {
      continue;
    }

    // Get actions related to this section (use actionsWithRefs for stable IDs)
    const moduleIds = sectionModules.map(m => m.id);
    const sectionActions = actionsWithRefs
      .filter(a => moduleIds.includes(a.module_instance_id))
      .map(a => ({
        id: a.id,
        reference_number: a.reference_number,
        priority: a.priority_band === 'P1' ? 1 : a.priority_band === 'P2' ? 2 : a.priority_band === 'P3' ? 3 : 4,
        status: a.status,
        recommended_action: a.recommended_action,
        priority_band: a.priority_band,
      }));

    let keyPoints: string[] = [];
    // Keep-with-next for sections 13 and 14 (no forced breaks, just ensure header+body fit)
    const SECTION_HEADER_KEEP = 56;
    const MIN_SECTION_BODY = 56;
    const needsKeepWithNext = section.id === 13;

    if (needsKeepWithNext) {
      // Ensure header + minimal body fit together
      const spaceResult = ensureSpace(SECTION_HEADER_KEEP + MIN_SECTION_BODY, page, yPosition, pdfDoc, isDraft, totalPages);
      page = spaceResult.page;
      yPosition = spaceResult.yPosition;
    } else {
      // Flowing layout: ensure space for section header + summary with keep-with-next
      const isTechnical = section.id >= 5 && section.id <= 12;
      let requiredHeight = isTechnical
        ? PDF_STYLES.blocks.sectionHeaderWithSummary
        : PDF_STYLES.blocks.sectionHeader;

      // Apply keep-with-next: header must stay with at least one line of content
      const required = Math.max(requiredHeight, SECTION_HEADER_KEEP + MIN_SECTION_BODY);

      const spaceResult = ensureSpace(required, page, yPosition, pdfDoc, isDraft, totalPages);
      page = spaceResult.page;
      yPosition = spaceResult.yPosition;
    }

    // Right after sectionModules is computed (and before summary/key points/renderers)
if (section.id === 5) {
  
}
    // Draw section header (use displayNumber for continuous numbering)
    yPosition = drawSectionHeaderBar({
      page,
      x: MARGIN,
      y: yPosition,
      w: CONTENT_WIDTH,
      sectionNo: String(section.displayNumber ?? section.id),
      title: section.title,
      product: 'fra',
      fonts: { regular: font, bold: fontBold },
    });

    // Draw assessor summary for technical sections (5-12)
    if (section.id >= 5 && section.id <= 12) {
      const summaryWithDrivers = generateSectionSummary({
        sectionId: section.id,
        sectionTitle: section.title,
        moduleInstances: sectionModules,
        actions: sectionActions,
      });

      if (summaryWithDrivers) {
        // Use universal assessor summary generator for all sections
        // This automatically detects boilerplate and generates contextual narratives
        let summaryText = summaryWithDrivers.summary;

        // Find primary module for this section
        const primaryModule = sectionModules[0];
        if (primaryModule) {
          const generatedSummary = generateAssessorSummary(section.id, primaryModule, document);

          // Use generated summary if available (it already handles boilerplate detection internally)
          if (generatedSummary) {
            summaryText = generatedSummary;
          }
        }

        const summaryResult = drawAssessorSummary(
          page,
          summaryText,
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

      // Generate and draw Key Points (deterministic, rule-based observations)
      // For sections 5-12: show summary line + fired sentences (authored, deterministic)
      keyPoints = generateSectionKeyPoints({
        sectionId: section.id,
        moduleInstances: sectionModules,
        actions: sectionActions,
      });

      if (keyPoints.length > 0) {
        // For sections 5-12, add summary line above key points
        if (section.id >= 5 && section.id <= 12) {
          const evaluation = generateSectionEvaluation({
            sectionId: section.id,
            moduleInstances: sectionModules,
            actions: sectionActions,
          });

          // Ensure space for summary line
            if (yPosition < MARGIN + 60) {
              const result = addNewPage(pdfDoc, isDraft, totalPages);
              page = result.page;
              yPosition = PAGE_TOP_Y;
            }
            
            // Tighter spacing above evaluation summary
            yPosition -= 8;
            
            page.drawText(sanitizePdfText(evaluation.summary), {
              x: MARGIN,
              y: yPosition,
              size: 10,
              font,
              color: rgb(0.3, 0.3, 0.3),
            });
            
            // Space before Key Points block (only if we're about to render them)
          if (keyPoints.length > 0) {
            yPosition -= 22;
          } else {
            yPosition -= 8; // small separation when no bullets follow
          }
        }

        const keyPointsResult = drawKeyPointsBlock({
          page,
          keyPoints,
          font,
          fontBold,
          yPosition,
          pdfDoc,
          isDraft,
          totalPages,
        });
        page = keyPointsResult.page;
        yPosition = keyPointsResult.yPosition;
      }
    }

    // Section-specific rendering
    // Ensure cursor is valid before section renderers
    let cursor = ensureCursor({ page, yPosition }, pdfDoc, isDraft, totalPages);

    // Special case: Section 13 (Significant Findings)
    if (section.id === 13) {
      if (fra4Module) {
        // Filter actions to only those belonging to FRA modules (in moduleToSectionMap)
        // This excludes actions from FSD, DSEAR, or other non-FRA modules
        const fraModuleIds = Array.from(moduleToSectionMap.keys());
        const section13Actions = actionsWithRefs.filter(a => fraModuleIds.includes(a.module_instance_id));

        const section13Result = drawCleanAuditSection13({
          page: cursor.page,
          fra4Module,
          actions: section13Actions,
          moduleInstances,
          font,
          fontBold,
          yPosition: cursor.yPosition,
          pdfDoc,
          isDraft,
          totalPages,
          scoringResult,
        });
        page = section13Result.page;
        yPosition = section13Result.yPosition;
      }
    } else {
      // Use section renderer if available, otherwise fallback to generic rendering
      const renderer = SECTION_RENDERERS[section.id];
      
      if (renderer) {
        cursor = await renderer(cursor, sectionModules, document, font, fontBold, pdfDoc, isDraft, totalPages, attachments, evidenceRefMap, moduleInstances, actions, actionIdToSectionId);
        ({ page, yPosition } = cursor);
      } else {
        // Use standard section renderer for consistent header, evidence, and numbering
        cursor = await renderStandardSection(
          { page, yPosition },
          section,
          sectionModules,
          document,
          font,
          fontBold,
          pdfDoc,
          isDraft,
          totalPages,
          attachments,
          evidenceRefMap,
          moduleInstances,
          actions,
          actionIdToSectionId
        );
        ({ page, yPosition } = cursor);
      }
    }
  }

  // Render low-density sections in compact format
  if (lowDensitySections.length > 0) {
    // Ensure space for compact section header
    const spaceResult = ensureSpace(64, page, yPosition, pdfDoc, isDraft, totalPages);
    page = spaceResult.page;
    yPosition = spaceResult.yPosition;

    // Title for compact sections block
    yPosition -= 20;
    page.drawText('Additional Assessment Areas (No Significant Findings)', {
      x: MARGIN,
      y: yPosition,
      size: 14,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 10;

    page.drawText('The following areas were assessed with no material deficiencies or actions identified:', {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    yPosition -= 25;

    // Render each low-density section compactly
    for (const { section, modules, actions: sectionActions } of lowDensitySections) {
      // Sections 2 & 3 must never render in compact mode (they have custom renderers)
      if (section.id === 2 || section.id === 3) continue;

      // Check if we need a new page
      const compactResult = ensureSpace(40, page, yPosition, pdfDoc, isDraft, totalPages);
      page = compactResult.page;
      yPosition = compactResult.yPosition;

      // Section number and title (use displayNumber)
      const displayNum = getDisplaySectionNumber(section.id);
      page.drawText(`${displayNum}. ${section.title}`, {
        x: MARGIN + 10,
        y: yPosition,
        size: 11,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 16;

      // Outcome badge if available
      const outcome = modules[0]?.outcome;
      if (outcome) {
        const outcomeLabel = getOutcomeLabel(outcome);
        page.drawText(`  • Outcome: ${outcomeLabel}`, {
          x: MARGIN + 20,
          y: yPosition,
          size: 9,
          font,
          color: rgb(0.5, 0.5, 0.5),
        });
        yPosition -= 14;
      }

      // Brief note if assessor notes exist
      const notes = modules[0]?.assessor_notes;
      if (notes && notes.trim().length > 0) {
        const briefNote = notes.length > 80 ? notes.substring(0, 77) + '...' : notes;
        const noteLines = wrapText(`  • ${briefNote}`, CONTENT_WIDTH - 20, 9, font);
        for (const line of noteLines) {
          const noteResult = ensureSpace(14, page, yPosition, pdfDoc, isDraft, totalPages);
          page = noteResult.page;
          yPosition = noteResult.yPosition;

          page.drawText(sanitizePdfText(line), {
            x: MARGIN + 20,
            y: yPosition,
            size: 9,
            font,
            color: rgb(0.5, 0.5, 0.5),
          });
          yPosition -= 14;
        }
      }

      yPosition -= 8;
    }
  }

  if (isIssuedMode && actionsWithRefs.length > 0) {
    const actionsForPdf = actionsWithRefs.map((action: any) => ({
      id: action.id,
      reference_number: action.reference_number || null,
      recommended_action: action.recommended_action,
      priority_band: action.priority_band,
      status: action.status,
      source: action.source, // Needed for deriveSystemActionTitle
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
    yPosition = PAGE_TOP_Y;
    yPosition = drawLikelihoodConsequenceExplanation(page, font, fontBold, yPosition, pdfDoc, isDraft, totalPages);

    console.log('[PDF] actions sample (before register)', (actionsWithRefs || []).slice(0,3).map(a => ({
      id: a.id,
      source: a.source,
      ref: a.reference_number,
      text: (a.recommended_action||'').slice(0,60),
    })));

    ({ page, yPosition } = await drawActionRegister({ page, yPosition }, actionsWithRefs, actionRatings, moduleInstances, font, fontBold, pdfDoc, isDraft, totalPages, attachments, evidenceRefMap));
  }

// --- APPENDICES ---
// Goal:
// 1) Action Register stands alone (no forced blank pre-page).
// 2) Attachments & Evidence Index ALWAYS starts on a fresh page.
// 3) Assumptions & Limitations follows on the SAME page as Attachments if there is space,
//    otherwise it starts a new page.

const ASSUMPTIONS_MIN = 160; // header + a few lines (tune if needed)

if (attachments.length > 0) {
  // Start attachments on a fresh page (appendix-style)
  const attStart = addNewPage(pdfDoc, isDraft, totalPages);
  page = attStart.page;
  yPosition = PAGE_TOP_Y;

  ({ page, yPosition } = drawAttachmentsIndex(
    { page, yPosition },
    attachments,
    moduleInstances,
    actions,
    font,
    fontBold,
    pdfDoc,
    isDraft,
    totalPages
  ));

  // Try to keep Assumptions & Limitations on the same page as the attachments index
  ({ page, yPosition } = ensureSpace(ASSUMPTIONS_MIN, page, yPosition, pdfDoc, isDraft, totalPages));

  ({ page, yPosition } = drawAssumptionsAndLimitations(
    { page, yPosition },
    document,
    fra4Module,
    font,
    fontBold,
    pdfDoc,
    isDraft,
    totalPages
  ));
} else {
  // No attachments: render Assumptions & Limitations as normal (no attempt to share)
  ({ page, yPosition } = ensureSpace(ASSUMPTIONS_MIN, page, yPosition, pdfDoc, isDraft, totalPages));

  ({ page, yPosition } = drawAssumptionsAndLimitations(
    { page, yPosition },
    document,
    fra4Module,
    font,
    fontBold,
    pdfDoc,
    isDraft,
    totalPages
  ));
}

// (footer logic continues below as you already have it)
  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const versionNum = (document as any).version_number ?? document.version ?? 1;
  const footerReportTitle = getReportFooterTitle(document.document_type, document.title);
  const footerText = `FRA Report — ${footerReportTitle} —     v${versionNum}.0 — Generated ${today}`;

  const startPageForFooters = isIssuedMode ? 2 : 1;
  for (let i = startPageForFooters; i < totalPages.length; i++) {
    drawFooter(totalPages[i], footerText, i, totalPages.length - 1, font);
  }

  if ((document as any).issue_status === 'superseded') {
    await addSupersededWatermark(pdfDoc);
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

function drawRiskSummaryPage(
  page: PDFPage,
  scoringResult: ScoringResult,
  priorityActions: Action[],
  font: any,
  fontBold: any,
  document: Document
): void {
  let yPosition = PAGE_TOP_Y;

  const fonts = { regular: font, bold: fontBold };

  const riskLabel = scoringResult.overallRisk;
  const likelihoodLabel = sanitizePdfText(
    normalizeDisplayValue(scoringResult?.likelihood ?? '')
  ).trim();
  const consequenceLabel = sanitizePdfText(
    normalizeDisplayValue(scoringResult?.consequence ?? '')
  ).trim();

  yPosition = drawExecutiveRiskHeader({
    page,
    x: MARGIN,
    y: yPosition,
    w: CONTENT_WIDTH,
    label: 'Overall Risk to Life',
    fonts,
  });

  yPosition = drawRiskBadge({
    page,
    x: MARGIN,
    y: yPosition,
    riskLabel,
    fonts,
  });

  yPosition = drawRiskBand({
    page,
    x: MARGIN,
    y: yPosition,
    w: CONTENT_WIDTH,
    riskLabel,
    fonts,
  });

  yPosition -= 24; // Additional gap below risk band

  yPosition = drawLikelihoodConsequenceBlock({
    page,
    x: MARGIN,
    y: yPosition,
    w: CONTENT_WIDTH,
    likelihood: likelihoodLabel,
    consequence: consequenceLabel,
    fonts,
  });

  if (scoringResult.provisional) {
    yPosition -= 10;

    page.drawRectangle({
      x: MARGIN,
      y: yPosition - 40,
      width: CONTENT_WIDTH,
      height: 60 + (scoringResult.provisionalReasons.length * 15),
      borderColor: PDF_THEME.colours.risk.medium.border,
      borderWidth: 1.5,
      color: PDF_THEME.colours.risk.medium.bg,
    });

    page.drawText('PROVISIONAL ASSESSMENT', {
      x: MARGIN + 10,
      y: yPosition - 15,
      size: 12,
      font: fontBold,
      color: PDF_THEME.colours.risk.medium.fg,
    });

    yPosition -= 30;

    for (const reason of scoringResult.provisionalReasons) {
      const reasonText = sanitizePdfText(reason);
      page.drawText(`- ${reasonText}`, {
        x: MARGIN + 15,
        y: yPosition,
        size: 10,
        font,
        color: PDF_THEME.colours.risk.medium.fg,
      });
      yPosition -= 15;
    }

    yPosition -= 25;
  }

  yPosition -= 20;

  const likeText = sanitizePdfText(normalizeDisplayValue(scoringResult?.likelihood ?? ''));
  const consText = sanitizePdfText(normalizeDisplayValue(scoringResult?.consequence ?? ''));

  const determinationText = `The overall risk to life is assessed as ${scoringResult.overallRisk} based on the combination of ${likeText} likelihood and ${consText} consequence. ${scoringResult.provisional ? 'This assessment is provisional pending resolution of critical information gaps.' : 'This assessment is based on complete information gathered during the survey.'}`;
  const determinationLines = wrapText(determinationText, CONTENT_WIDTH, 10, font);
  for (const line of determinationLines) {
    page.drawText(line, {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
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
      // Use PDF_THEME token-based colors for priority bands
      const priorityColor =
        action.priority_band === 'P1' ? PDF_THEME.colours.risk.high.fg :
        action.priority_band === 'P2' ? PDF_THEME.colours.risk.medium.fg :
        action.priority_band === 'P3' ? PDF_THEME.colours.risk.info.fg :
        PDF_THEME.colours.risk.info.fg;

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
    color: PDF_THEME.colours.text.primary,
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
  const statusColor = isIssued ? PDF_THEME.colours.risk.low.fg : isSuperseded ? PDF_THEME.colours.risk.medium.fg : PDF_THEME.colours.neutral[500];
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

  // Get jurisdiction display name using centralized function
  const jurisdictionName = getJurisdictionLabel(document.jurisdiction);

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

function drawExecutiveSummary(
  cursor: Cursor,
  fra4Module: ModuleInstance,
  actions: Action[],
  actionRatings: ActionRating[],
  moduleInstances: ModuleInstance[],
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  let { page, yPosition } = cursor;
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

  const outcomeColor = outcomeColors[outcome];

  page.drawText('Overall Fire Safety Assessment:', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 25;

const padX = 14;
const textW = fontBold.widthOfTextAtSize(outcomeLabel, 14);
const boxW = Math.min(CONTENT_WIDTH, textW + padX * 2);

page.drawRectangle({
  x: MARGIN,
  y: yPosition - 5,
  width: boxW,
  height: 30,
  color: outcomeColor,
});

page.drawText(outcomeLabel, {
  x: MARGIN + padX,
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
      yPosition = PAGE_TOP_Y;
    }

    page.drawText('ASSESSOR OVERRIDE APPLIED', {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: PDF_THEME.colours.risk.medium.fg,
    });

    yPosition -= 16;
    const overrideLines = wrapText(`Reason: ${overrideReason}`, CONTENT_WIDTH, 9, font);
    for (const line of overrideLines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_TOP_Y;
      }
      page.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 9,
        font,
        color: PDF_THEME.colours.risk.medium.fg,
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
      yPosition = PAGE_TOP_Y;
    }

    const warningText = 'Material fire safety deficiencies have been identified which require urgent attention.';
    page.drawText(warningText, {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: PDF_THEME.colours.risk.high.fg,
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
    color: PDF_THEME.colours.risk.high.fg,
  });

  yPosition -= 18;
  page.drawText(`P2 (Urgent): ${p2Actions}`, {
    x: MARGIN + 10,
    y: yPosition,
    size: 11,
    font,
    color: PDF_THEME.colours.risk.medium.fg,
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

  // Derive emergency lighting presence from Section 7 owner module (via helper)
  // Single source of truth for EL system existence across all SCS/reliance calculations
  const hasEmergencyLightingSystem = getHasEmergencyLightingSystemFromActiveSystems(moduleInstances);

  // Calculate SCS for top issues weighting (early calculation)
  const buildingProfileEarly = moduleInstances.find((m) => m.module_key === 'A2_BUILDING_PROFILE');
  const protectionModuleEarly = moduleInstances.find((m) => m.module_key === 'FRA_3_FIRE_PROTECTION');
  const protectionDataEarly: FireProtectionModuleData = {
    hasDetectionSystem: protectionModuleEarly?.data?.detection_system_present === true,
    hasEmergencyLighting: hasEmergencyLightingSystem,
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
      yPosition = PAGE_TOP_Y;
    }

    page.drawText('Key Issues Requiring Attention:', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 22;

    // Sort actions by reference number (stable professional order)
    const sortedTopActions = [...openActions].sort(compareActionsByDisplayReference);

    const topActions = sortedTopActions.slice(0, 3);

    for (let i = 0; i < topActions.length; i++) {
      const action = topActions[i];
      const actionText = action.recommended_action || '(No action text)';
      const truncatedText = actionText.length > 100 ? actionText.substring(0, 100) + '...' : actionText;

      if (yPosition < MARGIN + 80) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_TOP_Y;
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
          yPosition = PAGE_TOP_Y;
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
    color: materialDefCount > 0 ? PDF_THEME.colours.risk.high.fg : rgb(0, 0, 0),
  });

  yPosition -= 18;
  page.drawText(`Information Gaps: ${infoGapCount}`, {
    x: MARGIN + 10,
    y: yPosition,
    size: 11,
    font,
    color: infoGapCount > 0 ? PDF_THEME.colours.risk.medium.fg : rgb(0, 0, 0),
  });

  // Calculate and display Structural Complexity Score context
  yPosition -= 30;
  if (yPosition < MARGIN + 100) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_TOP_Y;
  }

  // Derive fire protection reliance from modules
  const protectionModule = moduleInstances.find((m) => m.module_key === 'FRA_3_FIRE_PROTECTION');
  const protectionData: FireProtectionModuleData = {
    hasDetectionSystem: protectionModule?.data?.detection_system_present === true,
    hasEmergencyLighting: hasEmergencyLightingSystem,
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

  // Preflight entire Building Complexity block
  const complexityLines = wrapText(complexityParagraph, CONTENT_WIDTH, 11, font);
  const requiredHeight = 20 + 20 + (complexityLines.length * 16);
  ({ page, yPosition } = ensurePageSpace(
    requiredHeight,
    page,
    yPosition,
    pdfDoc,
    isDraft,
    totalPages
  ));

  page.drawText('Building Complexity:', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 20;
  for (const line of complexityLines) {
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

    // Preflight entire Assessor Commentary block
    const commentaryLines = wrapText(fra4Module.data.commentary.executiveCommentary, CONTENT_WIDTH, 11, font);
    const requiredHeight = 20 + 20 + (commentaryLines.length * 16);
    ({ page, yPosition } = ensurePageSpace(
      requiredHeight,
      page,
      yPosition,
      pdfDoc,
      isDraft,
      totalPages
    ));

    page.drawText('Assessor Commentary', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 20;
    for (const line of commentaryLines) {
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

    // Preflight entire Limitations and Assumptions block
    const limitationsLines = wrapText(fra4Module.data.commentary.limitationsAssumptions, CONTENT_WIDTH, 11, font);
    const requiredHeight = 20 + 20 + (limitationsLines.length * 16);
    ({ page, yPosition } = ensurePageSpace(
      requiredHeight,
      page,
      yPosition,
      pdfDoc,
      isDraft,
      totalPages
    ));

    page.drawText('Limitations and Assumptions:', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 20;
    for (const line of limitationsLines) {
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

    // Preflight entire Summary block
    const summaryLines = wrapText(fra4Module.data.executive_summary, CONTENT_WIDTH, 11, font);
    const requiredHeight = 20 + 20 + (summaryLines.length * 16);
    ({ page, yPosition } = ensurePageSpace(
      requiredHeight,
      page,
      yPosition,
      pdfDoc,
      isDraft,
      totalPages
    ));

    page.drawText('Summary:', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 20;
    for (const line of summaryLines) {
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

    // Preflight entire Review Recommendation block
    const reviewLines = wrapText(fra4Module.data.review_recommendation, CONTENT_WIDTH, 11, font);
    const requiredHeight = 20 + 20 + (reviewLines.length * 16);
    ({ page, yPosition } = ensurePageSpace(
      requiredHeight,
      page,
      yPosition,
      pdfDoc,
      isDraft,
      totalPages
    ));

    page.drawText('Review Recommendation:', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 20;
    for (const line of reviewLines) {
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
  cursor: Cursor,
  fra4Module: ModuleInstance,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  let { page, yPosition } = cursor;
  const storedOverrideJustification = fra4Module.data.override_justification;
  const hasOverride = !!storedOverrideJustification;

  yPosition -= 40;

  if (yPosition < MARGIN + 250) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_TOP_Y;
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
      yPosition = PAGE_TOP_Y;
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
      yPosition = PAGE_TOP_Y;
    }

    const lines = wrapText(ratingLine, CONTENT_WIDTH - 15, 10, font);
    for (const line of lines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_TOP_Y;
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
        yPosition = PAGE_TOP_Y;
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

  return { page, yPosition };
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
  cursor: Cursor,
  module: ModuleInstance,
  document: Document,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): Cursor {
  let { page, yPosition } = cursor;
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
    
    // Light tag (not a slab)
    page.drawRectangle({
      x: MARGIN + 70,
      y: yPosition - 4,
      width: 140,
      height: 14,
      color: rgb(0.93, 0.93, 0.93),
      borderColor: rgb(0.80, 0.80, 0.80),
      borderWidth: 0.5,
    });
    
    page.drawText(outcomeLabel, {
      x: MARGIN + 76,
      y: yPosition - 1,
      size: 10,
      font: fontBold,
      color: rgb(0.25, 0.25, 0.25),
    });
    
    // Tighter spacing after outcome
    yPosition -= 18;
  }

  if (module.assessor_notes && module.assessor_notes.trim()) {
     const notesLines = wrapText(module.assessor_notes, CONTENT_WIDTH, 10, font);
    const notesBlockHeight = 18 + (notesLines.length * 14) + 10;
    ({ page, yPosition } = ensurePageSpace(notesBlockHeight, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText('Assessor Notes:', {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 18;
    for (const line of notesLines) {
      
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

  ({ page, yPosition } = drawModuleKeyDetails({ page, yPosition }, module, document, font, fontBold, pdfDoc, isDraft, totalPages));

  // Draw info gap quick actions if detected
  const infoGapResult = drawInfoGapQuickActions({
    page,
    module,
    document,
    font,
    fontBold,
    yPosition,
    pdfDoc,
    isDraft,
    totalPages,
    callerContext: 'drawModuleSummaryWithoutTitle',
  });
  page = infoGapResult.page;
  yPosition = infoGapResult.yPosition;

  return { page, yPosition };
}
