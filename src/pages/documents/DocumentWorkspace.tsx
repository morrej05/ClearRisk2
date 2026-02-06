import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, FileCheck, Menu, X, List, FileText, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { sortModulesByOrder, getModuleKeysForDocType, getModuleNavigationPath } from '../../lib/modules/moduleCatalog';
import ModuleRenderer from '../../components/modules/ModuleRenderer';
import IssueDocumentModal from '../../components/documents/IssueDocumentModal';
import EditLockBanner from '../../components/EditLockBanner';
import { isEditableStatus } from '../../utils/lifecycleGuards';
import ExecutiveSummaryPanel from '../../components/documents/ExecutiveSummaryPanel';
import { SurveyBadgeRow } from '../../components/SurveyBadgeRow';
import { JurisdictionSelector } from '../../components/JurisdictionSelector';
import DocumentStatusBadge from '../../components/documents/DocumentStatusBadge';
import OverallGradeWidget from '../../components/re/OverallGradeWidget';
import ModuleSidebar from '../../components/modules/ModuleSidebar';

console.log('✅ DocumentWorkspace.tsx LOADED - FileText import is present');

// Modules with dedicated routes that should NOT be rendered in workspace
const DEDICATED_MODULE_KEYS = new Set<string>([
  'RE_02_CONSTRUCTION',
  'RE_06_FIRE_PROTECTION',
]);

function isDedicatedModule(moduleKey: string): boolean {
  return DEDICATED_MODULE_KEYS.has(moduleKey);
}

function pickFirstWorkspaceModule(modules: ModuleInstance[]): ModuleInstance | null {
  return modules.find(m => !isDedicatedModule(m.module_key)) ?? null;
}

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
      if (mod === 'RE') return 'Risk Engineering Assessment';
      return mod;
    });
    return labels.join(' + ');
  }

  if (enabledModules.includes('FRA')) return 'Fire Risk Assessment';
  if (enabledModules.includes('FSD')) return 'Fire Strategy Document';
  if (enabledModules.includes('DSEAR')) return 'Explosive Atmospheres';
  if (enabledModules.includes('RE') || document.document_type === 'RE') return 'Risk Engineering Assessment';
  return document.document_type;
};

const isREKey = (k: string) =>
  k === 'RISK_ENGINEERING' ||
  k.startsWith('RE_') ||
  k.startsWith('RE-') ||
  k.toLowerCase().includes('risk_engineering'); // safety

function getExpectedKeysForDocument(document: Document): string[] {
  // IMPORTANT: use enabled_modules to decide what should exist
  const enabled = document.enabled_modules ?? [document.document_type];

  const expected: string[] = [];

  // Use module catalog for base document types
  if (document.document_type === 'FRA') {
    expected.push(...getModuleKeysForDocType('FRA'));
  }

  if (document.document_type === 'FSD') {
    expected.push(...getModuleKeysForDocType('FSD'));
  }

  if (document.document_type === 'DSEAR') {
    expected.push(...getModuleKeysForDocType('DSEAR'));
  }

  if (document.document_type === 'RE') {
    expected.push(...getModuleKeysForDocType('RE'));
  }

  // Additional modules from enabled_modules (for combined assessments)
  // FRA baseline
  if (enabled.includes('FRA') && document.document_type !== 'FRA') {
    expected.push(
      'A1_DOC_CONTROL',
      'A2_BUILDING_PROFILE',
      'A3_PERSONS_AT_RISK',
      'A4_MANAGEMENT_CONTROLS',
      'A5_EMERGENCY_ARRANGEMENTS',
      'A7_REVIEW_ASSURANCE',
      'FRA_1_HAZARDS',
      'FRA_2_ESCAPE_ASIS',
      'FRA_3_PROTECTION_ASIS',
      'FRA_4_SIGNIFICANT_FINDINGS',
      'FRA_5_EXTERNAL_FIRE_SPREAD'
    );
  }

  // FSD baseline
  if (enabled.includes('FSD') && document.document_type !== 'FSD') {
    expected.push(
      'A1_DOC_CONTROL',
      'A2_BUILDING_PROFILE',
      'A3_PERSONS_AT_RISK',
      'FSD_1_REG_BASIS',
      'FSD_2_EVAC_STRATEGY',
      'FSD_3_ESCAPE_DESIGN',
      'FSD_4_PASSIVE_PROTECTION',
      'FSD_5_ACTIVE_SYSTEMS',
      'FSD_6_FRS_ACCESS',
      'FSD_7_DRAWINGS',
      'FSD_8_SMOKE_CONTROL',
      'FSD_9_CONSTRUCTION_PHASE'
    );
  }

  // DSEAR baseline
  if (enabled.includes('DSEAR') && document.document_type !== 'DSEAR') {
    expected.push(
      'A1_DOC_CONTROL',
      'A2_BUILDING_PROFILE',
      'A3_PERSONS_AT_RISK',
      'DSEAR_1_DANGEROUS_SUBSTANCES',
      'DSEAR_2_PROCESS_RELEASES',
      'DSEAR_3_HAZARDOUS_AREA_CLASSIFICATION',
      'DSEAR_4_IGNITION_SOURCES',
      'DSEAR_5_EXPLOSION_PROTECTION',
      'DSEAR_6_RISK_ASSESSMENT',
      'DSEAR_10_HIERARCHY_OF_CONTROL',
      'DSEAR_11_EXPLOSION_EMERGENCY_RESPONSE'
    );
  }

  // De-dupe while preserving order
  return [...new Set(expected)];
}


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
  const [invalidUrl, setInvalidUrl] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Guard: Check for missing document ID
  useEffect(() => {
    if (!id) {
      console.error('[DocumentWorkspace] Missing document id route param');
      setInvalidUrl(true);
      setIsLoading(false);
      setDocumentNotFound(true);
    }
  }, [id]);

  useEffect(() => {
    if (id && organisation?.id) {
      fetchDocument();
      fetchModules();
    }
  }, [id, organisation?.id]);

  // Validate and correct module selection to only allow workspace modules
  useEffect(() => {
    if (modules.length === 0) return;

    const moduleParam = searchParams.get('m');

    // Case A: URL has ?m= parameter (explicit navigation)
    if (moduleParam) {
      const requestedModule = modules.find((m) => m.id === moduleParam);

      if (requestedModule && isDedicatedModule(requestedModule.module_key)) {
        // A) Explicitly requested a dedicated module via ?m= → redirect to dedicated page
        if (id) {
          navigate(getModuleNavigationPath(id, requestedModule.module_key, requestedModule.id), { replace: true });
        }
        return;
      }

      if (requestedModule && !isDedicatedModule(requestedModule.module_key)) {
        // A) Valid workspace module - use it
        if (selectedModuleId !== requestedModule.id) {
          setSelectedModuleId(requestedModule.id);
        }
        // Save to localStorage (safe - already verified not dedicated)
        if (id && !isDedicatedModule(requestedModule.module_key)) {
        localStorage.setItem(`ezirisk:lastModule:${id}`, requestedModule.id);
        }
        return;
      }

      // A) Invalid module ID in URL - fall through to Case B logic below
    }

    // Case B: No ?m= in URL - check localStorage or pick default
    const savedModuleId = id ? localStorage.getItem(`ezirisk:lastModule:${id}`) : null;
    const savedModule = savedModuleId ? modules.find((m) => m.id === savedModuleId) : null;

    let targetModule: ModuleInstance | null = null;

    if (savedModule && !isDedicatedModule(savedModule.module_key)) {
      // B) localStorage has valid workspace module - use it
      targetModule = savedModule;
    } else {
      // B) No saved module OR saved module is dedicated → pick first workspace module
      if (savedModule && isDedicatedModule(savedModule.module_key) && id) {
        // Clear the dedicated module from localStorage
        localStorage.removeItem(`ezirisk:lastModule:${id}`);
      }

      targetModule = pickFirstWorkspaceModule(modules);

      if (!targetModule) {
        console.error('[DocumentWorkspace] No workspace modules available');
        return;
      }
    }

    // Set the target module
    if (selectedModuleId !== targetModule.id) {
      setSelectedModuleId(targetModule.id);
    }

    // Update URL to include ?m=
    setSearchParams({ m: targetModule.id }, { replace: true });

   // Save chosen workspace module to localStorage (never save dedicated modules)
if (id && targetModule && !isDedicatedModule(targetModule.module_key)) {
  localStorage.setItem(`ezirisk:lastModule:${id}`, targetModule.id);
}

  }, [modules, id, searchParams, selectedModuleId, navigate]);

  const fetchDocument = async () => {
    if (!id || !organisation?.id) {
      console.error('[DocumentWorkspace.fetchDocument] Missing id or organisation.id', { id, orgId: organisation?.id });
      return;
    }

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
  if (!id || !organisation?.id) {
    console.error('[DocumentWorkspace.fetchModules] Missing id or organisation.id', { id, orgId: organisation?.id });
    return;
  }

  setIsLoading(true);
  try {
    // Need the document first so we know enabled_modules
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('organisation_id', organisation.id)
      .single();

    if (docErr) throw docErr;

    setDocument(doc);

    const { data: existing, error } = await supabase
      .from('module_instances')
      .select('*')
      .eq('document_id', id)
      .eq('organisation_id', organisation.id);

    if (error) throw error;

    const existingKeys = new Set((existing || []).map((m: any) => m.module_key));
    const expectedKeys = getExpectedKeysForDocument(doc);

    const missingKeys = expectedKeys.filter((k) => !existingKeys.has(k));

    // Seed missing module instances (only if any missing)
    if (missingKeys.length > 0) {
      const rows = missingKeys.map((k) => ({
        organisation_id: organisation.id,
        document_id: id,
        module_key: k,
        module_scope: 'document',
        data: {},
        assessor_notes: '',
      }));

      const { error: insErr } = await supabase.from('module_instances').insert(rows);
      if (insErr) throw insErr;

      // Re-fetch after seeding
      const { data: seeded, error: seededErr } = await supabase
        .from('module_instances')
        .select('*')
        .eq('document_id', id)
        .eq('organisation_id', organisation.id);

      if (seededErr) throw seededErr;

      // Filter modules to only expected keys (hide unwanted modules for RE docs)
      const filtered = (seeded || []).filter((m: any) => expectedKeys.includes(m.module_key));
      const sorted = sortModulesByOrder(filtered);
      setModules(sorted as ModuleInstance[]);
      return;
    }

    // Filter modules to only expected keys (hide unwanted modules for RE docs)
    const filtered = (existing || []).filter((m: any) => expectedKeys.includes(m.module_key));
    const sorted = sortModulesByOrder(filtered);
    setModules(sorted as ModuleInstance[]);
  } catch (error) {
    console.error('Error fetching modules:', error);
  } finally {
    setIsLoading(false);
  }
};


  const handleModuleSelect = (moduleId: string) => {
    // Find the module to get its module_key
    const targetModule = modules.find(m => m.id === moduleId);
    if (!targetModule) return;

    // Dedicated modules have their own routes - navigate directly
    if (isDedicatedModule(targetModule.module_key) && id) {
      navigate(getModuleNavigationPath(id, targetModule.module_key, targetModule.id));
      setIsMobileMenuOpen(false);
      // DO NOT save dedicated modules to localStorage
      return;
    }

    // Workspace modules: update state and URL
    setSelectedModuleId(moduleId);
    setSearchParams({ m: moduleId });
    setIsMobileMenuOpen(false);

    // Save workspace module to localStorage (safe - already verified not dedicated)
    if (id && !isDedicatedModule(targetModule.module_key)) {
  localStorage.setItem(`ezirisk:lastModule:${id}`, moduleId);
}

  };

  const handleModuleSaved = () => {
    fetchModules();
    fetchDocument();
  };

  const handleIssueDocument = async () => {
    if (!id || !user?.id || !document) {
      console.error('[DocumentWorkspace.handleIssueDocument] Missing required data', {
        id,
        userId: user?.id,
        hasDocument: !!document
      });
      return;
    }

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

  const selectedModule = modules.find((m) => m.id === selectedModuleId);



  // Guard: Redirect if a dedicated module is selected in workspace
  useEffect(() => {
    if (selectedModule && isDedicatedModule(selectedModule.module_key) && id) {
      console.log('[DocumentWorkspace] Redirecting dedicated module to its dedicated page:', selectedModule.module_key);
      navigate(getModuleNavigationPath(id, selectedModule.module_key, selectedModule.id), { replace: true });
    }
  }, [selectedModule, id, navigate]);

  if (documentNotFound) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-sm border border-neutral-200 text-center">
          <div className="mb-4">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">
            {invalidUrl ? 'Invalid Document URL' : 'Document Not Found'}
          </h2>
          <p className="text-neutral-600 mb-6">
            {invalidUrl
              ? 'The document URL is invalid or incomplete. Please check the URL and try again.'
              : "This document doesn't exist or you don't have permission to access it."
            }
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
                onClick={() => navigate(`/documents/${id}`, { state: { returnTo: returnToPath || '/dashboard' } })}
                className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Overview</span>
              </button>
            )}
            <div className="h-6 w-px bg-neutral-300 hidden sm:block" />
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-neutral-600 hidden sm:block" />
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-lg font-bold text-neutral-900">{document.title}</h1>
                  <p className="text-xs text-neutral-500">
                    {getDocumentTypeLabel(document)} • v{document.version}
                  </p>
                </div>
                <DocumentStatusBadge status={document.issue_status} />
              </div>
            </div>
          </div>
          {document.status === 'draft' && (
            <button
              onClick={() => setShowIssueModal(true)}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <FileCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Issue Document</span>
            </button>
          )}
        </div>
        <div className="max-w-[1800px] mx-auto flex items-center justify-between pt-3">
          <SurveyBadgeRow
            status={document.status as 'draft' | 'in_review' | 'approved' | 'issued'}
            jurisdiction={document.jurisdiction as 'UK' | 'IE'}
            enabledModules={document.enabled_modules}
          />
          {/* Risk Engineering is jurisdiction-neutral - hide selector for pure RE documents */}
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

      <div className="flex flex-1 overflow-hidden max-w-[1800px] mx-auto w-full relative">
        <ModuleSidebar
          modules={modules}
          selectedModuleId={selectedModuleId}
          onModuleSelect={handleModuleSelect}
          isMobileMenuOpen={isMobileMenuOpen}
          onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
        />

        <div className="flex-1 min-w-0 overflow-y-auto bg-neutral-50">
          <div className="w-full p-4 sm:p-6">
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

            {document.document_type === 'RE' && selectedModule?.module_key === 'RISK_ENGINEERING' && (
              <div className="mb-6">
                <OverallGradeWidget documentId={document.id} />
              </div>
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

      {showIssueModal && document && user && organisation && (
        <IssueDocumentModal
          documentId={document.id}
          documentTitle={document.title}
          userId={user.id}
          organisationId={organisation.id}
          onClose={() => setShowIssueModal(false)}
          onSuccess={() => {
            fetchDocument();
            fetchModules();
          }}
        />
      )}
    </div>
  );
}
