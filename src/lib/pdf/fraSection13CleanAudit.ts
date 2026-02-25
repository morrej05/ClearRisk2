/**
 * Section 13 - Clean Audit Format
 *
 * Professional "assessor voice" for Overall Risk Assessment
 * Replaces database dump with clear, competent assessment narrative
 */

import { PDFDocument, PDFPage, rgb } from 'pdf-lib';
import type { Action, ModuleInstance } from '../supabase/attachments';
import {
  sanitizePdfText,
  wrapText,
  addNewPage,
  PAGE_HEIGHT,
  MARGIN,
  CONTENT_WIDTH,
} from './pdfUtils';
import {
  deriveExecutiveOutcome,
  checkMaterialDeficiency,
  type FraContext,
  type FraExecutiveOutcome,
} from '../modules/fra/severityEngine';
import {
  calculateSCS,
  deriveStoreysForScoring,
  type FraBuildingComplexityInput,
} from '../modules/fra/complexityEngine';
import type { ScoringResult } from '../fra/scoring/scoringEngine';

interface CleanAuditOptions {
  page: PDFPage;
  fra4Module: ModuleInstance;
  actions: Action[];
  moduleInstances: ModuleInstance[];
  font: any;
  fontBold: any;
  yPosition: number;
  pdfDoc: PDFDocument;
  isDraft: boolean;
  totalPages: PDFPage[];
  scoringResult: ScoringResult | null;
}

function getPriorityColor(priority: string): ReturnType<typeof rgb> {
  switch (priority) {
    case 'P1':
      return rgb(0.7, 0, 0);
    case 'P2':
      return rgb(0.8, 0.4, 0);
    case 'P3':
      return rgb(0.9, 0.6, 0);
    default:
      return rgb(0.5, 0.5, 0.5);
  }
}

export function drawCleanAuditSection13(options: CleanAuditOptions): { page: PDFPage; yPosition: number } {
  let { page, fra4Module, actions, moduleInstances, font, fontBold, yPosition, pdfDoc, isDraft, totalPages, scoringResult } = options;

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

  // Derive executive outcome
  const openActions = actions.filter((a) => a.status === 'open' || a.status === 'in_progress');
  const computedOutcome: FraExecutiveOutcome = deriveExecutiveOutcome(openActions);
  const { isMaterialDeficiency } = checkMaterialDeficiency(openActions, fraContext);

  // Check for override
  const hasOverride = fra4Module.data.override?.enabled === true;
  const overrideOutcome = fra4Module.data.override?.outcome;
  const overrideReason = fra4Module.data.override?.reason;
  const outcome: FraExecutiveOutcome = hasOverride && overrideOutcome ? overrideOutcome : computedOutcome;

  // Calculate SCS for context
  const scsInput: FraBuildingComplexityInput = {
    storeys: buildingProfile?.data.number_of_storeys || null,
    floorAreaM2: buildingProfile?.data.floor_area_m2 || buildingProfile?.data.floor_area_sqm || null,
    storeysBand: buildingProfile?.data.storeys_band || null,
    storeysExact: buildingProfile?.data.storeys_exact || null,
    floorAreaBand: buildingProfile?.data.floor_area_band || null,
    floorAreaM2Exact: buildingProfile?.data.floor_area_m2 || null,
    sleepingRisk: buildingProfile?.data.sleeping_risk || 'None',
    layoutComplexity: buildingProfile?.data.layout_complexity || 'Simple',
    fireProtectionReliance: 'Moderate', // Simplified for now
  };
  const scs = calculateSCS(scsInput);

  // Info gaps count
  const infoGapCount = moduleInstances.filter((m) => m.outcome === 'info_gap').length;

  // ========================================================
  // 1. OVERALL RISK TO LIFE (Large, Prominent)
  // ========================================================
  yPosition -= 20;
  page.drawText('OVERALL RISK TO LIFE ASSESSMENT', {
    x: MARGIN,
    y: yPosition,
    size: 18,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 40;

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

  // Large outcome box
  page.drawRectangle({
    x: MARGIN,
    y: yPosition - 10,
    width: Math.min(CONTENT_WIDTH, outcomeLabel.length * 8 + 40),
    height: 40,
    color: outcomeColor,
  });
  page.drawText(outcomeLabel, {
    x: MARGIN + 15,
    y: yPosition + 5,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  yPosition -= 50;

  // Override notice (if applicable)
  if (hasOverride && overrideReason) {
    if (yPosition < MARGIN + 80) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    page.drawText('Note: Assessor professional judgement override applied', {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.6, 0.4, 0),
    });

    yPosition -= 16;
    const overrideLines = wrapText(sanitizePdfText(overrideReason), CONTENT_WIDTH, 9, font);
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

    yPosition -= 15;
  }

  // ========================================================
  // 2. LIKELIHOOD AND CONSEQUENCE
  // ========================================================
  if (yPosition < MARGIN + 120) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN - 20;
  }

  page.drawText('Likelihood and Consequence', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  yPosition -= 44; // Increased spacing (2 baseline steps) before likelihood details

  // Check for assessor override
  const hasLikelihoodOverride = fra4Module.data.override_likelihood !== undefined && fra4Module.data.override_likelihood !== null;
  const hasConsequenceOverride = fra4Module.data.override_consequence !== undefined && fra4Module.data.override_consequence !== null;

  // Use override values if present, otherwise use computed values from scoringResult
  const likelihood = hasLikelihoodOverride
    ? fra4Module.data.override_likelihood
    : (scoringResult?.likelihood || 'Medium');
  const consequence = hasConsequenceOverride
    ? fra4Module.data.override_consequence
    : (scoringResult?.consequence || 'Moderate');

  const overallRisk = (hasLikelihoodOverride || hasConsequenceOverride)
    ? (fra4Module.data.override_overall_risk || 'Moderate')
    : (scoringResult?.overallRisk || 'Moderate');

  // Show override notice if applicable
  if (hasLikelihoodOverride || hasConsequenceOverride) {
    page.drawText('Assessor override applied', {
      x: MARGIN + 10,
      y: yPosition,
      size: 9,
      font,
      color: rgb(0.6, 0.4, 0),
    });
    yPosition -= 16;
  }

  page.drawText(`Likelihood of Fire: ${likelihood}`, {
    x: MARGIN + 10,
    y: yPosition,
    size: 11,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  yPosition -= 18;
  page.drawText(`Consequence to Life if Fire Occurs: ${consequence}`, {
    x: MARGIN + 10,
    y: yPosition,
    size: 11,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  yPosition -= 18;
  page.drawText(`Overall Risk: ${overallRisk}`, {
    x: MARGIN + 10,
    y: yPosition,
    size: 11,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  yPosition -= 30;

  // ========================================================
  // 3. BASIS OF ASSESSMENT (3-5 Line Narrative)
  // ========================================================
  if (yPosition < MARGIN + 150) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_HEIGHT - MARGIN - 20;
  }

  page.drawText('Basis of Assessment', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  yPosition -= 20;

  // Generate professional narrative based on context
  const p1Count = openActions.filter((a) => a.priority_band === 'P1').length;
  const p2Count = openActions.filter((a) => a.priority_band === 'P2').length;
  const materialDefCount = moduleInstances.filter((m) => m.outcome === 'material_def').length;

  let narrativeParts: string[] = [];

  // Complexity context
  const complexityText = fra4Module.data.computed?.toneParagraph ||
    (scs.band === 'VeryHigh' ? 'The premises comprises a complex building with significant reliance on structural and active fire protection systems.' :
     scs.band === 'High' ? 'The building presents structural and occupancy complexity which increases reliance on fire protection measures.' :
     scs.band === 'Moderate' ? 'The premises is of moderate complexity requiring structured fire safety management.' :
     'The premises is of relatively straightforward layout and use.');

  narrativeParts.push(complexityText);

  // Findings context
  if (p1Count > 0) {
    narrativeParts.push(`${p1Count} immediate priority issue${p1Count > 1 ? 's' : ''} requiring urgent attention ${p1Count > 1 ? 'have' : 'has'} been identified.`);
  } else if (p2Count > 0) {
    narrativeParts.push(`${p2Count} urgent priority issue${p2Count > 1 ? 's' : ''} requiring prompt attention ${p2Count > 1 ? 'have' : 'has'} been identified.`);
  } else if (openActions.length > 0) {
    narrativeParts.push(`${openActions.length} improvement action${openActions.length > 1 ? 's' : ''} ${openActions.length > 1 ? 'have' : 'has'} been identified to enhance fire safety provisions.`);
  } else {
    narrativeParts.push('No significant deficiencies were identified during the assessment.');
  }

  // Material deficiency context
  if (materialDefCount > 0) {
    narrativeParts.push(`Material deficiencies were identified in ${materialDefCount} fire safety category${materialDefCount > 1 ? 'ies' : 'y'}.`);
  }

  const narrativeText = narrativeParts.join(' ');
  const narrativeLines = wrapText(narrativeText, CONTENT_WIDTH, 11, font);
  for (const line of narrativeLines) {
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

  yPosition -= 15;

  // ========================================================
  // 4. PROVISIONAL STATEMENT (If Info Gaps Present)
  // ========================================================
  const isProvisional = scoringResult?.provisional || infoGapCount > 0;
  if (isProvisional) {
    if (yPosition < MARGIN + 100) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    page.drawText('Provisional Assessment', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0.6, 0.4, 0),
    });

    yPosition -= 20;

    // Use specific reasons from scoring engine if available, otherwise generic text
    let provisionalText: string;
    if (scoringResult?.provisionalReasons && scoringResult.provisionalReasons.length > 0) {
      provisionalText = `This assessment is provisional due to: ${scoringResult.provisionalReasons.join('; ')}. The overall risk rating may change once complete information is obtained and these areas are fully assessed.`;
    } else {
      provisionalText = `This assessment is provisional in ${infoGapCount} area${infoGapCount > 1 ? 's' : ''} due to missing information or restricted access. The overall risk rating may change once complete information is obtained and these areas are fully assessed.`;
    }

    const provisionalLines = wrapText(provisionalText, CONTENT_WIDTH, 11, font);
    for (const line of provisionalLines) {
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
        color: rgb(0.6, 0.4, 0),
      });
      yPosition -= 16;
    }

    yPosition -= 15;
  }

  // ========================================================
  // 5. TOP 3 PRIORITY ISSUES
  // ========================================================
  if (openActions.length > 0) {
    if (yPosition < MARGIN + 150) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    page.drawText('Priority Issues', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    yPosition -= 22;

    // Sort and get top 3
    const sortedActions = [...openActions].sort((a, b) => {
      const priorityOrder = { P1: 1, P2: 2, P3: 3, P4: 4 };
      const aPriority = priorityOrder[a.priority_band as keyof typeof priorityOrder] || 5;
      const bPriority = priorityOrder[b.priority_band as keyof typeof priorityOrder] || 5;

      if (aPriority !== bPriority) return aPriority - bPriority;

      // For High/VeryHigh SCS, prefer critical categories
      if (scs.band === 'High' || scs.band === 'VeryHigh') {
        const criticalCategories = ['MeansOfEscape', 'DetectionAlarm', 'Compartmentation'];
        const aIsCritical = criticalCategories.includes(a.finding_category || '');
        const bIsCritical = criticalCategories.includes(b.finding_category || '');

        if (aIsCritical && !bIsCritical) return -1;
        if (!aIsCritical && bIsCritical) return 1;
      }

      return 0;
    });

    const topActions = sortedActions.slice(0, 3);

    for (const action of topActions) {
      if (yPosition < MARGIN + 70) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_HEIGHT - MARGIN - 20;
      }

      const actionText = sanitizePdfText(action.recommended_action || '(No action text)');
      const truncatedText = actionText.length > 120 ? actionText.substring(0, 117) + '...' : actionText;

      // Priority badge
      const priorityColor = getPriorityColor(action.priority_band);
      page.drawRectangle({
        x: MARGIN,
        y: yPosition - 2,
        width: 30,
        height: 14,
        color: priorityColor,
      });
      page.drawText(action.priority_band, {
        x: MARGIN + 6,
        y: yPosition,
        size: 10,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      // Action text
      const actionLines = wrapText(truncatedText, CONTENT_WIDTH - 45, 10, font);
      page.drawText(actionLines[0] || '', {
        x: MARGIN + 40,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });

      yPosition -= 18;

      // Show trigger reason for P1/P2
      if ((action.priority_band === 'P1' || action.priority_band === 'P2') && action.trigger_text) {
        const reasonText = sanitizePdfText(action.trigger_text);
        const truncatedReason = reasonText.length > 90 ? reasonText.substring(0, 87) + '...' : reasonText;

        page.drawText(`Reason: ${truncatedReason}`, {
          x: MARGIN + 40,
          y: yPosition,
          size: 8,
          font,
          color: rgb(0.5, 0.5, 0.5),
        });

        yPosition -= 14;
      }

      yPosition -= 6;
    }

    yPosition -= 10;
  }

  // ========================================================
  // 6. ASSESSOR COMMENTARY (If Provided)
  // ========================================================
  if (fra4Module.data.commentary?.executiveCommentary) {
    if (yPosition < MARGIN + 100) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_HEIGHT - MARGIN - 20;
    }

    page.drawText('Assessor Commentary', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
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

    yPosition -= 15;
  }

  return { page, yPosition };
}
