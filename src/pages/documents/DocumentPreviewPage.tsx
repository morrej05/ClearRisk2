import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { buildFraPdf } from '../../lib/pdf/buildFraPdf';
import { buildFsdPdf } from '../../lib/pdf/buildFsdPdf';
import { buildDsearPdf } from '../../lib/pdf/buildDsearPdf';
import { downloadLockedPdf, getLockedPdfInfo } from '../../utils/pdfLocking';
import { saveAs } from 'file-saver';

export default function DocumentPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { organisation } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [document, setDocument] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('document.pdf');

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const formatFilename = (doc: any) => {
    const siteName = (doc.title || 'document')
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .toLowerCase();
    const dateStr = doc.assessment_date ? new Date(doc.assessment_date).toISOString().split('T')[0] : 'date';
    const docType = doc.document_type || 'DOC';
    const v = doc.version_number || doc.version || 1;
    return `${docType}_${siteName}_${dateStr}_v${v}.pdf`;
  };

  useEffect(() => {
    if (!id || !organisation?.id) return;

    const run = async () => {
      setIsLoading(true);
      setErrorMsg(null);

      try {
        const { data: doc, error: docErr } = await supabase
          .from('documents')
          .select('*')
          .eq('id', id)
          .eq('organisation_id', organisation.id)
          .maybeSingle();

        if (docErr) throw docErr;
        if (!doc) {
          setErrorMsg('Document not found or you do not have access.');
          setIsLoading(false);
          return;
        }

        setDocument(doc);
        const fname = formatFilename(doc);
        setFilename(fname);

        if (doc.issue_status !== 'draft') {
          const info = await getLockedPdfInfo(id);

          if (!info?.locked_pdf_path) {
            setErrorMsg('This document is issued but has no locked PDF. Please contact support.');
            setIsLoading(false);
            return;
          }

          const download = await downloadLockedPdf(info.locked_pdf_path);
          if (!download.success || !download.data) {
            throw new Error(download.error || 'Failed to download locked PDF');
          }

          const url = URL.createObjectURL(download.data);
          setPdfUrl(url);
          setIsLoading(false);
          return;
        }

        const { data: moduleInstances, error: moduleError } = await supabase
          .from('module_instances')
          .select('*')
          .eq('document_id', id)
          .eq('organisation_id', organisation.id);

        if (moduleError) throw moduleError;

        const { data: actions, error: actionsError } = await supabase
          .from('actions')
          .select(`
            id,
            recommended_action,
            priority_band,
            status,
            owner_user_id,
            target_date,
            module_instance_id,
            created_at
          `)
          .eq('document_id', id)
          .eq('organisation_id', organisation.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: true });

        if (actionsError) throw actionsError;

        const actionIds = (actions || []).map((a: any) => a.id);
        let actionRatings: any[] = [];
        if (actionIds.length > 0) {
          const { data: ratings } = await supabase
            .from('action_ratings')
            .select('action_id, likelihood, impact, score, rated_at')
            .in('action_id', actionIds)
            .order('rated_at', { ascending: false });

          actionRatings = ratings || [];
        }

        const ownerUserIds = (actions || []).map((a: any) => a.owner_user_id).filter(Boolean);
        const uniqueOwnerIds = [...new Set(ownerUserIds)];
        const userNameMap = new Map<string, string>();

        if (uniqueOwnerIds.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('user_id, name')
            .in('user_id', uniqueOwnerIds);

          (profiles || []).forEach((p: any) => {
            if (p?.name) userNameMap.set(p.user_id, p.name);
          });
        }

        const enrichedActions = (actions || []).map((a: any) => ({
          ...a,
          owner_display_name: a.owner_user_id ? userNameMap.get(a.owner_user_id) : null,
        }));

        const pdfOptions = {
          document: doc,
          moduleInstances: moduleInstances || [],
          actions: enrichedActions,
          actionRatings,
          organisation: { id: organisation.id, name: organisation.name },
        };

        let pdfBytes: Uint8Array;
        if (doc.document_type === 'FSD') pdfBytes = await buildFsdPdf(pdfOptions);
        else if (doc.document_type === 'DSEAR') pdfBytes = await buildDsearPdf(pdfOptions);
        else pdfBytes = await buildFraPdf(pdfOptions);

        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        setIsLoading(false);
      } catch (e: any) {
        console.error(e);
        setErrorMsg(e?.message || 'Failed to load preview.');
        setIsLoading(false);
      }
    };

    run();
  }, [id, organisation?.id]);

  const handleDownload = async () => {
    if (!pdfUrl) return;
    try {
      const res = await fetch(pdfUrl);
      const blob = await res.blob();
      saveAs(blob, filename);
    } catch (e) {
      alert('Failed to download preview PDF.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-neutral-300 border-t-neutral-900"></div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 font-medium mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <h1 className="text-lg font-bold text-neutral-900 mb-2">Preview unavailable</h1>
            <p className="text-neutral-700">{errorMsg}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <button
            onClick={handleDownload}
            disabled={!pdfUrl}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <FileDown className="w-4 h-4" />
            Download PDF
          </button>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden" style={{ height: '80vh' }}>
          {pdfUrl && (
            <iframe
              title="Document Preview"
              src={pdfUrl}
              className="w-full h-full"
            />
          )}
        </div>
      </div>
    </div>
  );
}
