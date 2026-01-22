import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { ChangeSummary, getChangeSummary, getChangeSummaryStats, formatChangeSummaryText } from '../../utils/changeSummary';

interface ChangeSummaryPanelProps {
  documentId: string;
  className?: string;
}

export default function ChangeSummaryPanel({ documentId, className = '' }: ChangeSummaryPanelProps) {
  const [summary, setSummary] = useState<ChangeSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, [documentId]);

  const fetchSummary = async () => {
    setIsLoading(true);
    const data = await getChangeSummary(documentId);
    setSummary(data);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg border border-neutral-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-neutral-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-neutral-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-neutral-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className={`bg-neutral-50 rounded-lg border border-neutral-200 p-6 ${className}`}>
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-neutral-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-neutral-700">No Change Summary</p>
            <p className="text-sm text-neutral-600 mt-1">
              This is the first issued version or change tracking was not available.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const stats = getChangeSummaryStats(summary);
  const formattedText = formatChangeSummaryText(summary);

  return (
    <div className={`bg-white rounded-lg border border-neutral-200 ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-200">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {stats.improvement ? (
              <TrendingUp className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            ) : stats.deterioration ? (
              <TrendingDown className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            ) : (
              <Minus className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <h3 className="font-semibold text-neutral-900">Changes Since Last Issue</h3>
              <p className="text-sm text-neutral-600 mt-1">
                Generated {new Date(summary.generated_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {summary.has_material_changes ? (
            <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded">
              Material Changes
            </span>
          ) : (
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
              No Material Changes
            </span>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-neutral-50 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-neutral-700">New Actions</span>
          </div>
          <p className="text-2xl font-bold text-neutral-900">{summary.new_actions_count}</p>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-neutral-700">Closed Actions</span>
          </div>
          <p className="text-2xl font-bold text-neutral-900">{summary.closed_actions_count}</p>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-neutral-700">Outstanding</span>
          </div>
          <p className="text-2xl font-bold text-neutral-900">{summary.outstanding_actions_count}</p>
        </div>
      </div>

      {/* New Actions */}
      {summary.new_actions.length > 0 && (
        <div className="px-6 py-4 border-b border-neutral-200">
          <h4 className="font-medium text-neutral-900 mb-3">
            New Actions ({summary.new_actions.length})
          </h4>
          <div className="space-y-2">
            {summary.new_actions.map((action: any, index: number) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 mt-0.5 ${
                  action.priority_band === 'P1' ? 'bg-red-100 text-red-700' :
                  action.priority_band === 'P2' ? 'bg-amber-100 text-amber-700' :
                  action.priority_band === 'P3' ? 'bg-blue-100 text-blue-700' :
                  'bg-neutral-100 text-neutral-700'
                }`}>
                  {action.priority_band}
                </span>
                <p className="text-neutral-700 flex-1">{action.recommended_action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Closed Actions */}
      {summary.closed_actions.length > 0 && (
        <div className="px-6 py-4 border-b border-neutral-200">
          <h4 className="font-medium text-neutral-900 mb-3">
            Closed Actions ({summary.closed_actions.length})
          </h4>
          <div className="space-y-2">
            {summary.closed_actions.map((action: any, index: number) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 mt-0.5 ${
                  action.priority_band === 'P1' ? 'bg-red-100 text-red-700' :
                  action.priority_band === 'P2' ? 'bg-amber-100 text-amber-700' :
                  action.priority_band === 'P3' ? 'bg-blue-100 text-blue-700' :
                  'bg-neutral-100 text-neutral-700'
                }`}>
                  {action.priority_band}
                </span>
                <p className="text-neutral-700 flex-1 line-through opacity-70">{action.recommended_action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Text */}
      {summary.summary_text && (
        <div className="px-6 py-4 bg-neutral-50">
          <h4 className="font-medium text-neutral-900 mb-2">Summary Notes</h4>
          <p className="text-sm text-neutral-700 whitespace-pre-wrap">{summary.summary_text}</p>
        </div>
      )}

      {/* Client Visibility Badge */}
      {!summary.visible_to_client && (
        <div className="px-6 py-3 bg-amber-50 border-t border-amber-200">
          <p className="text-sm text-amber-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            This change summary is hidden from client view
          </p>
        </div>
      )}
    </div>
  );
}
