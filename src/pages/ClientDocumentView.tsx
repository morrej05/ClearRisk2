import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Download, AlertCircle, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getExternalLink, getClientVisibleDocument } from '../utils/clientAccess';
import { buildFraPdf } from '../lib/pdf/buildFraPdf';
import { buildFsdPdf } from '../lib/pdf/buildFsdPdf';
import { buildDsearPdf } from '../lib/pdf/buildDsearPdf';
import { saveAs } from 'file-saver';

interface Document {
  id: string;
  title: string;
  document_type: string;
  version_number: number;
  issue_date: string;
  issue_status: string;
  assessment_date: string;
  review_date: string | null;
  assessor_name: string | null;
  assessor_role: string | null;
  responsible_person: string | null;
  scope_description: string | null;
  organisation_id: string;
}

export default function ClientDocumentView() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    loadDocument();
  }, [token]);

  const loadDocument = async () => {
    if (!token) {
      setError('Invalid link');
      setIsLoading(false);
      return;
    }

    try {
      const linkData = await getExternalLink(token);

      if (!linkData) {
        setError('This link is invalid, expired, or has been revoked.');
        setIsLoading(false);
        return;
      }

      const clientDoc = await getClientVisibleDocument(linkData.base_document_id);

      if (!clientDoc) {
        setError('Document not yet issued. Please check back later.');
        setIsLoading(false);
        return;
      }

      const { data: fullDoc, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', clientDoc.id)
        .single();

      if (docError) throw docError;

      setDocument(fullDoc);
    } catch (err) {
      console.error('Error loading document:', err);
      setError('Failed to load document. Please contact support.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!document) return;

    setIsGeneratingPdf(true);

    try {
      const { data: modules, error: moduleError } = await supabase
        .from('module_instances')
        .select('*')
        .eq('document_id', document.id)
        .order('display_order', { ascending: true });

      if (moduleError) throw moduleError;

      const { data: actions, error: actionError } = await supabase
        .from('actions')
        .select('*')
        .eq('document_id', document.id)
        .eq('is_deleted', false)
        .order('priority', { ascending: true });

      if (actionError) throw actionError;

      const { data: org, error: orgError } = await supabase
        .from('organisations')
        .select('*')
        .eq('id', document.organisation_id)
        .single();

      if (orgError) throw orgError;

      let pdfBytes: Uint8Array;

      const buildOptions = {
        document,
        moduleInstances: modules || [],
        actions: actions || [],
        actionRatings: {},
        organisation: org,
      };

      if (document.document_type === 'FRA') {
        pdfBytes = await buildFraPdf(buildOptions);
      } else if (document.document_type === 'FSD') {
        pdfBytes = await buildFsdPdf(buildOptions);
      } else if (document.document_type === 'DSEAR') {
        pdfBytes = await buildDsearPdf(buildOptions);
      } else {
        throw new Error('Unsupported document type');
      }

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const filename = `${document.title.replace(/[^a-z0-9]/gi, '_')}_v${document.version_number}.pdf`;
      saveAs(blob, filename);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">
            {error ? 'Access Error' : 'Document Not Found'}
          </h1>
          <p className="text-neutral-600 mb-6">
            {error || 'The document you are looking for could not be found.'}
          </p>
          <button
            onClick={() => window.close()}
            className="px-6 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-neutral-900">Document Viewer</h1>
          </div>
          <button
            onClick={handleDownload}
            disabled={isGeneratingPdf}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-md border border-neutral-200 p-8">
          <div className="mb-6 pb-6 border-b border-neutral-200">
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">{document.title}</h2>
            <div className="flex items-center gap-4 text-sm text-neutral-600">
              <span className="inline-flex px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                {document.document_type}
              </span>
              <span className="inline-flex px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                Version {document.version_number}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <p className="text-sm font-medium text-neutral-500 mb-1">Issue Date</p>
              <p className="text-neutral-900">
                {new Date(document.issue_date).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500 mb-1">Assessment Date</p>
              <p className="text-neutral-900">
                {new Date(document.assessment_date).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            {document.assessor_name && (
              <div>
                <p className="text-sm font-medium text-neutral-500 mb-1">Assessor</p>
                <p className="text-neutral-900">{document.assessor_name}</p>
                {document.assessor_role && (
                  <p className="text-sm text-neutral-600">{document.assessor_role}</p>
                )}
              </div>
            )}
            {document.responsible_person && (
              <div>
                <p className="text-sm font-medium text-neutral-500 mb-1">Responsible Person</p>
                <p className="text-neutral-900">{document.responsible_person}</p>
              </div>
            )}
          </div>

          {document.scope_description && (
            <div className="mb-6">
              <p className="text-sm font-medium text-neutral-500 mb-2">Scope</p>
              <p className="text-neutral-700 whitespace-pre-wrap">{document.scope_description}</p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <ExternalLink className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-900 mb-1">Issued Document</p>
                <p className="text-sm text-blue-800">
                  This is the officially issued version {document.version_number} of this document.
                  Click the "Download PDF" button above to save a copy to your device.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
