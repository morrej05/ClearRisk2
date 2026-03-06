import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, AlertCircle, FileText, X, ChevronDown, ChevronRight, Flame, Zap } from 'lucide-react';
import {
  buildModuleSections,
  getModuleCode,
  getModuleDisplayName,
  isDerivedModule,
  type ModuleInstance,
} from '../../lib/modules/moduleDisplay';
import { getDsearSpecificModuleKeys, getFireRiskModuleKeys, getModuleOutcomeCategory } from '../../lib/modules/moduleCatalog';

interface ModuleSidebarProps {
  modules: ModuleInstance[];
  selectedModuleId: string | null;
  selectedModuleKey?: string | null;
  onModuleSelect: (moduleId: string) => void;
  isMobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
  documentId?: string;
}

export default function ModuleSidebar({
  modules,
  selectedModuleId,
  selectedModuleKey,
  onModuleSelect,
  isMobileMenuOpen,
  onCloseMobileMenu,
  documentId,
}: ModuleSidebarProps) {
  // Load/save expand/collapse state from localStorage
  const storageKey = documentId ? `moduleNavGroups:${documentId}` : null;

  const loadExpandedState = (): { fra: boolean; dsear: boolean; other: boolean } => {
    if (!storageKey) return { fra: true, dsear: false, other: true };
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { fra: parsed.fra ?? true, dsear: parsed.dsear ?? false, other: parsed.other ?? true };
      }
    } catch (e) {
      console.warn('Failed to load module nav state:', e);
    }
    return { fra: true, dsear: false, other: true };
  };

  const [expandedState, setExpandedState] = useState(loadExpandedState);

  useEffect(() => {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(expandedState));
      } catch (e) {
        console.warn('Failed to save module nav state:', e);
      }
    }
  }, [expandedState, storageKey]);

  const toggleGroup = (group: 'fra' | 'dsear' | 'other') => {
    setExpandedState(prev => ({ ...prev, [group]: !prev[group] }));
  };

  // Determine if we should use grouped UI
  const dsearSpecificKeys = getDsearSpecificModuleKeys();
  const fireRiskKeys = getFireRiskModuleKeys();

  const fraModules = modules.filter(
    (module) => fireRiskKeys.has(module.module_key) && !dsearSpecificKeys.has(module.module_key)
  );
  const dsearModules = modules.filter((module) => dsearSpecificKeys.has(module.module_key));
  const otherModules = modules.filter(
    (module) => !fireRiskKeys.has(module.module_key) && !dsearSpecificKeys.has(module.module_key)
  );

  const shouldUseGroupedUI = fraModules.length > 0 && dsearModules.length > 0;
  const showProductTags = shouldUseGroupedUI;

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

  const getOutcomeLabel = (outcome: string, moduleKey: string): string => {
    const category = getModuleOutcomeCategory(moduleKey);

    if (category === 'governance') {
      if (outcome === 'compliant') return 'Adequate';
      if (outcome === 'minor_def') return 'Improvement Recommended';
      if (outcome === 'material_def') return 'Significant Improvement Required';
      if (outcome === 'info_gap') return 'Information Incomplete';
      if (outcome === 'na') return 'Not Applicable';
    } else {
      if (outcome === 'compliant') return 'Compliant';
      if (outcome === 'minor_def') return 'Minor Deficiency';
      if (outcome === 'material_def') return 'Material Deficiency';
      if (outcome === 'info_gap') return 'Information Gap';
      if (outcome === 'na') return 'Not Applicable';
    }

    return outcome;
  };

  const ModuleNavItem = ({ module, productTag }: { module: ModuleInstance; productTag?: 'fire' | 'explosion' | null }) => {
    const isDerived = isDerivedModule(module.module_key);
    const storedOutcome = module.data?.section_assessment_outcome ?? module.outcome ?? '';

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
          {!isDerived && storedOutcome && storedOutcome !== 'info_gap' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : !isDerived && storedOutcome === 'info_gap' ? (
            <AlertCircle className="w-4 h-4 text-blue-600" />
          ) : !isDerived ? (
            <Circle className="w-4 h-4 text-neutral-300" />
          ) : (
            <div className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 min-w-0 md:hidden lg:block">
          <div className="flex items-start gap-2">
            <p className="text-sm font-medium text-neutral-900 leading-5 flex-1 min-w-0">
              {getModuleDisplayName(module.module_key)}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {showProductTags && productTag && (
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] font-medium tracking-wide rounded-md border ${
                  productTag === 'fire'
                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                    : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                }`}>
                  {productTag === 'fire' ? (
                    <>
                      <Flame className="w-2.5 h-2.5" />
                      <span>Fire</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-2.5 h-2.5" />
                      <span>Ex</span>
                    </>
                  )}
                </span>
              )}
              {isDerived && (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium tracking-wide rounded-md bg-neutral-50 text-neutral-500 border border-neutral-200">
                  Auto
                </span>
              )}
              <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-semibold tracking-wide rounded-md bg-neutral-100 text-neutral-600 border border-neutral-200">
                {getModuleCode(module.module_key)}
              </span>
            </div>
          </div>
          {!isDerived && storedOutcome && (
            <span
              className={`inline-flex mt-1 px-2 py-0.5 text-[11px] font-medium rounded border ${getOutcomeColor(
                storedOutcome
              )}`}
            >
              {getOutcomeLabel(storedOutcome, module.module_key)}
            </span>
          )}
        </div>
        {/* Icon-only badge for tablet view */}
        <div className="hidden md:block lg:hidden">
          {!isDerived && storedOutcome && (
            <div className={`w-2 h-2 rounded-full ${
              storedOutcome === 'compliant' ? 'bg-green-600' :
              storedOutcome === 'minor_def' ? 'bg-amber-600' :
              storedOutcome === 'material_def' ? 'bg-red-600' :
              storedOutcome === 'info_gap' ? 'bg-blue-600' :
              'bg-neutral-400'
            }`} />
          )}
        </div>
      </div>
    </button>
    );
  };

  const sections = buildModuleSections(modules);

  const CollapsibleGroup = ({
    title,
    icon,
    count,
    groupKey,
    modules: groupModules,
    productTag,
  }: {
    title: string;
    icon?: React.ReactNode;
    count: number;
    groupKey: 'fra' | 'dsear' | 'other';
    modules: ModuleInstance[];
    productTag?: 'fire' | 'explosion' | null;
  }) => {
    const isExpanded = expandedState[groupKey];

    return (
      <div className="space-y-1">
        <button
          onClick={() => toggleGroup(groupKey)}
          className="w-full flex items-center justify-between px-2 py-2 hover:bg-neutral-100 rounded-lg transition-colors group md:px-1 lg:px-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            {icon && <span className="flex-shrink-0 md:hidden lg:inline-flex">{icon}</span>}
            <span className="text-xs font-bold text-neutral-700 uppercase tracking-wide truncate md:hidden lg:block">
              {title}
            </span>
            <span className="text-xs font-semibold text-neutral-500 flex-shrink-0">
              ({count})
            </span>
          </div>
          <div className="flex-shrink-0 md:hidden lg:block">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-neutral-500 group-hover:text-neutral-700" />
            ) : (
              <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-neutral-700" />
            )}
          </div>
        </button>
        {isExpanded && (
          <div className="space-y-1">
            {groupModules.map((module) => (
              <ModuleNavItem key={module.id} module={module} productTag={productTag} />
            ))}
          </div>
        )}
      </div>
    );
  };

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
        md:block md:sticky md:top-0 md:h-screen md:w-16
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
          {shouldUseGroupedUI ? (
            <>
              {/* Grouped UI for Fire + Explosion documents */}
              {fraModules.length > 0 && (
                <CollapsibleGroup
                  title="Fire Risk"
                  icon={<Flame className="w-3.5 h-3.5 text-orange-600" />}
                  count={fraModules.length}
                  groupKey="fra"
                  modules={fraModules}
                  productTag="fire"
                />
              )}
              {dsearModules.length > 0 && (
                <CollapsibleGroup
                  title="Explosive Atmospheres"
                  icon={<Zap className="w-3.5 h-3.5 text-yellow-600" />}
                  count={dsearModules.length}
                  groupKey="dsear"
                  modules={dsearModules}
                  productTag="explosion"
                />
              )}
              {otherModules.length > 0 && (
                <CollapsibleGroup
                  title="Other"
                  count={otherModules.length}
                  groupKey="other"
                  modules={otherModules}
                  productTag={null}
                />
              )}
            </>
          ) : (
            <>
              {/* Traditional UI for single-product documents */}
              {sections.map((section) => (
                <div key={section.key} className="space-y-1">
                  <div className="px-1.5 py-1 md:hidden lg:block">
                    <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-[0.08em]">{section.label}</h3>
                  </div>
                  {section.modules.map((module) => (
                    <ModuleNavItem key={module.id} module={module} productTag={null} />
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
