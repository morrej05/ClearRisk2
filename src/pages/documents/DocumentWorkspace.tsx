import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, CheckCircle, AlertCircle, FileText, List, FileCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getModuleName, sortModulesByOrder } from '../../lib/modules/moduleCatalog';
import ModuleRenderer from '../../components/modules/ModuleRenderer';
import IssueDocumentModal from '../../components/IssueDocumentModal';
import EditLockBanner from '../../components/EditLockBanner';
import { isEditableStatus } from '../../utils/lifecycleGuards';
import ExecutiveSummaryPanel from '../../components/documents/ExecutiveSummaryPanel';
import { SurveyBadgeRow } from '../../components/SurveyBadgeRow';
import { JurisdictionSelector } from '../../components/JurisdictionSelector';

interface Document {
  id: string;
  document_type: string;
  enabled_modules?: string[];
  title: string;
  status: string;
  version: number;
  assessment_date: string;
  assessor_name: string | null;
  assessor_role: string | null;
  responsible_person: string | null;
  scope_description: string | null;
  limitations_assumptions: string | null;
  standards_selected: string[];
  issue_status: 'draft' | 'issued' | 'superseded';
  base_document_id: string;
  version_number: number;
  executive_summary_ai?: string | null;
  executive_summary_author?: string | null;
  executive_summary_mode?: string | null;
  jurisdiction: string;
}

interface ModuleInstance {
  id: string;
  module_key: string;
  outcome: string | null;
  completed_at: string | null;
  assessor_notes: string;
  data: Record<string, any>;
  updated_at: string;
}

const getDocumentTypeLabel = (document: Document): string => {
  const enabledModules = document.enabled_modules || [document.document_type];

  if (enabledModules.length > 1) {
    const labels = enabledModules.map((mod) => {
      if (mod === 'FRA') return 'Fire Risk Assessment';
      if (mod === 'FSD') return 'Fire Strategy Document';
      if (mod === 'DSEAR') return 'Explosive Atmospheres';
      return mod;
    });
    return labels.join(' + ');
  }

  if (enabledModules.includes('FRA')) return 'Fire Risk Assessment';
  if (enabledModules.includes('FSD')) return 'Fire Strategy Document';
  if (enabledModules.includes('DSEAR')) return 'Explosive Atmospheres';
  return document.document_type;
};

export default function DocumentWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { organisation, user } = useAuth();

  const returnToPath = (location.state as any)?.returnTo || null;

  const [document, setDocument] = useState<Document | null>(null);
  const [modules, setModules] = useState<ModuleInstance[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [documentNotFound, setDocumentNotFound] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);

  useEffect(() => {
    if (id && organisation?.id) {
      fetchDocument();
      fetchModules();
    }
  }, [id, organisation?.id]);

  useEffect(() => {
    const moduleParam = searchParams.get('m');
    if (moduleParam && modules.length > 0) {
      const moduleExists = modules.find((m) => m.id === moduleParam);
      if (moduleExists) {
        setSelectedModuleId(moduleParam);
        // Save to localStorage when navigating to a specific module
        if (id) {
          localStorage.setItem(`ezirisk:lastModule:${id}`, moduleParam);
        }
      }
    } else if (modules.length > 0 && !selectedModuleId) {
      setSelectedModuleId(modules[0].id);
      setSearchParams({ m: modules[0].id });
      // Save first module to localStorage
      if (id) {
        localStorage.setItem(`ezirisk:lastModule:${id}`, modules[0].id);
      }
    }
  }, [searchParams, modules, selectedModuleId, id]);

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
        .eq('organisation_id', organisation.id);

      if (error) throw error;

      const sorted = sortModulesByOrder(data || []);
      setModules(sorted as ModuleInstance[]);
    } catch (error) {
      console.error('Error fetching modules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModuleSelect = (moduleId: string) => {
    setSelectedModuleId(moduleId);
    setSearchParams({ m: moduleId });

    // Save last visited module to localStorage
    if (id) {
      localStorage.setItem(`ezirisk:lastModule:${id}`, moduleId);
    }
  };

  const handleModuleSaved = () => {
    fetchModules();
    fetchDocument();
  };

  const handleIssueDocument = async () => {
    if (!id || !user?.id || !document) return;

    setIsIssuing(true);
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          issue_status: 'issued',
          status: 'issued',
          issue_date: new Date().toISOString().split('T')[0],
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

  const getOutcomeColor = (outcome: string | null) => {
    switch (outcome) {
      case 'compliant':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'minor_def':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'material_def':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'info_gap':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'na':
        return 'bg-neutral-100 text-neutral-600 border-neutral-300';
      default:
        return 'bg-neutral-50 text-neutral-400 border-neutral-200';
    }
  };

  const ModuleNavItem = ({ module }: { module: ModuleInstance }) => (
    <button
      onClick={() => handleModuleSelect(module.id)}
      className={`w-full text-left px-4 py-3 transition-colors ${
        selectedModuleId === module.id
          ? 'bg-neutral-100 border-l-4 border-neutral-900'
          : 'hover:bg-neutral-50 border-l-4 border-transparent'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {module.outcome && module.outcome !== 'info_gap' ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : module.outcome === 'info_gap' ? (
            <AlertCircle className="w-5 h-5 text-blue-600" />
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-neutral-300" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900 mb-1">
            {getModuleName(module.module_key)}
          </p>
          {module.outcome && (
            <div className="flex flex-col gap-1">
              <span
                className={`inline-flex px-2 py-0.5 text-xs font-medium rounded border ${getOutcomeColor(
                  module.outcome
                )}`}
              >
                {module.outcome === 'compliant' && 'Compliant'}
                {module.outcome === 'minor_def' && 'Minor Def'}
                {module.outcome === 'material_def' && 'Material Def'}
                {module.outcome === 'info_gap' && 'Info Gap'}
                {module.outcome === 'na' && 'N/A'}
              </span>
              {module.outcome === 'info_gap' && (
                <span className="text-xs text-blue-600 font-medium">
                  Completed with gaps
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );

  const selectedModule = modules.find((m) => m.id === selectedModuleId);

  if (documentNotFound) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-sm border border-neutral-200 text-center">
          <div className="mb-4">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">Document Not Found</h2>
          <p className="text-neutral-600 mb-6">
            This document doesn't exist or you don't have permission to access it.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-md hover:bg-neutral-800 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !document) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-neutral-300 border-t-neutral-900"></div>
      </div>
    );
  }

  const isEditable = document.issue_status === 'draft';

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {!isEditable && (
        <EditLockBanner
          issueStatus={document.issue_status}
          supersededByDocumentId={document.superseded_by_document_id}
          onNavigateToSuccessor={() => {
            if (document.superseded_by_document_id) {
              navigate(`/documents/${document.superseded_by_document_id}/workspace`);
            }
          }}
          className="border-b"
        />
      )}
      <div className="bg-white border-b border-neutral-200 px-4 py-3">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {returnToPath === '/dashboard/actions' ? (
              <button
                onClick={() => navigate('/dashboard/actions')}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                <List className="w-4 h-4" />
                Actions Register
              </button>
            ) : (
              <button
                onClick={() => navigate(`/documents/${id}`, { state: { returnTo: returnToPath || '/dashboard' } })}
                className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Overview
              </button>
            )}
            <div className="h-6 w-px bg-neutral-300" />
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-neutral-600" />
              <div>
                <h1 className="text-lg font-bold text-neutral-900">{document.title}</h1>
                <p className="text-xs text-neutral-500">
                  {getDocumentTypeLabel(document)} • v{document.version}
                </p>
              </div>
            </div>
          </div>
          {document.status === 'draft' && (
            <button
              onClick={() => setShowIssueModal(true)}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <FileCheck className="w-4 h-4" />
              Issue Document
            </button>
          )}
        </div>
        <div className="max-w-[1800px] mx-auto flex items-center justify-between pt-3">
          <SurveyBadgeRow
            status={document.status as 'draft' | 'in_review' | 'approved' | 'issued'}
            jurisdiction={document.jurisdiction as 'UK' | 'IE'}
            enabledModules={document.enabled_modules}
          />
          <JurisdictionSelector
            documentId={document.id}
            currentJurisdiction={document.jurisdiction as 'UK' | 'IE'}
            status={document.status as 'draft' | 'in_review' | 'approved' | 'issued'}
            onUpdate={fetchDocument}
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden max-w-[1800px] mx-auto w-full">
        <div className="w-80 bg-white border-r border-neutral-200 overflow-y-auto">
          <div className="p-4 border-b border-neutral-200 bg-neutral-50">
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">
              Modules
            </h2>
          </div>
          <div className="divide-y divide-neutral-200">
            {(() => {
              const hasFRA = modules.some(m => m.module_key.startsWith('FRA_'));
              const hasFSD = modules.some(m => m.module_key.startsWith('FSD_'));
              const isCombined = hasFRA && hasFSD;

              const COMMON_MODULES = ['A1_DOC_CONTROL', 'A2_BUILDING_PROFILE', 'A3_PERSONS_AT_RISK'];

              if (isCombined) {
                const sharedModules = modules.filter(m => COMMON_MODULES.includes(m.module_key));
                const fraModules = modules.filter(m => m.module_key.startsWith('FRA_'));
                const fsdModules = modules.filter(m => m.module_key.startsWith('FSD_'));

                return (
                  <>
                    {sharedModules.length > 0 && (
                      <>
                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Shared</h3>
                        </div>
                        {sharedModules.map((module) => (
                          <ModuleNavItem key={module.id} module={module} />
                        ))}
                      </>
                    )}
                    {fraModules.length > 0 && (
                      <>
                        <div className="px-4 py-2 bg-orange-50 border-b border-orange-200">
                          <h3 className="text-xs font-bold text-orange-700 uppercase tracking-wider">Fire Risk Assessment (FRA)</h3>
                        </div>
                        {fraModules.map((module) => (
                          <ModuleNavItem key={module.id} module={module} />
                        ))}
                      </>
                    )}
                    {fsdModules.length > 0 && (
                      <>
                        <div className="px-4 py-2 bg-cyan-50 border-b border-cyan-200">
                          <h3 className="text-xs font-bold text-cyan-700 uppercase tracking-wider">Fire Strategy Document (FSD)</h3>
                        </div>
                        {fsdModules.map((module) => (
                          <ModuleNavItem key={module.id} module={module} />
                        ))}
                      </>
                    )}
                  </>
                );
              }

              return modules.map((module) => (
                <ModuleNavItem key={module.id} module={module} />
              ));
            })()}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-neutral-50">
          <div className="max-w-7xl mx-auto p-6">
            {['FRA', 'DSEAR', 'FSD'].includes(document.document_type) && organisation?.id && (
              <ExecutiveSummaryPanel
                documentId={document.id}
                organisationId={organisation.id}
                organisation={organisation}
                issueStatus={document.issue_status}
                initialAiSummary={document.executive_summary_ai}
                initialAuthorSummary={document.executive_summary_author}
                initialMode={(document.executive_summary_mode as 'ai' | 'author' | 'both' | 'none') || 'ai'}
                onUpdate={fetchDocument}
              />
            )}

            {selectedModule ? (
              <ModuleRenderer
                moduleInstance={selectedModule}
                document={document}
                onSaved={handleModuleSaved}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <AlertCircle className="w-16 h-16 text-neutral-300 mb-4" />
                <p className="text-neutral-500 text-lg">No module selected</p>
                <p className="text-neutral-400 text-sm">
                  Select a module from the sidebar to begin editing
                </p>
              </div>
            )}
          </div>
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
