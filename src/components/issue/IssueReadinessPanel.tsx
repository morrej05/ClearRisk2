/**
 * Issue Readiness Panel
 *
 * Displays required modules, conditional requirements, and overall readiness status
 * for survey issuance. Uses client-side validation for UX; server is source of truth.
 *
 * Supports combined surveys (e.g., FRA + FSD) - validates all enabled modules.
 */

import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import {
  getRequiredModules,
  isModuleRequired,
  type SurveyType,
  type IssueCtx,
} from '../../utils/issueRequirements';
import {
  validateIssueEligibility,
  validateIssueEligibilityForModules,
  getValidationSummary,
  type ModuleProgress,
} from '../../utils/issueValidation';

interface IssueReadinessPanelProps {
  surveyId: string;
  surveyType?: SurveyType;
  enabledModules?: SurveyType[];
  ctx: IssueCtx;
  moduleProgress: ModuleProgress;
  answers: any;
  actions: any[];
  canIssue: boolean;
}

export default function IssueReadinessPanel({
  surveyType,
  enabledModules,
  ctx,
  moduleProgress,
  answers,
  actions,
  canIssue,
}: IssueReadinessPanelProps) {
  const modulesToValidate = enabledModules && enabledModules.length > 0
    ? enabledModules
    : surveyType ? [surveyType] : [];

  const validation = modulesToValidate.length > 1
    ? validateIssueEligibilityForModules(modulesToValidate, ctx, answers, moduleProgress, actions)
    : validateIssueEligibility(modulesToValidate[0] || 'FRA', ctx, answers, moduleProgress, actions);

  const allRequiredModules = new Map<string, ReturnType<typeof getRequiredModules>>();
  modulesToValidate.forEach((type) => {
    allRequiredModules.set(type, getRequiredModules(type, ctx));
  });

  const requiredModules = Array.from(allRequiredModules.values()).flat();
  const uniqueRequiredModules = Array.from(
    new Map(requiredModules.map(m => [m.key, m])).values()
  );

  const completedCount = uniqueRequiredModules.filter(
    (m) => isModuleRequired(m, ctx) && moduleProgress[m.key] === 'complete'
  ).length;
  const totalRequired = uniqueRequiredModules.filter((m) => isModuleRequired(m, ctx)).length;

  const getConditionalRequirements = () => {
    const conditionals: Array<{ label: string; met: boolean; moduleType?: string }> = [];

    if (modulesToValidate.includes('FRA')) {
      const fraLabel = modulesToValidate.length > 1 ? '[FRA] ' : '';

      if (ctx.scope_type && ['limited', 'desktop'].includes(ctx.scope_type)) {
        conditionals.push({
          label: `${fraLabel}Scope & Limitations text required`,
          met: !!answers?.scope_limitations?.trim(),
          moduleType: 'FRA',
        });
      }

      const hasRecommendations = actions.filter((a) => a.status !== 'closed').length > 0;
      const noSignificantFindings = answers?.no_significant_findings === true;

      conditionals.push({
        label: `${fraLabel}Recommendations OR "No Significant Findings" confirmed`,
        met: hasRecommendations || noSignificantFindings,
        moduleType: 'FRA',
      });
    }

    if (modulesToValidate.includes('FSD')) {
      const fsdLabel = modulesToValidate.length > 1 ? '[FSD] ' : '';
      if (ctx.engineered_solutions_used) {
        conditionals.push({
          label: `${fsdLabel}Limitations documented (engineered solutions)`,
          met: !!answers?.limitations_text?.trim(),
          moduleType: 'FSD',
        });
        conditionals.push({
          label: `${fsdLabel}Management assumptions documented (engineered solutions)`,
          met: !!answers?.management_assumptions_text?.trim(),
          moduleType: 'FSD',
        });
      }
    }

    if (modulesToValidate.includes('DSEAR')) {
      const dsearLabel = modulesToValidate.length > 1 ? '[DSEAR] ' : '';
      const substances = answers?.substances;
      const noDangerousSubstances = answers?.no_dangerous_substances === true;

      conditionals.push({
        label: `${dsearLabel}Dangerous substances identified OR "No dangerous substances" confirmed`,
        met: (substances && substances.length > 0) || noDangerousSubstances,
        moduleType: 'DSEAR',
      });

      const zones = answers?.zones;
      const noZonedAreas = answers?.no_zoned_areas === true;

      conditionals.push({
        label: `${dsearLabel}Zone classification OR "No zoned areas" confirmed`,
        met: (zones && zones.length > 0) || noZonedAreas,
        moduleType: 'DSEAR',
      });

      const hasActions = actions.filter((a) => a.status !== 'closed').length > 0;
      const controlsAdequate = answers?.controls_adequate_confirmed === true;

      conditionals.push({
        label: `${dsearLabel}Actions OR "Controls adequate" confirmed`,
        met: hasActions || controlsAdequate,
        moduleType: 'DSEAR',
      });
    }

    return conditionals;
  };

  const conditionalRequirements = getConditionalRequirements();

  if (!canIssue) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-slate-900 mb-1">Issue Permission Required</h3>
            <p className="text-sm text-slate-600">
              You do not have permission to issue this survey. Contact an administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Issuance Readiness</h3>
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              validation.eligible
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {validation.eligible ? 'Ready to Issue' : 'Not Ready'}
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-4">{getValidationSummary(validation)}</p>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-slate-700">Required Modules</h4>
              <span className="text-sm text-slate-500">
                {completedCount} / {totalRequired} Complete
              </span>
            </div>
            <div className="space-y-2">
              {uniqueRequiredModules.map((module) => {
                if (!isModuleRequired(module, ctx)) return null;

                const status = moduleProgress[module.key];
                const isComplete = status === 'complete';

                return (
                  <div key={module.key} className="flex items-center gap-2 text-sm">
                    {isComplete ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    )}
                    <span className={isComplete ? 'text-slate-700' : 'text-slate-500'}>
                      {module.label}
                    </span>
                    {!isComplete && (
                      <span className="ml-auto px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                        Incomplete
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {conditionalRequirements.length > 0 && (
            <div className="pt-3 border-t border-slate-200">
              <h4 className="text-sm font-medium text-slate-700 mb-2">
                Conditional Requirements
              </h4>
              <div className="space-y-2">
                {conditionalRequirements.map((req, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    {req.met ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    )}
                    <span className={req.met ? 'text-slate-700' : 'text-slate-500'}>
                      {req.label}
                    </span>
                    {!req.met && (
                      <span className="ml-auto px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                        Required
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
