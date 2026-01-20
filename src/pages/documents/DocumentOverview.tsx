import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, FileText, Calendar, User, CheckCircle, AlertCircle, Clock, FileDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';

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

const MODULE_NAMES: Record<string, string> = {
  A1_DOC_CONTROL: 'A1 - Document Control & Governance',
  A2_BUILDING_PROFILE: 'A2 - Building Profile',
  A3_PERSONS_AT_RISK: 'A3 - Occupancy & Persons at Risk',
  A4_MANAGEMENT_CONTROLS: 'A4 - Management Systems',
  A5_EMERGENCY_ARRANGEMENTS: 'A5 - Emergency Arrangements',
  A7_REVIEW_ASSURANCE: 'A7 - Review & Assurance',
  FRA_1_HAZARDS: 'FRA-1 - Hazards & Ignition Sources',
  FRA_2_ESCAPE_ASIS: 'FRA-2 - Means of Escape (As-Is)',
  FRA_3_PROTECTION_ASIS: 'FRA-3 - Fire Protection (As-Is)',
  FRA_5_EXTERNAL_FIRE_SPREAD: 'FRA-5 - External Fire Spread',
  FRA_4_SIGNIFICANT_FINDINGS: 'FRA-4 - Significant Findings (Summary)',
  FSD_1_REG_BASIS: 'FSD-1 - Regulatory Basis',
  FSD_2_EVAC_STRATEGY: 'FSD-2 - Evacuation Strategy',
  FSD_3_ESCAPE_DESIGN: 'FSD-3 - Escape Design',
  FSD_4_PASSIVE_PROTECTION: 'FSD-4 - Passive Fire Protection',
  FSD_5_ACTIVE_SYSTEMS: 'FSD-5 - Active Fire Systems',
  FSD_6_FRS_ACCESS: 'FSD-6 - Fire & Rescue Service Access',
  FSD_7_DRAWINGS: 'FSD-7 - Drawings & Schedules',
  FSD_8_SMOKE_CONTROL: 'FSD-8 - Smoke Control',
  FSD_9_CONSTRUCTION_PHASE: 'FSD-9 - Construction Phase',
  DSEAR_1_SUBSTANCES_REGISTER: 'DSEAR-1 - Substances Register',
  DSEAR_2_PROCESS_RELEASES: 'DSEAR-2 - Process & Release Sources',
  DSEAR_3_HAC_ZONING: 'DSEAR-3 - Hazardous Area Classification',
  DSEAR_4_IGNITION_CONTROL: 'DSEAR-4 - Ignition Source Control',
  DSEAR_5_MITIGATION: 'DSEAR-5 - Mitigation Measures',
  DSEAR_6_RISK_TABLE: 'DSEAR-6 - Risk Assessment Table',
  DSEAR_10_HIERARCHY_SUBSTITUTION: 'DSEAR-10 - Hierarchy of Control & Substitution',
  DSEAR_11_EXPLOSION_EMERGENCY_RESPONSE: 'DSEAR-11 - Emergency Response Plan',
};

export default function DocumentOverview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const [document, setDocument] = useState<Document | null>(null);
  const [modules, setModules] = useState<ModuleInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id && organisation?.id) {
      fetchDocument();
      fetchModules();
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
      navigate(-1);
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

  const completedModules = modules.filter((m) => m.completed_at !== null).length;
  const totalModules = modules.length;
  const completionPercentage = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

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
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
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
              <button
                disabled
                className="px-4 py-2 bg-neutral-100 text-neutral-400 rounded-lg font-medium cursor-not-allowed"
                title="Coming in Phase 3"
              >
                Open Workspace
              </button>
              <button
                disabled
                className="px-4 py-2 bg-neutral-100 text-neutral-400 rounded-lg font-medium cursor-not-allowed flex items-center gap-2"
                title="Coming in Phase 4"
              >
                <FileDown className="w-4 h-4" />
                Export PDF
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

        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-neutral-900">Module Progress</h2>
            <span className="text-sm font-medium text-neutral-600">
              {completedModules} of {totalModules} completed ({completionPercentage}%)
            </span>
          </div>
          <div className="w-full bg-neutral-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${completionPercentage}%` }}
            />
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
                  onClick={() => {
                    alert('Module workspace coming in Phase 3!');
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
                          {MODULE_NAMES[module.module_key] || module.module_key}
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
    </div>
  );
}
