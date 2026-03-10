/**
 * FRA PDF Core Drawing Functions
 * Core drawing functions for FRA PDF modules and info gaps
 */

import { PDFDocument, PDFPage, PDFImage, rgb } from 'pdf-lib';
import { detectInfoGaps } from '../../../utils/infoGapQuickActions';
import {
  MARGIN,
  CONTENT_WIDTH,
  PAGE_WIDTH,
  PAGE_TOP_Y,
  sanitizePdfText,
  wrapText,
  formatDate,
  getOutcomeColor,
  getOutcomeLabel,
  getPriorityColor,
  addNewPage,
  ensurePageSpace,
  deriveAutoActionTitle,
  deriveSystemActionTitle,
  normalizeDisplayValue,
  getCoverTitleContent,
} from '../pdfUtils';
import {
  drawExecutiveRiskHeader,
  drawRiskBadge,
  drawRiskBand,
  drawLikelihoodConsequenceBlock,
  drawActionCard,
  drawPageTitle,
  drawSectionTitle,
  drawContentsRow,
  drawActionRegisterIntroBox,
  measureActionRegisterIntroBoxHeight,
  getReportLayoutSpacing,
} from '../pdfPrimitives';
import { CRITICAL_FIELDS } from './fraConstants';
import { safeArray, mapModuleKeyToSectionName } from './fraUtils';
import type { Cursor, Document, ModuleInstance, Action, ActionRating, Organisation } from './fraTypes';
import type { Attachment } from '../../supabase/attachments';
import { fetchAttachmentBytes } from '../../supabase/attachments';
import { getJurisdictionConfig, getJurisdictionLabel } from '../../jurisdictions';
import { FRA_REPORT_STRUCTURE } from '../fraReportStructure';
import { type ScoringResult } from '../../fra/scoring/scoringEngine';

/**
 * In-memory cache for embedded PDF images
 * Key: attachment.id, Value: embedded PDFImage
 * Prevents re-downloading and re-embedding the same image multiple times
 */
const imageCache = new Map<string, PDFImage>();
const REPORT_LAYOUT_SPACING = getReportLayoutSpacing();

/**
 * Build stable evidence reference map for consistent E-00X numbering
 * Returns map: attachment.id -> E-00X reference
 */
export function buildEvidenceRefMap(attachments: Attachment[]): Map<string, string> {
  const refMap = new Map<string, string>();

  // Filter and deduplicate (same logic as drawAttachmentsIndex)
  const seenKeys = new Set<string>();
  const filteredAttachments = attachments.filter(att => {
    if (att.file_name?.startsWith('._')) return false;

    const uniqueKey = att.storage_path ||
      `${att.file_name}_${att.file_size_bytes}_${att.created_at}`;

    if (seenKeys.has(uniqueKey)) return false;

    seenKeys.add(uniqueKey);
    return true;
  });

  // Build reference map
  for (let i = 0; i < filteredAttachments.length; i++) {
    const attachment = filteredAttachments[i];
    const refNum = `E-${String(i + 1).padStart(3, '0')}`;
    refMap.set(attachment.id, refNum);
  }

  return refMap;
}

/**
 * Build canonical moduleKey -> sectionId map from FRA_REPORT_STRUCTURE
 * This is the single source of truth for all module-to-section mappings
 */
function buildModuleKeyToSectionIdMap(): Map<string, number> {
  const map = new Map<string, number>();
  for (const section of FRA_REPORT_STRUCTURE) {
    for (const moduleKey of section.moduleKeys) {
      map.set(moduleKey, section.id);
    }
  }
  return map;
}

// Build the map once at module load time
const MODULE_KEY_TO_SECTION_ID = buildModuleKeyToSectionIdMap();

/**
 * Map module key to section ID using pre-built map
 * This ensures evidence filtering works correctly for all module keys
 */
function mapModuleKeyToSectionId(moduleKey: string): number | null {
  return MODULE_KEY_TO_SECTION_ID.get(moduleKey) ?? null;
}

/**
 * Shared two-column row renderer
 * MATCHES SECTION 5 GRID EXACTLY
 */
function drawTwoColumnRows(args: {
  page: PDFPage;
  rows: Array<[string, string]>;
  font: any;
  fontBold: any;
  yPosition: number;
  pdfDoc: PDFDocument;
  isDraft: boolean;
  totalPages: PDFPage[];
}): { page: PDFPage; yPosition: number } {
  let { page, rows, font, fontBold, yPosition, pdfDoc, isDraft, totalPages } = args;

  // MATCH SECTION 5 GRID EXACTLY
  const labelX = MARGIN;
  const valueX = MARGIN + 150; // <-- EXACT match to Section 5's VALUE_X
  const valueWidth = CONTENT_WIDTH - 150;
  const rowGap = 12;

  for (const [label, value] of rows) {
    if (!value || !String(value).trim()) continue;

    // --- Prevent label/value blocks splitting across pages ---
    const safeLabel = sanitizePdfText(
      normalizeDisplayValue(label)
    ).trim();
    const safeValue = sanitizePdfText(
      normalizeDisplayValue(value)
    ).trim();
    const valueLinesForEstimate = wrapText(safeValue, valueWidth, 10, font);

    // label line + value lines + small padding
    const estimatedHeight = 14 + (valueLinesForEstimate.length * 14) + 10;

    if (yPosition - estimatedHeight < MARGIN + 40) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_TOP_Y;
    }

    page.drawText(`${safeLabel}:`, {
      x: labelX,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    });

    const lines = wrapText(safeValue, valueWidth, 10, font);
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        yPosition -= rowGap;
        if (yPosition < MARGIN + 70) {
          const result = addNewPage(pdfDoc, isDraft, totalPages);
          page = result.page;
          yPosition = PAGE_TOP_Y;
        }
      }
      page.drawText(lines[i], {
        x: valueX,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
    }

    yPosition -= rowGap + 2;
  }

  return { page, yPosition };
}

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
  totalPages: PDFPage[],
  sectionId?: number // Optional: for section-specific filtering
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
        const ignitionFiltered = safeArray(data.ignition_sources).filter((x: string) => x !== 'hot_work');
        if (ignitionFiltered.length > 0) {
          keyDetails.push(['Ignition Sources', ignitionFiltered.join(', ')]);
        }
      }
      if (data.fuel_sources && safeArray(data.fuel_sources).length > 0) {
        keyDetails.push(['Fuel Sources', safeArray(data.fuel_sources).join(', ')]);
      }
      if (data.oxygen_enrichment) keyDetails.push(['Oxygen Enrichment', data.oxygen_enrichment]);
      if (data.high_risk_activities && safeArray(data.high_risk_activities).length > 0) {
        const activitiesFiltered = safeArray(data.high_risk_activities).filter((x: string) => x !== 'hot_work');
        if (activitiesFiltered.length > 0) {
          keyDetails.push(['High-Risk Activities', activitiesFiltered.join(', ')]);
        }
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
        if (eicr.eicr_outstanding_c1_c2 === 'yes') {
          keyDetails.push(['Outstanding C1/C2 Defects', 'Yes']);
        } else if (eicr.eicr_outstanding_c1_c2) {
          keyDetails.push(['Outstanding C1/C2 Defects', eicr.eicr_outstanding_c1_c2 === 'no' ? 'No' : eicr.eicr_outstanding_c1_c2]);
        }
        if (eicr.pat_in_place) keyDetails.push(['PAT Testing in Place', eicr.pat_in_place]);
      }
      break;

    case 'FRA_2_ESCAPE_ASIS':
      if (data.escape_strategy_current) keyDetails.push(['Escape Strategy', data.escape_strategy_current]);
      if (data.escape_strategy) keyDetails.push(['Escape Strategy', data.escape_strategy]);
      if (data.routes_description) keyDetails.push(['Routes Description', data.routes_description]);
      if (data.travel_distances_compliant) keyDetails.push(['Travel Distances Compliant', data.travel_distances_compliant]);
      if (data.travel_distances) keyDetails.push(['Travel Distances', data.travel_distances]);
      if (data.final_exits_adequate) keyDetails.push(['Final Exits Adequate', data.final_exits_adequate]);
      if (data.final_exits) keyDetails.push(['Final Exits', data.final_exits]);
      if (data.escape_route_obstructions) keyDetails.push(['Escape Route Obstructions', data.escape_route_obstructions]);
      if (data.stair_protection_status) keyDetails.push(['Stair Protection Status', data.stair_protection_status]);
      if (data.stair_protection) keyDetails.push(['Stair Protection', data.stair_protection]);
      if (data.signage_adequacy) keyDetails.push(['Signage Adequacy', data.signage_adequacy]);
      if (data.signage) keyDetails.push(['Signage', data.signage]);
      if (data.disabled_egress_adequacy) keyDetails.push(['Disabled Egress Adequacy', data.disabled_egress_adequacy]);
      if (data.disabled_egress) keyDetails.push(['Disabled Egress', data.disabled_egress]);
      if (data.inner_rooms_present) keyDetails.push(['Inner Rooms Present', data.inner_rooms_present]);
      if (data.inner_rooms) keyDetails.push(['Inner Rooms', data.inner_rooms]);
      if (data.basement_present) keyDetails.push(['Basement Present', data.basement_present]);
      if (data.basement) keyDetails.push(['Basement', data.basement]);
      break;

    case 'FRA_3_PROTECTION_ASIS':
    case 'FRA_3_ACTIVE_SYSTEMS':
      // SECTION 7: Active Fire Protection (Detection, Alarm & Emergency Lighting)
      if (sectionId === 7) {
        // Fire Alarm System
        if (data.fire_alarm_present) keyDetails.push(['Fire Alarm System', data.fire_alarm_present]);
        if (data.alarm_present) keyDetails.push(['Alarm Present', data.alarm_present]);
        if (data.fire_alarm_category) keyDetails.push(['Alarm Category', data.fire_alarm_category]);
        if (data.alarm_category) keyDetails.push(['Alarm Category', data.alarm_category]);
        if (data.category) keyDetails.push(['Category', data.category]); // L1/L2 etc
        if (data.alarm_testing_evidence) keyDetails.push(['Alarm Testing Evidence', data.alarm_testing_evidence]);
        if (data.system_type) keyDetails.push(['System Type', data.system_type]);
        if (data.coverage) keyDetails.push(['Coverage', data.coverage]);
        if (data.monitoring) keyDetails.push(['Monitoring', data.monitoring]);
        if (data.testing_maintenance) keyDetails.push(['Testing / Maintenance', data.testing_maintenance]);
        if (data.last_service_date) keyDetails.push(['Last Service Date', data.last_service_date]);

        // Emergency Lighting
        if (data.emergency_lighting_present) keyDetails.push(['Emergency Lighting Present', data.emergency_lighting_present]);
        if (data.emergency_lighting_testing_evidence) keyDetails.push(['Emergency Lighting Testing', data.emergency_lighting_testing_evidence]);
        if (data.emergency_lighting_testing) keyDetails.push(['Emergency Lighting Testing', data.emergency_lighting_testing]);

        if (data.notes) keyDetails.push(['Notes', data.notes]);
      } else {
        // Legacy/fallback rendering for other sections
        if (data.alarm_present) keyDetails.push(['Alarm Present', data.alarm_present]);
        if (data.system_type) keyDetails.push(['System Type', data.system_type]);
        if (data.alarm_category) keyDetails.push(['Alarm Category', data.alarm_category]);
        if (data.category) keyDetails.push(['Category', data.category]);
        if (data.coverage) keyDetails.push(['Coverage', data.coverage]);
        if (data.monitoring) keyDetails.push(['Monitoring', data.monitoring]);
        if (data.alarm_testing_evidence) keyDetails.push(['Alarm Testing Evidence', data.alarm_testing_evidence]);
        if (data.testing_maintenance) keyDetails.push(['Testing / Maintenance', data.testing_maintenance]);
        if (data.last_service_date) keyDetails.push(['Last Service Date', data.last_service_date]);
        if (data.notes) keyDetails.push(['Notes', data.notes]);
      }
      break;

    case 'FRA_4_PASSIVE_PROTECTION':
      // SECTION 9: Passive Fire Protection (Compartmentation) ONLY
      // Remove emergency lighting fields - they belong in Section 7
      if (sectionId === 9) {
        // Passive Fire Protection fields only
        if (data.fire_doors_condition) keyDetails.push(['Fire Doors Condition', data.fire_doors_condition]);
        if (data.fire_doors_inspection_regime) keyDetails.push(['Inspection Regime', data.fire_doors_inspection_regime]);
        if (data.compartmentation_condition) keyDetails.push(['Compartmentation', data.compartmentation_condition]);
        if (data.fire_stopping_confidence) keyDetails.push(['Fire Stopping Confidence', data.fire_stopping_confidence]);
        if (data.penetrations_sealing) keyDetails.push(['Service Penetrations Sealing', data.penetrations_sealing]);
        if (data.notes) keyDetails.push(['Notes', data.notes]);
      } else {
        // Legacy/fallback rendering for other sections (should not occur)
        if (data.fire_doors_condition) keyDetails.push(['Fire Doors Condition', data.fire_doors_condition]);
        if (data.compartmentation_condition) keyDetails.push(['Compartmentation', data.compartmentation_condition]);
        if (data.penetrations_sealing) keyDetails.push(['Service Penetrations Sealing', data.penetrations_sealing]);
        if (data.fire_stopping_confidence) keyDetails.push(['Fire Stopping Confidence', data.fire_stopping_confidence]);
        if (data.notes) keyDetails.push(['Notes', data.notes]);
      }
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
            if (spk.type) keyDetails.push(['Sprinkler Type', spk.type]);
            if (spk.coverage) keyDetails.push(['Sprinkler Coverage', spk.coverage]);
            if (spk.servicing_status) keyDetails.push(['Sprinkler Servicing', spk.servicing_status === 'defective' ? 'DEFECTIVE - CRITICAL ISSUE' : spk.servicing_status]);
            if (spk.last_service_date) keyDetails.push(['Sprinkler Last Service', spk.last_service_date]);
          }

          if (ff.fixed_facilities.dry_riser?.installed) {
            const dr = ff.fixed_facilities.dry_riser;
            keyDetails.push(['Dry Riser', dr.installed === 'yes' ? 'Installed' : dr.installed === 'no' ? 'Not installed' : dr.installed]);
            if (dr.coverage) keyDetails.push(['Dry Riser Coverage', dr.coverage]);
            if (dr.servicing_status) keyDetails.push(['Dry Riser Servicing', dr.servicing_status]);
            if (dr.last_test_date) keyDetails.push(['Dry Riser Last Test', dr.last_test_date]);
          }

          if (ff.fixed_facilities.wet_riser?.installed) {
            const wr = ff.fixed_facilities.wet_riser;
            keyDetails.push(['Wet Riser', wr.installed === 'yes' ? 'Installed' : wr.installed === 'no' ? 'Not installed' : wr.installed]);
            if (wr.coverage) keyDetails.push(['Wet Riser Coverage', wr.coverage]);
            if (wr.servicing_status) keyDetails.push(['Wet Riser Servicing', wr.servicing_status === 'defective' ? 'DEFECTIVE - CRITICAL ISSUE' : wr.servicing_status]);
            if (wr.last_test_date) keyDetails.push(['Wet Riser Last Test', wr.last_test_date]);
          }

          if (ff.fixed_facilities.firefighting_lift?.present) {
            keyDetails.push(['Firefighting Lift', ff.fixed_facilities.firefighting_lift.present === 'yes' ? 'Present' : ff.fixed_facilities.firefighting_lift.present === 'no' ? 'Not present' : ff.fixed_facilities.firefighting_lift.present]);
          }

          if (ff.fixed_facilities.firefighting_shaft?.present) {
            keyDetails.push(['Firefighting Shaft', ff.fixed_facilities.firefighting_shaft.present === 'yes' ? 'Present' : ff.fixed_facilities.firefighting_shaft.present === 'no' ? 'Not present' : ff.fixed_facilities.firefighting_shaft.present]);
          }
        }
      } else {
        // Legacy flat field fallback
        if (data.extinguishers_present) keyDetails.push(['Extinguishers Present', data.extinguishers_present]);
        if (data.extinguishers_servicing) keyDetails.push(['Extinguishers Servicing', data.extinguishers_servicing]);
        if (data.sprinkler_system) keyDetails.push(['Sprinkler System', data.sprinkler_system]);
        if (data.sprinkler_type) keyDetails.push(['Sprinkler Type', data.sprinkler_type]);
        if (data.sprinkler_coverage) keyDetails.push(['Sprinkler Coverage', data.sprinkler_coverage]);
        if (data.rising_mains) keyDetails.push(['Rising Mains', data.rising_mains]);
        if (data.firefighting_lift) keyDetails.push(['Firefighting Lift', data.firefighting_lift]);
        if (data.firefighting_shaft) keyDetails.push(['Firefighting Shaft', data.firefighting_shaft]);
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

    const normalizedLabel = String(label).toLowerCase();
const normalizedValue = String(value ?? '').trim().toLowerCase();

      // Filter out meaningless values
      if (!normalizedValue) return false;
      if (normalizedValue === 'unknown' || normalizedValue === 'not known') {
      // Only show unknown if outcome is info_gap AND this is a critical field
      const outcome = module.outcome;
      if (outcome === 'info_gap' || outcome === 'information_incomplete') {
        // Check if this field is critical - for now, exclude all unknowns
        // Can be enhanced with CRITICAL_FIELDS lookup if needed
        return false;
      }
      return false;
    }
    if (normalizedValue === 'not applicable' || normalizedValue === 'n/a') return false;
    if (normalizedValue === 'no') {
      // Keep "no" for presence/exists/provided questions (indicates deficiency)
      if (normalizedLabel.includes('exists') ||
          normalizedLabel.includes('present') ||
          normalizedLabel.includes('provided') ||
          normalizedLabel.includes('available') ||
          normalizedLabel.includes('in place') ||
          normalizedLabel.includes('evidence seen') ||
          normalizedLabel.includes('satisfactory')) {
        return true;
      }

      // FRA_2_ESCAPE_ASIS: Keep "no" for obstructions, inner rooms, basement
      // (indicates good condition - no obstructions, no inner rooms, no basement)
      if (module.module_key === 'FRA_2_ESCAPE_ASIS') {
        if (normalizedLabel.includes('obstruction') ||
            normalizedLabel.includes('inner room') ||
            normalizedLabel.includes('basement')) {
          return true;
        }
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

  // Draw using Section 5 grid alignment
  const result = drawTwoColumnRows({
    page,
    rows: filteredDetails,
    font,
    fontBold,
    yPosition,
    pdfDoc,
    isDraft,
    totalPages,
  });
  page = result.page;
  yPosition = result.yPosition;

  // Small gap before next block
  yPosition -= 8;

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
  
  // Maintain consistent visual separation from preceding section content/header.
  const INFO_GAP_TOP_SPACING = REPORT_LAYOUT_SPACING.sectionHeaderToInfoGap + 2;

  let { page, module, document, font, fontBold, yPosition, pdfDoc, isDraft, totalPages, keyPoints, expectedModuleKeys } = input;

  // TEMP SAFETY (keep): if page is missing, bail so preview doesn't hard-crash
  if (!page) return { page: input.page as any, yPosition };

  // DEFENSIVE GUARD: Skip if module doesn't belong to expected section
  // This prevents cross-section info gap bleed
  if (expectedModuleKeys && !expectedModuleKeys.includes(module.module_key)) {
    console.warn(`[PDF] Skipping info gap for ${module.module_key} - not in expected section keys:`, expectedModuleKeys);
    return { page, yPosition };
  }

  // Only show the "incomplete information" box when the module is explicitly an info-gap outcome.
  // Otherwise it clutters sections that already have a valid outcome (e.g. Minor Deficiency).
  const OUTCOME = (module.outcome || '').toLowerCase();
  const isInfoGapOutcome =
    OUTCOME === 'info_gap' ||
    OUTCOME === 'information_incomplete' ||
    OUTCOME === 'incomplete_information';

  if (!isInfoGapOutcome) {
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
      ({ page, yPosition } = ensurePageSpace(32 + INFO_GAP_TOP_SPACING, page, yPosition, pdfDoc, isDraft, totalPages));

      yPosition -= INFO_GAP_TOP_SPACING;

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

  // Pre-measure wrapped content for exact box height calculation.
  const wrappedReasons = detection.reasons.map((reason) => wrapText(reason, CONTENT_WIDTH - 30, 9, font));
  const wrappedActions = detection.quickActions.map((quickAction) => ({
    titleLines: wrapText(quickAction.action, CONTENT_WIDTH - 55, 9.5, fontBold),
    whyLines: quickAction.reason ? wrapText(`Why: ${quickAction.reason}`, CONTENT_WIDTH - 55, 8.5, font) : [],
    quickAction,
  }));

  // Keep these constants aligned to the draw calls below.
  const titleRowHeight = 18;
  const reasonLineHeight = 12;
  const reasonItemGap = 4;
  const gapBeforeActions = 6;
  const recommendedActionsHeaderHeight = 16;
  const actionTitleLineHeight = 12;
  const actionReasonLineHeight = 11;
  const actionItemGap = 6;
  const boxPaddingTop = 12;
  const boxPaddingBottom = 6;

  let measuredReasonsHeight = titleRowHeight;
  for (const reasonLines of wrappedReasons) {
    measuredReasonsHeight += (reasonLines.length * reasonLineHeight) + reasonItemGap;
  }

  let measuredActionsHeight = 0;
  if (wrappedActions.length > 0) {
    measuredActionsHeight += gapBeforeActions + recommendedActionsHeaderHeight;
    for (const { titleLines, whyLines } of wrappedActions) {
      measuredActionsHeight += titleLines.length * actionTitleLineHeight;
      measuredActionsHeight += whyLines.length * actionReasonLineHeight;
      measuredActionsHeight += actionItemGap;
    }
  }

  const boxHeight = boxPaddingTop + measuredReasonsHeight + measuredActionsHeight + boxPaddingBottom;
  ({ page, yPosition } = ensurePageSpace(boxHeight + 20 + INFO_GAP_TOP_SPACING, page, yPosition, pdfDoc, isDraft, totalPages));

  // --- INFO GAP BOX (single-cursor, self-contained) ---
yPosition -= INFO_GAP_TOP_SPACING;

// Box geometry
const boxTopY = yPosition;
const boxBottomY = boxTopY - boxHeight;

// Draw container
page.drawRectangle({
  x: MARGIN,
  y: boxBottomY,
  width: CONTENT_WIDTH,
  height: boxHeight,
  borderColor: rgb(0.7, 0.7, 0.7),
  borderWidth: 1,
  color: rgb(0.98, 0.98, 0.98),
});

// Inner cursor
let boxY = boxTopY - 12;

// Title row
page.drawText(sanitizePdfText('i'), {
  x: MARGIN + 8,
  y: boxY,
  size: 11,
  font: fontBold,
  color: rgb(0.5, 0.5, 0.5),
});

page.drawText(sanitizePdfText('Assessment notes (incomplete information)'), {
  x: MARGIN + 25,
  y: boxY,
  size: 11,
  font: fontBold,
  color: rgb(0.4, 0.4, 0.4),
});

boxY -= 18;

// Reasons
for (const reasonLines of wrappedReasons) {
  page.drawText(sanitizePdfText('•'), {
    x: MARGIN + 8,
    y: boxY,
    size: 10,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

    for (const line of reasonLines) {
    page.drawText(line, {
      x: MARGIN + 18,
      y: boxY,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    boxY -= reasonLineHeight;
  }
  boxY -= reasonItemGap;
}

// Recommended actions
if (wrappedActions.length > 0) {
  boxY -= gapBeforeActions;

  page.drawText('Recommended actions:', {
    x: MARGIN + 8,
    y: boxY,
    size: 10,
    font: fontBold,
    color: rgb(0.4, 0.4, 0.4),
  });

  boxY -= recommendedActionsHeaderHeight;

  for (const { quickAction, titleLines, whyLines } of wrappedActions) {
    // Use PDF_THEME token-based colors for priority
    const priorityColor =
      quickAction.priority === 'P2' ? PDF_THEME.colours.risk.medium.fg : PDF_THEME.colours.risk.medium.fg;

    // badge
    page.drawRectangle({
      x: MARGIN + 10,
      y: boxY - 2,
      width: 25,
      height: 12,
      color: priorityColor,
    });

    page.drawText(quickAction.priority, {
      x: MARGIN + 14,
      y: boxY,
      size: 8.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    // title
    for (const line of titleLines) {
      page.drawText(line, {
        x: MARGIN + 42,
        y: boxY,
        size: 9.5,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2),
      });
      boxY -= actionTitleLineHeight;
    }

    // why (small)
    for (const line of whyLines) {
      page.drawText(line, {
        x: MARGIN + 42,
        y: boxY,
        size: 8.5,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
      boxY -= actionReasonLineHeight;
    }

    boxY -= actionItemGap;
  }
}

// Move main cursor below the box (ignore any drift)
yPosition = boxBottomY - 8;

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

  // DEBUG MARKER — REMOVE AFTER CONFIRMED
  
  const PAD = 12;
  const LABEL_SIZE = 9;
  const BODY_SIZE = 11;
  const LINE_H = 13;
  const GAP_AFTER_LABEL = 6;
  const AFTER_BOX_GAP = 22;

  const innerWidth = CONTENT_WIDTH - PAD * 2;
  const summaryLines = wrapText(summaryText, innerWidth, BODY_SIZE, font);

  const labelHeight = LABEL_SIZE + 2;
  const bodyHeight = summaryLines.length * LINE_H;

  const boxHeight =
    PAD +
    labelHeight +
    GAP_AFTER_LABEL +
    bodyHeight +
    PAD;

  // Page break check
  if (yPosition - boxHeight < MARGIN + 50) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_TOP_Y;
  }

  // Draw rectangle
  const boxTop = yPosition;
  const boxBottom = boxTop - boxHeight;

  page.drawRectangle({
    x: MARGIN,
    y: boxBottom,
    width: CONTENT_WIDTH,
    height: boxHeight,
    color: rgb(0.96, 0.97, 0.98),
    borderColor: rgb(0.85, 0.87, 0.89),
    borderWidth: 1,
  });

  // Position label INSIDE the box correctly
  // Use a real label block height (not just font size) so body starts below it
const LABEL_H = LABEL_SIZE + 3;

let cursorY = boxTop - PAD - LABEL_H;

page.drawText('Assessor Summary:', {
  x: MARGIN + PAD,
  y: cursorY,
  size: LABEL_SIZE,
  font,
  color: rgb(0.4, 0.4, 0.4),
});

// Move to first body line baseline (gap + one line height)
cursorY -= (GAP_AFTER_LABEL + LINE_H);

  // Draw summary lines below label
  for (const line of summaryLines) {
    page.drawText(line, {
      x: MARGIN + PAD,
      y: cursorY,
      size: BODY_SIZE,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
    cursorY -= LINE_H;
  }

  // Move main yPosition below box
  yPosition = boxBottom - AFTER_BOX_GAP;

  return { page, yPosition };
}

/**
 * Helper: Determine if attachment is an image type we can embed
 */
function isImageAttachment(attachment: Attachment): boolean {
  const fileType = attachment.file_type.toLowerCase();
  const fileName = attachment.file_name.toLowerCase();

  // Exclude logos
  if (fileName.includes('logo')) {
    return false;
  }

  // Check for supported image types
  return fileType === 'image/png' ||
         fileType === 'image/jpg' ||
         fileType === 'image/jpeg' ||
         fileType === 'image/webp';
}

/**
 * Helper: Embed image into PDF document with caching
 */
async function embedImage(pdfDoc: PDFDocument, attachment: Attachment): Promise<PDFImage | null> {
  // Check cache first
  if (imageCache.has(attachment.id)) {
    return imageCache.get(attachment.id)!;
  }

  try {
    const bytes = await fetchAttachmentBytes(attachment);
    if (!bytes) {
      return null;
    }

    let image: PDFImage;
    const fileType = attachment.file_type.toLowerCase();

    if (fileType === 'image/png' || fileType === 'image/webp') {
      image = await pdfDoc.embedPng(bytes);
    } else if (fileType === 'image/jpg' || fileType === 'image/jpeg') {
      image = await pdfDoc.embedJpg(bytes);
    } else {
      return null;
    }

    // Cache the embedded image
    imageCache.set(attachment.id, image);
    return image;
  } catch (error) {
    console.warn('[embedImage] Failed to embed:', attachment.file_name, error);
    return null;
  }
}

/**
 * Helper: Draw image grid (2-3 columns)
 */
async function drawImageGrid(
  page: PDFPage,
  yPosition: number,
  images: Array<{ image: PDFImage; refNum: string; fileName: string }>,
  font: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  maxImages: number = 6
): Promise<{ page: PDFPage; yPosition: number }> {
  if (images.length === 0) {
    return { page, yPosition };
  }

  const imagesToShow = images.slice(0, maxImages);
  const cols = 3;
  const gutter = 10;
  const thumbWidth = (CONTENT_WIDTH - gutter * (cols - 1)) / cols;
  const thumbHeight = thumbWidth * 0.75;
  const captionHeight = 12;
  const rowHeight = thumbHeight + captionHeight + 15;

  let currentRow = 0;
  let currentCol = 0;

  for (const { image, refNum, fileName } of imagesToShow) {
    // Check if we need a new page
    if (yPosition < MARGIN + rowHeight + 50) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_TOP_Y;
      currentRow = 0;
      currentCol = 0;
    }

    const x = MARGIN + currentCol * (thumbWidth + gutter);
    const y = yPosition - thumbHeight;

    // Draw image with aspect ratio preservation
    const imgDims = image.scale(1);
    const scale = Math.min(thumbWidth / imgDims.width, thumbHeight / imgDims.height);
    const scaledWidth = imgDims.width * scale;
    const scaledHeight = imgDims.height * scale;

    // Center image in thumbnail space
    const xOffset = (thumbWidth - scaledWidth) / 2;
    const yOffset = (thumbHeight - scaledHeight) / 2;

    page.drawImage(image, {
      x: x + xOffset,
      y: y + yOffset,
      width: scaledWidth,
      height: scaledHeight,
    });

    // Draw border around thumbnail
    page.drawRectangle({
      x,
      y,
      width: thumbWidth,
      height: thumbHeight,
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 0.5,
    });

    // Draw caption below image
    const captionY = y - 10;
    const caption = sanitizePdfText(refNum);
    page.drawText(caption, {
      x: x + thumbWidth / 2 - (caption.length * 2.5),
      y: captionY,
      size: 8,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });

    currentCol++;
    if (currentCol >= cols) {
      currentCol = 0;
      currentRow++;
      yPosition -= rowHeight;
    }
  }

  // If we didn't complete a full row, adjust yPosition
  if (currentCol > 0) {
    yPosition -= rowHeight;
  }

  return { page, yPosition };
}

/**
 * Draw inline evidence block for a section
 * Shows up to 6 images (2 rows of 3) or text fallback
 */
export async function drawInlineEvidenceBlock(
  cursor: Cursor,
  attachments: Attachment[],
  moduleInstances: ModuleInstance[],
  evidenceRefMap: Map<string, string>,
  sectionId: number,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  actions?: Action[],
  actionIdToSectionId?: Map<string, number>
): Promise<Cursor> {
  let { page, yPosition } = cursor;

  // Collect attachments for this section
  const sectionAttachments: Array<{ attachment: Attachment; refNum: string | null; source: 'module' | 'action' }> = [];
  const seenAttachmentIds = new Set<string>();

  // 1) Module-linked attachments (original logic)
  for (const att of attachments) {
    if (seenAttachmentIds.has(att.id)) continue;

    if (att.module_instance_id) {
      const module = moduleInstances.find(m => m.id === att.module_instance_id);
      if (!module) continue;

      const attSectionId = mapModuleKeyToSectionId(module.module_key);
      if (attSectionId !== sectionId) continue;

      const refNum = evidenceRefMap.get(att.id);
      sectionAttachments.push({ attachment: att, refNum: refNum || null, source: 'module' });
      seenAttachmentIds.add(att.id);
    }
  }

  // 2) Action-linked attachments (ENHANCED with actionIdToSectionId fallback)
  if (actions && actions.length > 0) {
    for (const att of attachments) {
      if (seenAttachmentIds.has(att.id)) continue;

      if (att.action_id) {
        // a) First try actionIdToSectionId map (handles null module_instance_id)
        if (actionIdToSectionId) {
          const actionSectionId = actionIdToSectionId.get(att.action_id);
          if (actionSectionId === sectionId) {
            const refNum = evidenceRefMap.get(att.id);
            sectionAttachments.push({ attachment: att, refNum: refNum || null, source: 'action' });
            seenAttachmentIds.add(att.id);
            continue; // Found via map, skip fallback
          }
        }

        // b) Fallback to existing action.module_instance_id resolution
        const action = actions.find(a => a.id === att.action_id);
        if (!action) continue;

        if (action.module_instance_id) {
          const module = moduleInstances.find(m => m.id === action.module_instance_id);
          if (!module) continue;

          const actionSectionId = mapModuleKeyToSectionId(module.module_key);
          if (actionSectionId !== sectionId) continue;

          const refNum = evidenceRefMap.get(att.id);
          sectionAttachments.push({ attachment: att, refNum: refNum || null, source: 'action' });
          seenAttachmentIds.add(att.id);
        }
      }
    }
  }

  // c) If attachment has module_instance_id but wasn't matched yet, try direct module resolution
  for (const att of attachments) {
    if (seenAttachmentIds.has(att.id)) continue;

    if (att.module_instance_id) {
      const module = moduleInstances.find(m => m.id === att.module_instance_id);
      if (!module) continue;

      const attSectionId = mapModuleKeyToSectionId(module.module_key);
      if (attSectionId !== sectionId) continue;

      const refNum = evidenceRefMap.get(att.id);
      sectionAttachments.push({ attachment: att, refNum: refNum || null, source: 'module' });
      seenAttachmentIds.add(att.id);
    }
  }

  if (sectionAttachments.length === 0) {
    return { page, yPosition };
  }

  // Ensure space
  if (yPosition < MARGIN + 100) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    page = result.page;
    yPosition = PAGE_TOP_Y;
  }

  yPosition -= 15;

  // Header
  page.drawText('Evidence (selected):', {
    x: MARGIN,
    y: yPosition,
    size: 10,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 20;

  // Filter to image attachments only
  const imageAttachments = sectionAttachments.filter(sa => isImageAttachment(sa.attachment));

  // Try to embed images (up to 6 for sections)
  const embeddedImages: Array<{ image: PDFImage; refNum: string; fileName: string }> = [];
  for (const { attachment, refNum } of imageAttachments.slice(0, 6)) {
    if (!refNum) continue;

    const image = await embedImage(pdfDoc, attachment);
    if (image) {
      embeddedImages.push({
        image,
        refNum,
        fileName: attachment.file_name,
      });
    }
  }

  // Render image grid if we have images
  if (embeddedImages.length > 0) {
    ({ page, yPosition } = await drawImageGrid(
      page,
      yPosition,
      embeddedImages,
      font,
      pdfDoc,
      isDraft,
      totalPages,
      6 // max 6 images (2 rows of 3)
    ));

    // If more than 6 images, add note
    if (imageAttachments.length > 6) {
      page.drawText('See Evidence Index for full list.', {
        x: MARGIN,
        y: yPosition,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
      yPosition -= 12;
    }
  } else {
    // Text fallback - show up to 2 items
    const itemsToShow = sectionAttachments.slice(0, 2);

    for (const { attachment, refNum } of itemsToShow) {
      if (yPosition < MARGIN + 60) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_TOP_Y;
      }

      const displayName = attachment.caption || attachment.file_name || 'Unnamed';
      const evidenceLine = refNum
        ? `${refNum} – ${sanitizePdfText(displayName)}`
        : sanitizePdfText(displayName);

      const lines = wrapText(evidenceLine, CONTENT_WIDTH - 20, 9, font);
      for (const line of lines) {
        page.drawText(line, {
          x: MARGIN + 10,
          y: yPosition,
          size: 9,
          font,
          color: rgb(0.3, 0.3, 0.3),
        });
        yPosition -= 11;
      }
    }

    // If more than 2, add note
    if (sectionAttachments.length > 2) {
      page.drawText('See Evidence Index for full list.', {
        x: MARGIN + 10,
        y: yPosition,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
      yPosition -= 10;
    }
  }

  yPosition -= 10; // Extra spacing after evidence block

  return { page, yPosition };
}

/**
 * Draw module content WITHOUT printing the module key/name
 */
export async function drawModuleContent(
  cursor: Cursor,
  module: ModuleInstance,
  document: Document,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  keyPoints?: string[],
  expectedModuleKeys?: string[],
  sectionId?: number, // Optional: for section-specific filtering
  attachments?: Attachment[], // Optional: for inline evidence
  evidenceRefMap?: Map<string, string>, // Optional: evidence reference map
  moduleInstances?: ModuleInstance[], // Optional: for evidence linking
  actions?: Action[], // Optional: for action-linked evidence
  actionIdToSectionId?: Map<string, number> // Optional: action->section map for null module_instance_id fallback
): Promise<Cursor> {
  
  let { page, yPosition } = cursor;
  
 // Outcome badge
if (module.outcome) {
  const outcomeLabel = getOutcomeLabel(module.outcome);

  page.drawText('Outcome:', {
    x: MARGIN,
    y: yPosition,
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

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

  yPosition -= 24;
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
      yPosition -= 12;
    }
    yPosition -= 10;
  }

  // Module data
  ({ page, yPosition } = drawModuleKeyDetails({ page, yPosition }, module, document, font, fontBold, pdfDoc, isDraft, totalPages, sectionId));
  
  // Inline evidence block (if data provided and sectionId available)
  if (sectionId && attachments && evidenceRefMap && moduleInstances) {
    ({ page, yPosition } = await drawInlineEvidenceBlock(
      { page, yPosition },
      attachments,
      moduleInstances,
      evidenceRefMap,
      sectionId,
      font,
      fontBold,
      pdfDoc,
      isDraft,
      totalPages,
      actions, // Pass actions for action-linked evidence
      actionIdToSectionId // Pass action->section map for null module_instance_id fallback
    ));
  }

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

/**
 * Draw Action Register
 */
export async function drawActionRegister(
  cursor: Cursor,
  actions: Action[],
  actionRatings: ActionRating[],
  moduleInstances: ModuleInstance[],
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  attachments?: Attachment[],
  evidenceRefMap?: Map<string, string>,
  options?: { showIntroBox?: boolean }
): Promise<{ page: PDFPage; yPosition: number }> {
  let { page, yPosition } = cursor;
  yPosition -= 20;

  // Use Arup-style page title
  yPosition = drawPageTitle(page, MARGIN, yPosition, 'Action Register', { regular: font, bold: fontBold });

  // Action Register intro box with preflight
  const INTRO_BOX_GAP_AFTER = 12;
  const MIN_FIRST_ACTION_HEIGHT = 110;
  const PAGE_BOTTOM_Y = MARGIN;
  const showIntroBox = options?.showIntroBox !== false;

  if (showIntroBox) {
    // Measure intro box height deterministically
    const intro = measureActionRegisterIntroBoxHeight({
      w: CONTENT_WIDTH,
      fonts: { regular: font, bold: fontBold },
    });

    // Preflight: check if intro + gap + first action will fit
    const required = intro.height + INTRO_BOX_GAP_AFTER + MIN_FIRST_ACTION_HEIGHT;

    if (yPosition - required < PAGE_BOTTOM_Y) {
      // Won't fit, start new page
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_TOP_Y;
    }

    // Draw intro box
    const drawn = drawActionRegisterIntroBox({
      page,
      x: MARGIN,
      y: yPosition,
      w: CONTENT_WIDTH,
      fonts: { regular: font, bold: fontBold },
      product: 'fra',
    });

    // Set cursor with fixed gap after intro box
    yPosition = drawn.y - INTRO_BOX_GAP_AFTER;
  } else {
    // Preserve old behavior when intro disabled
    yPosition -= 12;
  }

  // Build rating map (latest per action)
  const ratingMap = new Map<string, ActionRating>();
  for (const rating of actionRatings) {
    const existing = ratingMap.get(rating.action_id);
    if (!existing || new Date(rating.rated_at) > new Date(existing.rated_at)) {
      ratingMap.set(rating.action_id, rating);
    }
  }

  // NO RE-SORTING: Actions are already sorted by buildFraPdf.ts using canonical order
  // Render actions in the order provided (preserves consistent order throughout PDF)

  if (actions.length === 0) {
    page.drawText('No actions have been created for this assessment.', {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    return { page, yPosition: yPosition - 20 };
  }

  // NO FALLBACK REFERENCE GENERATION
  // Use canonical DB reference_number exactly as stored, or undefined if not set

  for (const action of actions) {
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
      yPosition = PAGE_TOP_Y;
    }

    // Use priority band directly (P1/P2/P3/P4)
    const priorityBand = action.priority_band || 'P4';
    // Derive short title for system actions, full text for manual actions
    const actionText = deriveSystemActionTitle({
      recommended_action: action.recommended_action,
      source: action.source,
    }) || '(No action text provided)';
    const owner = action.owner_display_name || undefined;
    const target = action.target_date ? formatDate(action.target_date) : undefined;
    const status = action.status || 'open';
    // Use canonical DB reference only (undefined if not set)
    const ref = action.reference_number || undefined;

    // Use new action card primitive
    yPosition = drawActionCard({
      page,
      x: MARGIN,
      y: yPosition,
      w: CONTENT_WIDTH,
      ref,
      description: actionText,
      priority: priorityBand,
      owner,
      target,
      status,
      fonts: { regular: font, bold: fontBold },
    });

    // Add inline evidence for this action
    if (attachments && evidenceRefMap) {
      const actionAttachments = attachments.filter(att => att.action_id === action.id);

      if (actionAttachments.length > 0) {
        if (yPosition < MARGIN + 50) {
          const result = addNewPage(pdfDoc, isDraft, totalPages);
          page = result.page;
          yPosition = PAGE_TOP_Y;
        }

        // Filter to image attachments
        const imageAttachments = actionAttachments.filter(att => isImageAttachment(att));

        // Try to embed images (up to 3 for actions - 1 row)
        const embeddedImages: Array<{ image: PDFImage; refNum: string; fileName: string }> = [];
        for (const att of imageAttachments.slice(0, 3)) {
          const refNum = evidenceRefMap.get(att.id);
          if (!refNum) continue;

          const image = await embedImage(pdfDoc, att);
          if (image) {
            embeddedImages.push({
              image,
              refNum,
              fileName: att.file_name,
            });
          }
        }

        // Render image grid if we have images
        if (embeddedImages.length > 0) {
          ({ page, yPosition } = await drawImageGrid(
            page,
            yPosition,
            embeddedImages,
            font,
            pdfDoc,
            isDraft,
            totalPages,
            3 // max 3 images (1 row) for actions
          ));
        } else {
          // Text fallback
          const evidenceRefs = actionAttachments
            .map(att => evidenceRefMap.get(att.id))
            .filter(ref => ref)
            .join(', ');

          if (evidenceRefs) {
            page.drawText(`Evidence: ${evidenceRefs}`, {
              x: MARGIN + 28, // Align with card text (4px stripe + 12px padding + 12px spacing)
              y: yPosition,
              size: 8,
              font,
              color: rgb(0.4, 0.4, 0.4),
            });
            yPosition -= 10;
          }
        }
      }
    }

    yPosition -= 8;

    page.drawLine({
      start: { x: MARGIN, y: yPosition },
      end: { x: PAGE_WIDTH - MARGIN, y: yPosition },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });

    yPosition -= 15;
  }

  return { page, yPosition };
}

/**
 * Draw Assumptions and Limitations
 */
export function drawAssumptionsAndLimitations(
  cursor: Cursor,
  document: Document,
  fra4Module: ModuleInstance | undefined,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  let { page, yPosition } = cursor;
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
    return { page, yPosition: yPosition - 20 };
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
        yPosition = PAGE_TOP_Y;
      }
      page.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 12;
    }
    yPosition -= 10;
  }

  if (hasFra4Assumptions) {
    if (yPosition < MARGIN + 60) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_TOP_Y;
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
        yPosition = PAGE_TOP_Y;
      }
      page.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 12;
    }
  }

  if (document.scope_description && document.scope_description.trim()) {
    yPosition -= 20;

    if (yPosition < MARGIN + 100) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_TOP_Y;
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
        yPosition = PAGE_TOP_Y;
      }
      page.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 12;
    }
  }

  return { page, yPosition };
}

/**
 * Draw Regulatory Framework
 */
export function drawRegulatoryFramework(
  cursor: Cursor,
  document: Document,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  let { page, yPosition } = cursor;
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
  yPosition -= 22;

  const bulletX = MARGIN;
  const bulletTextX = MARGIN + 12;
  const bulletWrapWidth = CONTENT_WIDTH - (bulletTextX - MARGIN);

  for (const legislation of jurisdictionConfig.primaryLegislation) {
    if (yPosition < MARGIN + 50) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_TOP_Y;
    }

    const legislationLines = wrapText(sanitizePdfText(legislation), bulletWrapWidth, 10, font);

    page.drawText('•', {
      x: bulletX,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    for (const line of legislationLines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_TOP_Y;
      }
      page.drawText(line, {
        x: bulletTextX,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 12;
    }

    yPosition -= 2;
  }

  yPosition -= 8;

  // Draw regulatory framework text
  const paragraphs = jurisdictionConfig.regulatoryFrameworkText.split('\n\n');
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;

    const lines = wrapText(paragraph, CONTENT_WIDTH, 11, font);
    for (const line of lines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_TOP_Y;
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

  return { page, yPosition };
}

/**
 * Draw Responsible Person Duties (jurisdiction-aware)
 */
export function drawResponsiblePersonDuties(
  cursor: Cursor,
  document: Document,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  let { page, yPosition } = cursor;
  yPosition -= 20;

  // Get jurisdiction-specific configuration
  const jurisdictionConfig = getJurisdictionConfig(document.jurisdiction);

  // Use jurisdiction-aware heading
  page.drawText(jurisdictionConfig.dutyholderHeading, {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  // Draw key duties as bullet points
  for (const duty of jurisdictionConfig.responsiblePersonDuties) {
    if (yPosition < MARGIN + 50) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_TOP_Y;
    }

    const dutyLines = wrapText(`• ${duty}`, CONTENT_WIDTH - 10, 11, font);
    for (const line of dutyLines) {
      if (yPosition < MARGIN + 50) {
        const result = addNewPage(pdfDoc, isDraft, totalPages);
        page = result.page;
        yPosition = PAGE_TOP_Y;
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

  return { page, yPosition };
}

/**
 * Draw Attachments Index
 */
export function drawAttachmentsIndex(
  cursor: Cursor,
  attachments: Attachment[],
  moduleInstances: ModuleInstance[],
  actions: Action[],
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  let { page, yPosition } = cursor;
  yPosition -= 20;
  page.drawText('ATTACHMENTS & EVIDENCE INDEX', {
    x: MARGIN,
    y: yPosition,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 30;

  // Filter out AppleDouble files (._*) and deduplicate by unique key
  const seenKeys = new Set<string>();
  const filteredAttachments = attachments.filter(att => {
    // Filter out AppleDouble resource fork files
    if (att.file_name?.startsWith('._')) {
      return false;
    }

    // Create unique key: prefer storage_path, fallback to file_name + size + date
    const uniqueKey = att.storage_path ||
      `${att.file_name}_${att.file_size_bytes}_${att.created_at}`;

    if (seenKeys.has(uniqueKey)) {
      return false;
    }

    seenKeys.add(uniqueKey);
    return true;
  });

  if (filteredAttachments.length === 0) {
    page.drawText('No attachments recorded.', {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    return { page, yPosition: yPosition - 20 };
  }

  for (let i = 0; i < filteredAttachments.length; i++) {
    const attachment = filteredAttachments[i];

    if (yPosition < MARGIN + 100) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_TOP_Y;
    }

    const refNum = `E-${String(i + 1).padStart(3, '0')}`;

    page.drawText(`${refNum} ${sanitizePdfText(attachment.file_name)}`, {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 12;

    if (attachment.caption) {
      const captionLines = wrapText(attachment.caption, CONTENT_WIDTH - 20, 9, font);
      for (const line of captionLines) {
        if (yPosition < MARGIN + 50) {
          const result = addNewPage(pdfDoc, isDraft, totalPages);
          page = result.page;
          yPosition = PAGE_TOP_Y;
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

  return { page, yPosition };
}

/**
 * Draw Scope
 */
export function drawScope(
  cursor: Cursor,
  scopeText: string,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  let { page, yPosition } = cursor;
  yPosition -= 20;
  yPosition = drawSectionTitle(page, MARGIN, yPosition, 'SCOPE', { regular: font, bold: fontBold });

  const sanitized = sanitizePdfText(scopeText);
  const lines = wrapText(sanitized, CONTENT_WIDTH, 11, font);

  for (const line of lines) {
    if (yPosition < MARGIN + 50) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_TOP_Y;
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

  return { page, yPosition };
}

/**
 * Draw Limitations
 */
export function drawLimitations(
  cursor: Cursor,
  limitationsText: string,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  let { page, yPosition } = cursor;
  yPosition -= 20;
   yPosition = drawSectionTitle(page, MARGIN, yPosition, 'LIMITATIONS AND ASSUMPTIONS', { regular: font, bold: fontBold });

  const sanitized = sanitizePdfText(limitationsText);
  const lines = wrapText(sanitized, CONTENT_WIDTH, 11, font);

  for (const line of lines) {
    if (yPosition < MARGIN + 50) {
      const result = addNewPage(pdfDoc, isDraft, totalPages);
      page = result.page;
      yPosition = PAGE_TOP_Y;
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

  return { page, yPosition };
}

/**
 * Draw Table of Contents
 */
export function drawTableOfContents(
  page: PDFPage,
  font: any,
  fontBold: any
): void {
  let yPosition = PAGE_TOP_Y - 40;

  // Title - using Arup-style page title
  yPosition = drawPageTitle(page, MARGIN, yPosition, 'Contents', { regular: font, bold: fontBold });

  yPosition -= 12;

  for (const section of FRA_REPORT_STRUCTURE) {
    // Use displayNumber for consistent numbering (handles merged sections)
    const sectionNumber = section.displayNumber ?? section.id;

    yPosition = drawContentsRow(
      page,
      MARGIN + 20,
      yPosition,
      sectionNumber,
      section.title,
      { regular: font, bold: fontBold }
    );

    if (yPosition < MARGIN + 50) {
      break;
    }
  }
}

/**
 * Draw Clean Audit Page 1
 */
export function drawCleanAuditPage1(
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
  let yPosition = PAGE_TOP_Y - 40;
  const coverTitleContent = getCoverTitleContent(document.document_type, document.title);
  const resolvedReportTitle = sanitizePdfText(coverTitleContent.title);
  const reportProductLabel = sanitizePdfText(coverTitleContent.productLabel);
  
  // Extract site identity from A1 module (single source of truth)
  const a1Data = a1Module?.data || {};
  const siteName = sanitizePdfText(a1Data.site?.name || resolvedReportTitle || reportProductLabel);
  const clientName = sanitizePdfText(a1Data.client?.name || document.responsible_person || organisation.name);

  // Build site address from A1
  const siteAddressParts = [];
  if (a1Data.site?.address?.line1) siteAddressParts.push(a1Data.site.address.line1);
  if (a1Data.site?.address?.line2) siteAddressParts.push(a1Data.site.address.line2);
  if (a1Data.site?.address?.city) siteAddressParts.push(a1Data.site.address.city);
  if (a1Data.site?.address?.postcode) siteAddressParts.push(a1Data.site.address.postcode);
  const siteAddress = sanitizePdfText(siteAddressParts.join(', '));

  // Title Block (Centered)
  page.drawText(reportProductLabel, {
    x: centerX - (fontBold.widthOfTextAtSize(reportProductLabel, 24) / 2),
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

  // Executive Summary - Engineering Consultancy Style
  const fonts = { regular: font, bold: fontBold };

  // Use Arup-style section title
  yPosition = drawSectionTitle(page, MARGIN, yPosition, 'OVERALL RISK TO LIFE', fonts);

  // Add rule line for consistency
  const ruleY = yPosition;
  page.drawLine({
    start: { x: MARGIN, y: ruleY },
    end: { x: MARGIN + CONTENT_WIDTH, y: ruleY },
    thickness: 1,
    color: rgb(0.85, 0.87, 0.89),
  });
  yPosition = ruleY - 18;

  yPosition = drawRiskBadge({
    page,
    x: MARGIN,
    y: yPosition,
    riskLabel: scoringResult.overallRisk,
    fonts,
  });

  yPosition = drawRiskBand({
    page,
    x: MARGIN,
    y: yPosition,
    w: CONTENT_WIDTH,
    riskLabel: scoringResult.overallRisk,
    fonts,
  });

  yPosition -= 72;

  yPosition = drawLikelihoodConsequenceBlock({
    page,
    x: MARGIN,
    y: yPosition,
    w: CONTENT_WIDTH,
    likelihood: scoringResult.likelihood,
    consequence: scoringResult.consequence,
    fonts,
  });

  yPosition -= 10;

  const likeText = sanitizePdfText(
    normalizeDisplayValue(scoringResult?.likelihood ?? '')
  ).trim();

  const consText = sanitizePdfText(
    normalizeDisplayValue(scoringResult?.consequence ?? '')
  ).trim();

  // Auto narrative (wrapped)
  const narrativeText = `The likelihood of fire is assessed as ${likeText} and the potential consequences are assessed as ${consText}. The overall risk to life is therefore assessed as ${scoringResult.overallRisk}.`;
  const narrativeLines = wrapText(narrativeText, CONTENT_WIDTH, 10, font);
  for (const line of narrativeLines) {
    page.drawText(line, {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    yPosition -= 13;
  }

  yPosition -= 20;

  // Provisional warning (if applicable)
  if (scoringResult.provisional) {
    page.drawRectangle({
      x: MARGIN + 20,
      y: yPosition - 55,
      width: CONTENT_WIDTH - 40,
      height: 60,
      borderColor: PDF_THEME.colours.risk.medium.border,
      borderWidth: 1,
      color: PDF_THEME.colours.risk.medium.bg,
    });

    page.drawText('PROVISIONAL ASSESSMENT', {
      x: MARGIN + 35,
      y: yPosition - 25,
      size: 11,
      font: fontBold,
      color: PDF_THEME.colours.risk.medium.fg,
    });

    page.drawText('This assessment is provisional pending resolution of critical information gaps.', {
      x: MARGIN + 35,
      y: yPosition - 42,
      size: 9,
      font,
      color: PDF_THEME.colours.risk.medium.fg,
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

    // Use PDF_THEME token-based colors for priority bands
    const priorities = [
      { label: 'P1', count: p1Count, color: PDF_THEME.colours.risk.high.fg },
      { label: 'P2', count: p2Count, color: PDF_THEME.colours.risk.medium.fg },
      { label: 'P3', count: p3Count, color: PDF_THEME.colours.risk.info.fg },
      { label: 'P4', count: p4Count, color: PDF_THEME.colours.risk.info.fg }
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
