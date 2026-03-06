// src/pages/documents/DocumentWorkspace.tsx

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft,
  AlertCircle,
  List,
  FileCheck,
  Menu,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { withResolvedSectionAssessment } from '../../utils/moduleAssessment';
import {
  sortModulesByOrder,
  getModuleKeysForDocType,
  getReModulesForDocument,
  normalizeReModuleKey,
  filterDeprecatedModuleKeysForNavigation,
} from '../../lib/modules/moduleCatalog';
import ModuleRenderer from '../../components/modules/ModuleRenderer';
import ModuleSidebar from '../../components/modules/ModuleSidebar';
import IssueDocumentModal from '../../components/documents/IssueDocumentModal';
import EditLockBanner from '../../components/EditLockBanner';
import ExecutiveSummaryPanel from '../../components/documents/ExecutiveSummaryPanel';
import { SurveyBadgeRow } from '../../components/SurveyBadgeRow';
import { JurisdictionSelector } from '../../components/JurisdictionSelector';
import DocumentStatusBadge from '../../components/documents/DocumentStatusBadge';
import OverallGradeWidget from '../../components/re/OverallGradeWidget';
import ActionDetailModal from '../../components/actions/ActionDetailModal';
import { subscribeActionsVersion, getActionsVersion } from '../../lib/actions/actionsInvalidation';

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
  superseded_by_document_id?: string | null;
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

interface Action {
  id: string;
  recommended_action: string;
  status: string;
  priority_band: string | null;
  target_date: string | null;
  owner_user_id: string | null;
  updated_at: string;
  source: string | null;
  document_id: string;
  module_instance_id: string | null;
  owner: {
    id: string;
    name: string | null;
  } | null;
  attachment_count?: number;
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

function getExpectedKeysForDocument(document: Document, existingModuleKeys: string[] = []): string[] {
  const enabled = document.enabled_modules ?? [document.document_type];
  const expected: string[] = [];
  const existing = new Set(existingModuleKeys);

  if (document.document_type === 'FRA') {
    const fraModuleKeys = getModuleKeysForDocType('FRA', { includeDeprecatedIfPresent: existing });
    expected.push(...filterDeprecatedModuleKeysForNavigation(fraModuleKeys, existing));
  }

  if (document.document_type === 'FSD') expected.push(...getModuleKeysForDocType('FSD'));
  if (document.document_type === 'DSEAR') expected.push(...getModuleKeysForDocType('DSEAR'));
  if (document.document_type === 'RE') expected.push(...getModuleKeysForDocType('RE'));

  if (enabled.includes('FRA') && document.document_type !== 'FRA') {
    expected.push(
      'A1_DOC_CONTROL',
      'A2_BUILDING_PROFILE',
      'A3_PERSONS_AT_RISK',
      'FRA_6_MANAGEMENT_SYSTEMS',
      'FRA_7_EMERGENCY_ARRANGEMENTS',
      'A7_REVIEW_ASSURANCE',
      'FRA_1_HAZARDS',
      'FRA_2_ESCAPE_ASIS',
      ...(existing.has('FRA_3_PROTECTION_ASIS')
        ? ['FRA_3_PROTECTION_ASIS']
        : ['FRA_3_ACTIVE_SYSTEMS', 'FRA_4_PASSIVE_PROTECTION', 'FRA_8_FIREFIGHTING_EQUIPMENT']),
      'FRA_90_SIGNIFICANT_FINDINGS',
      'FRA_5_EXTERNAL_FIRE_SPREAD'
    );
  }

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
  const [selectedStable, setSelectedStable] = useState<ModuleInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModulesLoading, setIsModulesLoading] = useState(false);
  const [documentNotFound, setDocumentNotFound] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [invalidUrl, setInvalidUrl] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [actions, setActions] = useState<Action[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const [actionScope, setActionScope] = useState<'module' | 'document'>('module');
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [isActionsPanelCollapsed, setIsActionsPanelCollapsed] = useState(false);
  const [actionsVersion, setActionsVersion] = useState(getActionsVersion());

  const openActionId = searchParams.get('openAction');

  const modalAction = useMemo(() => {
    if (selectedAction) return selectedAction;
    if (!openActionId) return null;
    return actions.find((a) => a.id === openActionId) ?? null;
  }, [selectedAction, openActionId, actions]);

  const modalModule = useMemo(() => {
    if (!modalAction?.module_instance_id) return null;
    return modules.find((m) => m.id === modalAction.module_instance_id) ?? null;
  }, [modalAction, modules]);

  useEffect(() => {
    if (!id) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, organisation?.id]);

  useEffect(() => {
    const unsubscribe = subscribeActionsVersion(() => setActionsVersion(getActionsVersion()));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!id) return;
    if (actionScope === 'module' && !selectedModuleId) return;
    fetchActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, selectedModuleId, actionScope, actionsVersion]);

  useEffect(() => {
    if (searchParams.get('openAction')) return;
    if (modules.length === 0) return;

    const moduleParam = searchParams.get('m');
    const savedModuleId = id ? localStorage.getItem(`ezirisk:lastModule:${id}`) : null;
    const requestedModuleId = moduleParam || savedModuleId;

    const requestedModule = requestedModuleId ? modules.find((m) => m.id === requestedModuleId) : null;

    if (requestedModule) {
      if (selectedModuleId !== requestedModule.id) setSelectedModuleId(requestedModule.id);

      if (moduleParam !== requestedModule.id) {
        setSearchParams(
          (current) => {
            const next = new URLSearchParams(current);
            next.set('m', requestedModule.id);
            return next;
          },
          { replace: true }
        );
      }

      if (id && savedModuleId !== requestedModule.id) {
        localStorage.setItem(`ezirisk:lastModule:${id}`, requestedModule.id);
      }
    } else {
      const firstIncomplete = modules.find((m) => !m.completed_at);
      const targetModule = firstIncomplete ?? modules[0];

      if (selectedModuleId !== targetModule.id) setSelectedModuleId(targetModule.id);

      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set('m', targetModule.id);
          return next;
        },
        { replace: true }
      );

      if (id) localStorage.setItem(`ezirisk:lastModule:${id}`, targetModule.id);
    }
  }, [modules, id, searchParams, selectedModuleId, setSearchParams]);

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
    } catch {
      setDocument(null);
      setDocumentNotFound(true);
      setIsLoading(false);
    }
  };

  const fetchModules = async () => {
    if (!id || !organisation?.id) return;

    setIsModulesLoading(true);
    try {
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

      const existingModuleKeys = (existing || []).map((m: any) => m.module_key);
      const existingKeys = new Set(
        existingModuleKeys.map((key) => {
          if (doc.document_type === 'RE') return normalizeReModuleKey(key) ?? key;
          return key;
        })
      );

      const expectedKeys = getExpectedKeysForDocument(doc as Document, existingModuleKeys);
      const missingKeys = expectedKeys.filter((k) => !existingKeys.has(k));

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

        const { data: seeded, error: seededErr } = await supabase
          .from('module_instances')
          .select('*')
          .eq('document_id', id)
          .eq('organisation_id', organisation.id);

        if (seededErr) throw seededErr;

        const seededSafe = Array.isArray(seeded) ? seeded : [];
        const filtered =
          doc.document_type === 'RE'
            ? getReModulesForDocument(seededSafe as ModuleInstance[], { documentId: id })
            : seededSafe.filter((m: any) => expectedKeys.includes(m.module_key));

        setModules(sortModulesByOrder(filtered).map(withResolvedSectionAssessment) as ModuleInstance[]);
        return;
      }

      const existingSafe = Array.isArray(existing) ? existing : [];
      const filtered =
        doc.document_type === 'RE'
          ? getReModulesForDocument(existingSafe as ModuleInstance[], { documentId: id })
          : existingSafe.filter((m: any) => expectedKeys.includes(m.module_key));

      setModules(sortModulesByOrder(filtered).map(withResolvedSectionAssessment) as ModuleInstance[]);
    } finally {
      setIsModulesLoading(false);
    }
  };

  const fetchActions = async () => {
    if (!id) return;

    setIsLoadingActions(true);
    try {
      let query = supabase
        .from('actions')
        .select(
          `
          *,
          owner:user_profiles(id,name),
          attachment_count:attachments(count)
        `
        )
        .eq('document_id', id)
        .is('deleted_at', null)
        .order('priority_band', { ascending: true })
        .order('created_at', { ascending: false });

      if (actionScope === 'module' && selectedModuleId) {
        query = query.eq('module_instance_id', selectedModuleId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const transformedData = (data || []).map((action: any) => ({
        ...action,
        attachment_count: action.attachment_count?.[0]?.count || 0,
      }));

      setActions(transformedData as Action[]);
    } finally {
      setIsLoadingActions(false);
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'P1':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'P2':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'P3':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'P4':
        return 'bg-neutral-100 text-neutral-700 border-neutral-300';
      default:
        return 'bg-neutral-100 text-neutral-600 border-neutral-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'text-amber-700 bg-amber-50';
      case 'in_progress':
        return 'text-blue-700 bg-blue-50';
      case 'closed':
        return 'text-green-700 bg-green-50';
      default:
        return 'text-neutral-600 bg-neutral-50';
    }
  };

  const handleModuleSelect = (moduleId: string) => {
    setSelectedModuleId(moduleId);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('m', moduleId);
      return next;
    });
    setIsMobileMenuOpen(false);

    if (id) localStorage.setItem(`ezirisk:lastModule:${id}`, moduleId);
  };

  const handleOpenAction = (actionId: string) => {
    const action = actions.find((a) => a.id === actionId);
    if (action) setSelectedAction(action);
  };

  useEffect(() => {
    const openActionId2 = searchParams.get('openAction');
    if (!openActionId2) return;
    if (actionScope !== 'document') setActionScope('document');
  }, [searchParams, actionScope]);

  const handleModuleSaved = async (moduleId?: string, updatedData?: any) => {
    if (moduleId && updatedData) {
      const now = new Date().toISOString();
      setModules((prevModules) =>
        prevModules.map((m) =>
          m.id === moduleId ? ({ ...m, data: updatedData, updated_at: now } as any) : m
        )
      );
    }

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
    } catch {
      alert('Failed to issue document. Please try again.');
    } finally {
      setIsIssuing(false);
    }
  };

  useEffect(() => {
    const found = modules.find((m) => m.id === selectedModuleId) ?? null;
    if (found) setSelectedStable(found);
  }, [modules, selectedModuleId]);

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
              : "This document doesn't exist or you don't have permission to access it."}
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
  const isDsearDoc =
  document.enabled_modules?.includes('DSEAR') ||
  document.enabled_modules?.some((m) => m.startsWith('DSEAR_')) ||
  modules.some((m) => m.module_key?.startsWith('DSEAR_'));

const product = isDsearDoc ? 'DSEAR' : 'GENERIC';

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
        {/* Top header row */}
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 text-neutral-600" /> : <Menu className="w-5 h-5 text-neutral-600" />}
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

        {/* Second header row: badges + jurisdiction */}
        <div className="max-w-[1800px] mx-auto flex items-center justify-between pt-3">
          <SurveyBadgeRow
            status={document.status as 'draft' | 'in_review' | 'approved' | 'issued'}
            jurisdiction={document.jurisdiction}
            enabledModules={document.enabled_modules}
            product={product}
          />

          {/* Keep your hide logic if you want, but this is the simplest “always show” version */}
          <JurisdictionSelector
            documentId={document.id}
            currentJurisdiction={document.jurisdiction}
            product={product}
            status={document.status as 'draft' | 'in_review' | 'approved' | 'issued'}
            onUpdate={(newJurisdiction) => {
              setDocument((prev) =>
                prev ? { ...prev, jurisdiction: String(newJurisdiction) } : prev
              );
              }}
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 max-w-[1800px] mx-auto w-full relative">
        <ModuleSidebar
          modules={modules}
          selectedModuleId={selectedModuleId}
          onModuleSelect={handleModuleSelect}
          isMobileMenuOpen={isMobileMenuOpen}
          onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
          documentId={document?.id}
        />

        <div className="flex-1 min-w-0 overflow-y-auto bg-neutral-50 h-screen">
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
                onUpdate={(newJurisdiction) => {
                setDocument((prev) =>
                  prev ? { ...prev, jurisdiction: String(newJurisdiction) } : prev
                );
              }}
              />
            )}

            {document.document_type === 'RE' && selectedStable?.module_key === 'RISK_ENGINEERING' && (
              <div className="mb-6">
                <OverallGradeWidget documentId={document.id} />
              </div>
            )}

            {/* Actions Panel */}
            {selectedStable && (
              <div className="bg-white rounded-lg shadow-sm border border-neutral-200 mb-6">
                <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-900">Outstanding Actions</h3>
                    <button
                      onClick={() => setIsActionsPanelCollapsed(!isActionsPanelCollapsed)}
                      className="p-1 hover:bg-neutral-100 rounded transition-colors"
                    >
                      {isActionsPanelCollapsed ? (
                        <ChevronDown className="w-4 h-4 text-neutral-600" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-neutral-600" />
                      )}
                    </button>
                  </div>
                </div>

                {!isActionsPanelCollapsed && (
                  <>
                    <div className="flex gap-2 px-4 py-2 border-b border-neutral-200">
                      <button
                        onClick={() => setActionScope('module')}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                          actionScope === 'module'
                            ? 'bg-blue-600 text-white'
                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        }`}
                      >
                        This module ({actionScope === 'module' ? actions.length : '...'})
                      </button>
                      <button
                        onClick={() => setActionScope('document')}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                          actionScope === 'document'
                            ? 'bg-blue-600 text-white'
                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        }`}
                      >
                        All actions ({actionScope === 'document' ? actions.length : '...'})
                      </button>
                    </div>

                    <div className="px-4 py-3">
                      {isLoadingActions ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-200 border-t-blue-600"></div>
                        </div>
                      ) : actions.length === 0 ? (
                        <div className="text-center py-8">
                          <AlertCircle className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                          <p className="text-sm text-neutral-600">
                            {actionScope === 'module' ? 'No actions in this module' : 'No actions in this document'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {actions.slice(0, 5).map((action) => (
                            <button
                              key={action.id}
                              onClick={() => handleOpenAction(action.id)}
                              className="w-full text-left px-3 py-2 rounded border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
                            >
                              <div className="flex items-start gap-2">
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded border ${getPriorityColor(
                                    action.priority_band
                                  )}`}
                                >
                                  {action.priority_band || 'P4'}
                                </span>
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${getStatusColor(
                                    action.status
                                  )}`}
                                >
                                  {action.status}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-neutral-900 line-clamp-2">{action.recommended_action}</p>
                                  {action.owner?.name && (
                                    <p className="text-xs text-neutral-500 mt-1">Owner: {action.owner.name}</p>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}

                          {actions.length > 5 && (
                            <p className="text-xs text-neutral-500 text-center pt-2">Showing 5 of {actions.length} actions</p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {selectedStable ? (
              <ModuleRenderer key={selectedStable.id} moduleInstance={selectedStable} document={document} onSaved={handleModuleSaved} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <AlertCircle className="w-16 h-16 text-neutral-300 mb-4" />
                <p className="text-neutral-500 text-lg">No module selected</p>
                <p className="text-neutral-400 text-sm">Select a module from the sidebar to begin editing</p>
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

      {modalAction && user?.id && organisation?.id && (
        <ActionDetailModal
          action={{
            ...modalAction,
            document: document
              ? {
                  id: document.id,
                  title: document.title,
                  document_type: document.document_type,
                }
              : null,
            module_instance: modalModule
              ? {
                  id: modalModule.id,
                  module_key: modalModule.module_key,
                  outcome: modalModule.outcome,
                }
              : null,
            attachment_count: modalAction.attachment_count || 0,
          }}
          onClose={() => {
            setSelectedAction(null);
            setSearchParams(
              (cur) => {
                const next = new URLSearchParams(cur);
                next.delete('openAction');
                return next;
              },
              { replace: true }
            );
          }}
          onActionUpdated={() => fetchActions()}
        />
      )}
    </div>
  );
}