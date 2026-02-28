/**
 * FRA PDF Utility Functions
 * Shared utility functions for FRA PDF generation
 */

import { PDFDocument, PDFPage } from 'pdf-lib';
import { detectInfoGaps } from '../../../utils/infoGapQuickActions';
import { addNewPage, MARGIN, PAGE_TOP_Y } from '../pdfUtils';
import { FRA_REPORT_STRUCTURE } from '../fraReportStructure';
import type { Document, ModuleInstance, Organisation } from './fraTypes';

/**
 * Determines whether a section should be rendered in full based on content density.
 * Returns true if the section has meaningful content worth rendering.
 *
 * @param sectionId - The section number (2-14)
 * @param sectionModules - Module instances for this section
 * @param sectionActions - Actions for this section
 * @param document - The document being rendered
 * @returns true if section should be rendered in full, false if it should go to compact rollup
 */
export function shouldRenderSection(
  sectionId: number,
  sectionModules: ModuleInstance[],
  sectionActions: any[],
  document: Document
): boolean {
  // Section 1 (cover) is always rendered separately
  if (sectionId === 1) return true;

  // Section 13 (significant findings) and 14 (review) are always rendered
  if (sectionId === 13 || sectionId === 14) return true;

  // If no modules, skip
  if (sectionModules.length === 0) return false;

  // Check 1: Are there any open actions?
  const hasOpenActions = sectionActions.some(a =>
    a.status !== 'closed' && a.status !== 'completed'
  );
  if (hasOpenActions) return true;

  // Check 2: Does any module have a non-trivial outcome?
  const hasSignificantOutcome = sectionModules.some(m =>
    m.outcome &&
    m.outcome !== 'unknown' &&
    m.outcome !== 'na' &&
    m.outcome !== 'not_applicable'
  );
  if (hasSignificantOutcome) return true;

  // Check 3: Does any module have info gaps that need attention?
  for (const module of sectionModules) {
    const detection = detectInfoGaps(
      module.module_key,
      module.data,
      module.outcome,
      {
        responsible_person: document.responsible_person || undefined,
        standards_selected: document.standards_selected || []
      }
    );
    if (detection.hasInfoGap) return true;
  }

  // Check 4: Does any module have meaningful data?
  for (const module of sectionModules) {
    const data = module.data || {};
    let meaningfulFieldCount = 0;

    for (const [key, value] of Object.entries(data)) {
      // Skip empty, unknown, default noise
      if (!value) continue;
      if (value === 'unknown' || value === 'not_applicable' || value === 'n/a') continue;
      if (value === 'no' || value === false) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (typeof value === 'string' && value.trim().length === 0) continue;

      meaningfulFieldCount++;

      // If we have 3+ meaningful fields, consider it worth rendering
      if (meaningfulFieldCount >= 3) return true;
    }
  }

  // Check 5: Does any module have assessor notes?
  const hasSubstantialNotes = sectionModules.some(m =>
    m.assessor_notes && m.assessor_notes.trim().length > 20
  );
  if (hasSubstantialNotes) return true;

  // If none of the above, this section is too sparse to render
  return false;
}

/**
 * Calculate section content density score
 */
export function calculateSectionDensity(
  sectionModules: ModuleInstance[],
  sectionActions: any[],
  sectionId: number
): number {
  let score = 0;

  // 1. Assessor summary presence (10 points)
  const hasNotes = sectionModules.some(m => m.assessor_notes && m.assessor_notes.trim().length > 20);
  if (hasNotes) score += 10;

  // 2. Count meaningful data fields (up to 30 points)
  let meaningfulFields = 0;
  for (const module of sectionModules) {
    const data = module.data || {};
    for (const [key, value] of Object.entries(data)) {
      // Skip empty, unknown, default noise
      if (!value) continue;
      if (value === 'unknown' || value === 'not_applicable' || value === 'n/a') continue;
      if (value === 'no' || value === false) continue; // Default "no" values
      if (Array.isArray(value) && value.length === 0) continue;
      meaningfulFields++;
    }
  }
  score += Math.min(meaningfulFields * 2, 30);

  // 3. Actions count (up to 40 points)
  const actionCount = sectionActions.filter(a => a.status !== 'closed' && a.status !== 'completed').length;
  score += Math.min(actionCount * 10, 40);

  // 4. Outcome severity (20 points)
  const hasNonCompliant = sectionModules.some(m =>
    m.outcome && !['compliant', 'n/a', 'not_applicable'].includes(m.outcome)
  );
  if (hasNonCompliant) score += 20;

  return Math.min(score, 100);
}

/**
 * Check if field value is meaningful (not default/unknown/empty noise)
 */
export function isMeaningfulValue(value: any, fieldKey: string, outcome: string | null): boolean {
  // Always exclude these noise values
  if (!value) return false;
  if (value === 'unknown' || value === 'not_known') return false;
  if (value === 'not_applicable' || value === 'n/a') return false;
  if (Array.isArray(value) && value.length === 0) return false;

  // If outcome is info_gap, show unknowns ONLY for critical fields
  if (outcome === 'info_gap' || outcome === 'information_incomplete') {
    if (value === 'unknown' || value === 'not_known') {
      // This will be checked by caller using CRITICAL_FIELDS
      return false;
    }
  }

  // Exclude default "no" answers unless they're significant
  if (value === 'no' || value === false) {
    // Keep "no" if it's for presence questions (indicates something is missing)
    if (fieldKey.includes('_present') || fieldKey.includes('_exists') || fieldKey.includes('_provided')) {
      return true;
    }
    return false;
  }

  return true;
}

/**
 * Helper: Ensure enough space on current page, or create new page
 * Legacy version - kept for compatibility with existing code
 */
export function ensureSpace(
  requiredHeight: number,
  currentPage: PDFPage | undefined,
  currentY: number | undefined,
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  // If we don't yet have a page, create one
  if (!currentPage || typeof currentY !== 'number') {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    return { page: result.page, yPosition: PAGE_TOP_Y };
  }

  // Normal page overflow check
  if (currentY - requiredHeight < MARGIN + 50) {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    return { page: result.page, yPosition: PAGE_TOP_Y };
  }

  return { page: currentPage, yPosition: currentY };
}

/**
 * Ensure cursor has a valid PDFPage, creating one if needed
 * This validates the cursor and guarantees page.drawText exists
 */
export function ensureCursor(
  cursor: { page: PDFPage | undefined; yPosition: number },
  pdfDoc: PDFDocument,
  isDraft: boolean,
  totalPages: PDFPage[]
): { page: PDFPage; yPosition: number } {
  // If page is missing or invalid, create a new page
  if (!cursor.page || typeof (cursor.page as any).drawText !== 'function') {
    const result = addNewPage(pdfDoc, isDraft, totalPages);
    return { page: result.page, yPosition: PAGE_TOP_Y };
  }

  // Validate yPosition is a number
  if (typeof cursor.yPosition !== 'number' || isNaN(cursor.yPosition)) {
    return { page: cursor.page, yPosition: PAGE_TOP_Y };
  }

  return { page: cursor.page, yPosition: cursor.yPosition };
}

/**
 * Get organisation display name, handling edge cases
 */
export function getOrganisationDisplayName(organisation: Organisation): string {
  // Check if name looks like an email (contains @ and .)
  const isEmail = organisation.name && organisation.name.includes('@') && organisation.name.includes('.');

  // If name is missing or looks like an email, return placeholder
  if (!organisation.name || isEmail) {
    return 'Organisation (name not set)';
  }

  return organisation.name;
}

/**
 * Compute fallback rating when scoring engine is unavailable
 */
export function computeFallbackRating(actions: any[], actionRatings: any[], moduleInstances: ModuleInstance[]): string {
  // Count P1/P2 actions
  const p1Count = actions.filter(a => a.priority_band === 'P1').length;
  const p2Count = actions.filter(a => a.priority_band === 'P2').length;

  // Count critical outcomes
  const criticalOutcomes = moduleInstances.filter(m =>
    m.outcome === 'critical_deficiency' ||
    m.outcome === 'material_deficiency' ||
    m.outcome === 'non_compliant'
  ).length;

  // Simple heuristic
  if (p1Count > 0 || criticalOutcomes > 2) return 'high';
  if (p2Count > 2 || criticalOutcomes > 0) return 'medium';
  return 'low';
}

/**
 * Safe array conversion - handles non-array values
 */
export function safeArray(value: any): string[] {
  if (Array.isArray(value)) return value.filter(v => v != null);
  if (typeof value === 'string') return [value];
  return [];
}

/**
 * Map module key to section name for display
 */
export function mapModuleKeyToSectionName(moduleKey: string): string {
  // Find the section that contains this module key
  for (const section of FRA_REPORT_STRUCTURE) {
    if (section.moduleKeys.includes(moduleKey)) {
      // Use displayNumber if available, otherwise fall back to id
      const displayNum = section.displayNumber ?? section.id;
      return `${displayNum}. ${section.title}`;
    }
  }

  // Fallback for legacy or unmapped modules
  return 'General Evidence';
}
