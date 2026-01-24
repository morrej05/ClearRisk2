import { supabase } from '../lib/supabase';

export interface ValidationResult {
  isValid: boolean;
  errorCode: string;
  errorMessage: string;
}

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
}

export async function canUserIssueDocument(
  userId: string,
  documentId: string
): Promise<PermissionCheck> {
  try {
    const { data, error } = await supabase.rpc('can_user_issue_document', {
      p_user_id: userId,
      p_document_id: documentId,
    });

    if (error) throw error;

    return {
      allowed: data === true,
      reason: data ? undefined : 'You do not have permission to issue this document',
    };
  } catch (error) {
    console.error('Error checking issue permission:', error);
    return {
      allowed: false,
      reason: 'Unable to verify permissions',
    };
  }
}

export async function canUserCloseAction(
  userId: string,
  actionId: string
): Promise<PermissionCheck> {
  try {
    const { data, error } = await supabase.rpc('can_user_close_action', {
      p_user_id: userId,
      p_action_id: actionId,
    });

    if (error) throw error;

    return {
      allowed: data === true,
      reason: data ? undefined : 'You do not have permission to close this action',
    };
  } catch (error) {
    console.error('Error checking close action permission:', error);
    return {
      allowed: false,
      reason: 'Unable to verify permissions',
    };
  }
}

export async function canDocumentBeEdited(documentId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('can_document_be_edited', {
      p_document_id: documentId,
    });

    if (error) throw error;
    return data === true;
  } catch (error) {
    console.error('Error checking if document can be edited:', error);
    return false;
  }
}

export async function validateDocumentForIssue(
  documentId: string,
  userId: string
): Promise<ValidationResult> {
  try {
    const { data, error } = await supabase.rpc('validate_document_for_issue', {
      p_document_id: documentId,
      p_user_id: userId,
    });

    if (error) throw error;

    if (data && data.length > 0) {
      const result = data[0];
      return {
        isValid: result.is_valid,
        errorCode: result.error_code,
        errorMessage: result.error_message,
      };
    }

    return {
      isValid: false,
      errorCode: 'UNKNOWN_ERROR',
      errorMessage: 'Unable to validate document',
    };
  } catch (error: any) {
    console.error('Error validating document for issue:', error);
    return {
      isValid: false,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: error.message || 'Failed to validate document',
    };
  }
}

export async function checkVersionChainIntegrity(baseDocumentId: string): Promise<{
  isValid: boolean;
  issues: string[];
}> {
  try {
    const { data, error } = await supabase.rpc('check_version_chain_integrity', {
      p_base_document_id: baseDocumentId,
    });

    if (error) throw error;

    const issues: string[] = [];
    let allValid = true;

    if (data && data.length > 0) {
      data.forEach((result: any) => {
        if (!result.is_valid) {
          allValid = false;
          issues.push(result.issue_description);
        }
      });
    }

    return { isValid: allValid, issues };
  } catch (error) {
    console.error('Error checking version chain integrity:', error);
    return {
      isValid: false,
      issues: ['Failed to check version chain integrity'],
    };
  }
}

export async function checkLockedPdfIntegrity(): Promise<{
  hasIssues: boolean;
  documents: Array<{
    documentId: string;
    title: string;
    issueStatus: string;
    issue: string;
  }>;
}> {
  try {
    const { data, error } = await supabase.rpc('check_locked_pdf_integrity');

    if (error) throw error;

    const documents = (data || []).map((item: any) => ({
      documentId: item.document_id,
      title: item.title,
      issueStatus: item.issue_status,
      issue: item.issue_description,
    }));

    return {
      hasIssues: documents.length > 0,
      documents,
    };
  } catch (error) {
    console.error('Error checking locked PDF integrity:', error);
    return {
      hasIssues: false,
      documents: [],
    };
  }
}

export function getValidationErrorMessage(errorCode: string, errorMessage: string): string {
  const messages: Record<string, string> = {
    DOC_NOT_FOUND: 'Document not found. Please refresh and try again.',
    NOT_DRAFT: 'Only draft documents can be issued. This document has already been issued.',
    NO_PERMISSION: 'You do not have permission to issue documents. Contact your administrator.',
    NO_MODULES: 'Document must have at least one module before it can be issued.',
    EMPTY_MODULES: errorMessage,
    EMPTY_REQUIRED_MODULES: errorMessage,
    APPROVAL_REQUIRED: 'This document requires approval before it can be issued. Please request approval first.',
    APPROVAL_REJECTED: 'This document\'s approval was rejected. Please address the feedback and request approval again.',
    APPROVAL_INVALID: 'This document does not have valid approval. Please request approval.',
    ALREADY_HAS_PDF: 'This document already has a locked PDF. It may have been issued already.',
  };

  return messages[errorCode] || errorMessage;
}

export function isEditableStatus(issueStatus: string): boolean {
  return issueStatus === 'draft';
}

export function canCreateNewVersion(issueStatus: string): boolean {
  return issueStatus === 'issued';
}

export function canIssueDocument(issueStatus: string): boolean {
  return issueStatus === 'draft';
}

export function getStatusLockMessage(issueStatus: string): string {
  if (issueStatus === 'issued') {
    return 'This document has been issued and is locked. To make changes, create a new version.';
  }
  if (issueStatus === 'superseded') {
    return 'This document has been superseded by a newer version and cannot be edited.';
  }
  return '';
}

export function canReopenAction(status: string, userRole: string): boolean {
  if (status !== 'closed') return true;
  return userRole === 'org_admin' || userRole === 'platform_admin';
}

export function getActionReopenMessage(status: string, userRole: string): string {
  if (status === 'closed' && !canReopenAction(status, userRole)) {
    return 'Closed actions cannot be reopened. Contact an administrator if this action needs to be reopened.';
  }
  return '';
}

export async function getDocumentLifecycleHealth(
  organisationId: string
): Promise<Array<{
  baseDocumentId: string;
  totalVersions: number;
  draftCount: number;
  issuedCount: number;
  supersededCount: number;
  latestVersion: number;
  healthStatus: string;
}>> {
  try {
    const { data, error } = await supabase
      .from('document_lifecycle_health')
      .select('*')
      .eq('organisation_id', organisationId);

    if (error) throw error;

    return (data || []).map((item: any) => ({
      baseDocumentId: item.base_document_id,
      totalVersions: item.total_versions,
      draftCount: item.draft_count,
      issuedCount: item.issued_count,
      supersededCount: item.superseded_count,
      latestVersion: item.latest_version,
      healthStatus: item.health_status,
    }));
  } catch (error) {
    console.error('Error getting document lifecycle health:', error);
    return [];
  }
}

export function isInvariantViolation(healthStatus: string): boolean {
  return healthStatus.startsWith('ERROR:');
}

export function getInvariantViolationMessage(healthStatus: string): string {
  const messages: Record<string, string> = {
    'ERROR: Multiple issued': 'Critical error: This document chain has multiple issued versions. Contact support immediately.',
    'ERROR: Multiple drafts': 'Critical error: This document chain has multiple drafts. Complete or delete one of them.',
  };

  return messages[healthStatus] || 'Critical error in document lifecycle. Contact support.';
}
