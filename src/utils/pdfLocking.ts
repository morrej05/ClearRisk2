import { supabase } from '../lib/supabase';

export interface LockedPdfInfo {
  locked_pdf_path: string | null;
  locked_pdf_checksum: string | null;
  locked_pdf_generated_at: string | null;
  locked_pdf_size_bytes: number | null;
  pdf_generation_error: string | null;
}

export async function calculateSHA256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function uploadLockedPdf(
  pdfBytes: Uint8Array,
  organisationId: string,
  documentId: string,
  documentTitle: string,
  versionNumber: number
): Promise<{ success: boolean; path?: string; checksum?: string; error?: string }> {
  try {
    const sanitizedTitle = documentTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().getTime();
    const filename = `${sanitizedTitle}_v${versionNumber}_${timestamp}.pdf`;
    const path = `${organisationId}/${documentId}/${filename}`;

    const checksum = await calculateSHA256(pdfBytes);

    const { error: uploadError } = await supabase.storage
      .from('document-pdfs')
      .upload(path, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError);
      return { success: false, error: uploadError.message };
    }

    return { success: true, path, checksum };
  } catch (error: any) {
    console.error('Error in uploadLockedPdf:', error);
    return { success: false, error: error.message || 'Failed to upload PDF' };
  }
}

/**
 * Downloads a locked PDF by requesting a signed URL from the Edge Function.
 * Uses document_id instead of path for security and simplicity.
 */
export async function downloadLockedPdf(
  documentId: string
): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  try {
    console.log('[downloadLockedPdf] Requesting signed URL for document:', documentId);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      console.error('[downloadLockedPdf] No access token available');
      return { success: false, error: 'Not authenticated (no access token)' };
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/get-locked-pdf-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ document_id: documentId }),
    });

    const respJson = await response.json().catch(() => null);

    console.log('[downloadLockedPdf] Response status:', response.status, respJson);

    if (!response.ok) {
      const errorMsg = respJson?.error || `Failed to get signed URL (${response.status})`;
      console.error('[downloadLockedPdf] Error:', errorMsg);
      return { success: false, error: errorMsg };
    }

    const signedUrl = respJson?.signed_url;
    if (!signedUrl) {
      console.error('[downloadLockedPdf] No signed URL in response');
      return { success: false, error: 'No signed URL returned from function' };
    }

    console.log('[downloadLockedPdf] Success! Signed URL received');
    return { success: true, signedUrl };
  } catch (err: any) {
    console.error('[downloadLockedPdf] Exception:', err);
    return { success: false, error: err?.message || 'Failed to get signed URL' };
  }
}


export async function lockPdfToDocument(
  documentId: string,
  pdfPath: string,
  checksum: string,
  sizeBytes: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('documents')
      .update({
        locked_pdf_path: pdfPath,
        locked_pdf_checksum: checksum,
        locked_pdf_generated_at: new Date().toISOString(),
        locked_pdf_size_bytes: sizeBytes,
        pdf_generation_error: null,
      })
      .eq('id', documentId);

    if (error) {
      console.error('Error locking PDF to document:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in lockPdfToDocument:', error);
    return { success: false, error: error.message || 'Failed to lock PDF' };
  }
}

export async function recordPdfGenerationError(
  documentId: string,
  errorMessage: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('documents')
      .update({
        pdf_generation_error: errorMessage,
      })
      .eq('id', documentId);

    if (error) {
      console.error('Error recording PDF generation error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in recordPdfGenerationError:', error);
    return { success: false, error: error.message || 'Failed to record error' };
  }
}

export async function getLockedPdfInfo(documentId: string): Promise<LockedPdfInfo | null> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('locked_pdf_path, locked_pdf_checksum, locked_pdf_generated_at, locked_pdf_size_bytes, pdf_generation_error')
      .eq('id', documentId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting locked PDF info:', error);
    return null;
  }
}

export async function hasLockedPdf(documentId: string): Promise<boolean> {
  const info = await getLockedPdfInfo(documentId);
  return info?.locked_pdf_path !== null;
}

export async function shouldRegeneratePdf(documentId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('should_regenerate_pdf', {
      document_id_param: documentId,
    });

    if (error) throw error;
    return data === true;
  } catch (error) {
    console.error('Error checking if should regenerate PDF:', error);
    return true;
  }
}

export async function verifyPdfIntegrity(
  documentId: string,
  pdfBytes: Uint8Array
): Promise<{ valid: boolean; storedChecksum?: string; calculatedChecksum?: string }> {
  try {
    const info = await getLockedPdfInfo(documentId);

    if (!info?.locked_pdf_checksum) {
      return { valid: false };
    }

    const calculatedChecksum = await calculateSHA256(pdfBytes);

    return {
      valid: calculatedChecksum === info.locked_pdf_checksum,
      storedChecksum: info.locked_pdf_checksum,
      calculatedChecksum,
    };
  } catch (error) {
    console.error('Error verifying PDF integrity:', error);
    return { valid: false };
  }
}

export async function generateAndLockPdf(
  documentId: string,
  organisationId: string,
  documentTitle: string,
  versionNumber: number,
  pdfBytes: Uint8Array
): Promise<{ success: boolean; path?: string; checksum?: string; error?: string }> {
  try {
    console.log(`[PDF Lock] Starting PDF upload for document ${documentId}, size: ${pdfBytes.length} bytes`);

    const uploadResult = await uploadLockedPdf(
      pdfBytes,
      organisationId,
      documentId,
      documentTitle,
      versionNumber
    );

    if (!uploadResult.success || !uploadResult.path || !uploadResult.checksum) {
      console.error('[PDF Lock] Upload failed:', uploadResult.error);
      await recordPdfGenerationError(
        documentId,
        uploadResult.error || 'Failed to upload PDF'
      );
      return {
        success: false,
        error: uploadResult.error || 'Failed to upload PDF',
      };
    }

    console.log(`[PDF Lock] Upload succeeded, path: ${uploadResult.path}, checksum: ${uploadResult.checksum}`);
    console.log(`[PDF Lock] Locking PDF to document ${documentId}...`);

    const lockResult = await lockPdfToDocument(
      documentId,
      uploadResult.path,
      uploadResult.checksum,
      pdfBytes.length
    );

    if (!lockResult.success) {
      console.error('[PDF Lock] Database update failed:', lockResult.error);
      await recordPdfGenerationError(documentId, lockResult.error || 'Failed to lock PDF to document');
      return {
        success: false,
        error: lockResult.error || 'Failed to lock PDF to document',
      };
    }

    console.log(`[PDF Lock] Successfully locked PDF to document ${documentId}`);

    return {
      success: true,
      path: uploadResult.path,
      checksum: uploadResult.checksum,
    };
  } catch (error: any) {
    console.error('[PDF Lock] Exception in generateAndLockPdf:', error);
    const errorMessage = error.message || 'Failed to generate and lock PDF';
    await recordPdfGenerationError(documentId, errorMessage);
    return { success: false, error: errorMessage };
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function getPdfStatusDescription(document: any): string {
  if (document.issue_status === 'draft') {
    return 'Draft - Regenerates with latest data';
  }

  if (document.pdf_generation_error) {
    return `Error: ${document.pdf_generation_error}`;
  }

  if (!document.locked_pdf_path) {
    if (document.issue_status === 'issued') {
      return 'Issued - Legacy (no locked PDF)';
    }
    if (document.issue_status === 'superseded') {
      return 'Superseded - Legacy (no locked PDF)';
    }
    return 'Unknown status';
  }

  if (document.issue_status === 'issued') {
    return 'Issued - PDF Locked';
  }

  if (document.issue_status === 'superseded') {
    return 'Superseded - PDF Locked';
  }

  return 'Unknown status';
}

export function canRegeneratePdf(document: any): boolean {
  return document.issue_status === 'draft';
}

export function mustUseLockedPdf(document: any): boolean {
  return (
    document.issue_status !== 'draft' &&
    document.locked_pdf_path !== null &&
    document.locked_pdf_path !== undefined
  );
}

export async function deleteLockedPdf(path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from('document-pdfs')
      .remove([path]);

    if (error) {
      console.error('Error deleting locked PDF:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in deleteLockedPdf:', error);
    return { success: false, error: error.message || 'Failed to delete PDF' };
  }
}
