import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, FileText, Calendar, User, CheckCircle, AlertCircle, Clock, FileDown, Edit3, AlertTriangle, Image, List, FileCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getModuleName } from '../../lib/modules/moduleCatalog';
import { buildFraPdf } from '../../lib/pdf/buildFraPdf';
import { buildFsdPdf } from '../../lib/pdf/buildFsdPdf';
import { buildDsearPdf } from '../../lib/pdf/buildDsearPdf';
import { saveAs } from 'file-saver';
import IssueDocumentModal from '../../components/IssueDocumentModal';

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
  standards_selected: string[];
  created_at: string;
  updated_at: string;
}

interface ModuleInstance {
  id: string;
  module_key: string;
  outcome: string | null;
  completed_at: string | null;
  updated_at: string;
}

interface Action {
  id: string;
  priority_band: string;
  target_date: string | null;
  created_at: string;
  [key: string]: any;
}

function sortActionsByPriority(actions: Action[]): Action[] {
  const priorityMap: Record<string, number> = {
    P1: 1,
    P2: 2,
    P3: 3,
    P4: 4,
  };

  return [...actions].sort((a, b) => {
    const aPriority = priorityMap[a.priority_band] || 999;
    const bPriority = priorityMap[b.priority_band] || 999;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    if (a.target_date && b.target_date) {
      return new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
    }
    if (a.target_date && !b.target_date) return -1;
    if (!a.target_date && b.target_date) return 1;

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export default function DocumentOverview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { organisation, user } = useAuth();
  const [document, setDocument] = useState<Document | null>(null);
  const [modules, setModules] = useState<ModuleInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionCounts, setActionCounts] = useState({ P1: 0, P2: 0, P3: 0, P4: 0 });
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);

  const returnToPath = (location.state as any)?.returnTo || null;

  const getDashboardRoute = () => {
    if (returnToPath === '/dashboard/actions') {
      return '/dashboard/actions';
    }

    const fromParam = searchParams.get('from');
    if (fromParam) {
      return fromParam;
    }

    if (document?.document_type === 'DSEAR') {
      return '/dashboard/explosion';
    } else if (document?.document_type === 'FRA' || document?.document_type === 'FSD') {
      return '/dashboard/fire';
    }
    return '/common-dashboard';
  };

  useEffect(() => {
    if (id && organisation?.id) {
      fetchDocument();
      fetchModules();
      fetchActionCounts();
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
        .single();

      if (error) throw error;
      setDocument(data);
    } catch (error) {
      console.error('Error fetching document:', error);
      alert('Failed to load document. It may not exist or you may not have access.');
      navigate('/common-dashboard');
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
    } catch (error) {
      console.error('Error fetching action counts:', error);
    }
  };

  const getOutcomeColor = (outcome: string | null) => {
    switch (outcome) {
      case 'compliant':
        return 'bg-green-100 text-green-700';
      case 'minor_def':
        return 'bg-amber-100 text-amber-700';
      case 'material_def':
        return 'bg-red-100 text-red-700';
      case 'info_gap':
        return 'bg-blue-100 text-blue-700';
      case 'na':
        return 'bg-neutral-100 text-neutral-600';
      default:
        return 'bg-neutral-100 text-neutral-500';
    }
  };

  const getOutcomeLabel = (outcome: string | null) => {
    switch (outcome) {
      case 'compliant':
        return 'Compliant';
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-neutral-100 text-neutral-700';
      case 'issued':
        return 'bg-green-100 text-green-700';
      case 'superseded':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-neutral-100 text-neutral-600';
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

  const handleIssueDocument = async () => {
    if (!id || !user?.id || !document) return;

    setIsIssuing(true);
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          status: 'issued',
          issued_at: new Date().toISOString(),
          issued_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      await fetchDocument();
      setShowIssueModal(false);
      alert('Document issued successfully.');
    } catch (error) {
      console.error('Error issuing document:', error);
      alert('Failed to issue document. Please try again.');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!id || !document || !organisation) return;

    setIsGeneratingPdf(true);
    try {
      console.log('[PDF] Starting PDF generation for document:', id);

      // Fetch module instances
      const { data: moduleInstances, error: moduleError } = await supabase
        .from('module_instances')
        .select('*')
        .eq('document_id', id)
        .eq('organisation_id', organisation.id);

      if (moduleError) throw moduleError;
      console.log('[PDF] Fetched', moduleInstances?.length || 0, 'module instances');

      // Fetch actions with user profile names
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
      console.log('[PDF] Fetched', actions?.length || 0, 'actions');

      // Fetch action ratings
      const actionIds = (actions || []).map(a => a.id);
      let actionRatings = [];
      if (actionIds.length > 0) {
        const { data: ratings, error: ratingsError } = await supabase
          .from('action_ratings')
          .select('action_id, likelihood, impact, score, rated_at')
          .in('action_id', actionIds)
          .order('rated_at', { ascending: false });

        if (ratingsError) {
          console.warn('[PDF] Failed to fetch action ratings:', ratingsError);
        } else {
          actionRatings = ratings || [];
          console.log('[PDF] Fetched', actionRatings.length, 'action ratings');
        }
      }

      // Fetch user profiles for owner display names
      const ownerUserIds = (actions || [])
        .map(a => a.owner_user_id)
        .filter(id => id != null);
      const uniqueOwnerIds = [...new Set(ownerUserIds)];

      const userNameMap = new Map<string, string>();
      if (uniqueOwnerIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('user_profiles')
          .select('user_id, name')
          .in('user_id', uniqueOwnerIds);

        if (profilesError) {
          console.warn('[PDF] Failed to fetch user profiles:', profilesError);
        } else {
          (profiles || []).forEach(p => {
            if (p.name) userNameMap.set(p.user_id, p.name);
          });
        }
      }

      // Enrich actions with owner display names
      const enrichedActions = (actions || []).map(action => ({
        ...action,
        owner_display_name: action.owner_user_id ? userNameMap.get(action.owner_user_id) : null,
      }));

      const pdfOptions = {
        document,
        moduleInstances: moduleInstances || [],
        actions: enrichedActions,
        actionRatings,
        organisation: { id: organisation.id, name: organisation.name },
      };

      let pdfBytes;
      if (document.document_type === 'FSD') {
        pdfBytes = await buildFsdPdf(pdfOptions);
      } else if (document.document_type === 'DSEAR') {
        pdfBytes = await buildDsearPdf(pdfOptions);
      } else {
        pdfBytes = await buildFraPdf(pdfOptions);
      }

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const siteName = document.title
        .replace(/[^a-z0-9]/gi, '_')
        .replace(/_+/g, '_')
        .toLowerCase();
      const dateStr = new Date(document.assessment_date).toISOString().split('T')[0];
      const docType = document.document_type || 'FRA';
      const filename = `${docType}_${siteName}_${dateStr}_v${document.version}.pdf`;

      saveAs(blob, filename);
      console.log('[PDF] PDF generated successfully:', filename);
    } catch (error) {
      console.error('[PDF] Error generating PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to generate PDF: ${errorMessage}\n\nPlease check the console for details and try again.`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const completedModules = modules.filter((m) => m.completed_at !== null).length;
  const totalModules = modules.length;
  const completionPercentage = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  const infoGapModules = modules.filter((m) => m.outcome === 'info_gap').length;
  const materialDefModules = modules.filter((m) => m.outcome === 'material_def').length;
  const totalOpenActions = actionCounts.P1 + actionCounts.P2 + actionCounts.P3 + actionCounts.P4;

  if (!document) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-neutral-300 border-t-neutral-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-8 h-8 text-neutral-700" />
                <h1 className="text-2xl font-bold text-neutral-900">{document.title}</h1>
              </div>
              <div className="flex items-center gap-4 text-sm text-neutral-600">
                <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(document.status)}`}>
                  {document.status}
                </span>
                <span className="inline-flex px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                  {document.document_type}
                </span>
                <span>v{document.version}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {document.status === 'draft' && (
                <button
                  onClick={() => setShowIssueModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <FileCheck className="w-4 h-4" />
                  Issue Document
                </button>
              )}
              <button
                onClick={() => navigate(`/documents/${id}/workspace`)}
                className="px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-colors flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Open Workspace
              </button>
              <button
                onClick={() => navigate(`/documents/${id}/evidence`)}
                className="px-4 py-2 border-2 border-neutral-300 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition-colors flex items-center gap-2"
              >
                <Image className="w-4 h-4" />
                Evidence
              </button>
              <button
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                  isGeneratingPdf
                    ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isGeneratingPdf ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-neutral-400 border-t-transparent"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    Generate PDF
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-neutral-200">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-neutral-400 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase">Assessment Date</p>
                <p className="text-sm font-semibold text-neutral-900">{formatDate(document.assessment_date)}</p>
              </div>
            </div>

            {document.assessor_name && (
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-neutral-400 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase">Assessor</p>
                  <p className="text-sm font-semibold text-neutral-900">{document.assessor_name}</p>
                  {document.assessor_role && (
                    <p className="text-xs text-neutral-600">{document.assessor_role}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-neutral-400 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase">Last Updated</p>
                <p className="text-sm font-semibold text-neutral-900">{formatDate(document.updated_at)}</p>
              </div>
            </div>
          </div>

          {document.scope_description && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <p className="text-xs font-medium text-neutral-500 uppercase mb-1">Scope</p>
              <p className="text-sm text-neutral-700">{document.scope_description}</p>
            </div>
          )}

          {document.standards_selected && document.standards_selected.length > 0 && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <p className="text-xs font-medium text-neutral-500 uppercase mb-2">Standards & References</p>
              <div className="flex flex-wrap gap-2">
                {document.standards_selected.map((standard) => (
                  <span
                    key={standard}
                    className="inline-flex px-2 py-1 text-xs font-medium rounded bg-neutral-100 text-neutral-700"
                  >
                    {standard}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-neutral-500 uppercase">Module Progress</h3>
            </div>
            <div className="mb-3">
              <div className="flex items-end justify-between mb-1">
                <span className="text-3xl font-bold text-neutral-900">{completionPercentage}%</span>
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
            {(infoGapModules > 0 || materialDefModules > 0) && (
              <div className="flex flex-wrap gap-2 text-xs">
                {materialDefModules > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded">
                    <AlertCircle className="w-3 h-3" />
                    {materialDefModules} Material Def
                  </span>
                )}
                {infoGapModules > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded">
                    <AlertCircle className="w-3 h-3" />
                    {infoGapModules} Info Gap
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-neutral-500 uppercase">Open Actions</h3>
            </div>
            <div className="mb-3">
              <div className="text-3xl font-bold text-neutral-900 mb-1">{totalOpenActions}</div>
              <div className="text-sm text-neutral-600">Total open actions</div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center">
                <div className="text-lg font-bold text-red-700">{actionCounts.P1}</div>
                <div className="text-xs text-neutral-500">P1</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-orange-700">{actionCounts.P2}</div>
                <div className="text-xs text-neutral-500">P2</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-amber-700">{actionCounts.P3}</div>
                <div className="text-xs text-neutral-500">P3</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-700">{actionCounts.P4}</div>
                <div className="text-xs text-neutral-500">P4</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-neutral-500 uppercase">Document Status</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Status:</span>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(document.status)}`}>
                  {document.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Version:</span>
                <span className="text-sm font-medium text-neutral-900">v{document.version}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Type:</span>
                <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                  {document.document_type}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-200">
            <h2 className="text-lg font-bold text-neutral-900">Modules</h2>
            <p className="text-sm text-neutral-600 mt-1">
              Click on a module to open its workspace (coming in Phase 3)
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-neutral-300 border-t-neutral-900"></div>
            </div>
          ) : modules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="w-12 h-12 text-neutral-400 mb-3" />
              <p className="text-neutral-500">No modules found for this document</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-200">
              {modules.map((module) => (
                <div
                  key={module.id}
                  className="px-6 py-4 hover:bg-neutral-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/documents/${id}/workspace?m=${module.id}`)}
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
                      <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${getOutcomeColor(module.outcome)}`}>
                        {getOutcomeLabel(module.outcome)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <IssueDocumentModal
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        onConfirm={handleIssueDocument}
        isProcessing={isIssuing}
      />
    </div>
  );
}
