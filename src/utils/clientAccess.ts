import { supabase } from '../lib/supabase';

export interface ClientUser {
  id: string;
  email: string;
  name: string;
  organisation_id: string;
  created_at: string;
  last_accessed_at: string | null;
  access_revoked: boolean;
  revoked_at: string | null;
  revoked_by: string | null;
  notes: string | null;
}

export interface ClientDocumentAccess {
  id: string;
  client_user_id: string;
  base_document_id: string;
  granted_by: string;
  granted_at: string;
  access_expires_at: string | null;
  access_revoked: boolean;
  revoked_at: string | null;
  revoked_by: string | null;
  notes: string | null;
}

export interface DocumentExternalLink {
  id: string;
  base_document_id: string;
  token: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  access_count: number;
  last_accessed_at: string | null;
  is_active: boolean;
  revoked_at: string | null;
  revoked_by: string | null;
  description: string | null;
}

export async function getLatestIssuedDocument(baseDocumentId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('get_latest_issued_document', {
      base_doc_id: baseDocumentId,
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting latest issued document:', error);
    return null;
  }
}

export async function getClientVisibleDocument(
  baseDocumentId: string
): Promise<{
  id: string;
  title: string;
  document_type: string;
  version_number: number;
  issue_date: string;
  issue_status: string;
} | null> {
  try {
    const latestIssuedId = await getLatestIssuedDocument(baseDocumentId);

    if (!latestIssuedId) {
      return null;
    }

    const { data, error } = await supabase
      .from('documents')
      .select('id, title, document_type, version_number, issue_date, issue_status')
      .eq('id', latestIssuedId)
      .eq('issue_status', 'issued')
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting client visible document:', error);
    return null;
  }
}

export async function createExternalLink(
  baseDocumentId: string,
  userId: string,
  expiresInDays?: number,
  description?: string
): Promise<{ success: boolean; token?: string; url?: string; error?: string }> {
  try {
    const latestIssued = await getLatestIssuedDocument(baseDocumentId);

    if (!latestIssued) {
      return { success: false, error: 'No issued document found. Cannot create link for draft documents.' };
    }

    const token = crypto.randomUUID();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data, error } = await supabase
      .from('document_external_links')
      .insert({
        base_document_id: baseDocumentId,
        token,
        created_by: userId,
        expires_at: expiresAt,
        description: description || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    const url = `${window.location.origin}/client/document/${token}`;

    return { success: true, token, url };
  } catch (error) {
    console.error('Error creating external link:', error);
    return { success: false, error: 'Failed to create external link' };
  }
}

export async function getExternalLink(token: string): Promise<DocumentExternalLink | null> {
  try {
    const { data, error } = await supabase
      .from('document_external_links')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return null;
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return null;
    }

    await supabase
      .from('document_external_links')
      .update({
        access_count: data.access_count + 1,
        last_accessed_at: new Date().toISOString(),
      })
      .eq('id', data.id);

    return data;
  } catch (error) {
    console.error('Error getting external link:', error);
    return null;
  }
}

export async function revokeExternalLink(
  linkId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('document_external_links')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: userId,
      })
      .eq('id', linkId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error revoking external link:', error);
    return { success: false, error: 'Failed to revoke external link' };
  }
}

export async function getDocumentExternalLinks(
  baseDocumentId: string
): Promise<DocumentExternalLink[]> {
  try {
    const { data, error } = await supabase
      .from('document_external_links')
      .select('*')
      .eq('base_document_id', baseDocumentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting external links:', error);
    return [];
  }
}

export async function getAllDocumentVersions(baseDocumentId: string): Promise<{
  draft: any | null;
  issued: any[];
  superseded: any[];
}> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('base_document_id', baseDocumentId)
      .order('version_number', { ascending: false });

    if (error) throw error;

    const draft = data?.find((d) => d.issue_status === 'draft') || null;
    const issued = data?.filter((d) => d.issue_status === 'issued') || [];
    const superseded = data?.filter((d) => d.issue_status === 'superseded') || [];

    return { draft, issued, superseded };
  } catch (error) {
    console.error('Error getting document versions:', error);
    return { draft: null, issued: [], superseded: [] };
  }
}

export function isDocumentImmutable(issueStatus: string): boolean {
  return issueStatus === 'issued' || issueStatus === 'superseded';
}

export function getClientAccessDescription(document: any): string {
  if (!document) {
    return 'No document available';
  }

  if (document.issue_status === 'draft') {
    return 'Draft - Not visible to clients';
  }

  if (document.issue_status === 'issued') {
    return 'Issued - Visible to clients via shared links';
  }

  if (document.issue_status === 'superseded') {
    return 'Superseded - Replaced by newer version. Clients see latest version only.';
  }

  return 'Unknown status';
}

export async function createClientUser(
  email: string,
  name: string,
  organisationId: string,
  notes?: string
): Promise<{ success: boolean; clientUser?: ClientUser; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('client_users')
      .insert({
        email,
        name,
        organisation_id: organisationId,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, clientUser: data };
  } catch (error: any) {
    console.error('Error creating client user:', error);

    if (error.code === '23505') {
      return { success: false, error: 'A client with this email already exists' };
    }

    return { success: false, error: 'Failed to create client user' };
  }
}

export async function grantClientAccess(
  clientUserId: string,
  baseDocumentId: string,
  grantedBy: string,
  expiresInDays?: number,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const latestIssued = await getLatestIssuedDocument(baseDocumentId);

    if (!latestIssued) {
      return { success: false, error: 'No issued document found. Cannot grant access to draft documents.' };
    }

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { error } = await supabase
      .from('client_document_access')
      .insert({
        client_user_id: clientUserId,
        base_document_id: baseDocumentId,
        granted_by: grantedBy,
        access_expires_at: expiresAt,
        notes: notes || null,
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error granting client access:', error);
    return { success: false, error: 'Failed to grant client access' };
  }
}

export async function revokeClientAccess(
  accessId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('client_document_access')
      .update({
        access_revoked: true,
        revoked_at: new Date().toISOString(),
        revoked_by: userId,
      })
      .eq('id', accessId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error revoking client access:', error);
    return { success: false, error: 'Failed to revoke client access' };
  }
}
