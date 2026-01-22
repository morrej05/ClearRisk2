import { supabase } from '../supabase';

export interface Attachment {
  id: string;
  organisation_id: string;
  document_id: string;
  module_instance_id: string | null;
  action_id: string | null;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number | null;
  caption: string | null;
  taken_at: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAttachmentData {
  organisation_id: string;
  document_id: string;
  module_instance_id?: string | null;
  action_id?: string | null;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size_bytes?: number | null;
  caption?: string | null;
  taken_at?: string | null;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];

export interface AttachmentWithLinks extends Attachment {
  module_name?: string;
  action_summary?: string;
}

export async function listAttachments(documentId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing attachments:', error);
    throw error;
  }

  return data || [];
}

export async function listAttachmentsWithLinks(documentId: string): Promise<AttachmentWithLinks[]> {
  const { data, error } = await supabase
    .from('attachments')
    .select(`
      *,
      module_instances!attachments_module_instance_id_fkey (
        module_key
      ),
      actions!attachments_action_id_fkey (
        summary
      )
    `)
    .eq('document_id', documentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing attachments with links:', error);
    throw error;
  }

  return (data || []).map((item: any) => ({
    ...item,
    module_name: item.module_instances?.module_key || undefined,
    action_summary: item.actions?.summary || undefined,
  }));
}

export async function getAttachment(id: string): Promise<Attachment | null> {
  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error getting attachment:', error);
    throw error;
  }

  return data;
}

export async function createAttachmentRow(attachmentData: CreateAttachmentData): Promise<Attachment> {
  const { data: userData } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('attachments')
    .insert({
      ...attachmentData,
      uploaded_by: userData?.user?.id || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating attachment:', error);
    throw error;
  }

  return data;
}

export async function updateAttachmentCaption(id: string, caption: string): Promise<void> {
  const { error } = await supabase
    .from('attachments')
    .update({ caption })
    .eq('id', id);

  if (error) {
    console.error('Error updating attachment caption:', error);
    throw error;
  }
}

export async function updateAttachmentLinks(
  id: string,
  moduleInstanceId: string | null,
  actionId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('attachments')
    .update({
      module_instance_id: moduleInstanceId,
      action_id: actionId,
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating attachment links:', error);
    throw error;
  }
}

export async function deleteAttachment(attachmentId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const attachment = await getAttachment(attachmentId);
    if (!attachment) {
      return { success: false, error: 'Attachment not found' };
    }

    const fileSizeMb = (attachment.file_size_bytes || 0) / (1024 * 1024);

    const { error: storageError } = await supabase.storage
      .from('evidence')
      .remove([attachment.file_path]);

    if (storageError) {
      console.error('[deleteAttachment] Error deleting from storage:', storageError);
    }

    const { error: dbError } = await supabase
      .from('attachments')
      .delete()
      .eq('id', attachmentId);

    if (dbError) {
      console.error('[deleteAttachment] Error deleting from database:', dbError);
      return { success: false, error: dbError.message };
    }

    if (attachment.organisation_id && fileSizeMb > 0) {
      const { data: orgData } = await supabase
        .from('organisations')
        .select('storage_used_mb')
        .eq('id', attachment.organisation_id)
        .single();

      if (orgData) {
        const newStorageMb = Math.max(0, (orgData.storage_used_mb || 0) - fileSizeMb);
        await supabase
          .from('organisations')
          .update({ storage_used_mb: newStorageMb })
          .eq('id', attachment.organisation_id);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('[deleteAttachment] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed. Allowed types: JPG, PNG, WEBP, PDF`,
    };
  }

  return { valid: true };
}

export function sanitizeFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 200);
}

function extractStorageKey(input: any): string {
  // Accept: string key, attachment row, or jsonb object
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      throw new Error('Empty string passed as storage key');
    }
    return trimmed;
  }

  // If passed an attachment row with file_path as string
  if (input && typeof input === 'object' && typeof input.file_path === 'string') {
    const trimmed = input.file_path.trim();
    if (!trimmed) {
      throw new Error('Empty file_path in attachment object');
    }
    return trimmed;
  }

  // If file_path itself is a nested jsonb object { file_path, file_name, ... }
  // This can happen if the database column is JSONB and not properly extracted
  if (input && typeof input === 'object' && input.file_path && typeof input.file_path === 'object') {
    if (typeof input.file_path.file_path === 'string') {
      const trimmed = input.file_path.file_path.trim();
      if (!trimmed) {
        throw new Error('Empty file_path in nested JSONB object');
      }
      console.warn('[extractStorageKey] Nested JSONB detected - database query may need fixing:', input);
      return trimmed;
    }
  }

  console.error('[extractStorageKey] Invalid input:', input);
  throw new Error('Invalid storage key input (expected string or attachment with file_path)');
}

export function extractFilePath(input: any): string | null {
  try {
    return extractStorageKey(input);
  } catch {
    return null;
  }
}

export async function uploadEvidenceFile(
  file: File,
  organisationId: string,
  documentId: string
): Promise<{ file_path: string; file_name: string; file_type: string; file_size_bytes: number }> {
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const fileSizeMb = file.size / (1024 * 1024);

  const { data: orgData, error: orgError } = await supabase
    .from('organisations')
    .select(`
      id,
      storage_used_mb,
      plan_definitions!organisations_plan_id_fkey (
        max_storage_mb
      )
    `)
    .eq('id', organisationId)
    .single();

  if (orgError || !orgData) {
    console.error('Error fetching organisation storage limits:', orgError);
    throw new Error('Unable to verify storage limits');
  }

  const storageUsedMb = orgData.storage_used_mb || 0;
  const maxStorageMb = (orgData.plan_definitions as any)?.max_storage_mb || 0;
  const newTotalMb = storageUsedMb + fileSizeMb;

  if (newTotalMb > maxStorageMb) {
    const remainingMb = Math.max(0, maxStorageMb - storageUsedMb);
    throw new Error(
      `Storage limit reached. You have ${remainingMb.toFixed(1)}MB remaining of ${maxStorageMb}MB. This file is ${fileSizeMb.toFixed(1)}MB. Upgrade your plan to add more storage.`
    );
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const randomId = crypto.randomUUID();
  const sanitizedName = sanitizeFilename(file.name);
  const filePath = `${organisationId}/${documentId}/${timestamp}/${randomId}_${sanitizedName}`;

  const { error: uploadError } = await supabase.storage
    .from('evidence')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error('Error uploading file:', uploadError);
    throw uploadError;
  }

  await supabase
    .from('organisations')
    .update({
      storage_used_mb: newTotalMb,
    })
    .eq('id', organisationId);

  return {
    file_path: filePath,
    file_name: file.name,
    file_type: file.type,
    file_size_bytes: file.size,
  };
}

export function getPublicUrl(filePath: string): string {
  const { data } = supabase.storage
    .from('evidence')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export async function getSignedUrl(input: string | any, expiresIn: number = 3600): Promise<string> {
  let key: string;

  try {
    key = extractStorageKey(input);
  } catch (error) {
    console.error('[getSignedUrl] Failed to extract storage key:', error, 'Input:', input);
    throw error;
  }

  // Trim and validate
  key = key.trim();

  // Hard fail if key looks like JSON
  if (!key || key.startsWith('{') || key.includes('"file_path"') || key.includes('{"')) {
    console.error('[getSignedUrl] Invalid key - appears to be JSON:', { key, input });
    throw new Error('Invalid storage key: key appears to be JSON object, not a path string');
  }

  // Debug log (remove after verification)
  console.log('[getSignedUrl] Using key:', key);

  if (typeof input === 'object') {
    console.warn('[getSignedUrl] Object passed - extracting file_path. Call site should pass string directly:', input);
  }

  const { data, error } = await supabase.storage
    .from('evidence')
    .createSignedUrl(key, expiresIn);

  if (error) {
    console.error('[getSignedUrl] Supabase Storage error:', error, 'Key:', key);
    throw error;
  }

  return data.signedUrl;
}

export interface PreviewResult {
  ok: boolean;
  url?: string;
  fileType?: string;
  error?: string;
}

export async function openAttachmentPreview(attachmentOrPath: any, expiresIn: number = 3600): Promise<PreviewResult> {
  try {
    const filePath = extractFilePath(attachmentOrPath);

    if (!filePath) {
      return {
        ok: false,
        error: 'Invalid file path',
      };
    }

    const url = await getSignedUrl(filePath, expiresIn);

    let fileType = 'unknown';
    if (typeof attachmentOrPath === 'object' && attachmentOrPath?.file_type) {
      fileType = attachmentOrPath.file_type;
    } else if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      fileType = 'image';
    } else if (filePath.match(/\.pdf$/i)) {
      fileType = 'pdf';
    }

    return {
      ok: true,
      url,
      fileType,
    };
  } catch (error) {
    console.error('Error opening attachment preview:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function isValidAttachment(attachment: any): boolean {
  return extractFilePath(attachment) !== null;
}

export async function countAttachmentsByAction(actionId: string): Promise<number> {
  const { count, error } = await supabase
    .from('attachments')
    .select('*', { count: 'exact', head: true })
    .eq('action_id', actionId);

  if (error) {
    console.error('Error counting attachments:', error);
    return 0;
  }

  return count || 0;
}

export async function countAttachmentsByModule(moduleInstanceId: string): Promise<number> {
  const { count, error } = await supabase
    .from('attachments')
    .select('*', { count: 'exact', head: true })
    .eq('module_instance_id', moduleInstanceId);

  if (error) {
    console.error('Error counting attachments:', error);
    return 0;
  }

  return count || 0;
}
