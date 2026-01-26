import { PDFDocument, PDFPage, StandardFonts } from 'pdf-lib';
import { supabase } from '../supabase';
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  fetchAndEmbedLogo,
  drawCoverPage,
  drawDocumentControlPage,
} from './pdfUtils';

async function fetchEziRiskFallbackLogo(pdfDoc: PDFDocument): Promise<{ image: any; width: number; height: number } | null> {
  try {
    const response = await fetch('/ezirisk-logo-primary.png.png');
    if (!response.ok) {
      console.warn('Failed to fetch EziRisk fallback logo');
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const image = await pdfDoc.embedPng(uint8Array);
    const dims = image.scale(1);
    return { image, width: dims.width, height: dims.height };
  } catch (error) {
    console.error('Error loading EziRisk fallback logo:', error);
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
  const { pdfDoc, document, organisation, client, fonts } = options;

  let logoData: { image: any; width: number; height: number } | null = null;

  if (organisation.branding_logo_path) {
    try {
      const { data, error } = await supabase.storage
        .from('org-assets')
        .createSignedUrl(organisation.branding_logo_path, 3600);

      if (!error && data?.signedUrl) {
        logoData = await fetchAndEmbedLogo(
          pdfDoc,
          organisation.branding_logo_path,
          data.signedUrl
        );
      }
    } catch (error) {
      console.warn('[Issued PDF] Failed to load org logo, will try fallback:', error);
    }
  }

  if (!logoData) {
    console.log('[Issued PDF] Using EziRisk fallback logo');
    logoData = await fetchEziRiskFallbackLogo(pdfDoc);
  }

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
    revisionHistory.push({
      version_number: document.version_number,
      issue_date: document.issue_date,
      change_summary: 'Initial issue',
      issued_by_name: null,
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

  return { coverPage, docControlPage };
}
