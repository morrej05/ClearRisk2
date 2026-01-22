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
