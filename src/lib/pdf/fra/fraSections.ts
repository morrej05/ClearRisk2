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
import { ensureSpace } from './fraUtils';
import {
  drawModuleContent,
  renderFilteredModuleData,
} from './fraCoreDraw';
import type { Cursor, Document, ModuleInstance } from './fraTypes';

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

      if (data.has_building_address && data.building_address) {
        const addr = data.building_address;
        const addressParts = [addr.line1, addr.line2, addr.city, addr.postcode].filter(Boolean);
        if (addressParts.length > 0) {
          page.drawText(`Building Address: ${addressParts.join(', ')}`, {
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

    // Physical characteristics
    const hasPhysicalData = data.building_type || data.storeys_above_ground || data.storeys_below_ground || data.gross_floor_area_m2;
    if (hasPhysicalData) {
      page.drawText('Physical Characteristics', {
        x: MARGIN,
        y: yPosition,
        size: 12,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      yPosition -= 18;

      if (data.building_type) {
        page.drawText(`Building Type: ${sanitizePdfText(data.building_type)}`, {
          x: MARGIN + 10,
          y: yPosition,
          size: 10,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
        yPosition -= 14;
      }

      if (data.storeys_above_ground) {
        page.drawText(`Storeys Above Ground: ${data.storeys_above_ground}`, {
          x: MARGIN + 10,
          y: yPosition,
          size: 10,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
        yPosition -= 14;
      }

      if (data.storeys_below_ground) {
        page.drawText(`Storeys Below Ground: ${data.storeys_below_ground}`, {
          x: MARGIN + 10,
          y: yPosition,
          size: 10,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
        yPosition -= 14;
      }

      if (data.gross_floor_area_m2) {
        page.drawText(`Gross Floor Area: ${data.gross_floor_area_m2}m²`, {
          x: MARGIN + 10,
          y: yPosition,
          size: 10,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
        yPosition -= 14;
      }

      yPosition -= 10;
    }

    // Render full module content (includes outcome, assessor notes, other fields)
    ({ page, yPosition } = drawModuleContent({ page, yPosition }, a2Module, document, font, fontBold, pdfDoc, isDraft, totalPages, undefined, ['A2_BUILDING_PROFILE']));
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

  const a3Module = sectionModules.find(m => m.module_key === 'A3_PERSONS_AT_RISK');

  if (a3Module && a3Module.data) {
    const data = a3Module.data;

    // Occupancy profile - only render header if we have content
    const hasOccupancyData = data.typical_occupancy_number || data.max_occupancy_number || data.occupancy_type;

    if (hasOccupancyData) {
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
    }

    // Vulnerability factors - only render header if we have content
    const hasVulnerabilityData = data.vulnerable_persons_present !== undefined ||
                                  data.sleeping_accommodation !== undefined ||
                                  data.lone_working !== undefined;

    if (hasVulnerabilityData) {
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
    }

    // Render full module content (includes outcome, assessor notes, other fields)
    ({ page, yPosition } = drawModuleContent({ page, yPosition }, a3Module, document, font, fontBold, pdfDoc, isDraft, totalPages, undefined, ['A3_PERSONS_AT_RISK']));
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
    ({ page, yPosition } = ensureSpace(120, page, yPosition, pdfDoc, isDraft, totalPages));

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
      'fire_blankets',
    ];

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
