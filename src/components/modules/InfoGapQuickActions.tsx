import { AlertCircle, CheckCircle, Plus } from 'lucide-react';
import { InfoGapDetection } from '../../utils/infoGapQuickActions';

interface InfoGapQuickActionsProps {
  detection: InfoGapDetection;
  moduleKey: string;
  onCreateAction?: (actionText: string, priority: 'P2' | 'P3') => void;
  showCreateButtons?: boolean;
}

export default function InfoGapQuickActions({
  detection,
  moduleKey,
  onCreateAction,
  showCreateButtons = true,
}: InfoGapQuickActionsProps) {
  if (!detection.hasInfoGap) {
    return null;
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-amber-900 mb-1">Information Gaps Detected</h4>
          {detection.reasons.length > 0 && (
            <ul className="text-sm text-amber-800 space-y-1 mb-3">
              {detection.reasons.map((reason, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-amber-600 mt-1">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {detection.quickActions.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-amber-200">
          <h5 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Recommended Actions to Resolve
          </h5>
          <div className="space-y-2">
            {detection.quickActions.map((quickAction, index) => (
              <div
                key={index}
                className="bg-white border border-amber-200 rounded-lg p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          quickAction.priority === 'P2'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {quickAction.priority}
                      </span>
                      <p className="text-sm font-medium text-neutral-900 flex-1">
                        {quickAction.action}
                      </p>
                    </div>
                    <p className="text-xs text-neutral-600 pl-0">
                      <span className="font-medium">Why:</span> {quickAction.reason}
                    </p>
                  </div>
                  {showCreateButtons && onCreateAction && (
                    <button
                      onClick={() => onCreateAction(quickAction.action, quickAction.priority)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors flex-shrink-0"
                      title="Add this action to the action register"
                    >
                      <Plus className="h-3 w-3" />
                      Add Action
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!showCreateButtons && (
            <p className="text-xs text-amber-700 italic mt-2">
              Tip: Address these information gaps to improve assessment completeness and reduce risk uncertainty.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
