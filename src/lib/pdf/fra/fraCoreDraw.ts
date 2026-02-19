/**
 * FRA PDF Core Drawing Functions
 * Core drawing functions for FRA PDF modules and info gaps
 */

import { PDFDocument, PDFPage, rgb } from 'pdf-lib';
import { detectInfoGaps } from '../../../utils/infoGapQuickActions';
import {
  MARGIN,
  CONTENT_WIDTH,
  sanitizePdfText,
  wrapText,
  formatDate,
  getOutcomeColor,
  getOutcomeLabel,
  addNewPage,
} from '../pdfUtils';
import { PAGE_TOP_Y } from '../pdfCursor';
import { CRITICAL_FIELDS } from './fraConstants';
import { safeArray } from './fraUtils';
import type { Cursor, Document, ModuleInstance } from './fraTypes';

/**
 * Draw module key details section
 */
export function drawModuleKeyDetails(
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
    // COLLAPSE: No Key Details section at all if no meaningful data
    return cursor;
  }

  // Filter out unknown/default noise values
  const filteredDetails = keyDetails.filter(([label, value]) => {
    // Always keep section headers (empty values used for visual separation)
    if (value === '' && label.startsWith('---')) return true;

    // Filter out meaningless values
    if (!value || value.trim() === '') return false;
    if (value.toLowerCase() === 'unknown' || value.toLowerCase() === 'not known') {
      // Only show unknown if outcome is info_gap AND this is a critical field
      const outcome = module.outcome;
      if (outcome === 'info_gap' || outcome === 'information_incomplete') {
        // Check if this field is critical - for now, exclude all unknowns
        // Can be enhanced with CRITICAL_FIELDS lookup if needed
        return false;
      }
      return false;
    }
    if (value.toLowerCase() === 'not applicable' || value.toLowerCase() === 'n/a') return false;
    if (value.toLowerCase() === 'no') {
      // Keep "no" for presence/exists/provided questions (indicates deficiency)
      if (label.toLowerCase().includes('exists') ||
          label.toLowerCase().includes('present') ||
          label.toLowerCase().includes('provided') ||
          label.toLowerCase().includes('available') ||
          label.toLowerCase().includes('in place') ||
          label.toLowerCase().includes('evidence seen') ||
          label.toLowerCase().includes('satisfactory')) {
        return true;
      }
      return false;
    }

    return true;
  });

  // If all details were filtered out, COLLAPSE completely
  if (filteredDetails.length === 0) {
    return cursor;
  }

  page.drawText('Key Details:', {
    x: MARGIN,
    y: yPosition,
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= 18;

  for (const [label, value] of filteredDetails) {
    if (yPosition < MARGIN + 80) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_TOP_Y;
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
        yPosition = PAGE_TOP_Y;
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

  return { page, yPosition };
}

/**
 * Draw info gap quick actions section
 */
export function drawInfoGapQuickActions(input: {
  page: PDFPage;
  module: ModuleInstance;
  document: Document;
  font: any;
  fontBold: any;
  yPosition: number;
  pdfDoc: PDFDocument;
  isDraft: boolean;
  totalPages: PDFPage[];
  keyPoints?: string[];
  expectedModuleKeys?: string[];
}): { page: PDFPage; yPosition: number } {
  let { page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages, keyPoints, expectedModuleKeys } = input;

  // TEMP SAFETY (keep): if page is missing, bail so preview doesn't hard-crash
  if (!page) return { page: input.page as any, yPosition };

  // DEFENSIVE GUARD: Skip if module doesn't belong to expected section
  // This prevents cross-section info gap bleed
  if (expectedModuleKeys && !expectedModuleKeys.includes(module.module_key)) {
    console.warn(`[PDF] Skipping info gap for ${module.module_key} - not in expected section keys:`, expectedModuleKeys);
    return { page, yPosition };
  }

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
    return { page, yPosition };
  }

  // GLOBAL SUPPRESSION RULE: For ALL FRA sections, suppress the full info-gap box
  // if Key Points already include assurance gap sentences and all reasons are unknowns
  if (keyPoints && keyPoints.length > 0) {
    const hasAssuranceGapKeyPoint = keyPoints.some(kp =>
      kp.toLowerCase().includes('not been evidenced') ||
      kp.toLowerCase().includes('not been verified') ||
      kp.toLowerCase().includes('records have not') ||
      kp.toLowerCase().includes('information gap') ||
      kp.toLowerCase().includes('incomplete information') ||
      kp.toLowerCase().includes('not provided') ||
      kp.toLowerCase().includes('not recorded')
    );

    const allReasonsAreUnknowns = detection.reasons.every(r =>
      r.toLowerCase().includes('unknown') ||
      r.toLowerCase().includes('not known') ||
      r.toLowerCase().includes('not recorded') ||
      r.toLowerCase().includes('not provided') ||
      r.toLowerCase().includes('no record') ||
      r.toLowerCase().includes('no information')
    );

    if (hasAssuranceGapKeyPoint && allReasonsAreUnknowns) {
      // Render compact reference instead of full box
      if (yPosition < MARGIN + 100) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_TOP_Y;
      }

      yPosition -= 20;

      page.drawText(sanitizePdfText('i'), {
        x: MARGIN + 8,
        y: yPosition,
        size: 9,
        font: fontBold,
        color: rgb(0.6, 0.6, 0.6),
      });

      page.drawText(sanitizePdfText('Information gaps noted (see Key Points)'), {
        x: MARGIN + 22,
        y: yPosition,
        size: 9,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });

      yPosition -= 20;
      return { page, yPosition };
    }
  }

  // Precompute total line count for wrapped reasons to calculate accurate box height
  let totalReasonLines = 0;
  for (const reason of detection.reasons) {
    const wrappedLines = wrapText(reason, CONTENT_WIDTH - 30, 9, font);
    totalReasonLines += wrappedLines.length;
  }

  // Calculate box height based on actual wrapped content
  const lineHeight = 13;
  const headingHeight = 30;
  const paddingTop = 10;
  const paddingBottom = 15;
  const quickActionsHeight = detection.quickActions.length > 0 ? 30 + (detection.quickActions.length * 18) : 0;
  const boxHeight = headingHeight + (totalReasonLines * lineHeight) + quickActionsHeight + paddingTop + paddingBottom;

  // Check if we need a new page
  if (yPosition < MARGIN + boxHeight + 50) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_TOP_Y;
  }

  yPosition -= 20;

  // Neutral callout - light border instead of warning banner
  // Draw subtle border box with correct height
  const boxStartY = yPosition + 5;
  page.drawRectangle({
    x: MARGIN,
    y: yPosition - boxHeight + 10,
    width: CONTENT_WIDTH,
    height: boxHeight,
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
        yPosition = PAGE_TOP_Y;
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
          yPosition = PAGE_TOP_Y;
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
      yPosition = PAGE_TOP_Y;
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
        yPosition = PAGE_TOP_Y;
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
          yPosition = PAGE_TOP_Y;
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
          yPosition = PAGE_TOP_Y;
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
        yPosition = PAGE_TOP_Y;
      }
      page.drawText(line, {
        x: MARGIN + 10,
        y: yPosition,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
      yPosition -= 12;
    }
  }

  yPosition -= 15;
  return { page, yPosition };
}

/**
 * Draw section header with number and title
 */
export function drawSectionHeader(
  cursor: Cursor,
  sectionId: number,
  sectionTitle: string,
  font: any,
  fontBold: any
): Cursor {
  let { page, yPosition } = cursor;

  if (!page) {
    throw new Error(`[PDF] drawSectionHeader received missing page (section=${sectionId} ${sectionTitle})`);
  }

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
  return { page, yPosition };
}

/**
 * Draw assessor summary paragraph with driver bullets for technical sections (5-12)
 */
export function drawAssessorSummary(
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

  // Calculate box height needed for summary only
  const lineHeight = 16;
  const boxPadding = 15;

  // Height for summary text only
  const totalHeight = summaryLines.length * lineHeight;
  const boxHeight = totalHeight + (boxPadding * 2);

  // Check if we need a new page
  if (yPosition - boxHeight < MARGIN + 50) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_TOP_Y;
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

  yPosition -= boxPadding;
  yPosition -= 10; // Extra space after summary box

  return { page, yPosition };
}

/**
 * Draw module content WITHOUT printing the module key/name
 */
export function drawModuleContent(
  cursor: Cursor,
  module: ModuleInstance,
  document: Document,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  keyPoints?: string[],
  expectedModuleKeys?: string[]
): Cursor {
  let { page, yPosition } = cursor;

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
        yPosition = PAGE_TOP_Y;
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
  ({ page, yPosition } = drawModuleKeyDetails({ page, yPosition }, module, document, font, fontBold, pdfDoc, isDraft, totalPages));

  // Info gap quick actions
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
    keyPoints,
    expectedModuleKeys,
  });
  page = infoGapResult.page;
  yPosition = infoGapResult.yPosition;

  return { page, yPosition };
}

/**
 * Helper: Render only specific fields from a module
 */
export function renderFilteredModuleData(
  cursor: Cursor,
  module: ModuleInstance,
  fieldKeys: string[],
  document: Document,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  expectedModuleKeys?: string[]
): { page: PDFPage; yPosition: number } {
  let { page, yPosition } = cursor;
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
    ({ page, yPosition } = drawModuleContent({ page, yPosition }, filteredModule, document, font, fontBold, pdfDoc, isDraft, totalPages, undefined, expectedModuleKeys));
  }

  return { page, yPosition };
}
