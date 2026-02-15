import { supabase } from '../lib/supabase';

/**
 * Create a safe filename slug from input string
 */
export function safeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

interface UploadDraftPdfOptions {
  organisationId: string;
  documentId: string;
  reportKind: 'fra' | 'fsd' | 'ex' | 're_survey' | 're_lp';
  filenameBase: string;
  pdfBytes: Uint8Array;
}

interface UploadDraftPdfResult {
  path: string;
  signedUrl: string;
}

/**
 * Upload draft PDF to storage and create signed URL
 *
 * @param options Upload options
 * @returns Object with storage path and signed URL
 */
export async function uploadDraftPdfAndSign(
  options: UploadDraftPdfOptions
): Promise<UploadDraftPdfResult> {
  const { organisationId, documentId, reportKind, filenameBase, pdfBytes } = options;

  const timestamp = Date.now();
  const safeBase = safeSlug(filenameBase);
  const filename = `${safeBase}_${reportKind}_${timestamp}.pdf`;
  const path = `${organisationId}/${documentId}/draft/${filename}`;

  // Upload to document-pdfs bucket
  const { error: uploadError } = await supabase.storage
    .from('document-pdfs')
    .upload(path, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Failed to upload draft PDF: ${uploadError.message}`);
  }

  // Create signed URL (valid for 1 hour)
  const { data: signedData, error: signError } = await supabase.storage
    .from('document-pdfs')
    .createSignedUrl(path, 3600);

  if (signError || !signedData?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${signError?.message || 'Unknown error'}`);
  }

  // Try to update document table with draft path (ignore errors if columns don't exist yet)
  try {
    const updateData: Record<string, any> = {};

    if (reportKind === 're_survey') {
      updateData.draft_re_survey_pdf_path = path;
    } else if (reportKind === 're_lp') {
      updateData.draft_re_lp_pdf_path = path;
    } else {
      updateData.draft_pdf_path = path;
    }

    await supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentId);
  } catch (error) {
    // Ignore errors - columns might not exist yet
    console.warn('Could not update document draft_pdf_path (columns may not exist):', error);
  }

  return {
    path,
    signedUrl: signedData.signedUrl,
  };
}

/**
 * Save RE module selection to database
 *
 * @param documentId Document ID
 * @param moduleKeys Array of selected module keys
 */
export async function saveReModuleSelection(
  documentId: string,
  moduleKeys: string[]
): Promise<void> {
  try {
    await supabase
      .from('documents')
      .update({ draft_re_survey_included_modules: moduleKeys })
      .eq('id', documentId);
  } catch (error) {
    console.warn('Could not save RE module selection (column may not exist):', error);
  }
}

/**
 * Load RE module selection from database
 *
 * @param documentId Document ID
 * @returns Array of selected module keys, or null if not set
 */
export async function loadReModuleSelection(
  documentId: string
): Promise<string[] | null> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('draft_re_survey_included_modules')
      .eq('id', documentId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.draft_re_survey_included_modules as string[] | null;
  } catch (error) {
    console.warn('Could not load RE module selection (column may not exist):', error);
    return null;
  }
}
