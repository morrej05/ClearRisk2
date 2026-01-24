/**
 * Survey Lock State Utilities
 *
 * Determines if a survey is locked (read-only) based on its status.
 * Issued surveys are locked and require a revision to be edited.
 */

interface Survey {
  status?: string;
  issued?: boolean;
  [key: string]: any;
}

/**
 * Check if a survey is issued
 */
export function isIssued(survey: Survey | null | undefined): boolean {
  if (!survey) return false;
  return survey.status === 'issued' || survey.issued === true;
}

/**
 * Check if a survey is locked (read-only)
 * Currently same as isIssued, but future-proof for other lock states
 */
export function isLocked(survey: Survey | null | undefined): boolean {
  return isIssued(survey);
}

/**
 * Check if a survey is editable (not locked)
 */
export function isEditable(survey: Survey | null | undefined): boolean {
  return !isLocked(survey);
}

/**
 * Get lock reason message
 */
export function getLockReason(survey: Survey | null | undefined): string | null {
  if (!survey) return null;

  if (isIssued(survey)) {
    return `This survey is issued (v${survey.current_revision || 1}) and cannot be edited. Create a revision to make changes.`;
  }

  return null;
}
