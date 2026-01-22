import { CheckCircle, Circle, FileText, ListTodo, Image, CheckSquare, Sparkles, Edit3 } from 'lucide-react';

interface DraftCompletenessBannerProps {
  documentId: string;
  issueStatus: string;
  executiveSummaryMode: 'ai' | 'author' | 'both' | 'none';
  executiveSummaryAi: string | null;
  executiveSummaryAuthor: string | null;
  totalActions: number;
  evidenceCount: number;
  approvalStatus: string | null;
  onGenerateAiSummary?: () => void;
  onAddAuthorCommentary?: () => void;
  onViewActions?: () => void;
  onAddEvidence?: () => void;
  onManageApproval?: () => void;
}

export default function DraftCompletenessBanner({
  documentId,
  issueStatus,
  executiveSummaryMode,
  executiveSummaryAi,
  executiveSummaryAuthor,
  totalActions,
  evidenceCount,
  approvalStatus,
  onGenerateAiSummary,
  onAddAuthorCommentary,
  onViewActions,
  onAddEvidence,
  onManageApproval,
}: DraftCompletenessBannerProps) {
  if (issueStatus !== 'draft') {
    return null;
  }

  const checkExecutiveSummary = (): boolean => {
    if (executiveSummaryMode === 'none') return true;
    if (executiveSummaryMode === 'ai' && executiveSummaryAi) return true;
    if (executiveSummaryMode === 'author' && executiveSummaryAuthor) return true;
    if (executiveSummaryMode === 'both' && executiveSummaryAi && executiveSummaryAuthor) return true;
    return false;
  };

  const checkActions = (): boolean => {
    return totalActions > 0;
  };

  const checkEvidence = (): boolean => {
    return evidenceCount > 0;
  };

  const checkApproval = (): boolean => {
    return approvalStatus === 'approved';
  };

  const summaryComplete = checkExecutiveSummary();
  const actionsComplete = checkActions();
  const evidenceComplete = checkEvidence();
  const approvalComplete = checkApproval();

  const allComplete = summaryComplete && actionsComplete;

  const getSummaryMessage = (): string => {
    if (executiveSummaryMode === 'none') return 'No executive summary required';
    if (executiveSummaryMode === 'ai' && !executiveSummaryAi) return 'Generate AI summary';
    if (executiveSummaryMode === 'author' && !executiveSummaryAuthor) return 'Add author commentary';
    if (executiveSummaryMode === 'both') {
      if (!executiveSummaryAi && !executiveSummaryAuthor) return 'Generate AI summary and add commentary';
      if (!executiveSummaryAi) return 'Generate AI summary';
      if (!executiveSummaryAuthor) return 'Add author commentary';
    }
    return 'Executive summary complete';
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4 mb-6 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-neutral-900 mb-1">
            {allComplete ? 'Document Ready for Review' : 'Draft Completeness Checklist'}
          </h3>
          <p className="text-sm text-neutral-600">
            {allComplete
              ? 'All required items are complete. Review the document and issue when ready.'
              : 'Complete these items before issuing the document. This checklist is for guidance only and does not block issuing.'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3 group">
          {summaryComplete ? (
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          ) : (
            <Circle className="w-5 h-5 text-neutral-300 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className={`text-sm font-medium ${summaryComplete ? 'text-neutral-700' : 'text-neutral-900'}`}>
                Executive Summary: {getSummaryMessage()}
              </p>
              {!summaryComplete && executiveSummaryMode !== 'none' && (
                <div className="flex gap-2 flex-shrink-0">
                  {(executiveSummaryMode === 'ai' || executiveSummaryMode === 'both') && !executiveSummaryAi && onGenerateAiSummary && (
                    <button
                      onClick={onGenerateAiSummary}
                      className="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors flex items-center gap-1 font-medium"
                    >
                      <Sparkles className="w-3 h-3" />
                      Generate AI
                    </button>
                  )}
                  {(executiveSummaryMode === 'author' || executiveSummaryMode === 'both') && !executiveSummaryAuthor && onAddAuthorCommentary && (
                    <button
                      onClick={onAddAuthorCommentary}
                      className="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors flex items-center gap-1 font-medium"
                    >
                      <Edit3 className="w-3 h-3" />
                      Add Commentary
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 group">
          {actionsComplete ? (
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          ) : (
            <Circle className="w-5 h-5 text-neutral-300 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className={`text-sm font-medium ${actionsComplete ? 'text-neutral-700' : 'text-neutral-900'}`}>
                Actions: {actionsComplete ? `${totalActions} action${totalActions !== 1 ? 's' : ''} recorded` : 'No actions recorded'}
              </p>
              {!actionsComplete && onViewActions && (
                <button
                  onClick={onViewActions}
                  className="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors flex items-center gap-1 font-medium flex-shrink-0"
                >
                  <ListTodo className="w-3 h-3" />
                  View Actions
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 group">
          {evidenceComplete ? (
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          ) : (
            <Circle className="w-5 h-5 text-neutral-300 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className={`text-sm ${evidenceComplete ? 'text-neutral-600' : 'text-neutral-500'}`}>
                Evidence: {evidenceComplete ? `${evidenceCount} file${evidenceCount !== 1 ? 's' : ''} attached` : 'Optional - no evidence attached'}
              </p>
              {onAddEvidence && (
                <button
                  onClick={onAddEvidence}
                  className="text-xs px-3 py-1 bg-neutral-50 text-neutral-600 rounded hover:bg-neutral-100 transition-colors flex items-center gap-1 flex-shrink-0"
                >
                  <Image className="w-3 h-3" />
                  Add Evidence
                </button>
              )}
            </div>
          </div>
        </div>

        {approvalStatus && (
          <div className="flex items-start gap-3 group">
            {approvalComplete ? (
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-neutral-300 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm ${approvalComplete ? 'text-neutral-600' : 'text-neutral-500'}`}>
                  Approval: {approvalComplete ? 'Document approved' : 'Optional - not yet approved'}
                </p>
                {onManageApproval && (
                  <button
                    onClick={onManageApproval}
                    className="text-xs px-3 py-1 bg-neutral-50 text-neutral-600 rounded hover:bg-neutral-100 transition-colors flex items-center gap-1 flex-shrink-0"
                  >
                    <CheckSquare className="w-3 h-3" />
                    Manage Approval
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
