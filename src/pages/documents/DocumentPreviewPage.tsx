import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileDown, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { buildFraPdf } from '../../lib/pdf/buildFraPdf';
import { buildFsdPdf } from '../../lib/pdf/buildFsdPdf';
import { buildDsearPdf } from '../../lib/pdf/buildDsearPdf';
import { buildCombinedPdf } from '../../lib/pdf/buildCombinedPdf';
import { downloadLockedPdf, getLockedPdfInfo } from '../../utils/pdfLocking';
import { saveAs } from 'file-saver';
import { SurveyBadgeRow } from '../../components/SurveyBadgeRow';

type OutputMode = 'FRA' | 'FSD' | 'DSEAR' | 'COMBINED';

export default function DocumentPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { organisation } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [document, setDocument] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('document.pdf');
  const [outputMode, setOutputMode] = useState<OutputMode>('FRA');
  const [availableModes, setAvailableModes] = useState<OutputMode[]>(['FRA']);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const getAvailableOutputModes = (doc: any): OutputMode[] => {
    const enabledModules = doc.enabled_modules || [doc.document_type];
    const modes: OutputMode[] = [];

    if (enabledModules.includes('FRA')) modes.push('FRA');
    if (enabledModules.includes('FSD')) modes.push('FSD');
    if (enabledModules.includes('DSEAR')) modes.push('DSEAR');

    if (enabledModules.length > 1 && (enabledModules.includes('FRA') && enabledModules.includes('FSD'))) {
      modes.push('COMBINED');
    }

    return modes.length > 0 ? modes : [doc.document_type as OutputMode];
  };

  const getDefaultOutputMode = (doc: any): OutputMode => {
    const enabledModules = doc.enabled_modules || [doc.document_type];

    if (enabledModules.length > 1 && enabledModules.includes('FRA') && enabledModules.includes('FSD')) {
      return 'COMBINED';
    }

    return enabledModules[0] as OutputMode;
  };

  const formatFilename = (doc: any, mode: OutputMode) => {
    const siteName = (doc.title || 'document')
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .toLowerCase();
    const dateStr = doc.assessment_date ? new Date(doc.assessment_date).toISOString().split('T')[0] : 'date';
    const docType = mode === 'COMBINED' ? 'COMBINED' : (doc.document_type || 'DOC');
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

        const modes = getAvailableOutputModes(doc);
        setAvailableModes(modes);

        const defaultMode = getDefaultOutputMode(doc);
        setOutputMode(defaultMode);

        const fname = formatFilename(doc, defaultMode);
        setFilename(fname);

        // Load module and action data for PDF generation
        let moduleInstances: any[] = [];
        let enrichedActions: any[] = [];
        let actionRatings: any[] = [];

        if (doc.issue_status !== 'draft') {
          // For issued documents, load from live tables for preview
          // Note: The locked PDF is the source of truth, but this preview allows
          // viewing different output modes (FRA, FSD, Combined) on-the-fly
          const { data: modules } = await supabase
            .from('module_instances')
            .select('*')
            .eq('document_id', id)
            .eq('organisation_id', organisation.id);

          moduleInstances = modules || [];

          const { data: actions } = await supabase
            .from('actions')
            .select(`*`)
            .eq('document_id', id)
            .eq('organisation_id', organisation.id)
            .is('deleted_at', null);

          enrichedActions = actions || [];
        } else {
          // Draft document: load live data
          const { data: modules, error: moduleError } = await supabase
            .from('module_instances')
            .select('*')
            .eq('document_id', id)
            .eq('organisation_id', organisation.id);

          if (moduleError) throw moduleError;
          moduleInstances = modules || [];

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

          enrichedActions = (actions || []).map((a: any) => ({
            ...a,
            owner_display_name: a.owner_user_id ? userNameMap.get(a.owner_user_id) : null,
          }));
        }

        const pdfOptions = {
          document: doc,
          moduleInstances: moduleInstances || [],
          actions: enrichedActions,
          actionRatings,
          organisation: { id: organisation.id, name: organisation.name },
        };

        let pdfBytes: Uint8Array;
        if (defaultMode === 'COMBINED') {
          pdfBytes = await buildCombinedPdf(pdfOptions);
        } else if (defaultMode === 'FSD') {
          pdfBytes = await buildFsdPdf(pdfOptions);
        } else if (defaultMode === 'DSEAR') {
          pdfBytes = await buildDsearPdf(pdfOptions);
        } else {
          pdfBytes = await buildFraPdf(pdfOptions);
        }

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

  useEffect(() => {
    if (!document || !organisation?.id) return;

    const regeneratePdf = async () => {
      try {
        let moduleInstances: any[] = [];
        let enrichedActions: any[] = [];
        let actionRatings: any[] = [];

        if (document.issue_status !== 'draft') {
          // For issued documents, load from live tables for preview
          const { data: modules } = await supabase
            .from('module_instances')
            .select('*')
            .eq('document_id', document.id)
            .eq('organisation_id', organisation.id);

          moduleInstances = modules || [];

          const { data: actions } = await supabase
            .from('actions')
            .select(`*`)
            .eq('document_id', document.id)
            .eq('organisation_id', organisation.id)
            .is('deleted_at', null);

          enrichedActions = actions || [];
        } else {
          // Load live data for draft documents
          const { data: modules, error: moduleError } = await supabase
            .from('module_instances')
            .select('*')
            .eq('document_id', document.id)
            .eq('organisation_id', organisation.id);

          if (moduleError) throw moduleError;
          moduleInstances = modules || [];

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
            .eq('document_id', document.id)
            .eq('organisation_id', organisation.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: true });

          if (actionsError) throw actionsError;

          const actionIds = (actions || []).map((a: any) => a.id);
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

          enrichedActions = (actions || []).map((a: any) => ({
            ...a,
            owner_display_name: a.owner_user_id ? userNameMap.get(a.owner_user_id) : null,
          }));
        }

        const pdfOptions = {
          document: document,
          moduleInstances: moduleInstances || [],
          actions: enrichedActions,
          actionRatings,
          organisation: { id: organisation.id, name: organisation.name },
        };

        let pdfBytes: Uint8Array;
        if (outputMode === 'COMBINED') {
          pdfBytes = await buildCombinedPdf(pdfOptions);
        } else if (outputMode === 'FSD') {
          pdfBytes = await buildFsdPdf(pdfOptions);
        } else if (outputMode === 'DSEAR') {
          pdfBytes = await buildDsearPdf(pdfOptions);
        } else {
          pdfBytes = await buildFraPdf(pdfOptions);
        }

        if (pdfUrl) URL.revokeObjectURL(pdfUrl);

        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        setFilename(formatFilename(document, outputMode));
      } catch (e: any) {
        console.error('[PDF Regeneration Error]', e);
      }
    };

    regeneratePdf();
  }, [outputMode]);

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

          <div className="flex items-center gap-4">
            <button
              onClick={handleDownload}
              disabled={!pdfUrl}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        </div>

        {document && (
          <div className="mb-4">
            <SurveyBadgeRow
              status={document.issue_status as 'draft' | 'in_review' | 'approved' | 'issued'}
              jurisdiction={document.jurisdiction as 'UK' | 'IE'}
              enabledModules={document.enabled_modules}
            />
          </div>
        )}

        {document && document.issue_status !== 'draft' && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-blue-900 mb-1">
                Issued v{document.version_number || document.version} (Immutable)
              </h3>
              <p className="text-sm text-blue-700">
                This is a locked revision. The content cannot be edited. Create a new revision to make changes.
              </p>
            </div>
          </div>
        )}

        {availableModes.length > 1 && (
          <div className="mb-4 bg-white border border-neutral-200 rounded-lg p-4">
            <label htmlFor="outputMode" className="block text-sm font-semibold text-neutral-900 mb-2">
              Output Mode
            </label>
            <select
              id="outputMode"
              value={outputMode}
              onChange={(e) => setOutputMode(e.target.value as OutputMode)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {availableModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode === 'COMBINED' ? 'Combined FRA + FSD Report' : `${mode} Report Only`}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-neutral-600">
              {outputMode === 'COMBINED'
                ? 'Viewing combined report with both FRA and FSD sections.'
                : `Viewing ${outputMode} report only.`}
            </p>
          </div>
        )}

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
