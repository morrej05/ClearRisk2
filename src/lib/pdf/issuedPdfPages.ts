import { PDFDocument, PDFPage, StandardFonts } from 'pdf-lib';
import { supabase } from '../supabase';
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  fetchAndEmbedLogo,
  drawCoverPage,
  drawDocumentControlPage,
} from './pdfUtils';
import { getEziRiskLogoBytes } from './eziRiskLogo';

/**
 * Wraps a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

async function getEmbeddedEziRiskLogo(pdfDoc: PDFDocument): Promise<{ image: any; width: number; height: number } | null> {
  try {
    console.log('[PDF Logo] Loading embedded EziRisk logo');
    const logoBytes = getEziRiskLogoBytes();

    // Add 2-second timeout to prevent hanging
    const image = await withTimeout(
      pdfDoc.embedPng(logoBytes),
      2000,
      'EziRisk logo embedding timed out'
    );

    const dims = image.scale(1);
    console.log('[PDF Logo] Successfully embedded EziRisk logo:', dims.width, 'x', dims.height);
    return { image, width: dims.width, height: dims.height };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PDF Logo] Error embedding EziRisk logo:', errorMsg);
    console.log('[PDF Logo] Will use text fallback');
    return null;
  }
}

interface IssuedPdfOptions {
  pdfDoc: PDFDocument;
  document: {
    id: string;
    title: string;
    document_type: string;
    version_number: number;
    issue_date: string | null;
    issue_status: 'draft' | 'issued' | 'superseded';
    assessor_name: string | null;
    base_document_id?: string;
  };
  organisation: {
    id: string;
    name: string;
    branding_logo_path?: string | null;
  };
  client?: {
    name?: string;
    site?: string;
  } | null;
  fonts: {
    bold: any;
    regular: any;
  };
}

export async function addIssuedReportPages(options: IssuedPdfOptions): Promise<{
  coverPage: PDFPage;
  docControlPage: PDFPage;
}> {
  console.log('[PDF Issued Pages] Starting issued pages generation');
  const { pdfDoc, document, organisation, client, fonts } = options;

  let logoData: { image: any; width: number; height: number } | null = null;

  // Try to load organization logo with timeout
  if (organisation.branding_logo_path) {
    try {
      console.log('[PDF Logo] Attempting to load org logo:', organisation.branding_logo_path);

      // Wrap entire org logo loading in timeout
      logoData = await withTimeout(
        (async () => {
          const { data, error } = await supabase.storage
            .from('org-assets')
            .createSignedUrl(organisation.branding_logo_path!, 3600);

          if (error) {
            console.warn('[PDF Logo] Failed to create signed URL for org logo:', error);
            return null;
          }

          if (!data?.signedUrl) {
            console.warn('[PDF Logo] No signed URL returned');
            return null;
          }

          console.log('[PDF Logo] Got signed URL, fetching and embedding...');
          const result = await fetchAndEmbedLogo(
            pdfDoc,
            organisation.branding_logo_path!,
            data.signedUrl
          );

          if (result) {
            console.log('[PDF Logo] Successfully loaded org logo');
          } else {
            console.warn('[PDF Logo] Org logo failed to embed');
          }

          return result;
        })(),
        5000, // 5-second timeout for org logo (includes fetch + embed)
        'Organization logo loading timed out'
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.warn('[PDF Logo] Exception loading org logo:', errorMsg);
      logoData = null;
    }
  }

  // Fallback to embedded EziRisk logo
  if (!logoData) {
    console.log('[PDF Logo] No org logo available, using embedded EziRisk logo');
    logoData = await getEmbeddedEziRiskLogo(pdfDoc);
  }

  // Final fallback message
  if (!logoData) {
    console.log('[PDF Logo] All logo loading failed, using text fallback "EziRisk"');
  } else {
    console.log('[PDF Logo] Logo ready for use');
  }

  console.log('[PDF Issued Pages] Creating cover page');
  const coverPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  await drawCoverPage(
    coverPage,
    fonts,
    document,
    organisation,
    client || null,
    logoData
  );

  let revisionHistory: Array<{
    version_number: number;
    issue_date: string;
    change_summary: string | null;
    issued_by_name: string | null;
  }> = [];

  if (document.base_document_id) {
    try {
      const { data: summaries } = await supabase
        .from('change_summaries')
        .select(`
          version_number,
          created_at,
          summary_text,
          user_profiles!change_summaries_created_by_fkey (
            full_name
          )
        `)
        .eq('base_document_id', document.base_document_id)
        .order('version_number', { ascending: false });

      if (summaries) {
        revisionHistory = summaries.map((s: any) => ({
          version_number: s.version_number,
          issue_date: s.created_at,
          change_summary: s.summary_text,
          issued_by_name: s.user_profiles?.full_name || null,
        }));
      }
    } catch (error) {
      console.warn('[Issued PDF] Failed to load revision history:', error);
    }
  }

  if (revisionHistory.length === 0 && document.issue_date) {
    const isInitialVersion = !document.base_document_id || document.version_number === 1;
    revisionHistory.push({
      version_number: document.version_number,
      issue_date: document.issue_date,
      change_summary: isInitialVersion ? 'Initial issue' : 'Revision issued',
      issued_by_name: document.assessor_name || null,
    });
  }

  const docControlPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  await drawDocumentControlPage(
    docControlPage,
    fonts,
    {
      title: document.title,
      version_number: document.version_number,
      issue_date: document.issue_date,
      issue_status: document.issue_status,
      assessor_name: document.assessor_name,
      issued_by_name: null,
    },
    organisation,
    client || null,
    revisionHistory
  );

  console.log('[PDF Issued Pages] Issued pages generation complete');
  return { coverPage, docControlPage };
}
