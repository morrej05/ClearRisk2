import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, CheckCircle, AlertCircle, FileText, List } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getModuleName, sortModulesByOrder } from '../../lib/modules/moduleCatalog';
import ModuleRenderer from '../../components/modules/ModuleRenderer';

interface Document {
  id: string;
  document_type: string;
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

export default function DocumentWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { organisation } = useAuth();

  const returnToPath = (location.state as any)?.returnTo || null;

  const [document, setDocument] = useState<Document | null>(null);
  const [modules, setModules] = useState<ModuleInstance[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      }
    } else if (modules.length > 0 && !selectedModuleId) {
      setSelectedModuleId(modules[0].id);
      setSearchParams({ m: modules[0].id });
    }
  }, [searchParams, modules, selectedModuleId]);

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
      alert('Failed to load document.');
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
  };

  const handleModuleSaved = () => {
    fetchModules();
    fetchDocument();
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

  const selectedModule = modules.find((m) => m.id === selectedModuleId);

  if (isLoading || !document) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-neutral-300 border-t-neutral-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
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
                onClick={() => navigate(`/documents/${id}`)}
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
                  {document.document_type} • v{document.version} • {document.status}
                </p>
              </div>
            </div>
          </div>
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
            {modules.map((module) => (
              <button
                key={module.id}
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
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-neutral-50">
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
  );
}
