/**
 * FRA PDF Section Renderers
 * Section-specific rendering functions for FRA PDF generation
 */

import { PDFDocument, PDFPage, rgb } from 'pdf-lib';
import {
  MARGIN,
  CONTENT_WIDTH,
  PAGE_TOP_Y,
  sanitizePdfText,
  wrapText,
  formatDate,
  addNewPage,
  drawKeyValueRow,
  normalizeDisplayValue,
} from '../pdfUtils';
import { ensureSpace, ensureCursor } from './fraUtils';
import {
  drawModuleContent,
  renderFilteredModuleData,
} from './fraCoreDraw';
import type { Cursor, Document, ModuleInstance, Action } from './fraTypes';
import type { Attachment } from '../../supabase/attachments';
import { FRA_REPORT_STRUCTURE } from '../fraReportStructure';

/**
 * Get display section number (uses displayNumber if available, otherwise falls back to id)
 */
function getDisplaySectionNumber(sectionId: number): number {
  const section = FRA_REPORT_STRUCTURE.find(s => s.id === sectionId);
  return section?.displayNumber ?? section?.id ?? sectionId;
}

/**
 * Section 1: Assessment Details (A1_DOC_CONTROL)
 * Renders key assessment metadata in a compact format
 */
export function renderSection1AssessmentDetails(
  cursor: Cursor,
  sectionModules: ModuleInstance[],
  document: Document,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): Cursor {
  // CRITICAL: Ensure we start with a valid PDFPage
  cursor = ensureCursor(cursor, pdfDoc, isDraft, totalPages);
  let { page, yPosition } = cursor;

  const a1Module = sectionModules[0];

  // Helper functions
  const norm = (v: any) => sanitizePdfText(String(v ?? '')).trim();

  const drawFact = (c: Cursor, label: string, value: string): Cursor => {
    if (!value) return c; // Skip empty values

    let { page: p, yPosition: y } = c;

    // Ensure space and get potentially new page (requiredHeight, page, yPosition, ...)
    ({ page: p, yPosition: y } = ensureSpace(14, p, y, pdfDoc, isDraft, totalPages));

    // Validate page has drawText
    if (!p || typeof (p as any).drawText !== 'function') {
      throw new Error('[PDF] drawFact received invalid page');
    }

    // Draw label
    p.drawText(`${label}:`, {
      x: MARGIN,
      y,
      size: 9,
      font: fontBold,
      color: rgb(0.42, 0.42, 0.42)
    });

    // Draw value
    p.drawText(value, {
      x: MARGIN + 140,
      y,
      size: 10,
      font,
      color: rgb(0.18, 0.18, 0.18)
    });

    y -= 12;
    return { page: p, yPosition: y };
  };

  // Intro sentence (optional, slim)
  const introPara = 'Assessment overview for reporting and identification.';

  ({ page, yPosition } = ensureSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));
  page.drawText(introPara, {
    x: MARGIN,
    y: yPosition,
    size: 10,
    font,
    color: rgb(0.18, 0.18, 0.18),
  });
  yPosition -= 18; // Extra spacing after intro

  // Extract data from A1 module and document
  const data: any = a1Module?.data || {};

  // Client and Site info
  const clientName = norm(
    document.meta?.client?.name ||
    data.client?.name ||
    data.clientName ||
    document.responsible_person ||
    ''
  );

  const siteName = norm(
    document.meta?.site?.name ||
    data.site?.name ||
    data.siteName ||
    ''
  );

  // Build address (one line)
  const addressParts: string[] = [];
  const addr = document.meta?.site?.address || data.site?.address || {};
  if (addr.line1 || data.addressLine1) addressParts.push(norm(addr.line1 || data.addressLine1));
  if (addr.line2 || data.addressLine2) addressParts.push(norm(addr.line2 || data.addressLine2));
  if (addr.city || data.city) addressParts.push(norm(addr.city || data.city));
  if (addr.postcode || data.postcode) addressParts.push(norm(addr.postcode || data.postcode));
  const address = addressParts.filter(Boolean).join(', ');

  // Assessment date
  const assessmentDate = document.assessment_date ? formatDate(document.assessment_date) : 'N/A';

  // Draw compact facts list (5 rows max) - update cursor after each call
  ({ page, yPosition } = drawFact({ page, yPosition }, 'Client', clientName));
  ({ page, yPosition } = drawFact({ page, yPosition }, 'Site', siteName));
  ({ page, yPosition } = drawFact({ page, yPosition }, 'Address', address));
  ({ page, yPosition } = drawFact({ page, yPosition }, 'Assessment Date', assessmentDate));
  ({ page, yPosition } = drawFact({ page, yPosition }, 'Assessor', norm(document.assessor_name || '')));

  // Optional: Include assessor role if present
  const assessorRole = norm(document.assessor_role || '');
  if (assessorRole) {
    ({ page, yPosition } = drawFact({ page, yPosition }, 'Role', assessorRole));
  }

  // Add some spacing after the section
  yPosition -= 8;

  return { page, yPosition };
}

/**
 * Section 2: Premises & General Information (A2_BUILDING_PROFILE)
 */
export function renderSection2Premises(
  cursor: Cursor,
  sectionModules: ModuleInstance[],
  document: Document,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): Cursor {
  let { page, yPosition } = cursor;

  const a2Module = sectionModules[0];
  
  if (!a2Module) {
    page.drawText('No Premises & General Information data captured (A2).', {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    yPosition -= 14;
    return { page, yPosition };
  }

  const data: any = (a2Module as any).data;

  if (!data) {
    page.drawText('Premises & General Information module has no data payload (A2).', {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    yPosition -= 14;
    return { page, yPosition };
  }

  if (data) {

    const norm = (v: any) => sanitizePdfText(String(v ?? '')).replace(/_/g, ' ').trim();
    const pushIf = (arr: string[], s?: string) => { if (s && s.trim()) arr.push(s.trim()); };
    const yesNo = (v: any) =>
      v === 'yes' || v === true ? 'Yes'
      : v === 'no' || v === false ? 'No'
      : v;

    const drawFact = (label: string, value: string) => {
      const safeValue = sanitizePdfText(
        normalizeDisplayValue(value)
      ).trim();
      page.drawText(`${label}:`, { x: MARGIN, y: yPosition, size: 9, font: fontBold, color: rgb(0.42, 0.42, 0.42) });
      page.drawText(safeValue, { x: MARGIN + 140, y: yPosition, size: 10, font, color: rgb(0.18, 0.18, 0.18) });
      yPosition -= 12;
    };

    const buildingName = norm(data.building_name);
    const yearBuilt = norm(data.year_built);
    const heightM = norm(data.height_m);
    const storeysBand = norm(data.storeys_band);
    const floorArea = norm(data.gross_floor_area_m2 || data.floor_area_m2 || data.total_floor_area_m2);
    const buildingUse = norm(data.building_use || data.use_type || data.occupancy_profile);
    const construction = norm(data.construction_type || data.primary_construction || data.frame_type);
    const basement = data.has_basement !== undefined ? (data.has_basement ? 'Yes' : 'No') : '';
    const notes = norm(data.notes);

    const sentences: string[] = [];

    if (buildingUse || buildingName) {
      pushIf(sentences, `The assessment relates to${buildingUse ? ` a ${buildingUse}` : ''}${buildingName ? ` premises known as ${buildingName}` : ' the premises'}.`);
    }

    if (storeysBand && heightM) {
      pushIf(sentences, `The building comprises ${storeysBand} storeys and is approximately ${heightM} metres in height.`);
    } else if (storeysBand) {
      pushIf(sentences, `The building comprises ${storeysBand} storeys.`);
    } else if (heightM) {
      pushIf(sentences, `The building is approximately ${heightM} metres in height.`);
    }

    if (yearBuilt) pushIf(sentences, `The building is understood to have been constructed circa ${yearBuilt}.`);
    if (construction) pushIf(sentences, `Primary construction is recorded as ${construction}.`);
    if (basement) pushIf(sentences, `Basement present: ${basement}.`);
    if (notes) pushIf(sentences, notes.endsWith('.') ? notes : `${notes}.`);

    if (data.has_building_address && data.building_address) {
      const addr = data.building_address;
      const addressParts = [addr.line1, addr.line2, addr.city, addr.postcode].filter(Boolean).map(norm);
      if (addressParts.length) pushIf(sentences, `The building address is recorded as ${addressParts.join(', ')}.`);
    }

    if (sentences.length) {
      const narrative = sentences.join(' ');
      const lines = wrapText(narrative, CONTENT_WIDTH, 11, font);
      for (const line of lines) {
        ({ page, yPosition } = ensureSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));
        page.drawText(line, { x: MARGIN, y: yPosition, size: 11, font, color: rgb(0.18, 0.18, 0.18) });
        yPosition -= 14;
      }
      yPosition -= 10;
    }

    const facts: Array<[string, string]> = [];
    if (buildingUse) facts.push(['Building use', buildingUse]);
    if (buildingName) facts.push(['Building name', buildingName]);
    if (storeysBand) facts.push(['Storeys', storeysBand]);
    if (heightM) facts.push(['Height', `${heightM} m`]);
    if (floorArea) facts.push(['Floor area (m²)', floorArea]);
    if (yearBuilt) facts.push(['Year Built', yearBuilt]);
    if (construction) facts.push(['Construction', construction]);
    if (basement) facts.push(['Basement', basement]);

    if (data.has_building_address && data.building_address) {
      const addr = data.building_address;
      const addressParts = [addr.line1, addr.line2, addr.city, addr.postcode].filter(Boolean).map(norm);
      if (addressParts.length) facts.push(['Building address', addressParts.join(', ')]);
    }

    if (facts.length) {
      ({ page, yPosition } = ensureSpace(16, page, yPosition, pdfDoc, isDraft, totalPages));
      page.drawLine({
        start: { x: MARGIN, y: yPosition },
        end: { x: MARGIN + CONTENT_WIDTH, y: yPosition },
        thickness: 0.7,
        color: rgb(0.84, 0.86, 0.89),
      });
      yPosition -= 12;

      for (const [label, value] of facts) {
        ({ page, yPosition } = ensureSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));
        drawFact(label, value);
      }
      yPosition -= 6;
    }
  }

  return { page, yPosition };
}

/**
 * Section 3: Occupants & Persons at Risk (A3_PERSONS_AT_RISK)
 */
export function renderSection3Occupants(
  cursor: Cursor,
  sectionModules: ModuleInstance[],
  document: Document,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): Cursor {
  let { page, yPosition } = cursor;

  const a3Module = sectionModules[0];

  if (!a3Module) {
    page.drawText('No Occupants & Vulnerability data captured (A3).', {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    yPosition -= 14;
    return { page, yPosition };
  }

  const data: any = (a3Module as any).data;
  
  if (!data) {
    page.drawText('Occupants & Vulnerability module has no data payload (A3).', {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    yPosition -= 14;
    return { page, yPosition };
  }

  if (data) {

    const norm = (v: any) => sanitizePdfText(String(v ?? '')).replace(/_/g, ' ').trim();
    const pushIf = (arr: string[], s?: string) => { if (s && s.trim()) arr.push(s.trim()); };
    const yesNo = (v: any) =>
      v === 'yes' || v === true ? 'Yes'
      : v === 'no' || v === false ? 'No'
      : v;

    const drawFact = (label: string, value: string) => {
      const safeValue = sanitizePdfText(
        normalizeDisplayValue(value)
      ).trim();
      page.drawText(`${label}:`, { x: MARGIN, y: yPosition, size: 9, font: fontBold, color: rgb(0.42, 0.42, 0.42) });
      page.drawText(safeValue, { x: MARGIN + 140, y: yPosition, size: 10, font, color: rgb(0.18, 0.18, 0.18) });
      yPosition -= 12;
    };

    const sentences: string[] = [];

    const typical = data.normal_occupancy ? String(data.normal_occupancy) : '';
    const max = data.max_occupancy ? String(data.max_occupancy) : '';
    const occProfile = norm(data.occupancy_profile);

    const vulnerableGroups = Array.isArray(data.vulnerable_groups)
      ? data.vulnerable_groups.map(norm).filter(Boolean).join(', ')
      : norm(data.vulnerable_groups);

    const vulnerableNotes = norm(data.vulnerable_groups_notes);
    const peeps = norm(data.peeps_dependency);
    const outOfHours = norm(data.out_of_hours_occupation);

    if (max || typical) {
      const parts: string[] = [];
      if (max) parts.push(`approximately ${max} persons at peak occupancy`);
      if (typical) parts.push(`with a typical occupancy of ${typical}`);
      pushIf(sentences, `The premises accommodate ${parts.join(', ')}.`);
    }

    if (occProfile) pushIf(sentences, `Occupancy profile: ${occProfile}.`);

    if (vulnerableGroups || vulnerableNotes) {
      const vg = [vulnerableGroups, vulnerableNotes].filter(Boolean).join(vulnerableGroups && vulnerableNotes ? ' — ' : '');
      pushIf(sentences, `Vulnerable groups: ${vg}.`);
    }

    if (peeps || data.evacuation_assistance_required) {
      pushIf(sentences, `Personal Emergency Evacuation Plans (PEEPs) are in place.`);
    }

    if (outOfHours) {
      pushIf(sentences, `The premises are occupied outside normal working hours.`);
    }

    if (data.sleeping_accommodation !== undefined) {
      pushIf(sentences, data.sleeping_accommodation
        ? `Sleeping accommodation is present.`
        : `Sleeping accommodation is not present.`);
    }

    if (data.lone_working !== undefined && data.lone_working === 'yes') {
      pushIf(sentences, `Lone working arrangements may be encountered.`);
    }

    if (sentences.length) {
      const narrative = sentences.join(' ');
      const lines = wrapText(narrative, CONTENT_WIDTH, 11, font);
      for (const line of lines) {
        ({ page, yPosition } = ensureSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));
        page.drawText(line, { x: MARGIN, y: yPosition, size: 11, font, color: rgb(0.18, 0.18, 0.18) });
        yPosition -= 14;
      }
      yPosition -= 10;
    }

    const facts: Array<[string, string]> = [];
    if (typical) facts.push(['Typical occupancy', typical]);
    if (max) facts.push(['Maximum occupancy', max]);
    if (occProfile) facts.push(['Occupancy profile', occProfile]);
    if (vulnerableGroups) facts.push(['Vulnerable groups', vulnerableGroups]);
    if (vulnerableNotes) facts.push(['Vulnerable groups notes', vulnerableNotes]);
    if (peeps) facts.push(['PEEPs / dependency', yesNo(peeps)]);
    if (outOfHours) facts.push(['Out of hours occupation', yesNo(outOfHours)]);
    if (data.sleeping_accommodation !== undefined) facts.push(['Sleeping accommodation', yesNo(data.sleeping_accommodation)]);
    if (data.lone_working !== undefined) facts.push(['Lone working', yesNo(data.lone_working)]);

    if (facts.length) {
      ({ page, yPosition } = ensureSpace(16, page, yPosition, pdfDoc, isDraft, totalPages));
      page.drawLine({
        start: { x: MARGIN, y: yPosition },
        end: { x: MARGIN + CONTENT_WIDTH, y: yPosition },
        thickness: 0.7,
        color: rgb(0.84, 0.86, 0.89),
      });
      yPosition -= 12;

      for (const [label, value] of facts) {
        ({ page, yPosition } = ensureSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));
        drawFact(label, value);
      }
      yPosition -= 6;
    }
  }

  return { page, yPosition };
}

/**
 * Section 4: Legislation & Duty Holder (A1_DOC_CONTROL)
 * Renders ONLY governance fields to avoid duplication with Section 1
 */
export function renderSection4Legislation(
  cursor: Cursor,
  sectionModules: ModuleInstance[],
  document: Document,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): Cursor {
  // CRITICAL: Ensure we start with a valid PDFPage
  cursor = ensureCursor(cursor, pdfDoc, isDraft, totalPages);
  let { page, yPosition } = cursor;

  const a1Module = sectionModules.find(m => m.module_key === 'A1_DOC_CONTROL');

  if (!a1Module) {
    return { page, yPosition };
  }

  const data: any = a1Module.data || {};
  const norm = (v: any) => sanitizePdfText(String(v ?? '')).trim();

  // Helper function to draw governance facts
  const VALUE_X = MARGIN + 150; // Consistent x-position for all values

  const drawGovernanceFact = (c: Cursor, label: string, value: string): Cursor => {
    if (!value) return c; // Skip empty values

    let { page: p, yPosition: y } = c;

    // Ensure space for the fact
    ({ page: p, yPosition: y } = ensureSpace(14, p, y, pdfDoc, isDraft, totalPages));

    // Validate page
    if (!p || typeof (p as any).drawText !== 'function') {
      throw new Error('[PDF] drawGovernanceFact received invalid page');
    }

    // Draw label (standardized to match Sections 2/3)
    p.drawText(`${label}:`, {
      x: MARGIN,
      y,
      size: 10,
      font: fontBold,
      color: rgb(0.35, 0.35, 0.35)
    });

    // Normalize and sanitize value
    const safeValue = sanitizePdfText(
      normalizeDisplayValue(value)
    ).trim();

    // Wrap value text to remaining width after VALUE_X
    const valueLines = wrapText(safeValue, CONTENT_WIDTH - 150, 10, font);

    for (let i = 0; i < valueLines.length; i++) {
      if (i > 0) {
        // Need new line for wrapped text
        y -= 12;
        ({ page: p, yPosition: y } = ensureSpace(12, p, y, pdfDoc, isDraft, totalPages));
      }

      p.drawText(valueLines[i], {
        x: VALUE_X,
        y,
        size: 10,
        font,
        color: rgb(0.18, 0.18, 0.18)
      });
    }

    y -= 12; // Spacing after fact (tightened rhythm)
    return { page: p, yPosition: y };
  };

  // Intro paragraph - authoritative and concise
  const introPara = 'This section outlines the applicable regulatory framework and identifies the duty holder responsibilities relevant to this assessment.';

  if (introPara.trim()) {
    ({ page, yPosition } = ensureSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));
    const introLines = wrapText(introPara, CONTENT_WIDTH, 10, font);
    for (const line of introLines) {
      ({ page, yPosition } = ensureSpace(14, page, yPosition, pdfDoc, isDraft, totalPages));
      page.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.18, 0.18, 0.18),
      });
      yPosition -= 14;
    }

    // Divider line (exact match to Sections 2/3)
    ({ page, yPosition } = ensureSpace(16, page, yPosition, pdfDoc, isDraft, totalPages));
    page.drawLine({
      start: { x: MARGIN, y: yPosition },
      end: { x: MARGIN + CONTENT_WIDTH, y: yPosition },
      thickness: 0.7,
      color: rgb(0.84, 0.86, 0.89),
    });
    yPosition -= 12; // Space after divider before facts
  }

  // Extract governance fields only
  const responsiblePerson = norm(
    document.responsible_person ||
    data.responsible_person ||
    data.duty_holder ||
    ''
  );

  const scope = norm(
    document.scope_description ||
    data.scope_description ||
    data.scope ||
    ''
  );

  // Build standards string
  let standards = '';
  if (Array.isArray(document.standards_selected) && document.standards_selected.length > 0) {
    standards = document.standards_selected.join(', ');
  } else if (Array.isArray(data.standards_selected) && data.standards_selected.length > 0) {
    standards = data.standards_selected.join(', ');
  } else if (Array.isArray(data.standards) && data.standards.length > 0) {
    standards = data.standards.join(', ');
  }
  standards = norm(standards);

  const limitations = norm(
    document.limitations_assumptions ||
    data.limitations_assumptions ||
    data.limitations ||
    ''
  );

  // Render governance facts (only these 4 fields)
  ({ page, yPosition } = drawGovernanceFact({ page, yPosition }, 'Responsible Person', responsiblePerson));
  ({ page, yPosition } = drawGovernanceFact({ page, yPosition }, 'Assessment Scope', scope));
  ({ page, yPosition } = drawGovernanceFact({ page, yPosition }, 'Standards & Guidance', standards));
  ({ page, yPosition } = drawGovernanceFact({ page, yPosition }, 'Limitations & Assumptions', limitations));

  // Add spacing after section (aligned with Sections 2/3)
  yPosition -= 12;

  return { page, yPosition };
}

/**
 * Section 5: Fire Hazards (FRA_1_HAZARDS)
 * Clean grouped output with visual consistency matching Sections 2-4
 */
export function renderSection5FireHazards(
  cursor: Cursor,
  sectionModules: ModuleInstance[],
  document: Document,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): Cursor {
  cursor = ensureCursor(cursor, pdfDoc, isDraft, totalPages);
  let { page, yPosition } = cursor;

  const mod = sectionModules.find(m => m.module_key === 'FRA_1_HAZARDS');
  if (!mod) return { page, yPosition };

  const d: any = mod.data || {};

  const norm = (v: any) => sanitizePdfText(String(v ?? '')).replace(/_/g, ' ').trim();
  const titleCase = (s: string) =>
    s.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());

  const list = (arr: any, other?: any) => {
    const a = Array.isArray(arr) ? arr.map(norm).filter(Boolean) : [];
    const o = norm(other);
    if (o) a.push(o);
    return a;
  };

  const drawSubhead = (text: string) => {
    ({ page, yPosition } = ensureSpace(18, page, yPosition, pdfDoc, isDraft, totalPages));
    page.drawText(text.toUpperCase(), {
      x: MARGIN,
      y: yPosition,
      size: 9,
      font: fontBold,
      color: rgb(0.35, 0.35, 0.35),
    });
    yPosition -= 14;
  };

  const drawLine = () => {
    const y = yPosition - 4;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + CONTENT_WIDTH, y },
      thickness: 0.7,
      color: rgb(0.84, 0.86, 0.89),
    });
    yPosition -= 16;
  };

  const drawFact = (label: string, value: string) => {
    const v = norm(value);
    if (!v) return;

    // Estimate required height for page break check
    // Use a rough estimate: 14px per line, assume label might wrap once, value might wrap 2-3 times
    const estimatedHeight = 50;
    ({ page, yPosition } = ensureSpace(estimatedHeight, page, yPosition, pdfDoc, isDraft, totalPages));

    // Use drawKeyValueRow helper with proper column widths to prevent overlap
    yPosition = drawKeyValueRow(
      page,
      MARGIN,
      yPosition,
      `${label}:`,
      v,
      fontBold,
      font,
      9,  // labelSize
      10, // valueSize
      12, // lineHeight
      210, // labelWidth - wider than 150 to accommodate long labels
      14  // gap
    );
  };

  const endGroup = () => {
    yPosition -= 6;
  };

  // --- Clean grouped output ---
  // Small divider after outcome/key points area
  drawLine();

  const ignition = list(d.ignition_sources, d.ignition_other).filter((x: string) => x !== 'hot_work');
  const fuels = list(d.fuel_sources, d.fuel_other);
  const highRisk = list(d.high_risk_activities, d.high_risk_other).filter((x: string) => x !== 'hot_work');

  // Group 1: Sources
  if (ignition.length || fuels.length) {
    drawSubhead('Sources');
    if (ignition.length) drawFact('Ignition sources', ignition.map(titleCase).join(', '));
    if (fuels.length) drawFact('Fuel sources', fuels.map(titleCase).join(', '));
    endGroup();
  }

  // Group 2: Oxygen enrichment
  const oxygen = norm(d.oxygen_enrichment);
const oxygenNotes = norm(d.oxygen_sources_notes);

// Treat "none"/"no" as not reportable unless notes exist
const oxygenIsMeaningful =
  !!oxygen && !['none', 'no', 'n/a', 'na', 'not applicable'].includes(oxygen.toLowerCase());

if (oxygenIsMeaningful || oxygenNotes) {
  if (oxygenIsMeaningful && !oxygenNotes) {
    drawFact('Oxygen enrichment', titleCase(oxygen));
  } else {
    drawSubhead('Oxygen enrichment');
    if (oxygenIsMeaningful) drawFact('Oxygen enrichment', titleCase(oxygen));
    if (oxygenNotes) drawFact('Notes', oxygenNotes);
  }
}

  // Group 3: Higher-risk activities
  if (highRisk.length) {
    drawSubhead('Higher-risk activities');
    drawFact('Activities', highRisk.map(titleCase).join(', '));
    endGroup();
  }

  // Group 4: Context factors
  const hk = norm(d.housekeeping_fire_load);
  const arson = norm(d.arson_risk);

  if (hk || arson) {
    drawSubhead('Context factors');
    if (hk) drawFact('Housekeeping / fire load', titleCase(hk));
    if (arson) drawFact('Arson risk', titleCase(arson));
    endGroup();
  }

  // Group 5: Electrical safety
if (d.electrical_safety && typeof d.electrical_safety === 'object') {
  const es = d.electrical_safety;

  // CONFIRMED form keys (Codex)
  const eicrSeen = norm(es.eicr_evidence_seen ?? '');
  const eicrSat  = norm(es.eicr_satisfactory ?? '');
  const c1c2     = norm(es.eicr_outstanding_c1_c2 ?? ''); // <-- key fix
  const pat      = norm(es.pat_in_place ?? '');           // <-- key fix

  if (eicrSeen || eicrSat || c1c2 || pat) {
    drawSubhead('Electrical safety');

    // Build a single, reader-friendly EICR line
    // Override: any outstanding C1/C2 => UNSATISFACTORY (regardless of "satisfactory" field)
    let eicrText = '';
    if (c1c2 === 'yes') {
      eicrText = 'UNSATISFACTORY — outstanding C1/C2 defects (urgent remedial action required)';
    } else {
      const sat = eicrSat ? titleCase(eicrSat) : '';
      const seen = eicrSeen ? titleCase(eicrSeen) : '';

      if (sat && seen) eicrText = `${sat} (evidence seen: ${seen})`;
      else if (sat) eicrText = sat;
      else if (seen) eicrText = `Evidence seen: ${seen}`;
    }

    if (eicrText) {
      drawFact('Electrical Installation Condition Report (EICR)', eicrText); // <-- label fix
    }

    // Avoid duplicating urgency wording (already stated in the EICR line)
    if (c1c2 === 'yes') {
      drawFact('Outstanding C1/C2 defects', 'Yes');
    } else if (c1c2) {
      drawFact('Outstanding C1/C2 defects', titleCase(c1c2));
    }

    // PAT label expansion
    if (pat) drawFact('Portable Appliance Testing (PAT) in place', titleCase(pat)); // <-- label fix

    endGroup();
  }
}

  // Group 6: Lightning, Duct cleaning, DSEAR (screening)
  const lightning = d.lightning || {};
  const ductCleaning = d.duct_cleaning || {};
  const dsearScreen = d.dsear_screen || {};

  const lnProtection = norm(lightning.lightning_protection_present);
  const lnAssessment = norm(lightning.lightning_risk_assessment_completed);
  const lnDate = norm(lightning.assessment_date);
  const lnNotes = norm(lightning.notes);

  const ductPresent = norm(ductCleaning.ducts_present);
  const ductRisk = norm(ductCleaning.dust_grease_risk);
  const ductFreq = norm(ductCleaning.cleaning_frequency);
  const ductLast = norm(ductCleaning.last_cleaned);
  const ductNotes = norm(ductCleaning.notes);

  const dsFlam = norm(dsearScreen.flammables_present);
  const dsAtmos = norm(dsearScreen.explosive_atmospheres_possible);
  const dsStatus = norm(dsearScreen.dsear_assessment_status);
  const dsAssessor = norm(dsearScreen.assessor);
  const dsNotes = norm(dsearScreen.notes);

  const hasLightningData = lnProtection || lnAssessment || lnDate || lnNotes;
  const hasDuctData = ductPresent || ductRisk || ductFreq || ductLast || ductNotes;
  const hasDsearData = dsFlam || dsAtmos || dsStatus || dsAssessor || dsNotes;

  if (hasLightningData || hasDuctData || hasDsearData) {
    drawSubhead('Lightning, duct cleaning, DSEAR (screening)');

    if (hasLightningData) {
      if (lnProtection) drawFact('Lightning protection present', titleCase(lnProtection));
      if (lnAssessment) drawFact('Lightning risk assessment', titleCase(lnAssessment));
      if (lnDate) drawFact('Assessment date', lnDate);
      if (lnNotes) drawFact('Lightning notes', lnNotes);
    }

    if (hasDuctData) {
      if (ductPresent) drawFact('Extract ductwork present', titleCase(ductPresent));
      if (ductRisk) drawFact('Dust/grease accumulation risk', titleCase(ductRisk));
      if (ductFreq) drawFact('Duct cleaning frequency', titleCase(ductFreq));
      if (ductLast) drawFact('Last cleaned', ductLast);
      if (ductNotes) drawFact('Duct cleaning notes', ductNotes);
    }

    if (hasDsearData) {
      if (dsFlam) drawFact('Flammable substances present', titleCase(dsFlam));
      if (dsAtmos) drawFact('Explosive atmospheres possible', titleCase(dsAtmos));
      if (dsStatus) drawFact('DSEAR assessment status', titleCase(dsStatus));
      if (dsAssessor) drawFact('DSEAR assessor', dsAssessor);
      if (dsNotes) drawFact('DSEAR notes', dsNotes);
    }

    endGroup();
  }

  // Optional free notes
  const notes = norm(d.notes);
  if (notes) {
    drawSubhead('Additional notes');
    drawFact('Notes', notes);
  }

  yPosition -= 4;
  return { page, yPosition };
}

/**
 * Section 7: Active Fire Protection (Detection, Alarm & Emergency Lighting)
 * Renders FRA_3_ACTIVE_SYSTEMS including detection, alarm, and emergency lighting
 * (Emergency lighting merged from former Section 8)
 */
export async function renderSection7Detection(
  cursor: Cursor,
  sectionModules: ModuleInstance[],
  document: Document,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  attachments?: Attachment[],
  evidenceRefMap?: Map<string, string>,
  moduleInstances?: ModuleInstance[],
  actions?: Action[],
  actionIdToSectionId?: Map<string, number>
): Promise<Cursor> {
  let { page, yPosition } = cursor;

  // ✅ Hard guarantee: always have a page before any operations
  if (!page) {
    const init = addNewPage(pdfDoc, isDraft, totalPages);
    page = init.page;
    yPosition = PAGE_TOP_Y;
  }
  if (typeof yPosition !== 'number') {
    yPosition = PAGE_TOP_Y;
  }

   // Primary section heading is rendered once by buildFraPdf's shared section pass.
  // Keep only section body content here to prevent duplicate top-level headings.

  const fra3Module = sectionModules.find(m => m.module_key === 'FRA_3_ACTIVE_SYSTEMS');

  if (fra3Module) {
    // Use drawModuleContent with sectionId=7 for proper Section 7 filtering
    // This will show fire alarm + emergency lighting fields via drawModuleKeyDetails
    ({ page, yPosition } = await drawModuleContent(
      { page, yPosition },
      fra3Module,
      document,
      font,
      fontBold,
      pdfDoc,
      isDraft,
      totalPages,
      [], // keyPoints handled by main renderer
      ['FRA_3_ACTIVE_SYSTEMS'],
      7, // Section ID for Section 7 filtering
      attachments, // Pass attachments for inline evidence
      evidenceRefMap, // Pass evidence reference map
      moduleInstances, // Pass module instances for evidence linking
      actions, // Pass actions for action-linked evidence
      actionIdToSectionId // Pass action->section map for null module_instance_id fallback
    ));
  }

  return { page, yPosition };
}

/**
 * Section 8: Emergency Lighting
 * @deprecated REMOVED - Section 8 has been folded into Section 7
 * Emergency lighting is now part of "Active Fire Protection (Detection, Alarm & Emergency Lighting)"
 * This function is kept for backwards compatibility but should not be used.
 */
export function renderSection8EmergencyLighting(
  cursor: Cursor,
  sectionModules: ModuleInstance[],
  document: Document,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): Cursor {
  // DEPRECATED: Section 8 removed, emergency lighting now in Section 7
  // Return cursor unchanged to avoid breaking existing code
  console.warn('[PDF] renderSection8EmergencyLighting is deprecated - Section 8 removed');
  return cursor;
}

/**
 * Section 10: Fixed Fire Suppression & Firefighting Facilities
 * Split from FRA_8 (suppression systems only)
 */
export async function renderSection10Suppression(
  cursor: Cursor,
  sectionModules: ModuleInstance[],
  document: Document,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  attachments?: Attachment[],
  evidenceRefMap?: Map<string, string>,
  moduleInstances?: ModuleInstance[],
  actions?: Action[],
  actionIdToSectionId?: Map<string, number>
): Promise<Cursor> {
  
  let { page, yPosition } = cursor;

  // ✅ Hard guarantee: always have a page before any operations
  if (!page) {
    const init = addNewPage(pdfDoc, isDraft, totalPages);
    page = init.page;
    yPosition = PAGE_TOP_Y;
  }
  if (typeof yPosition !== 'number') {
    yPosition = PAGE_TOP_Y;
  }

  // Primary section heading is rendered once by buildFraPdf's shared section pass.
  // Keep only section body content here to prevent duplicate top-level headings.

  const fra8Module = sectionModules.find(m => m.module_key === 'FRA_8_FIREFIGHTING_EQUIPMENT');

  if (fra8Module && fra8Module.data) {
    // Use standard rendering pipeline to surface structured firefighting data
    // This includes sprinklers, risers, firefighting shaft/lift from data.firefighting.fixed_facilities
    ({ page, yPosition } = await drawModuleContent(
      { page, yPosition },
      fra8Module,
      document,
      font,
      fontBold,
      pdfDoc,
      isDraft,
      totalPages,
      undefined, // keyPoints
      ['FRA_8_FIREFIGHTING_EQUIPMENT'], // expectedModuleKeys
      10, // sectionId
      attachments,
      evidenceRefMap,
      moduleInstances,
      actions,
      actionIdToSectionId
    ));
  }

  return { page, yPosition };
}

/**
 * Section 11: Fire Safety Management & Procedures
 * Combines multiple management modules + FRA_8 portable equipment
 */
export async function renderSection11Management(
  cursor: Cursor,
  sectionModules: ModuleInstance[],
  allModules: ModuleInstance[],
  document: Document,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[],
  attachments?: Attachment[],
  evidenceRefMap?: Map<string, string>,
  moduleInstances?: ModuleInstance[],
  actions?: Action[],
  actionIdToSectionId?: Map<string, number>
): Promise<Cursor> {
  let { page, yPosition } = cursor;

  // HARD GUARD: never allow undefined page into this renderer
  if (!page) {
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

  // Primary section heading is rendered once by buildFraPdf's shared section pass.
  // Keep only section body content here to prevent duplicate top-level headings.

  const displayNum = getDisplaySectionNumber(11);

  // 11.1 Management Systems
  const managementSystemsModule = sectionModules.find(
    (m) => m.module_key === 'A4_MANAGEMENT_CONTROLS' || m.module_key === 'FRA_6_MANAGEMENT_SYSTEMS'
  );

  if (managementSystemsModule) {
    ({ page, yPosition } = ensureSpace(64, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText(`${displayNum}.1 Management Systems`, {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 20;

    ({ page, yPosition } = await drawModuleContent(
      { page, yPosition },
      managementSystemsModule,
      document,
      font,
      fontBold,
      pdfDoc,
      isDraft,
      totalPages,
      undefined,
      ['A4_MANAGEMENT_CONTROLS', 'FRA_6_MANAGEMENT_SYSTEMS'],
      11, // Section 11: Fire Safety Management
      attachments, // Pass attachments for inline evidence
      evidenceRefMap, // Pass evidence reference map
      moduleInstances, // Pass module instances for evidence linking
      actions, // Pass actions for action-linked evidence
      actionIdToSectionId // Pass action->section map for null module_instance_id fallback
    ));

    // Hot work permit controls (detail) - if available
    const mgmtData: any = managementSystemsModule.data || {};
    const hwFireWatchReq = mgmtData.ptw_hot_work_fire_watch_required;
    const hwPostMins = mgmtData.ptw_hot_work_post_watch_mins;
    const hwComments = sanitizePdfText(String(mgmtData.ptw_hot_work_comments ?? '')).trim();

    const hasHotWorkDetail = hwFireWatchReq !== null || hwPostMins || hwComments;

    if (hasHotWorkDetail) {
      ({ page, yPosition } = ensureSpace(60, page, yPosition, pdfDoc, isDraft, totalPages));
      yPosition -= 8;

      page.drawText('Hot work permit controls (detail)', {
        x: MARGIN,
        y: yPosition,
        size: 9,
        font: fontBold,
        color: rgb(0.35, 0.35, 0.35),
      });
      yPosition -= 14;

      const drawFact = (label: string, value: string) => {
        if (!value) return;
        ({ page, yPosition } = ensureSpace(30, page, yPosition, pdfDoc, isDraft, totalPages));
        yPosition = drawKeyValueRow(
          page,
          MARGIN,
          yPosition,
          `${label}:`,
          value,
          fontBold,
          font,
          9,
          10,
          12,
          210,
          14
        );
      };

      if (hwFireWatchReq !== null) {
        drawFact('Fire watch during hot work', hwFireWatchReq ? 'Yes' : 'No');
      }
      if (hwPostMins) {
        drawFact('Post-work fire watch duration', `${hwPostMins} minutes`);
      }
      if (hwComments) {
        drawFact('Comments', hwComments);
      }

      yPosition -= 6;
    }

    yPosition -= 15;
  }

  // 11.2 Emergency Arrangements
  const emergencyArrangementsModule = sectionModules.find(
    (m) => m.module_key === 'A5_EMERGENCY_ARRANGEMENTS' || m.module_key === 'FRA_7_EMERGENCY_ARRANGEMENTS'
  );

  if (emergencyArrangementsModule) {
    ({ page, yPosition } = ensureSpace(64, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText(`${displayNum}.2 Emergency Arrangements`, {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 20;

    ({ page, yPosition } = await drawModuleContent(
      { page, yPosition },
      emergencyArrangementsModule,
      document,
      font,
      fontBold,
      pdfDoc,
      isDraft,
      totalPages,
      undefined,
      ['A5_EMERGENCY_ARRANGEMENTS', 'FRA_7_EMERGENCY_ARRANGEMENTS'],
      11, // Section 11: Fire Safety Management
      attachments, // Pass attachments for inline evidence
      evidenceRefMap, // Pass evidence reference map
      moduleInstances, // Pass module instances for evidence linking
      actions, // Pass actions for action-linked evidence
      actionIdToSectionId // Pass action->section map for null module_instance_id fallback
    ));

    yPosition -= 15;
  }

  // 11.3 Review & Assurance
  const reviewAssuranceModule = sectionModules.find((m) => m.module_key === 'A7_REVIEW_ASSURANCE');

  if (reviewAssuranceModule) {
    ({ page, yPosition } = ensureSpace(64, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText(`${displayNum}.3 Review & Assurance`, {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 20;

    ({ page, yPosition } = await drawModuleContent(
      { page, yPosition },
      reviewAssuranceModule,
      document,
      font,
      fontBold,
      pdfDoc,
      isDraft,
      totalPages,
      undefined,
      ['A7_REVIEW_ASSURANCE'],
      11, // Section 11: Fire Safety Management
      attachments, // Pass attachments for inline evidence
      evidenceRefMap, // Pass evidence reference map
      moduleInstances, // Pass module instances for evidence linking
      actions, // Pass actions for action-linked evidence
      actionIdToSectionId // Pass action->section map for null module_instance_id fallback
    ));

    yPosition -= 15;
  }

  // 11.4 Portable Firefighting Equipment (from FRA_8)
  const fra8Module = allModules.find((m) => m.module_key === 'FRA_8_FIREFIGHTING_EQUIPMENT');

  if (fra8Module && fra8Module.data) {
    // Check for both structured (data.firefighting.portable_*) and legacy flat fields
    const hasStructuredPortable =
      fra8Module.data.firefighting?.portable_extinguishers?.present ||
      fra8Module.data.firefighting?.hose_reels?.installed;

    const hasLegacyPortable =
      fra8Module.data.portable_extinguishers ||
      fra8Module.data.extinguisher_types ||
      fra8Module.data.hose_reels ||
      fra8Module.data.fire_blankets;

    const hasEquipmentData = hasStructuredPortable || hasLegacyPortable;

    // Only draw header if we have equipment data
    if (hasEquipmentData) {
      ({ page, yPosition } = ensureSpace(72, page, yPosition, pdfDoc, isDraft, totalPages));

      page.drawText(`${displayNum}.4 Portable Firefighting Equipment`, {
        x: MARGIN,
        y: yPosition,
        size: 12,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      yPosition -= 20;
      // Create a filtered module that only includes portable equipment data
      const portableOnlyModule = {
        ...fra8Module,
        data: {
          // Include structured portable data
          firefighting: fra8Module.data.firefighting ? {
            portable_extinguishers: fra8Module.data.firefighting.portable_extinguishers,
            hose_reels: fra8Module.data.firefighting.hose_reels,
          } : undefined,
          // Include legacy flat keys as fallback
          portable_extinguishers: fra8Module.data.portable_extinguishers,
          extinguisher_types: fra8Module.data.extinguisher_types,
          extinguisher_locations: fra8Module.data.extinguisher_locations,
          hose_reels: fra8Module.data.hose_reels,
          fire_blankets: fra8Module.data.fire_blankets,
        }
      };

      // Use standard rendering to show portable equipment details
      ({ page, yPosition } = await drawModuleContent(
        { page, yPosition },
        portableOnlyModule,
        document,
        font,
        fontBold,
        pdfDoc,
        isDraft,
        totalPages,
        undefined,
        ['FRA_8_FIREFIGHTING_EQUIPMENT'],
        11, // Section 11: Fire Safety Management
        attachments, // Pass attachments for inline evidence
        evidenceRefMap, // Pass evidence reference map
        moduleInstances, // Pass module instances for evidence linking
        actions, // Pass actions for action-linked evidence
        actionIdToSectionId // Pass action->section map for null module_instance_id fallback
      ));
    }
    // No else block - if no equipment data, skip the subsection entirely
  }

  return { page, yPosition };
}

/**
 * Section 14: Review & Reassessment
 */
export function renderSection14Review(
  cursor: Cursor,
  _sectionModules: ModuleInstance[],
  document: Document,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): Cursor {
  let { page, yPosition } = cursor;

  // ✅ Hard guarantee: always have a page before any operations
  if (!page) {
    const init = addNewPage(pdfDoc, isDraft, totalPages);
    page = init.page;
    yPosition = PAGE_TOP_Y;
  }
  if (typeof yPosition !== 'number') {
    yPosition = PAGE_TOP_Y;
  }
  yPosition -= 10;

  page.drawText('Review Requirements', {
    x: MARGIN,
    y: yPosition,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  yPosition -= 20;

  const reviewText = `This fire risk assessment should be reviewed and, where necessary, updated:

• following any significant change to the building, occupancy, or use
• following a fire, alarm activation, or near-miss incident
• following enforcement action or formal notification by the fire authority
• as part of the ongoing fire safety management programme

Next formal reassessment recommended: ${document.review_date ? formatDate(document.review_date) : 'To be determined by the duty holder based on risk profile and material change'}`;

  const reviewLines = wrapText(reviewText, CONTENT_WIDTH, 11, font);
  for (const line of reviewLines) {
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
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 16;
  }

  return { page, yPosition };
}
