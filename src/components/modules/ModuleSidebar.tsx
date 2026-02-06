import { CheckCircle, AlertCircle, FileText, X } from 'lucide-react';
import { getModuleName } from '../../lib/modules/moduleCatalog';

interface ModuleInstance {
  id: string;
  module_key: string;
  outcome: string | null;
  completed_at: string | null;
}

interface ModuleSidebarProps {
  modules: ModuleInstance[];
  selectedModuleId: string | null;
  selectedModuleKey?: string | null; // For dedicated pages that don't have module instance ID
  onModuleSelect: (moduleId: string) => void;
  isMobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
}

export default function ModuleSidebar({
  modules,
  selectedModuleId,
  selectedModuleKey,
  onModuleSelect,
  isMobileMenuOpen,
  onCloseMobileMenu,
}: ModuleSidebarProps) {
  const getOutcomeColor = (outcome: string | null) => {
    switch (outcome) {
      case 'compliant':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'minor_def':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'material_def':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'info_gap':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'na':
        return 'bg-neutral-100 text-neutral-600 border-neutral-300';
      default:
        return 'bg-neutral-50 text-neutral-400 border-neutral-200';
    }
  };

  const isModuleActive = (module: ModuleInstance) => {
    if (selectedModuleId) {
      return selectedModuleId === module.id;
    }
    if (selectedModuleKey) {
      return selectedModuleKey === module.module_key;
    }
    return false;
  };

  const ModuleNavItem = ({ module }: { module: ModuleInstance }) => (
    <button
      onClick={() => onModuleSelect(module.id)}
      className={`w-full text-left px-4 py-3 transition-colors md:px-2 lg:px-4 ${
        isModuleActive(module)
          ? 'bg-neutral-100 border-l-4 border-neutral-900'
          : 'hover:bg-neutral-50 border-l-4 border-transparent'
      }`}
      title={getModuleName(module.module_key)}
    >
      <div className="flex items-start gap-3 md:flex-col md:items-center md:gap-1 lg:flex-row lg:items-start lg:gap-3">
        <div className="flex-shrink-0 mt-0.5 md:mt-0">
          {module.outcome && module.outcome !== 'info_gap' ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : module.outcome === 'info_gap' ? (
            <AlertCircle className="w-5 h-5 text-blue-600" />
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-neutral-300" />
          )}
        </div>
        <div className="flex-1 min-w-0 md:hidden lg:block">
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
        {/* Icon-only badge for tablet view */}
        <div className="hidden md:block lg:hidden">
          {module.outcome && (
            <div className={`w-2 h-2 rounded-full ${
              module.outcome === 'compliant' ? 'bg-green-600' :
              module.outcome === 'minor_def' ? 'bg-amber-600' :
              module.outcome === 'material_def' ? 'bg-red-600' :
              module.outcome === 'info_gap' ? 'bg-blue-600' :
              'bg-neutral-400'
            }`} />
          )}
        </div>
      </div>
    </button>
  );

  const reModules = modules.filter(
    m => m.module_key.startsWith('RE_') || m.module_key === 'RISK_ENGINEERING'
  );

  const hasFRA = modules.some(m => m.module_key.startsWith('FRA_'));
  const hasFSD = modules.some(m => m.module_key.startsWith('FSD_'));
  const isCombined = hasFRA && hasFSD;

  const COMMON_MODULES = ['A1_DOC_CONTROL', 'A2_BUILDING_PROFILE', 'A3_PERSONS_AT_RISK'];

  return (
    <>
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onCloseMobileMenu}
        />
      )}

      {/* Sidebar - responsive width and positioning */}
      <div className={`
        bg-white border-r border-neutral-200 overflow-y-auto transition-all duration-300
        ${isMobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 w-80' : 'hidden'}
        md:block md:relative md:w-16
        lg:w-64
      `}>
        <div className="p-4 border-b border-neutral-200 bg-neutral-50 md:p-2 lg:p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide md:hidden lg:block">
              Modules
            </h2>
            <button
              onClick={onCloseMobileMenu}
              className="md:hidden p-1 hover:bg-neutral-200 rounded transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5 text-neutral-600" />
            </button>
          </div>
          <div className="hidden md:block lg:hidden text-center">
            <FileText className="w-5 h-5 text-neutral-600 mx-auto" />
          </div>
        </div>
        <div className="divide-y divide-neutral-200">
          {(() => {
            if (isCombined) {
              const sharedModules = modules.filter(m => COMMON_MODULES.includes(m.module_key));
              const fraModules = modules.filter(m => m.module_key.startsWith('FRA_'));
              const fsdModules = modules.filter(m => m.module_key.startsWith('FSD_'));

              return (
                <>
                  {sharedModules.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 md:px-2 lg:px-4 md:hidden lg:block">
                        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Shared</h3>
                      </div>
                      {sharedModules.map((module) => (
                        <ModuleNavItem key={module.id} module={module} />
                      ))}
                    </>
                  )}
                  {fraModules.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-orange-50 border-b border-orange-200 md:px-2 lg:px-4 md:hidden lg:block">
                        <h3 className="text-xs font-bold text-orange-700 uppercase tracking-wider">Fire Risk Assessment (FRA)</h3>
                      </div>
                      {fraModules.map((module) => (
                        <ModuleNavItem key={module.id} module={module} />
                      ))}
                    </>
                  )}
                  {fsdModules.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-cyan-50 border-b border-cyan-200 md:px-2 lg:px-4 md:hidden lg:block">
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

            return (
              <>
                {reModules.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-purple-50 border-b border-purple-200 md:px-2 lg:px-4 md:hidden lg:block">
                      <h3 className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                        Risk Engineering
                      </h3>
                    </div>

                    {reModules.map((module) => (
                      <ModuleNavItem key={module.id} module={module} />
                    ))}
                  </>
                )}

                {modules
                  .filter(m => !reModules.includes(m))
                  .map((module) => (
                    <ModuleNavItem key={module.id} module={module} />
                  ))}
              </>
            );
          })()}
        </div>
      </div>
    </>
  );
}
