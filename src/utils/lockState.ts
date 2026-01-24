/**
 * Survey Lock State Utilities
 *
 * Determines if a survey is locked (read-only) based on its status and approval workflow.
 *
 * Workflow states:
 * - draft: Editable by surveyor + admin
 * - in_review: Editable by admin only, surveyor read-only
 * - approved: Read-only for everyone except admin
 * - issued: Locked (requires revision to edit)
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
 * Check if a survey is locked (read-only) based on status and user role
 *
 * Rules:
 * - Issued: Always locked
 * - Approved: Read-only unless admin
 * - In Review: Read-only unless admin
 * - Draft: Editable
 */
export function isLocked(
  survey: Survey | null | undefined,
  isAdmin: boolean = false
): boolean {
  if (!survey) return false;

  // Issued surveys are always locked
  if (isIssued(survey)) {
    return true;
  }

  // In review: locked for non-admins
  if (survey.status === 'in_review' && !isAdmin) {
    return true;
  }

  // Approved: locked for non-admins
  if (survey.status === 'approved' && !isAdmin) {
    return true;
  }

  // Draft: not locked
  return false;
}

/**
 * Check if a survey is editable (not locked)
 */
export function isEditable(
  survey: Survey | null | undefined,
  isAdmin: boolean = false
): boolean {
  return !isLocked(survey, isAdmin);
}

/**
 * Get lock reason message
 */
export function getLockReason(
  survey: Survey | null | undefined,
  isAdmin: boolean = false
): string | null {
  if (!survey) return null;

  if (isIssued(survey)) {
    return `This survey is issued (v${survey.current_revision || 1}) and cannot be edited. Create a revision to make changes.`;
  }

  if (survey.status === 'in_review' && !isAdmin) {
    return 'This survey is under review and cannot be edited. Wait for admin approval or return to draft.';
  }

  if (survey.status === 'approved' && !isAdmin) {
    return 'This survey is approved and ready to be issued. Only admins can make changes.';
  }

  return null;
}
