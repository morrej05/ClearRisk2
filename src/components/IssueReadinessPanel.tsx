import { CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { getRequiredModules, isModuleRequired, type SurveyType, type ValidationContext } from '../utils/issueRequirements';
import type { Blocker } from '../utils/issueValidation';

interface IssueReadinessPanelProps {
  surveyType: SurveyType;
  validationContext: ValidationContext;
  moduleProgress: Record<string, 'complete' | 'incomplete' | 'not_started'>;
  blockers: Blocker[];
  isExpanded?: boolean;
}

export default function IssueReadinessPanel({
  surveyType,
  validationContext,
  moduleProgress,
  blockers,
  isExpanded = false,
}: IssueReadinessPanelProps) {
  const [expanded, setExpanded] = useState(isExpanded);

  const requiredModules = getRequiredModules(surveyType, validationContext);
  const activeModules = requiredModules.filter(m => isModuleRequired(m, validationContext));

  const completedCount = activeModules.filter(
    m => moduleProgress[m.key] === 'complete'
  ).length;
  const totalCount = activeModules.length;

  const isReady = blockers.length === 0;
  const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isReady ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-600" />
          )}
          <div className="text-left">
            <h3 className="font-semibold text-neutral-900">Issue Readiness</h3>
            <p className="text-sm text-neutral-600">
              {completedCount} of {totalCount} required modules complete ({completionPercent}%)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isReady ? (
            <span className="text-sm font-medium text-green-600">Ready to Issue</span>
          ) : (
            <span className="text-sm font-medium text-amber-600">
              {blockers.length} issue{blockers.length !== 1 ? 's' : ''}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-neutral-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-neutral-400" />
          )}
        </div>
      </button>

      {/* Progress Bar */}
      <div className="px-4 pb-3">
        <div className="w-full bg-neutral-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              isReady ? 'bg-green-600' : 'bg-amber-600'
            }`}
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-neutral-200">
          {/* Module List */}
          <div className="p-4 space-y-2">
            <h4 className="text-sm font-semibold text-neutral-700 mb-3">Required Modules</h4>
            {activeModules.map(module => {
              const status = moduleProgress[module.key] || 'not_started';
              const isComplete = status === 'complete';
              const moduleBlockers = blockers.filter(b => b.moduleKey === module.key);

              return (
                <div
                  key={module.key}
                  className={`flex items-start gap-3 p-2 rounded-lg ${
                    isComplete ? 'bg-green-50' : 'bg-neutral-50'
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-neutral-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-neutral-900">{module.label}</p>
                    {moduleBlockers.length > 0 && (
                      <ul className="mt-1 space-y-1">
                        {moduleBlockers.map((blocker, idx) => (
                          <li key={idx} className="text-xs text-amber-700">
                            • {blocker.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* General Blockers */}
          {blockers.filter(b => !b.moduleKey).length > 0 && (
            <div className="px-4 pb-4">
              <h4 className="text-sm font-semibold text-neutral-700 mb-2">General Requirements</h4>
              <div className="space-y-2">
                {blockers
                  .filter(b => !b.moduleKey)
                  .map((blocker, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-800">{blocker.message}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
