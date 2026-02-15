import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN,
  CONTENT_WIDTH,
  sanitizePdfText,
  wrapText,
  formatDate,
  addNewPage,
  drawFooter,
  addSupersededWatermark,
  addExecutiveSummaryPages,
  drawRecommendationsSection,
} from './pdfUtils';
import { addIssuedReportPages } from './issuedPdfPages';

interface Document {
  id: string;
  document_type: string;
  title: string;
  status: string;
  version: number;
  assessment_date: string;
  review_date: string | null;
  assessor_name: string | null;
  assessor_role: string | null;
  responsible_person: string | null;
  scope_description: string | null;
  limitations_assumptions: string | null;
  created_at: string;
  updated_at: string;
  executive_summary_ai?: string | null;
  executive_summary_author?: string | null;
  executive_summary_mode?: string | null;
  jurisdiction?: string;
}

interface ModuleInstance {
  id: string;
  module_key: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
  completed_at: string | null;
  updated_at: string;
}

interface Action {
  id: string;
  recommended_action: string;
  priority_band: string;
  status: string;
  owner_user_id: string | null;
  owner_display_name?: string;
  target_date: string | null;
  module_instance_id: string;
  created_at: string;
}

interface Organisation {
  id: string;
  name: string;
  branding_logo_path?: string | null;
}

interface BuildPdfOptions {
  document: Document;
  moduleInstances: ModuleInstance[];
  actions: Action[];
  organisation: Organisation;
  renderMode?: 'preview' | 'issued';
  selectedModules?: string[];
}

export async function buildReSurveyPdf(options: BuildPdfOptions): Promise<Uint8Array> {
  console.log('[PDF RE Survey] Starting RE Survey PDF build');
  const { document, moduleInstances, actions, organisation, renderMode, selectedModules } = options;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const isIssuedMode = renderMode === 'issued';
  const isDraft = !isIssuedMode;
  const totalPages: PDFPage[] = [];

  console.log('[PDF RE Survey] Render mode:', isIssuedMode ? 'ISSUED' : 'DRAFT');

  if (isIssuedMode) {
    console.log('[PDF RE Survey] Adding issued report pages (cover + doc control)');
    const { coverPage, docControlPage } = await addIssuedReportPages({
      pdfDoc,
      document: {
        id: document.id,
        title: document.title,
        document_type: 'RE',
        version_number: (document as any).version_number || document.version || 1,
        issue_date: (document as any).issue_date || new Date().toISOString(),
        issue_status: 'issued',
        assessor_name: document.assessor_name,
        base_document_id: (document as any).base_document_id,
      },
      organisation: {
        id: organisation.id,
        name: organisation.name,
        branding_logo_path: organisation.branding_logo_path,
      },
      client: {
        name: document.responsible_person,
        site: document.scope_description,
      },
      fonts: { bold: fontBold, regular: font },
    });
    totalPages.push(coverPage, docControlPage);
  } else {
    // Draft mode: simple cover page
    const { page } = addNewPage(pdfDoc, isDraft, totalPages);
    let yPosition = PAGE_HEIGHT - MARGIN - 20;

    page.drawText('Risk Engineering Survey Report', {
      x: MARGIN,
      y: yPosition,
      size: 18,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 40;

    const titleLines = wrapText(document.title, CONTENT_WIDTH, 14, fontBold);
    for (const line of titleLines) {
      page.drawText(line, {
        x: MARGIN,
        y: yPosition,
        size: 14,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;
    }

    yPosition -= 20;

    page.drawText(`Version ${document.version}.0 - DRAFT`, {
      x: MARGIN,
      y: yPosition,
      size: 11,
      font: font,
      color: rgb(0.7, 0, 0),
    });

    yPosition -= 30;

    page.drawText(`Organisation: ${organisation.name}`, {
      x: MARGIN,
      y: yPosition,
      size: 10,
      font: font,
      color: rgb(0, 0, 0),
    });

    yPosition -= 15;

    if (document.assessor_name) {
      page.drawText(`Assessor: ${document.assessor_name}`, {
        x: MARGIN,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0, 0, 0),
      });
    }
  }

  // Add executive summary if configured
  addExecutiveSummaryPages(
    pdfDoc,
    isDraft,
    totalPages,
    (document.executive_summary_mode as 'ai' | 'author' | 'both' | 'none') || 'none',
    document.executive_summary_ai,
    document.executive_summary_author,
    { bold: fontBold, regular: font }
  );

  // Add module sections
  const modulesToInclude = selectedModules
    ? moduleInstances.filter(m => selectedModules.includes(m.module_key))
    : moduleInstances;

  for (const module of modulesToInclude) {
    const { page } = addNewPage(pdfDoc, isDraft, totalPages);
    let yPosition = PAGE_HEIGHT - MARGIN - 20;

    page.drawText(module.module_key, {
      x: MARGIN,
      y: yPosition,
      size: 16,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    yPosition -= 30;

    if (module.assessor_notes) {
      const lines = wrapText(module.assessor_notes, CONTENT_WIDTH, 10, font);
      for (const line of lines) {
        if (yPosition < MARGIN + 40) {
          const { page: newPage } = addNewPage(pdfDoc, isDraft, totalPages);
          yPosition = PAGE_HEIGHT - MARGIN - 20;
          newPage.drawText(line, {
            x: MARGIN,
            y: yPosition,
            size: 10,
            font: font,
            color: rgb(0, 0, 0),
          });
        } else {
          page.drawText(line, {
            x: MARGIN,
            y: yPosition,
            size: 10,
            font: font,
            color: rgb(0, 0, 0),
          });
        }
        yPosition -= 14;
      }
    }
  }

  // Add recommendations section
  drawRecommendationsSection(
    pdfDoc,
    actions as any[],
    { bold: fontBold, regular: font },
    isDraft,
    totalPages
  );

  // Add footers
  for (let i = 0; i < totalPages.length; i++) {
    drawFooter(totalPages[i], document.title, i + 1, totalPages.length, font);
  }

  // Add superseded watermark if needed
  if ((document as any).issue_status === 'superseded') {
    await addSupersededWatermark(pdfDoc);
  }

  const pdfBytes = await pdfDoc.save();
  console.log('[PDF RE Survey] PDF build complete');
  return pdfBytes;
}
