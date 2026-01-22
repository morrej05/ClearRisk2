import { supabase } from '../lib/supabase';

export interface DefencePack {
  id: string;
  organisation_id: string;
  document_id: string;
  title: string;
  description: string | null;
  included_pdf: boolean;
  included_change_summary: boolean;
  included_action_register: boolean;
  included_evidence_list: boolean;
  bundle_storage_path: string | null;
  bundle_size_bytes: number | null;
  internal_only: boolean;
  client_accessible: boolean;
  generated_at: string;
  generated_by: string | null;
  version_timestamp: string;
  created_at: string;
  updated_at: string;
}

export interface DefencePackOptions {
  includePdf?: boolean;
  includeChangeSummary?: boolean;
  includeActionRegister?: boolean;
  includeEvidenceList?: boolean;
  internalOnly?: boolean;
  clientAccessible?: boolean;
}

export async function createDefencePack(
  documentId: string,
  organisationId: string,
  userId: string,
  options: DefencePackOptions = {}
): Promise<{ success: boolean; packId?: string; error?: string }> {
  try {
    // Get document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('title, version_number, issue_date')
      .eq('id', documentId)
      .single();

    if (docError) throw docError;

    const title = `Defence Pack - ${document.title} v${document.version_number}`;
    const description = `Professional defence bundle generated on ${new Date().toLocaleDateString()} for document issued ${document.issue_date}`;

    const { data, error } = await supabase
      .from('defence_packs')
      .insert({
        organisation_id: organisationId,
        document_id: documentId,
        title,
        description,
        included_pdf: options.includePdf ?? true,
        included_change_summary: options.includeChangeSummary ?? true,
        included_action_register: options.includeActionRegister ?? true,
        included_evidence_list: options.includeEvidenceList ?? true,
        internal_only: options.internalOnly ?? true,
        client_accessible: options.clientAccessible ?? false,
        generated_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, packId: data.id };
  } catch (error: any) {
    console.error('Error creating defence pack:', error);
    return { success: false, error: error.message };
  }
}

export async function getDefencePacks(
  documentId: string
): Promise<DefencePack[]> {
  try {
    const { data, error } = await supabase
      .from('defence_packs')
      .select('*')
      .eq('document_id', documentId)
      .order('generated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching defence packs:', error);
    return [];
  }
}

export async function getDefencePack(
  packId: string
): Promise<DefencePack | null> {
  try {
    const { data, error } = await supabase
      .from('defence_packs')
      .select('*')
      .eq('id', packId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching defence pack:', error);
    return null;
  }
}

export async function updateDefencePackAccessibility(
  packId: string,
  clientAccessible: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('defence_packs')
      .update({
        client_accessible: clientAccessible,
        updated_at: new Date().toISOString(),
      })
      .eq('id', packId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error updating defence pack accessibility:', error);
    return { success: false, error: error.message };
  }
}

export function getDefencePackContents(pack: DefencePack): string[] {
  const contents: string[] = [];

  if (pack.included_pdf) {
    contents.push('Issued Report PDF (Locked)');
  }

  if (pack.included_change_summary) {
    contents.push('Change Summary (Material Changes)');
  }

  if (pack.included_action_register) {
    contents.push('Action Register Snapshot');
  }

  if (pack.included_evidence_list) {
    contents.push('Evidence List (Metadata)');
  }

  return contents;
}

export function getDefencePackSummary(pack: DefencePack): string {
  const contents = getDefencePackContents(pack);
  return `Defence pack containing ${contents.length} components: ${contents.join(', ')}`;
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return 'N/A';

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(2)} KB`;
  }

  const mb = kb / 1024;
  if (mb < 1024) {
    return `${mb.toFixed(2)} MB`;
  }

  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

export function canClientAccessPack(pack: DefencePack): boolean {
  return !pack.internal_only && pack.client_accessible;
}

export async function generateDefencePackManifest(
  packId: string
): Promise<{ success: boolean; manifest?: any; error?: string }> {
  try {
    const pack = await getDefencePack(packId);
    if (!pack) {
      throw new Error('Defence pack not found');
    }

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('title, version_number, issue_date, issued_by')
      .eq('id', pack.document_id)
      .single();

    if (docError) throw docError;

    // Get change summary if included
    let changeSummary = null;
    if (pack.included_change_summary) {
      const { data: summary } = await supabase
        .from('document_change_summaries')
        .select('*')
        .eq('document_id', pack.document_id)
        .maybeSingle();

      changeSummary = summary;
    }

    // Get actions if included
    let actionCount = 0;
    if (pack.included_action_register) {
      const { count } = await supabase
        .from('actions')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', pack.document_id)
        .is('deleted_at', null);

      actionCount = count || 0;
    }

    // Get evidence count if included
    let evidenceCount = 0;
    if (pack.included_evidence_list) {
      const { count } = await supabase
        .from('attachments')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', pack.document_id);

      evidenceCount = count || 0;
    }

    const manifest = {
      pack_id: pack.id,
      title: pack.title,
      description: pack.description,
      generated_at: pack.generated_at,
      document: {
        title: document.title,
        version: document.version_number,
        issue_date: document.issue_date,
        issued_by: document.issued_by,
      },
      contents: {
        pdf: pack.included_pdf,
        change_summary: pack.included_change_summary ? {
          included: true,
          has_material_changes: changeSummary?.has_material_changes,
          new_actions: changeSummary?.new_actions_count,
          closed_actions: changeSummary?.closed_actions_count,
        } : { included: false },
        action_register: pack.included_action_register ? {
          included: true,
          action_count: actionCount,
        } : { included: false },
        evidence_list: pack.included_evidence_list ? {
          included: true,
          evidence_count: evidenceCount,
        } : { included: false },
      },
      access_control: {
        internal_only: pack.internal_only,
        client_accessible: pack.client_accessible,
      },
    };

    return { success: true, manifest };
  } catch (error: any) {
    console.error('Error generating defence pack manifest:', error);
    return { success: false, error: error.message };
  }
}
