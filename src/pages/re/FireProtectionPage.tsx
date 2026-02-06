import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Menu, X, List } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import FireProtectionForm from '../../components/re/FireProtectionForm';
import ModuleSidebar from '../../components/modules/ModuleSidebar';
import { getModuleNavigationPath, sortModulesByOrder } from '../../lib/modules/moduleCatalog';
import EditLockBanner from '../../components/EditLockBanner';
import { SurveyBadgeRow } from '../../components/SurveyBadgeRow';
import { JurisdictionSelector } from '../../components/JurisdictionSelector';
import DocumentStatusBadge from '../../components/documents/DocumentStatusBadge';

interface ModuleInstance {
  id: string;
  module_key: string;
  outcome: string | null;
  completed_at: string | null;
}

interface Document {
  id: string;
  document_type: string;
  enabled_modules?: string[];
  title: string;
  status: string;
  issue_status: string;
  version: number;
  jurisdiction: string;
  superseded_by_document_id: string | null;
}

function getDocumentTypeLabel(document: Document | null): string {
  if (!document) return '';
  if (document.document_type === 'FRA') return 'Fire Risk Assessment';
  if (document.document_type === 'FSD') return 'Fire Strategy';
  if (document.document_type === 'DSEAR') return 'DSEAR Assessment';
  if (document.document_type === 'RE') return 'Risk Engineering';
  if (document.document_type === 'Combined') return 'Combined Assessment';
  return document.document_type;
}

export default function FireProtectionPage() {
  const { id: documentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { organisation } = useAuth();
  const [searchParams] = useSearchParams();
  const [document, setDocument] = useState<Document | null>(null);
  const [modules, setModules] = useState<ModuleInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const returnToPath = (location.state as any)?.returnTo || '/dashboard';

  useEffect(() => {
    if (!documentId || !organisation?.id) return;

    async function loadData() {
      setIsLoading(true);

      // Load document
      const { data: doc } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .eq('organisation_id', organisation.id)
        .maybeSingle();

      if (doc) {
        setDocument(doc as Document);

        // Load modules
        const { data: modulesData } = await supabase
          .from('module_instances')
          .select('id, module_key, outcome, completed_at')
          .eq('document_id', documentId)
          .order('created_at', { ascending: true });

        if (modulesData) {
          const sorted = sortModulesByOrder(modulesData as ModuleInstance[]);
          setModules(sorted);
        }
      }

      setIsLoading(false);
    }

    loadData();
  }, [documentId, organisation?.id]);

  const handleModuleSelect = (moduleId: string) => {
    const targetModule = modules.find(m => m.id === moduleId);
    if (!targetModule || !documentId) return;

    // Navigate to the appropriate page for this module
    navigate(getModuleNavigationPath(documentId, targetModule.module_key, targetModule.id));
    setIsMobileMenuOpen(false);
  };

  const fetchDocument = async () => {
    if (!documentId || !organisation?.id) return;

    const { data: doc } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('organisation_id', organisation.id)
      .maybeSingle();

    if (doc) {
      setDocument(doc as Document);
    }
  };

  if (!documentId) {
    return (
      <div className="p-8">
        <div className="text-neutral-600">Invalid document ID</div>
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

      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-4 py-3">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-neutral-600" />
              ) : (
                <Menu className="w-5 h-5 text-neutral-600" />
              )}
            </button>

            {returnToPath === '/dashboard/actions' ? (
              <button
                onClick={() => navigate('/dashboard/actions')}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Actions Register</span>
              </button>
            ) : (
              <button
                onClick={() => navigate(`/documents/${documentId}`, { state: { returnTo: returnToPath || '/dashboard' } })}
                className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Document Overview</span>
              </button>
            )}

            <div className="border-l border-neutral-300 pl-4 hidden sm:block">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-base font-semibold text-neutral-900 leading-tight">
                    {document.title}
                  </h1>
                  <p className="text-xs text-neutral-500">
                    {getDocumentTypeLabel(document)} • v{document.version}
                  </p>
                </div>
                <DocumentStatusBadge status={document.issue_status} />
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-[1800px] mx-auto flex items-center justify-between pt-3">
          <SurveyBadgeRow
            status={document.status as 'draft' | 'in_review' | 'approved' | 'issued'}
            jurisdiction={document.jurisdiction as 'UK' | 'IE'}
            enabledModules={document.enabled_modules}
          />
          {(document.document_type !== 'RE' && !document.enabled_modules?.includes('RE')) ||
           document.enabled_modules?.some(m => m.startsWith('FRA_') || m.startsWith('FSD_') || m.startsWith('DSEAR_')) ? (
            <JurisdictionSelector
              documentId={document.id}
              currentJurisdiction={document.jurisdiction as 'UK' | 'IE'}
              status={document.status as 'draft' | 'in_review' | 'approved' | 'issued'}
              onUpdate={fetchDocument}
            />
          ) : null}
        </div>
      </div>

      {/* Main layout with sidebar */}
      <div className="flex flex-1 overflow-hidden max-w-[1800px] mx-auto w-full relative">
        <ModuleSidebar
          modules={modules}
          selectedModuleId={null}
          selectedModuleKey="RE_06_FIRE_PROTECTION"
          onModuleSelect={handleModuleSelect}
          isMobileMenuOpen={isMobileMenuOpen}
          onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
        />

        {/* Main content area */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-neutral-50">
          <div className="w-full p-4 sm:p-6">
            <FireProtectionForm documentId={documentId} />
          </div>
        </div>
      </div>
    </div>
  );
}
