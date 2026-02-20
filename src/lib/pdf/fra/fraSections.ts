/**
 * FRA PDF Section Renderers
 * Section-specific rendering functions for FRA PDF generation
 */

import { PDFDocument, PDFPage, rgb } from 'pdf-lib';
import {
  MARGIN,
  CONTENT_WIDTH,
  sanitizePdfText,
  wrapText,
  formatDate,
  addNewPage,
} from '../pdfUtils';
import { PAGE_TOP_Y } from '../pdfCursor';
import { ensureSpace, ensureCursor } from './fraUtils';
import {
  drawModuleContent,
  renderFilteredModuleData,
} from './fraCoreDraw';
import type { Cursor, Document, ModuleInstance } from './fraTypes';

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

  // Intro paragraph
  const assessmentDate = document.assessment_date ? formatDate(document.assessment_date) : 'N/A';
  const introPara = `This fire risk assessment was undertaken on ${assessmentDate}.`;

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

  // Spacing before facts
  yPosition -= 6;

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

  // Build address
  const addressParts: string[] = [];
  const addr = document.meta?.site?.address || data.site?.address || {};
  if (addr.line1 || data.addressLine1) addressParts.push(norm(addr.line1 || data.addressLine1));
  if (addr.line2 || data.addressLine2) addressParts.push(norm(addr.line2 || data.addressLine2));
  if (addr.city || data.city) addressParts.push(norm(addr.city || data.city));
  if (addr.county || data.county) addressParts.push(norm(addr.county || data.county));
  if (addr.postcode || data.postcode) addressParts.push(norm(addr.postcode || data.postcode));
  const address = addressParts.filter(Boolean).join(', ');

  // Standards
  const standards = Array.isArray(document.standards_selected) && document.standards_selected.length > 0
    ? document.standards_selected.join(', ')
    : '';

  // Draw key facts - update cursor after each call
  ({ page, yPosition } = drawFact({ page, yPosition }, 'Client', clientName));
  ({ page, yPosition } = drawFact({ page, yPosition }, 'Site', siteName));
  ({ page, yPosition } = drawFact({ page, yPosition }, 'Address', address));
  ({ page, yPosition } = drawFact({ page, yPosition }, 'Assessment Date', assessmentDate));
  ({ page, yPosition } = drawFact({ page, yPosition }, 'Assessor', norm(document.assessor_name || '')));
  ({ page, yPosition } = drawFact({ page, yPosition }, 'Assessor Role', norm(document.assessor_role || '')));
  ({ page, yPosition } = drawFact({ page, yPosition }, 'Responsible Person', norm(document.responsible_person || '')));
  ({ page, yPosition } = drawFact({ page, yPosition }, 'Scope', norm(document.scope_description || '')));
  ({ page, yPosition } = drawFact({ page, yPosition }, 'Standards', standards));
  ({ page, yPosition } = drawFact({ page, yPosition }, 'Limitations', norm(document.limitations_assumptions || '')));

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
  console.log('[A2 MODULE]', a2Module);
console.log('[A2 MODULE KEYS]', a2Module ? Object.keys(a2Module as any) : null);
console.log('[A2 DATA]', (a2Module as any)?.data);
console.log('[A2 DATA KEYS]', (a2Module as any)?.data ? Object.keys((a2Module as any).data) : null);

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
      page.drawText(`${label}:`, { x: MARGIN, y: yPosition, size: 9, font: fontBold, color: rgb(0.42, 0.42, 0.42) });
      page.drawText(value, { x: MARGIN + 140, y: yPosition, size: 10, font, color: rgb(0.18, 0.18, 0.18) });
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
  console.log('[A3 DATA KEYS]', Object.keys(data));
console.log('[A3 DATA FULL]', data);

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
      page.drawText(`${label}:`, { x: MARGIN, y: yPosition, size: 9, font: fontBold, color: rgb(0.42, 0.42, 0.42) });
      page.drawText(value, { x: MARGIN + 140, y: yPosition, size: 10, font, color: rgb(0.18, 0.18, 0.18) });
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
  let { page, yPosition } = cursor;

  const a1Module = sectionModules.find(m => m.module_key === 'A1_DOC_CONTROL');

  if (a1Module) {
    ({ page, yPosition } = drawModuleContent({ page, yPosition }, a1Module, document, font, fontBold, pdfDoc, isDraft, totalPages, undefined, ['A1_DOC_CONTROL']));
  }

  return { page, yPosition };
}

/**
 * Section 7: Fire Detection, Alarm & Warning
 * Split from FRA_3_ACTIVE_SYSTEMS (detection fields only)
 */
export function renderSection7Detection(
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

  // ✅ Hard guarantee: always have a page before any operations
  if (!page) {
    const init = addNewPage(pdfDoc, isDraft, totalPages);
    page = init.page;
    yPosition = PAGE_TOP_Y;
  }
  if (typeof yPosition !== 'number') {
    yPosition = PAGE_TOP_Y;
  }

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

    ({ page, yPosition } = renderFilteredModuleData({ page, yPosition }, fra3Module, detectionFields, document, font, fontBold, pdfDoc, isDraft, totalPages, ['FRA_3_ACTIVE_SYSTEMS']));
  }

  return { page, yPosition };
}

/**
 * Section 8: Emergency Lighting
 * Split from FRA_3_ACTIVE_SYSTEMS (emergency lighting fields only)
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

    ({ page, yPosition } = renderFilteredModuleData({ page, yPosition }, fra3Module, lightingFields, document, font, fontBold, pdfDoc, isDraft, totalPages, ['FRA_3_ACTIVE_SYSTEMS']));
  }

  return { page, yPosition };
}

/**
 * Section 10: Fixed Fire Suppression & Firefighting Facilities
 * Split from FRA_8 (suppression systems only)
 */
export function renderSection10Suppression(
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

  // ✅ Hard guarantee: always have a page before any operations
  if (!page) {
    const init = addNewPage(pdfDoc, isDraft, totalPages);
    page = init.page;
    yPosition = PAGE_TOP_Y;
  }
  if (typeof yPosition !== 'number') {
    yPosition = PAGE_TOP_Y;
  }

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

    ({ page, yPosition } = renderFilteredModuleData({ page, yPosition }, fra8Module, suppressionFields, document, font, fontBold, pdfDoc, isDraft, totalPages, ['FRA_8_FIREFIGHTING_EQUIPMENT']));
  }

  return { page, yPosition };
}

/**
 * Section 11: Fire Safety Management & Procedures
 * Combines multiple management modules + FRA_8 portable equipment
 */
export function renderSection11Management(
  cursor: Cursor,
  sectionModules: ModuleInstance[],
  allModules: ModuleInstance[],
  document: Document,
  font: any,
  fontBold: any,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): Cursor {
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

  // 11.1 Management Systems
  const managementSystemsModule = sectionModules.find(
    (m) => m.module_key === 'A4_MANAGEMENT_CONTROLS' || m.module_key === 'FRA_6_MANAGEMENT_SYSTEMS'
  );

  if (managementSystemsModule) {
    ({ page, yPosition } = ensureSpace(80, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText('11.1 Management Systems', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 20;

    ({ page, yPosition } = drawModuleContent(
      { page, yPosition },
      managementSystemsModule,
      document,
      font,
      fontBold,
      pdfDoc,
      isDraft,
      totalPages,
      undefined,
      ['A4_MANAGEMENT_CONTROLS', 'FRA_6_MANAGEMENT_SYSTEMS']
    ));

    yPosition -= 15;
  }

  // 11.2 Emergency Arrangements
  const emergencyArrangementsModule = sectionModules.find(
    (m) => m.module_key === 'A5_EMERGENCY_ARRANGEMENTS' || m.module_key === 'FRA_7_EMERGENCY_ARRANGEMENTS'
  );

  if (emergencyArrangementsModule) {
    ({ page, yPosition } = ensureSpace(100, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText('11.2 Emergency Arrangements', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 20;

    ({ page, yPosition } = drawModuleContent(
      { page, yPosition },
      emergencyArrangementsModule,
      document,
      font,
      fontBold,
      pdfDoc,
      isDraft,
      totalPages,
      undefined,
      ['A5_EMERGENCY_ARRANGEMENTS', 'FRA_7_EMERGENCY_ARRANGEMENTS']
    ));

    yPosition -= 15;
  }

  // 11.3 Review & Assurance
  const reviewAssuranceModule = sectionModules.find((m) => m.module_key === 'A7_REVIEW_ASSURANCE');

  if (reviewAssuranceModule) {
    ({ page, yPosition } = ensureSpace(100, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText('11.3 Review & Assurance', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 20;

    ({ page, yPosition } = drawModuleContent(
      { page, yPosition },
      reviewAssuranceModule,
      document,
      font,
      fontBold,
      pdfDoc,
      isDraft,
      totalPages,
      undefined,
      ['A7_REVIEW_ASSURANCE']
    ));

    yPosition -= 15;
  }

  // 11.4 Portable Firefighting Equipment (from FRA_8)
  const fra8Module = allModules.find((m) => m.module_key === 'FRA_8_FIREFIGHTING_EQUIPMENT');

  if (fra8Module && fra8Module.data) {
    const equipmentFields = [
      'portable_extinguishers',
      'extinguisher_types',
      'extinguisher_locations',
      'hose_reels',
      'fire_blankets',
    ];

    // Check if there's any actual data in the equipment fields
    const hasEquipmentData = equipmentFields.some(
      field => fra8Module.data[field] && fra8Module.data[field].toString().trim() !== ''
    );

    ({ page, yPosition } = ensureSpace(120, page, yPosition, pdfDoc, isDraft, totalPages));

    page.drawText('11.4 Portable Firefighting Equipment', {
      x: MARGIN,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPosition -= 20;

    if (hasEquipmentData) {
      ({ page, yPosition } = renderFilteredModuleData(
        { page, yPosition },
        fra8Module,
        equipmentFields,
        document,
        font,
        fontBold,
        pdfDoc,
        isDraft,
        totalPages,
        ['FRA_8_FIREFIGHTING_EQUIPMENT']
      ));
    } else {
      page.drawText('No portable firefighting equipment data recorded.', {
        x: MARGIN,
        y: yPosition,
        size: 11,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
      yPosition -= 20;
    }
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
