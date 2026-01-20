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

export async function deleteAttachment(id: string): Promise<void> {
  const attachment = await getAttachment(id);
  if (!attachment) {
    throw new Error('Attachment not found');
  }

  const { error: storageError } = await supabase.storage
    .from('evidence')
    .remove([attachment.file_path]);

  if (storageError) {
    console.warn('Error deleting file from storage:', storageError);
  }

  const { error } = await supabase
    .from('attachments')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting attachment:', error);
    throw error;
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

export async function uploadEvidenceFile(
  file: File,
  organisationId: string,
  documentId: string
): Promise<{ file_path: string; file_name: string; file_type: string; file_size_bytes: number }> {
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
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

export async function getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from('evidence')
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    console.error('Error creating signed URL:', error);
    throw error;
  }

  return data.signedUrl;
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
