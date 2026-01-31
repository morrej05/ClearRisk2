import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, FileText, Calendar, User, CheckCircle, AlertCircle, Clock, FileDown, Edit3, AlertTriangle, Image, List, FileCheck, Shield, Package, Trash2, PlayCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getModuleName } from '../../lib/modules/moduleCatalog';
import { buildFraPdf } from '../../lib/pdf/buildFraPdf';
import { buildFsdPdf } from '../../lib/pdf/buildFsdPdf';
import { buildDsearPdf } from '../../lib/pdf/buildDsearPdf';
import { buildCombinedPdf } from '../../lib/pdf/buildCombinedPdf';
import { saveAs } from 'file-saver';
import { withTimeout, isTimeoutError } from '../../utils/withTimeout';
import { getAssessmentShortName } from '../../utils/displayNames';
import VersionStatusBanner from '../../components/documents/VersionStatusBanner';
import IssueDocumentModal from '../../components/documents/IssueDocumentModal';
import CreateNewVersionModal from '../../components/documents/CreateNewVersionModal';
import VersionHistoryModal from '../../components/documents/VersionHistoryModal';
import ApprovalManagementModal from '../../components/documents/ApprovalManagementModal';
import ApprovalStatusBadge from '../../components/documents/ApprovalStatusBadge';
import ClientAccessModal from '../../components/documents/ClientAccessModal';
import EditLockBanner from '../../components/EditLockBanner';
import ChangeSummaryPanel from '../../components/documents/ChangeSummaryPanel';
import DraftCompletenessBanner from '../../components/documents/DraftCompletenessBanner';
import type { ApprovalStatus } from '../../utils/approvalWorkflow';
import { getLockedPdfInfo, downloadLockedPdf } from '../../utils/pdfLocking';
import { canShareWithClients, canUseApprovalWorkflow } from '../../utils/entitlements';
import {
  getDefencePack,
  buildDefencePack,
  downloadDefencePack,
  formatFileSize,
  type DefencePack,
} from '../../utils/defencePack';
import { Button, Badge, Card, Callout, PageHeader } from '../../components/ui/DesignSystem';

interface Document {
  id: string;
  document_type: string;
  enabled_modules?: string[];
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
  standards_selected: string[];
  created_at: string;
  updated_at: string;
  base_document_id: string;
  version_number: number;
  issue_status: 'draft' | 'issued' | 'superseded';
  issue_date: string | null;
  issued_by: string | null;
  superseded_by_document_id: string | null;
  superseded_date: string | null;
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approval_date: string | null;
  approval_notes: string | null;
  locked_pdf_path: string | null;
  locked_pdf_generated_at: string | null;
  locked_pdf_size_bytes: number | null;
  locked_pdf_sha256: string | null;
  jurisdiction: string;
}

interface ModuleInstance {
  id: string;
  module_key: string;
  outcome: string | null;
  completed_at: string | null;
  updated_at: string;
}

export default function DocumentOverview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { organisation, user } = useAuth();
  const [document, setDocument] = useState<Document | null>(null);
  const SHOW_CHANGE_SUMMARY = true;
  const [modules, setModules] = useState<ModuleInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [documentNotFound, setDocumentNotFound] = useState(false);
  const [actionCounts, setActionCounts] = useState({ P1: 0, P2: 0, P3: 0, P4: 0 });
  const [totalActions, setTotalActions] = useState(0);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [showVersionHistoryModal, setShowVersionHistoryModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showClientAccessModal, setShowClientAccessModal] = useState(false);
  const [defencePack, setDefencePack] = useState<DefencePack | null>(null);
  const [isBuildingDefencePack, setIsBuildingDefencePack] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const returnToPath = (location.state as any)?.returnTo || null;

  const getDashboardRoute = () => {
    if (returnToPath === '/dashboard/actions') {
      return '/dashboard/actions';
    }

    const fromParam = searchParams.get('from');
    const pathToCheck = returnToPath || fromParam;

    const legacyPaths = ['/common-dashboard', '/dashboard/fire', '/dashboard/explosion', '/legacy-dashboard'];
    if (pathToCheck && legacyPaths.includes(pathToCheck)) {
      return '/dashboard';
    }

    if (returnToPath) {
      return returnToPath;
    }

    if (fromParam) {
      return fromParam;
    }

    return '/dashboard';
  };

  useEffect(() => {
    if (id && organisation?.id) {
      fetchDocument();
      fetchModules();
      fetchActionCounts();
      fetchEvidenceCount();
      fetchDefencePack();
    }
  }, [id, organisation?.id]);

  const fetchDocument = async () => {
    if (!id || !organisation?.id) return;

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .eq('organisation_id', organisation.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setDocument(null);
        setDocumentNotFound(true);
        setIsLoading(false);
        return;
      }

      setDocument(data);
      setDocumentNotFound(false);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching document:', error);
      setDocument(null);
      setDocumentNotFound(true);
      setIsLoading(false);
    }
  };

  const fetchModules = async () => {
    if (!id || !organisation?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('module_instances')
        .select('*')
        .eq('document_id', id)
        .eq('organisation_id', organisation.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setModules(data || []);
    } catch (error) {
      console.error('Error fetching modules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActionCounts = async () => {
    if (!id || !organisation?.id) return;

    try {
      const { data, error } = await supabase
        .from('actions')
        .select('priority_band, status')
        .eq('document_id', id)
        .eq('organisation_id', organisation.id)
        .eq('status', 'open')
        .is('deleted_at', null);

      if (error) throw error;

      const counts = { P1: 0, P2: 0, P3: 0, P4: 0 };
      (data || []).forEach((action) => {
        if (action.priority_band && action.priority_band in counts) {
          counts[action.priority_band as keyof typeof counts]++;
        }
      });

      setActionCounts(counts);
      setTotalActions((data || []).length);
    } catch (error) {
      console.error('Error fetching action counts:', error);
    }
  };

  const fetchEvidenceCount = async () => {
    if (!id || !organisation) return;

    try {
      const { count, error } = await supabase
        .from('attachments')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', id)
        .eq('organisation_id', organisation.id);

      if (error) throw error;
      setEvidenceCount(count || 0);
    } catch (error) {
      console.error('Error fetching evidence count:', error);
    }
  };

  const fetchDefencePack = async () => {
    if (!id) return;

    try {
      const pack = await getDefencePack(id);
      setDefencePack(pack);
    } catch (error) {
      console.error('Error fetching defence pack:', error);
    }
  };

  const handleBuildDefencePack = async () => {
    if (!id) return;

    setIsBuildingDefencePack(true);
    try {
      const result = await buildDefencePack(id);

      if (result.success) {
        setDefencePack(result.pack || null);
        alert('Defence pack created successfully!');
      } else {
        alert(result.error || 'Failed to create defence pack');
      }
    } catch (error: any) {
      console.error('Error building defence pack:', error);
      alert(error.message || 'Failed to create defence pack');
    } finally {
      setIsBuildingDefencePack(false);
    }
  };

const handleDownloadDefencePack = async () => {
  if (!defencePack) return;

  try {
    if (!document?.id) return;

    const filename = `defence_pack_${(document.title || '').replace(/[^a-z0-9]/gi, '_')}_v${document.version_number}.zip`;
    const result = await downloadDefencePack(document.id, filename);

    if (!result.success) {
      alert(result.error || 'Failed to download defence pack');
    }
  } catch (error: any) {
    console.error('Error downloading defence pack:', error);
    alert(error.message || 'Failed to download defence pack');
  }
};


  const getOutcomeBadgeVariant = (outcome: string | null): 'neutral' | 'risk-low' | 'risk-medium' | 'risk-high' | 'info' => {
    switch (outcome) {
      case 'compliant':
      case 'satisfactory':
        return 'risk-low';
      case 'minor_def':
        return 'risk-medium';
      case 'material_def':
        return 'risk-high';
      case 'info_gap':
        return 'info';
      default:
        return 'neutral';
    }
  };

  const getOutcomeLabel = (outcome: string | null) => {
    switch (outcome) {
      case 'compliant':
        return 'Compliant';
      case 'satisfactory':
        return 'Satisfactory';
      case 'minor_def':
        return 'Minor Deficiency';
      case 'material_def':
        return 'Material Deficiency';
      case 'info_gap':
        return 'Information Gap';
      case 'na':
        return 'Not Applicable';
      default:
        return 'Pending';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadgeVariant = (status: string): 'neutral' | 'success' | 'warning' => {
    switch (status) {
      case 'issued':
        return 'success';
      case 'superseded':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const handleIssueSuccess = () => {
    fetchDocument();
  };

  const handleNewVersionSuccess = (newDocumentId: string, newVersionNumber: number) => {
    navigate(`/documents/${newDocumentId}`);
  };

  const handleNavigateToVersion = (documentId: string) => {
    navigate(`/documents/${documentId}`);
  };

  // Save last visited module to localStorage
  const saveLastVisitedModule = (moduleId: string) => {
    if (id) {
      localStorage.setItem(`ezirisk:lastModule:${id}`, moduleId);
    }
  };

  // Get last visited module from localStorage
  const getLastVisitedModule = (): string | null => {
    if (id) {
      return localStorage.getItem(`ezirisk:lastModule:${id}`);
    }
    return null;
  };

  const handleContinueAssessment = () => {
    if (!id) return;

    // Find first incomplete REQUIRED module
    const firstIncomplete = modules.find(m => !m.completed_at);

    if (firstIncomplete) {
      // Don't save to localStorage - let workspace save it when loaded
      // This keeps Continue and Open Workspace destinations separate
      navigate(`/documents/${id}/workspace?m=${firstIncomplete.id}`, {
        state: { returnTo: `/documents/${id}` }
      });
    } else {
      // All modules complete, go to last visited or first module
      const lastVisited = getLastVisitedModule();
      const targetModule = lastVisited && modules.find(m => m.id === lastVisited)
        ? lastVisited
        : modules[0]?.id;

      if (targetModule) {
        navigate(`/documents/${id}/workspace?m=${targetModule}`, {
          state: { returnTo: `/documents/${id}` }
        });
      }
    }
  };

  const handleOpenWorkspace = () => {
    if (!id) return;

    // Check last visited module first, or fall back to first module
    const lastVisited = getLastVisitedModule();
    const targetModule = lastVisited && modules.find(m => m.id === lastVisited)
      ? lastVisited
      : modules[0]?.id;

    if (targetModule) {
      // Don't save to localStorage - let workspace save it when loaded
      navigate(`/documents/${id}/workspace?m=${targetModule}`, {
        state: { returnTo: `/documents/${id}` }
      });
    } else {
      navigate(`/documents/${id}/workspace`, {
        state: { returnTo: `/documents/${id}` }
      });
    }
  };

  const handleDeleteDocument = async () => {
    if (!id || !user?.id || !organisation?.id) return;

    setIsDeleting(true);
    try {
      // Only allow deleting draft documents
      if (document?.issue_status !== 'draft') {
        alert('Only draft documents can be deleted');
        return;
      }

      // Soft delete: set deleted_at and deleted_by
      const { error } = await supabase
        .from('documents')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id
        })
        .eq('id', id)
        .eq('organisation_id', organisation.id)
        .eq('issue_status', 'draft');

      if (error) {
        console.error('Error deleting document:', error);
        throw new Error(error.message || 'Failed to delete document');
      }

      // Navigate back to dashboard
      navigate(getDashboardRoute(), { replace: true });
    } catch (error: any) {
      console.error('Error deleting document:', error);
      alert(error.message || 'Failed to delete document');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!id || !document || !organisation) return;

setIsGeneratingPdf(true);
try {
  console.log('[PDF Download] Document status:', document.issue_status);
  const pdfInfo = await getLockedPdfInfo(id);

  // If document has a pre-generated locked PDF, open it via signed URL
  if (document.issue_status !== 'draft' && pdfInfo?.locked_pdf_path) {
    console.log('[PDF Download] Found locked PDF, requesting signed URL for document:', id);

    const downloadResult = await downloadLockedPdf(id);

    if (downloadResult.success && downloadResult.signedUrl) {
      console.log('[PDF Download] Opening signed URL in new tab');
      window.open(downloadResult.signedUrl, '_blank', 'noopener,noreferrer');
      setIsGeneratingPdf(false);
      return;
    }

    console.warn('[PDF Download] Failed to get signed URL, falling back to regeneration:', downloadResult.error);
  } else if (document.issue_status !== 'draft') {
    console.log('[PDF Download] No locked PDF found for issued document, generating on-demand');
  }

      const { data: moduleInstances, error: moduleError } = await supabase
        .from('module_instances')
        .select('*')
        .eq('document_id', id)
        .eq('organisation_id', organisation.id);

      if (moduleError) throw moduleError;

      const { data: actions, error: actionsError } = await supabase
        .from('actions')
        .select('*')
        .eq('document_id', id)
        .eq('organisation_id', organisation.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (actionsError) throw actionsError;

      const actionIds = (actions || []).map(a => a.id);
      let actionRatings = [];
      if (actionIds.length > 0) {
        const { data: ratings } = await supabase
          .from('action_ratings')
          .select('action_id, likelihood, impact, score, rated_at')
          .in('action_id', actionIds)
          .order('rated_at', { ascending: false });

        actionRatings = ratings || [];
      }

      const pdfOptions = {
        document,
        moduleInstances: moduleInstances || [],
        actions: actions || [],
        actionRatings,
        organisation: { id: organisation.id, name: organisation.name, branding_logo_path: organisation.branding_logo_path },
        renderMode: (document.issue_status === 'issued' || document.issue_status === 'superseded') ? 'issued' as const : 'preview' as const,
      };

      console.log('[PDF Download] Starting PDF generation');
      console.log('[PDF Download] Document type:', document.document_type);
      console.log('[PDF Download] Render mode:', pdfOptions.renderMode);

      let pdfBytes;
      const enabledModules = document.enabled_modules || [document.document_type];
      const isCombined = enabledModules.length > 1 &&
                         enabledModules.includes('FRA') &&
                         enabledModules.includes('FSD');

      console.log('[PDF Download] Enabled modules:', enabledModules);
      console.log('[PDF Download] Is combined:', isCombined);

      const PDF_GENERATION_TIMEOUT = 30000;

      try {
        if (isCombined) {
          console.log('[PDF Download] Building combined FRA+FSD PDF');
          pdfBytes = await withTimeout(
            buildCombinedPdf(pdfOptions),
            PDF_GENERATION_TIMEOUT,
            'Combined PDF generation timed out after 30 seconds'
          );
        } else if (document.document_type === 'FSD') {
          console.log('[PDF Download] Building FSD PDF');
          pdfBytes = await withTimeout(
            buildFsdPdf(pdfOptions),
            PDF_GENERATION_TIMEOUT,
            'FSD PDF generation timed out after 30 seconds'
          );
        } else if (document.document_type === 'DSEAR') {
          console.log('[PDF Download] Building DSEAR PDF');
          pdfBytes = await withTimeout(
            buildDsearPdf(pdfOptions),
            PDF_GENERATION_TIMEOUT,
            'DSEAR PDF generation timed out after 30 seconds'
          );
        } else {
          console.log('[PDF Download] Building FRA PDF');
          pdfBytes = await withTimeout(
            buildFraPdf(pdfOptions),
            PDF_GENERATION_TIMEOUT,
            'FRA PDF generation timed out after 30 seconds'
          );
        }

        console.log('[PDF Download] PDF generation complete, size:', pdfBytes.length, 'bytes');
        console.log('[PDF Download] Generated for', document.issue_status === 'issued' ? 'ISSUED' : 'DRAFT', 'document');

        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const siteName = document.title
          .replace(/[^a-z0-9]/gi, '_')
          .replace(/_+/g, '_')
          .toLowerCase();
        const dateStr = new Date(document.assessment_date).toISOString().split('T')[0];
        const docType = document.document_type || 'FRA';
        const filename = `${docType}_${siteName}_${dateStr}_v${document.version_number}.pdf`;

        console.log('[PDF Download] Downloading file:', filename);
        saveAs(blob, filename);
        console.log('[PDF Download] Download complete');
      } catch (pdfError) {
        if (isTimeoutError(pdfError)) {
          console.error('[PDF Download] PDF generation timed out');
          throw new Error('PDF generation timed out. Please try again or contact support if this persists.');
        }
        throw pdfError;
      }
    } catch (error) {
      console.error('[PDF Download] Error generating PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to generate PDF: ${errorMessage}`);
    } finally {
      console.log('[PDF Download] Resetting UI state');
      setIsGeneratingPdf(false);
    }
  };

  const completedModules = modules.filter((m) => m.outcome !== null || m.completed_at !== null).length;
  const totalModules = modules.length;
  const completionPercentage = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
  const firstIncomplete = modules.find(m => !m.completed_at);

  if (documentNotFound) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="max-w-md mx-auto text-center">
          <div className="mb-4">
            <AlertCircle className="w-12 h-12 text-amber-600 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">Document Not Found</h2>
          <p className="text-neutral-600 mb-6">
            This document doesn't exist or you don't have permission to access it.
          </p>
          <Button onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading || !document) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-neutral-200 border-t-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Navigation */}
        <div className="mb-6">
          <button
            onClick={() => navigate(getDashboardRoute())}
            className={`flex items-center gap-2 font-medium transition-colors ${
              returnToPath === '/dashboard/actions'
                ? 'text-blue-600 hover:text-blue-700'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {returnToPath === '/dashboard/actions' ? (
              <>
                <List className="w-4 h-4" />
                Actions Register
              </>
            ) : (
              <>
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </>
            )}
          </button>
        </div>

        {/* Status Banners */}
        <VersionStatusBanner
          versionNumber={document.version_number}
          issueStatus={document.issue_status}
          issueDate={document.issue_date}
          supersededByDocumentId={document.superseded_by_document_id}
        />

        {document.issue_status !== 'draft' && (
          <EditLockBanner
            issueStatus={document.issue_status}
            supersededByDocumentId={document.superseded_by_document_id}
            onNavigateToSuccessor={() => {
              if (document.superseded_by_document_id) {
                navigate(`/documents/${document.superseded_by_document_id}`);
              }
            }}
            className="mb-6"
          />
        )}

        {SHOW_CHANGE_SUMMARY && document.issue_status === 'issued' && (
          <ChangeSummaryPanel
            documentId={id!}
            versionNumber={document.version_number}
            className="mb-6"
          />
        )}

        {['FRA', 'DSEAR', 'FSD'].includes(document.document_type) && organisation && (
          <DraftCompletenessBanner
            documentId={id!}
            issueStatus={document.issue_status}
            executiveSummaryMode={(document.executive_summary_mode as 'ai' | 'author' | 'both' | 'none') || 'ai'}
            executiveSummaryAi={document.executive_summary_ai}
            executiveSummaryAuthor={document.executive_summary_author}
            totalActions={totalActions}
            evidenceCount={evidenceCount}
            approvalStatus={document.approval_status}
            organisation={organisation}
            onGenerateAiSummary={() => navigate(`/documents/${id}`)}
            onAddAuthorCommentary={() => navigate(`/documents/${id}`)}
            onViewActions={() => navigate(`/documents/${id}`)}
            onAddEvidence={() => navigate(`/documents/${id}/evidence`)}
            onManageApproval={() => setShowApprovalModal(true)}
          />
        )}

        {/* Header Card */}
        <Card className="mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <FileText className="w-8 h-8 text-neutral-700" />
                <div>
                  <h1 className="text-2xl font-bold text-neutral-900">{document.title}</h1>
                  <div className="flex items-center gap-3 mt-1">
                    <Badge variant="info">
                      {getAssessmentShortName(document.document_type, document.jurisdiction)}
                    </Badge>
                    <Badge variant={getStatusBadgeVariant(document.issue_status)}>
                      {document.issue_status}
                    </Badge>
                    <span className="text-sm text-neutral-500">v{document.version_number}</span>
                    <ApprovalStatusBadge status={document.approval_status} size="sm" />
                  </div>
                </div>
              </div>

              {/* Key Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-neutral-200">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-neutral-400 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-neutral-500">Assessment Date</p>
                    <p className="text-sm text-neutral-900">{formatDate(document.assessment_date)}</p>
                  </div>
                </div>

                {document.assessor_name && (
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-neutral-400 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-neutral-500">Assessor</p>
                      <p className="text-sm text-neutral-900">{document.assessor_name}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-neutral-400 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-neutral-500">Last Updated</p>
                    <p className="text-sm text-neutral-900">{formatDate(document.updated_at)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Defence Pack Notice */}
          {defencePack && (
            <Callout variant="info" className="mt-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-blue-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Defence Pack Available</p>
                  <p className="text-xs text-neutral-600 mt-1">
                    Created {formatDate(defencePack.created_at)}
                    {defencePack.size_bytes && ` • ${formatFileSize(defencePack.size_bytes)}`}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={handleDownloadDefencePack}
                  className="text-sm"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </Callout>
          )}

          {document.locked_pdf_path && document.issue_status !== 'draft' && (
            <Callout variant="success" className="mt-4">
              <div className="flex items-center gap-3">
                <FileCheck className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">PDF Locked</p>
                  <p className="text-xs text-neutral-600 mt-1">
                    Issued {formatDate(document.locked_pdf_generated_at)}
                    {document.locked_pdf_size_bytes && ` • ${(document.locked_pdf_size_bytes / 1024).toFixed(0)} KB`}
                  </p>
                </div>
              </div>
            </Callout>
          )}
        </Card>

        {/* Next Steps Section - Only for Draft */}
        {document.issue_status === 'draft' && (
          <Card className="mb-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Next Steps</h2>

            {firstIncomplete ? (
              <Callout variant="info" className="mb-4">
                <div className="flex items-center gap-3">
                  <PlayCircle className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Resume Assessment</p>
                    <p className="text-xs text-neutral-600 mt-1">
                      Next incomplete module: {getModuleName(firstIncomplete.module_key)}
                    </p>
                  </div>
                  <Button onClick={handleContinueAssessment}>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Continue Assessment
                  </Button>
                </div>
              </Callout>
            ) : (
              <Callout variant="success" className="mb-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">All Modules Complete</p>
                    <p className="text-xs text-neutral-600 mt-1">
                      Ready for review and issue
                    </p>
                  </div>
                </div>
              </Callout>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="secondary" onClick={handleOpenWorkspace}>
                <Edit3 className="w-4 h-4 mr-2" />
                Open Workspace
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/documents/${id}/preview`)}>
                <FileText className="w-4 h-4 mr-2" />
                Preview Report
              </Button>
              {organisation && canUseApprovalWorkflow(organisation) && (
                <Button variant="secondary" onClick={() => setShowApprovalModal(true)}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Manage Approval
                </Button>
              )}
              <Button onClick={() => setShowIssueModal(true)}>
                <FileCheck className="w-4 h-4 mr-2" />
                Issue Document
              </Button>
            </div>
          </Card>
        )}

        {/* Quick Actions Section - For Issued */}
        {document.issue_status === 'issued' && (
          <Card className="mb-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Actions</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="secondary"
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf}
              >
                {isGeneratingPdf ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-neutral-400 border-t-transparent mr-2"></div>
                    Downloading...
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4 mr-2" />
                    Download PDF
                  </>
                )}
              </Button>
              {organisation && canShareWithClients(organisation) && (
                <Button variant="secondary" onClick={() => setShowClientAccessModal(true)}>
                  <FileText className="w-4 h-4 mr-2" />
                  Share with Clients
                </Button>
              )}
              <Button
                variant="secondary"
                disabled={true}
                title="Defence Pack export will be available post-launch"
              >
                <Shield className="w-4 h-4 mr-2" />
                Generate Defence Pack
                <Badge className="ml-2 text-xs bg-neutral-200 text-neutral-600">
                  Coming Soon
                </Badge>
              </Button>
              <Button onClick={() => setShowNewVersionModal(true)}>
                <FileText className="w-4 h-4 mr-2" />
                Create New Version
              </Button>
            </div>
          </Card>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <h3 className="text-sm font-medium text-neutral-500 uppercase mb-4">Module Progress</h3>
            <div className="mb-3">
              <div className="flex items-end justify-between mb-1">
                <span className="text-3xl font-semibold text-neutral-900">{completionPercentage}%</span>
                <span className="text-sm text-neutral-600">
                  {completedModules}/{totalModules}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-neutral-500 uppercase">Open Actions</h3>
              <button
                onClick={() => navigate(`/dashboard/actions?document=${id}`)}
                className="text-xs text-neutral-600 hover:text-neutral-900 font-medium flex items-center gap-1"
              >
                <List className="w-3 h-3" />
                View Register
              </button>
            </div>
            <div className="mb-3">
              <div className="text-3xl font-semibold text-neutral-900 mb-1">{totalActions}</div>
              <div className="text-sm text-neutral-600">Total open actions</div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center">
                <div className="text-lg font-semibold text-red-700">{actionCounts.P1}</div>
                <div className="text-xs text-neutral-500">P1</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-orange-700">{actionCounts.P2}</div>
                <div className="text-xs text-neutral-500">P2</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-amber-700">{actionCounts.P3}</div>
                <div className="text-xs text-neutral-500">P3</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-neutral-700">{actionCounts.P4}</div>
                <div className="text-xs text-neutral-500">P4</div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-medium text-neutral-500 uppercase mb-4">Quick Links</h3>
            <div className="space-y-2">
              <button
                onClick={() => navigate(`/documents/${id}/workspace`)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-neutral-50 transition-colors flex items-center gap-2 text-sm"
              >
                <Edit3 className="w-4 h-4 text-neutral-600" />
                <span className="text-neutral-900">Workspace</span>
              </button>
              <button
                onClick={() => navigate(`/documents/${id}/evidence`)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-neutral-50 transition-colors flex items-center gap-2 text-sm"
              >
                <Image className="w-4 h-4 text-neutral-600" />
                <span className="text-neutral-900">Evidence ({evidenceCount})</span>
              </button>
              <button
                onClick={() => navigate(`/documents/${id}/preview`)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-neutral-50 transition-colors flex items-center gap-2 text-sm"
              >
                <FileText className="w-4 h-4 text-neutral-600" />
                <span className="text-neutral-900">Preview Report</span>
              </button>
              <button
                onClick={() => setShowVersionHistoryModal(true)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-neutral-50 transition-colors flex items-center gap-2 text-sm"
              >
                <Clock className="w-4 h-4 text-neutral-600" />
                <span className="text-neutral-900">Version History</span>
              </button>
            </div>
          </Card>
        </div>

        {/* Modules List */}
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-900">Modules</h2>
            <p className="text-sm text-neutral-600 mt-1">
              Click on a module to open its workspace
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-neutral-200 border-t-red-600"></div>
            </div>
          ) : modules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <AlertCircle className="w-12 h-12 text-neutral-400 mb-3" />
              <p className="text-neutral-600">No modules found for this document</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-200">
              {modules.map((module) => (
                <div
                  key={module.id}
                  className="px-6 py-4 hover:bg-neutral-50 transition-colors cursor-pointer"
                  onClick={() => {
                    // Don't save here - workspace will save when loaded
                    navigate(`/documents/${id}/workspace?m=${module.id}`);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex-shrink-0">
                        {module.completed_at ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-neutral-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-neutral-900">
                          {getModuleName(module.module_key)}
                        </p>
                        {module.completed_at && (
                          <p className="text-xs text-neutral-500 mt-0.5">
                            Completed {formatDate(module.completed_at)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={getOutcomeBadgeVariant(module.outcome)}>
                        {getOutcomeLabel(module.outcome)}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Delete Draft Button */}
        {document.issue_status === 'draft' && (
          <div className="mt-6 flex justify-end">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteConfirm(true)}
              className="!text-red-600 hover:!text-red-700 hover:!bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Draft
            </Button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showIssueModal && user?.id && organisation?.id && (
        <IssueDocumentModal
          documentId={id!}
          documentTitle={document.title}
          userId={user.id}
          organisationId={organisation.id}
          onClose={() => setShowIssueModal(false)}
          onSuccess={handleIssueSuccess}
        />
      )}

      {showApprovalModal && user?.id && organisation?.id && (
        <ApprovalManagementModal
          documentId={id!}
          documentTitle={document.title}
          currentApprovalStatus={document.approval_status}
          approvalNotes={document.approval_notes}
          approvedBy={document.approved_by}
          approvalDate={document.approval_date}
          userId={user.id}
          organisationId={organisation.id}
          userRole={user.role || 'viewer'}
          onClose={() => setShowApprovalModal(false)}
          onSuccess={handleIssueSuccess}
        />
      )}

      {showClientAccessModal && user?.id && (
        <ClientAccessModal
          baseDocumentId={document.base_document_id}
          documentTitle={document.title}
          userId={user.id}
          issueStatus={document.issue_status}
          onClose={() => setShowClientAccessModal(false)}
        />
      )}

      {showNewVersionModal && user?.id && organisation?.id && (
        <CreateNewVersionModal
          baseDocumentId={document.base_document_id}
          currentVersion={document.version_number}
          documentTitle={document.title}
          userId={user.id}
          organisationId={organisation.id}
          onClose={() => setShowNewVersionModal(false)}
          onSuccess={handleNewVersionSuccess}
        />
      )}

      {showVersionHistoryModal && (
        <VersionHistoryModal
          baseDocumentId={document.base_document_id}
          currentDocumentId={id!}
          onClose={() => setShowVersionHistoryModal(false)}
          onNavigateToVersion={handleNavigateToVersion}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h2 className="text-xl font-bold text-neutral-900">Delete Draft Document</h2>
            </div>
            <p className="text-neutral-700 mb-6">
              Are you sure you want to delete this draft document? This action cannot be undone.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDocument}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
