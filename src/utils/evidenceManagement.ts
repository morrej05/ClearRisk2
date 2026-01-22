import { supabase } from '../lib/supabase';

export interface Attachment {
  id: string;
  organisation_id: string;
  document_id: string;
  base_document_id: string;
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
  deleted_at: string | null;
}

export interface DocumentStatus {
  id: string;
  issue_status: 'draft' | 'issued' | 'superseded';
  version_number: number;
  base_document_id: string;
}

export async function getDocumentStatus(documentId: string): Promise<DocumentStatus | null> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('id, issue_status, version_number, base_document_id')
      .eq('id', documentId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching document status:', error);
    return null;
  }
}

export function isDocumentLocked(issueStatus: string): boolean {
  return issueStatus === 'issued' || issueStatus === 'superseded';
}

export async function getDocumentAttachments(documentId: string): Promise<Attachment[]> {
  try {
    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('document_id', documentId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching attachments:', error);
    return [];
  }
}

export async function uploadAttachment(
  organisationId: string,
  documentId: string,
  baseDocumentId: string,
  file: File,
  caption?: string,
  moduleInstanceId?: string,
  actionId?: string
): Promise<{ success: boolean; error?: string; attachment?: Attachment }> {
  try {
    const docStatus = await getDocumentStatus(documentId);

    if (!docStatus) {
      return { success: false, error: 'Document not found' };
    }

    if (isDocumentLocked(docStatus.issue_status)) {
      return {
        success: false,
        error: 'Cannot add evidence to an issued or superseded document. Create a new version to add evidence.',
      };
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const fileExt = file.name.split('.').pop();
    const randomId = crypto.randomUUID();
    const storagePath = `evidence/${organisationId}/${documentId}/${timestamp}/${randomId}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('evidence')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { success: false, error: uploadError.message };
    }

    const { data: attachment, error: dbError } = await supabase
      .from('attachments')
      .insert({
        organisation_id: organisationId,
        document_id: documentId,
        base_document_id: baseDocumentId,
        module_instance_id: moduleInstanceId || null,
        action_id: actionId || null,
        file_path: storagePath,
        file_name: file.name,
        file_type: file.type,
        file_size_bytes: file.size,
        caption: caption || null,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .select()
      .single();

    if (dbError) {
      await supabase.storage.from('evidence').remove([storagePath]);
      console.error('Database insert error:', dbError);
      return { success: false, error: dbError.message };
    }

    return { success: true, attachment };
  } catch (error: any) {
    console.error('Upload error:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export async function deleteAttachment(
  attachmentId: string,
  documentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docStatus = await getDocumentStatus(documentId);

    if (!docStatus) {
      return { success: false, error: 'Document not found' };
    }

    if (isDocumentLocked(docStatus.issue_status)) {
      return {
        success: false,
        error: 'Cannot delete evidence from an issued or superseded document.',
      };
    }

    const { error } = await supabase
      .from('attachments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', attachmentId);

    if (error) {
      console.error('Delete error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Delete error:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export async function updateAttachmentCaption(
  attachmentId: string,
  documentId: string,
  caption: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docStatus = await getDocumentStatus(documentId);

    if (!docStatus) {
      return { success: false, error: 'Document not found' };
    }

    if (isDocumentLocked(docStatus.issue_status)) {
      return {
        success: false,
        error: 'Cannot edit evidence on an issued or superseded document.',
      };
    }

    const { error } = await supabase
      .from('attachments')
      .update({ caption })
      .eq('id', attachmentId);

    if (error) {
      console.error('Update error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Update error:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export async function downloadAttachment(filePath: string, fileName: string): Promise<void> {
  try {
    const { data, error } = await supabase.storage
      .from('evidence')
      .download(filePath);

    if (error) throw error;

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
}

export async function getAttachmentPublicUrl(filePath: string): Promise<string | null> {
  try {
    const { data } = supabase.storage
      .from('evidence')
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (error) {
    console.error('Error getting public URL:', error);
    return null;
  }
}

export async function carryForwardEvidence(
  fromDocumentId: string,
  toDocumentId: string,
  toBaseDocumentId: string,
  organisationId: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const attachments = await getDocumentAttachments(fromDocumentId);

    if (attachments.length === 0) {
      return { success: true, count: 0 };
    }

    const userId = (await supabase.auth.getUser()).data.user?.id;

    const newAttachments = attachments.map(att => ({
      organisation_id: organisationId,
      document_id: toDocumentId,
      base_document_id: toBaseDocumentId,
      module_instance_id: att.module_instance_id,
      action_id: att.action_id,
      file_path: att.file_path,
      file_name: att.file_name,
      file_type: att.file_type,
      file_size_bytes: att.file_size_bytes,
      caption: att.caption,
      taken_at: att.taken_at,
      uploaded_by: userId,
    }));

    const { error } = await supabase
      .from('attachments')
      .insert(newAttachments);

    if (error) {
      console.error('Carry forward error:', error);
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: newAttachments.length };
  } catch (error: any) {
    console.error('Carry forward error:', error);
    return { success: false, count: 0, error: error.message || 'Unknown error occurred' };
  }
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function getFileIcon(fileType: string): string {
  if (fileType.startsWith('image/')) return '🖼️';
  if (fileType === 'application/pdf') return '📄';
  return '📎';
}
