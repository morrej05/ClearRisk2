import { CheckCircle2, Circle, AlertCircle, FileText, X, Sparkles } from 'lucide-react';
import { getModuleName, MODULE_CATALOG } from '../../lib/modules/moduleCatalog';

interface ModuleInstance {
  id: string;
  module_key: string;
  outcome: string | null;
  completed_at: string | null;
}

interface ModuleSidebarProps {
  modules: ModuleInstance[];
  selectedModuleId: string | null;
  selectedModuleKey?: string | null;
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
  const getModuleCode = (module: ModuleInstance): string => {
    if (module.module_key === 'RISK_ENGINEERING') return 'RE-00';

    const moduleCode = getModuleName(module.module_key).split(' ')[0];
    return moduleCode.replace(/[–-]$/, '');
  };

  const getModuleDisplayName = (moduleKey: string): string => {
    const fullName = getModuleName(moduleKey)
      .replace(/^([A-Z]+-\d+|A\d+|RE-\d+)\s*[–-]\s*/u, '')
      .replace(/\(As-Is\)/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return fullName.charAt(0).toUpperCase() + fullName.slice(1);
  };

  const getModuleOrder = (moduleKey: string): number => MODULE_CATALOG[moduleKey]?.order ?? 999;

  const sortByOrder = (items: ModuleInstance[]) => [...items].sort((a, b) => getModuleOrder(a.module_key) - getModuleOrder(b.module_key));

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

  const isDerivedModule = (moduleKey: string): boolean => {
    return MODULE_CATALOG[moduleKey]?.type === 'derived';
  };

  const ModuleNavItem = ({ module }: { module: ModuleInstance }) => {
    const isDerived = isDerivedModule(module.module_key);

    return (
    <button
      onClick={() => onModuleSelect(module.id)}
      className={`w-full text-left px-3 py-2.5 transition-all duration-200 md:px-2 lg:px-3 rounded-xl border ${
        isModuleActive(module)
          ? 'bg-neutral-900/5 border-neutral-200 shadow-sm'
          : 'border-transparent hover:bg-neutral-900/[0.02] hover:border-neutral-200/70'
      }`}
      title={getModuleDisplayName(module.module_key)}
    >
      <div className="flex items-start gap-2.5 md:flex-col md:items-center md:gap-1 lg:flex-row lg:items-start lg:gap-2.5">
        <div className="flex-shrink-0 mt-0.5 md:mt-0">
          {isDerived ? (
            <Sparkles className="w-4 h-4 text-violet-500" />
          ) : module.outcome && module.outcome !== 'info_gap' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : module.outcome === 'info_gap' ? (
            <AlertCircle className="w-4 h-4 text-blue-600" />
          ) : (
            <Circle className="w-4 h-4 text-neutral-300" />
          )}
        </div>
        <div className="flex-1 min-w-0 md:hidden lg:block">
          <div className="flex items-start gap-2">
            <p className="text-sm font-medium text-neutral-900 leading-5 flex-1 min-w-0">
              {getModuleDisplayName(module.module_key)}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {isDerived && (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-semibold tracking-wide rounded-md bg-violet-50 text-violet-700 border border-violet-200">
                  Auto
                </span>
              )}
              <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-semibold tracking-wide rounded-md bg-neutral-100 text-neutral-600 border border-neutral-200">
                {getModuleCode(module)}
              </span>
            </div>
          </div>
          {!isDerived && module.outcome && (
            <span
              className={`inline-flex mt-1 px-2 py-0.5 text-[11px] font-medium rounded border ${getOutcomeColor(
                module.outcome
              )}`}
            >
              {module.outcome === 'compliant' && 'Compliant'}
              {module.outcome === 'minor_def' && 'Minor deficiency'}
              {module.outcome === 'material_def' && 'Material deficiency'}
              {module.outcome === 'info_gap' && 'Information gap'}
              {module.outcome === 'na' && 'N/A'}
            </span>
          )}
        </div>
        {/* Icon-only badge for tablet view */}
        <div className="hidden md:block lg:hidden">
          {isDerived ? (
            <div className="w-2 h-2 rounded-full bg-violet-500" />
          ) : module.outcome && (
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
  };

  const CORE_MODULE_KEYS = new Set(['A1_DOC_CONTROL', 'A2_BUILDING_PROFILE', 'A3_PERSONS_AT_RISK', 'A7_REVIEW_ASSURANCE']);
  const FRA_ADDITIONAL_A_KEYS = new Set(['A4_MANAGEMENT_CONTROLS', 'A5_EMERGENCY_ARRANGEMENTS']);

  const sections = [
    {
      key: 'core',
      label: 'Core',
      modules: sortByOrder(modules.filter((m) => CORE_MODULE_KEYS.has(m.module_key))),
    },
    {
      key: 'fra',
      label: 'Fire Risk Assessment',
      modules: sortByOrder(modules.filter((m) => m.module_key.startsWith('FRA_') || FRA_ADDITIONAL_A_KEYS.has(m.module_key))),
    },
    {
      key: 'fsd',
      label: 'Fire Strategy Design',
      modules: sortByOrder(modules.filter((m) => m.module_key.startsWith('FSD_'))),
    },
    {
      key: 'dsear',
      label: 'Explosive Atmospheres',
      modules: sortByOrder(modules.filter((m) => m.module_key.startsWith('DSEAR_'))),
    },
    {
      key: 're',
      label: 'Risk Engineering',
      modules: sortByOrder(modules.filter((m) => m.module_key.startsWith('RE_') || m.module_key === 'RISK_ENGINEERING')),
    },
    {
      key: 'other',
      label: 'Additional',
      modules: sortByOrder(modules.filter((m) => {
        const key = m.module_key;
        return !CORE_MODULE_KEYS.has(key)
          && !FRA_ADDITIONAL_A_KEYS.has(key)
          && !key.startsWith('FRA_')
          && !key.startsWith('FSD_')
          && !key.startsWith('DSEAR_')
          && !key.startsWith('RE_')
          && key !== 'RISK_ENGINEERING';
      })),
    },
  ].filter((section) => section.modules.length > 0);

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
        <div className="space-y-1 p-2 lg:p-3">
          {sections.map((section) => (
            <div key={section.key} className="space-y-1">
              <div className="px-1.5 py-1 md:hidden lg:block">
                <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-[0.08em]">{section.label}</h3>
              </div>
              {section.modules.map((module) => (
                <ModuleNavItem key={module.id} module={module} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
