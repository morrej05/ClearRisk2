import { supabase } from '../lib/supabase';

export type ApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected';

export interface ApprovalInfo {
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approval_date: string | null;
  approval_notes: string | null;
}

export interface OrganisationSettings {
  id: string;
  organisation_id: string;
  approval_required: boolean;
}

export interface ApprovalResult {
  success: boolean;
  error?: string;
}

export async function getOrganisationSettings(organisationId: string): Promise<OrganisationSettings | null> {
  try {
    const { data, error } = await supabase
      .from('organisation_settings')
      .select('*')
      .eq('organisation_id', organisationId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching organisation settings:', error);
    return null;
  }
}

export async function isApprovalRequired(organisationId: string): Promise<boolean> {
  const settings = await getOrganisationSettings(organisationId);
  return settings?.approval_required ?? false;
}

export async function requestApproval(
  documentId: string,
  requestedBy: string,
  notes?: string
): Promise<ApprovalResult> {
  try {
    const { error } = await supabase
      .from('documents')
      .update({
        approval_status: 'pending',
        approval_notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error requesting approval:', error);
    return { success: false, error: 'Failed to request approval' };
  }
}

export async function approveDocument(
  documentId: string,
  approvedBy: string,
  notes?: string
): Promise<ApprovalResult> {
  try {
    const { error } = await supabase
      .from('documents')
      .update({
        approval_status: 'approved',
        approved_by: approvedBy,
        approval_date: new Date().toISOString().split('T')[0],
        approval_notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error approving document:', error);
    return { success: false, error: 'Failed to approve document' };
  }
}

export async function rejectDocument(
  documentId: string,
  rejectedBy: string,
  reason: string
): Promise<ApprovalResult> {
  try {
    if (!reason || reason.trim() === '') {
      return { success: false, error: 'Rejection reason is required' };
    }

    const { error } = await supabase
      .from('documents')
      .update({
        approval_status: 'rejected',
        approved_by: null,
        approval_date: null,
        approval_notes: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error rejecting document:', error);
    return { success: false, error: 'Failed to reject document' };
  }
}

export async function clearApprovalStatus(documentId: string): Promise<ApprovalResult> {
  try {
    const { error } = await supabase
      .from('documents')
      .update({
        approval_status: 'not_required',
        approved_by: null,
        approval_date: null,
        approval_notes: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error clearing approval status:', error);
    return { success: false, error: 'Failed to clear approval status' };
  }
}

export async function canIssueDocument(documentId: string, organisationId: string): Promise<{
  canIssue: boolean;
  reason?: string;
}> {
  try {
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('approval_status, issue_status')
      .eq('id', documentId)
      .single();

    if (docError) throw docError;

    if (document.issue_status !== 'draft') {
      return { canIssue: false, reason: 'Only draft documents can be issued' };
    }

    if (document.approval_status === 'rejected') {
      return { canIssue: false, reason: 'Cannot issue a rejected document. Please address the rejection reasons first.' };
    }

    const approvalRequired = await isApprovalRequired(organisationId);

    if (approvalRequired && document.approval_status !== 'approved') {
      return {
        canIssue: false,
        reason: 'Document must be approved before it can be issued. Current approval status: ' + document.approval_status
      };
    }

    return { canIssue: true };
  } catch (error) {
    console.error('Error checking if document can be issued:', error);
    return { canIssue: false, reason: 'Failed to check document status' };
  }
}

export function getApprovalStatusDisplay(status: ApprovalStatus): {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
} {
  switch (status) {
    case 'not_required':
      return {
        label: 'Not Required',
        color: 'text-neutral-600',
        bgColor: 'bg-neutral-50',
        borderColor: 'border-neutral-200',
      };
    case 'pending':
      return {
        label: 'Pending Approval',
        color: 'text-amber-700',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
      };
    case 'approved':
      return {
        label: 'Approved',
        color: 'text-green-700',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        color: 'text-red-700',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
      };
    default:
      return {
        label: 'Unknown',
        color: 'text-neutral-600',
        bgColor: 'bg-neutral-50',
        borderColor: 'border-neutral-200',
      };
  }
}
