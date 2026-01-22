import { supabase } from '../lib/supabase';

export interface ExternalAccessLink {
  id: string;
  organisation_id: string;
  document_id: string;
  access_token: string;
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_organisation: string | null;
  expires_at: string;
  max_access_count: number | null;
  access_count: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  last_accessed_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
}

export interface AccessAuditEntry {
  id: string;
  organisation_id: string;
  access_link_id: string | null;
  document_id: string | null;
  accessed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  action_type: string;
  resource_path: string | null;
  access_granted: boolean;
  denial_reason: string | null;
  session_id: string | null;
  request_metadata: any;
}

export async function createExternalAccessLink(
  documentId: string,
  recipientName: string,
  recipientEmail: string,
  expiresInDays: number,
  userId: string
): Promise<{ success: boolean; linkId?: string; token?: string; error?: string }> {
  try {
    const { data: linkId, error } = await supabase.rpc('create_external_access_link', {
      p_document_id: documentId,
      p_recipient_name: recipientName,
      p_recipient_email: recipientEmail,
      p_expires_in_days: expiresInDays,
      p_created_by: userId,
    });

    if (error) throw error;

    // Fetch the created link to get the token
    const { data: link, error: fetchError } = await supabase
      .from('external_access_links')
      .select('access_token')
      .eq('id', linkId)
      .single();

    if (fetchError) throw fetchError;

    return { success: true, linkId, token: link.access_token };
  } catch (error: any) {
    console.error('Error creating external access link:', error);
    return { success: false, error: error.message };
  }
}

export async function getExternalAccessLinks(
  documentId: string
): Promise<ExternalAccessLink[]> {
  try {
    const { data, error } = await supabase
      .from('external_access_links')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching external access links:', error);
    return [];
  }
}

export async function revokeExternalAccessLink(
  linkId: string,
  userId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('external_access_links')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: userId,
        revoke_reason: reason,
      })
      .eq('id', linkId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error revoking external access link:', error);
    return { success: false, error: error.message };
  }
}

export async function validateAndLogAccess(
  accessToken: string,
  documentId: string,
  ipAddress: string,
  userAgent: string,
  actionType: string
): Promise<{ granted: boolean; reason?: string }> {
  try {
    const { data: granted, error } = await supabase.rpc('validate_and_log_access', {
      p_access_token: accessToken,
      p_document_id: documentId,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_action_type: actionType,
    });

    if (error) throw error;

    return { granted: granted === true };
  } catch (error: any) {
    console.error('Error validating access:', error);
    return { granted: false, reason: error.message };
  }
}

export async function getAccessAuditLog(
  organisationId: string,
  filters?: {
    documentId?: string;
    linkId?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<AccessAuditEntry[]> {
  try {
    let query = supabase
      .from('access_audit_log')
      .select('*')
      .eq('organisation_id', organisationId)
      .order('accessed_at', { ascending: false });

    if (filters?.documentId) {
      query = query.eq('document_id', filters.documentId);
    }

    if (filters?.linkId) {
      query = query.eq('access_link_id', filters.linkId);
    }

    if (filters?.startDate) {
      query = query.gte('accessed_at', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('accessed_at', filters.endDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching access audit log:', error);
    return [];
  }
}

export function generateAccessUrl(baseUrl: string, token: string, documentId: string): string {
  return `${baseUrl}/external/${documentId}?token=${token}`;
}

export function isLinkExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

export function isLinkActive(link: ExternalAccessLink): boolean {
  return link.is_active && !isLinkExpired(link.expires_at) &&
    (link.max_access_count === null || link.access_count < link.max_access_count);
}

export function getDaysUntilExpiry(expiresAt: string): number {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function getAccessStats(links: ExternalAccessLink[]) {
  const active = links.filter(isLinkActive).length;
  const expired = links.filter(l => isLinkExpired(l.expires_at)).length;
  const revoked = links.filter(l => l.revoked_at !== null).length;
  const totalAccesses = links.reduce((sum, l) => sum + l.access_count, 0);

  return {
    total: links.length,
    active,
    expired,
    revoked,
    totalAccesses,
  };
}

export interface DocumentAccessLink {
  id: string;
  organisation_id: string;
  base_document_id: string;
  token: string;
  created_by: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_accessed_at: string | null;
  access_count: number;
  label: string | null;
  allowed_actions: any | null;
}

export interface CreateDocumentAccessLinkParams {
  baseDocumentId: string;
  organisationId: string;
  expiresInDays: number;
  label?: string;
}

export interface PublicDocumentInfo {
  document_id: string;
  title: string;
  document_type: string;
  version_number: number;
  issue_date: string;
  locked_pdf_path: string | null;
  has_pdf: boolean;
  label: string | null;
}

async function generateAccessToken(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_access_token');

  if (error) {
    console.error('Error generating token:', error);
    return btoa(crypto.randomUUID() + crypto.randomUUID()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 43);
  }

  return data || btoa(crypto.randomUUID() + crypto.randomUUID()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 43);
}

export async function createDocumentAccessLink(params: CreateDocumentAccessLinkParams): Promise<{ success: boolean; link?: DocumentAccessLink; url?: string; error?: string }> {
  try {
    const token = await generateAccessToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + params.expiresInDays);

    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('document_access_links')
      .insert({
        organisation_id: params.organisationId,
        base_document_id: params.baseDocumentId,
        token,
        expires_at: expiresAt.toISOString(),
        label: params.label || null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating access link:', error);
      return { success: false, error: error.message };
    }

    const url = `${window.location.origin}/public/documents?token=${token}`;

    return { success: true, link: data, url };
  } catch (error: any) {
    console.error('Error creating access link:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export async function getDocumentAccessLinks(baseDocumentId: string, organisationId: string): Promise<DocumentAccessLink[]> {
  try {
    const { data, error } = await supabase
      .from('document_access_links')
      .select('*')
      .eq('base_document_id', baseDocumentId)
      .eq('organisation_id', organisationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching access links:', error);
    return [];
  }
}

export async function revokeDocumentAccessLink(linkId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('document_access_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', linkId);

    if (error) {
      console.error('Error revoking access link:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error revoking access link:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export async function deleteDocumentAccessLink(linkId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('document_access_links')
      .delete()
      .eq('id', linkId);

    if (error) {
      console.error('Error deleting access link:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting access link:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export function isDocumentLinkActive(link: DocumentAccessLink): boolean {
  if (link.revoked_at) return false;

  const now = new Date();
  const expiresAt = new Date(link.expires_at);

  return now <= expiresAt;
}

export function getDocumentLinkStatus(link: DocumentAccessLink): 'active' | 'expired' | 'revoked' {
  if (link.revoked_at) return 'revoked';

  const now = new Date();
  const expiresAt = new Date(link.expires_at);

  return now <= expiresAt ? 'active' : 'expired';
}

export function formatDocumentLinkUrl(token: string): string {
  return `${window.location.origin}/public/documents?token=${token}`;
}

export async function fetchPublicDocument(token: string): Promise<{ success: boolean; data?: PublicDocumentInfo; error?: string; status?: string }> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/public-document?token=${token}`);

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Failed to fetch document',
        status: errorData.status,
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error('Error fetching public document:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export async function fetchPublicDocumentDownloadUrl(token: string): Promise<{ success: boolean; url?: string; filename?: string; error?: string }> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/public-document-download?token=${token}`);

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Failed to fetch download URL',
      };
    }

    const data = await response.json();
    return { success: true, url: data.url, filename: data.filename };
  } catch (error: any) {
    console.error('Error fetching download URL:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  document.body.appendChild(textArea);
  textArea.select();

  try {
    document.execCommand('copy');
    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  } finally {
    document.body.removeChild(textArea);
  }
}
