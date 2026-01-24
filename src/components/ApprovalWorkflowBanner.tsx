import { useState } from 'react';
import { AlertCircle, CheckCircle, Clock, FileCheck, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { isOrgAdmin } from '../utils/entitlements';

interface ApprovalWorkflowBannerProps {
  surveyId: string;
  status: string;
  approvedAt?: string | null;
  approvedBy?: string | null;
  approvalNote?: string | null;
  onStatusChange?: () => void;
}

export default function ApprovalWorkflowBanner({
  surveyId,
  status,
  approvedAt,
  approvedBy,
  approvalNote,
  onStatusChange,
}: ApprovalWorkflowBannerProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showApprovalNote, setShowApprovalNote] = useState(false);
  const [showReturnNote, setShowReturnNote] = useState(false);
  const [approvalNoteText, setApprovalNoteText] = useState('');
  const [returnNoteText, setReturnNoteText] = useState('');
  const [approverName, setApproverName] = useState<string | null>(null);

  const isAdmin = user ? isOrgAdmin(user.id) : false;

  // Fetch approver name if approved
  useState(() => {
    if (approvedBy) {
      supabase
        .from('user_profiles')
        .select('name')
        .eq('id', approvedBy)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setApproverName(data.name);
        });
    }
  });

  const handleSubmitForReview = async () => {
    if (!surveyId) return;

    const confirmed = window.confirm(
      'Submit this survey for review?\n\nOnce submitted, you will not be able to edit it until an admin reviews it.'
    );

    if (!confirmed) return;

    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/submit-for-review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ survey_id: surveyId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit for review');
      }

      alert('Survey submitted for review successfully!');
      onStatusChange?.();
    } catch (err: any) {
      console.error('Error submitting for review:', err);
      alert(`Failed to submit: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnToDraft = async () => {
    if (!surveyId) return;

    if (!showReturnNote) {
      setShowReturnNote(true);
      return;
    }

    setIsReturning(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/return-to-draft`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          survey_id: surveyId,
          note: returnNoteText || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to return to draft');
      }

      alert('Survey returned to draft successfully!');
      setShowReturnNote(false);
      setReturnNoteText('');
      onStatusChange?.();
    } catch (err: any) {
      console.error('Error returning to draft:', err);
      alert(`Failed to return to draft: ${err.message}`);
    } finally {
      setIsReturning(false);
    }
  };

  const handleApproveSurvey = async () => {
    if (!surveyId) return;

    if (!showApprovalNote) {
      setShowApprovalNote(true);
      return;
    }

    setIsApproving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/approve-survey`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          survey_id: surveyId,
          note: approvalNoteText || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to approve survey');
      }

      alert('Survey approved successfully!');
      setShowApprovalNote(false);
      setApprovalNoteText('');
      onStatusChange?.();
    } catch (err: any) {
      console.error('Error approving survey:', err);
      alert(`Failed to approve: ${err.message}`);
    } finally {
      setIsApproving(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
            <AlertCircle className="w-4 h-4" />
            Draft
          </span>
        );
      case 'in_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            In Review
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Approved
          </span>
        );
      case 'issued':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
            <FileCheck className="w-4 h-4" />
            Issued
          </span>
        );
      default:
        return null;
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'draft':
        return 'This survey is in draft mode. Submit for review when ready.';
      case 'in_review':
        return isAdmin
          ? 'This survey is pending your review. You can approve it or return it to draft.'
          : 'This survey has been submitted for review. An admin will review it shortly.';
      case 'approved':
        if (approvedAt && approverName) {
          const date = new Date(approvedAt).toLocaleDateString();
          return `Approved by ${approverName} on ${date}${approvalNote ? `: ${approvalNote}` : ''}`;
        }
        return 'This survey has been approved and is ready to be issued.';
      case 'issued':
        return 'This survey has been issued and is now locked.';
      default:
        return null;
    }
  };

  const getBannerColor = () => {
    switch (status) {
      case 'draft':
        return 'bg-slate-50 border-slate-200';
      case 'in_review':
        return 'bg-amber-50 border-amber-200';
      case 'approved':
        return 'bg-green-50 border-green-200';
      case 'issued':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className={`border-b ${getBannerColor()} print:hidden`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {getStatusBadge()}
            <p className="text-sm text-slate-600">{getStatusMessage()}</p>
          </div>

          <div className="flex items-center gap-2">
            {status === 'draft' && (
              <button
                onClick={handleSubmitForReview}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4" />
                    <span>Submit for Review</span>
                  </>
                )}
              </button>
            )}

            {status === 'in_review' && isAdmin && (
              <>
                <button
                  onClick={handleReturnToDraft}
                  disabled={isReturning}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {isReturning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Returning...</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      <span>Return to Draft</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleApproveSurvey}
                  disabled={isApproving}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {isApproving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Approving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Approve</span>
                    </>
                  )}
                </button>
              </>
            )}

            {status === 'approved' && isAdmin && (
              <button
                onClick={handleReturnToDraft}
                disabled={isReturning}
                className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isReturning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Returning...</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    <span>Return to Draft</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {showApprovalNote && (
          <div className="mt-4 bg-white border border-green-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Approval Note (Optional)
            </label>
            <textarea
              value={approvalNoteText}
              onChange={(e) => setApprovalNoteText(e.target.value)}
              placeholder="Add any comments about this approval..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              rows={3}
            />
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleApproveSurvey}
                disabled={isApproving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isApproving ? 'Approving...' : 'Confirm Approval'}
              </button>
              <button
                onClick={() => {
                  setShowApprovalNote(false);
                  setApprovalNoteText('');
                }}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showReturnNote && (
          <div className="mt-4 bg-white border border-slate-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Return Note (Optional)
            </label>
            <textarea
              value={returnNoteText}
              onChange={(e) => setReturnNoteText(e.target.value)}
              placeholder="Explain why this survey is being returned to draft..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
              rows={3}
            />
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleReturnToDraft}
                disabled={isReturning}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isReturning ? 'Returning...' : 'Confirm Return to Draft'}
              </button>
              <button
                onClick={() => {
                  setShowReturnNote(false);
                  setReturnNoteText('');
                }}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
