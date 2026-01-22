import { supabase } from '../lib/supabase';

export interface DefencePack {
  id: string;
  organisation_id: string;
  document_id: string;
  base_document_id: string;
  version_number: number;
  created_by: string | null;
  created_at: string;
  bundle_path: string;
  checksum: string | null;
  size_bytes: number | null;
  manifest: any | null;
}

export interface DefencePackManifest {
  document_id: string;
  base_document_id: string;
  title: string;
  document_type: string;
  version_number: number;
  issue_date: string;
  pack_created_at: string;
  files: Array<{
    name: string;
    type: string;
  }>;
  action_count: number;
  evidence_count: number;
}

export async function getDefencePack(documentId: string): Promise<DefencePack | null> {
  try {
    const { data, error } = await supabase
      .from('document_defence_packs')
      .select('*')
      .eq('document_id', documentId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching defence pack:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching defence pack:', error);
    return null;
  }
}

export async function getDefencePacksByBaseDocument(baseDocumentId: string): Promise<DefencePack[]> {
  try {
    const { data, error } = await supabase
      .from('document_defence_packs')
      .select('*')
      .eq('base_document_id', baseDocumentId)
      .order('version_number', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching defence packs:', error);
    return [];
  }
}

export async function buildDefencePack(documentId: string): Promise<{ success: boolean; pack?: DefencePack; error?: string }> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/build-defence-pack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ document_id: documentId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Failed to build defence pack',
      };
    }

    const result = await response.json();

    if (result.success) {
      return { success: true, pack: result.pack };
    } else {
      return { success: false, error: result.error || 'Unknown error' };
    }
  } catch (error: any) {
    console.error('Error building defence pack:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export async function downloadDefencePack(bundlePath: string, filename: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from('defence-packs')
      .createSignedUrl(bundlePath, 300);

    if (error || !data) {
      console.error('Error creating signed URL:', error);
      return { success: false, error: 'Failed to generate download URL' };
    }

    const link = document.createElement('a');
    link.href = data.signedUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return { success: true };
  } catch (error: any) {
    console.error('Error downloading defence pack:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function getDefencePackFilename(pack: DefencePack): string {
  return `defence_pack_v${pack.version_number}.zip`;
}

export async function checkDefencePackExists(documentId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('document_defence_packs')
      .select('id')
      .eq('document_id', documentId)
      .maybeSingle();

    if (error) {
      console.error('Error checking defence pack:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking defence pack:', error);
    return false;
  }
}

export function isDefencePackEligible(issueStatus: string, lockedPdfPath: string | null): boolean {
  return issueStatus === 'issued' && !!lockedPdfPath;
}

export function getDefencePackStatus(pack: DefencePack | null, issueStatus: string, lockedPdfPath: string | null): 'not_eligible' | 'ready' | 'exists' {
  if (!isDefencePackEligible(issueStatus, lockedPdfPath)) {
    return 'not_eligible';
  }

  if (pack) {
    return 'exists';
  }

  return 'ready';
}

export function getDefencePackContents(manifest: DefencePackManifest | null): string[] {
  const contents: string[] = [];

  contents.push('Issued Report PDF (Locked)');
  contents.push('Change Summary');
  contents.push('Action Register Snapshot');
  contents.push('Evidence Index');
  contents.push('Manifest File');

  return contents;
}

export function getDefencePackSummary(pack: DefencePack): string {
  const manifest = pack.manifest as DefencePackManifest | null;
  if (!manifest) {
    return 'Defence pack bundle (contents unknown)';
  }

  return `Defence pack containing ${manifest.files?.length || 5} files - ${manifest.action_count || 0} actions, ${manifest.evidence_count || 0} evidence items`;
}
