import { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import {
  requestApproval,
  approveDocument,
  rejectDocument,
  clearApprovalStatus,
  getApprovalStatusDisplay,
  ApprovalStatus,
  isApprovalRequired,
} from '../../utils/approvalWorkflow';

interface ApprovalManagementModalProps {
  documentId: string;
  documentTitle: string;
  currentApprovalStatus: ApprovalStatus;
  approvalNotes: string | null;
  approvedBy: string | null;
  approvalDate: string | null;
  userId: string;
  organisationId: string;
  userRole: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ApprovalManagementModal({
  documentId,
  documentTitle,
  currentApprovalStatus,
  approvalNotes,
  approvedBy,
  approvalDate,
  userId,
  organisationId,
  userRole,
  onClose,
  onSuccess,
}: ApprovalManagementModalProps) {
  const [action, setAction] = useState<'request' | 'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [approvalRequiredInOrg, setApprovalRequiredInOrg] = useState(false);

  useEffect(() => {
    checkApprovalRequired();
  }, [organisationId]);

  const checkApprovalRequired = async () => {
    const required = await isApprovalRequired(organisationId);
    setApprovalRequiredInOrg(required);
  };

  const handleRequestApproval = async () => {
    setIsProcessing(true);
    try {
      const result = await requestApproval(documentId, userId, notes);
      if (result.success) {
        onSuccess();
        onClose();
      } else {
        alert(result.error || 'Failed to request approval');
      }
    } catch (error) {
      console.error('Error requesting approval:', error);
      alert('Failed to request approval');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      const result = await approveDocument(documentId, userId, notes);
      if (result.success) {
        onSuccess();
        onClose();
      } else {
        alert(result.error || 'Failed to approve document');
      }
    } catch (error) {
      console.error('Error approving document:', error);
      alert('Failed to approve document');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!notes.trim()) {
      alert('Rejection reason is required');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await rejectDocument(documentId, userId, notes);
      if (result.success) {
        onSuccess();
        onClose();
      } else {
        alert(result.error || 'Failed to reject document');
      }
    } catch (error) {
      console.error('Error rejecting document:', error);
      alert('Failed to reject document');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearStatus = async () => {
    if (!confirm('Are you sure you want to clear the approval status?')) {
      return;
    }

    setIsProcessing(true);
    try {
      const result = await clearApprovalStatus(documentId);
      if (result.success) {
        onSuccess();
        onClose();
      } else {
        alert(result.error || 'Failed to clear approval status');
      }
    } catch (error) {
      console.error('Error clearing approval status:', error);
      alert('Failed to clear approval status');
    } finally {
      setIsProcessing(false);
    }
  };

  const statusConfig = getApprovalStatusDisplay(currentApprovalStatus);
  const canManageApproval = userRole === 'org_admin' || userRole === 'platform_admin';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-bold text-neutral-900">Approval Management</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h3 className="font-semibold text-neutral-900 mb-2">{documentTitle}</h3>
            <p className="text-sm text-neutral-600">
              Internal approval is separate from document issue. Approval is used for
              quality control and management sign-off before formal issue to clients.
            </p>
          </div>

          {!approvalRequiredInOrg && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-900 mb-1">
                    Approval Not Required
                  </p>
                  <p className="text-sm text-blue-800">
                    This organisation does not require approval before issuing documents.
                    You can still use approval for internal quality control.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-semibold text-neutral-700 mb-3">
              Current Approval Status
            </h4>
            <div className="flex items-center gap-3 mb-3">
              <span
                className={`inline-flex px-3 py-1 text-sm font-medium rounded-full border ${statusConfig.bgColor} ${statusConfig.borderColor} ${statusConfig.color}`}
              >
                {statusConfig.label}
              </span>
            </div>
            {approvalDate && (
              <p className="text-sm text-neutral-600 mb-1">
                <span className="font-medium">Date:</span>{' '}
                {new Date(approvalDate).toLocaleDateString('en-GB')}
              </p>
            )}
            {approvalNotes && (
              <div className="mt-3 pt-3 border-t border-neutral-200">
                <p className="text-sm font-medium text-neutral-700 mb-1">Notes:</p>
                <p className="text-sm text-neutral-600">{approvalNotes}</p>
              </div>
            )}
          </div>

          {!action && (
            <div className="space-y-3">
              {currentApprovalStatus === 'not_required' && (
                <button
                  onClick={() => setAction('request')}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Clock className="w-5 h-5" />
                  Request Approval
                </button>
              )}

              {currentApprovalStatus === 'pending' && canManageApproval && (
                <>
                  <button
                    onClick={() => setAction('approve')}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Approve Document
                  </button>
                  <button
                    onClick={() => setAction('reject')}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-5 h-5" />
                    Reject Document
                  </button>
                </>
              )}

              {(currentApprovalStatus === 'approved' || currentApprovalStatus === 'rejected') && canManageApproval && (
                <button
                  onClick={handleClearStatus}
                  className="w-full px-4 py-3 border-2 border-neutral-300 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition-colors"
                >
                  Clear Approval Status
                </button>
              )}

              {currentApprovalStatus === 'rejected' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-900 mb-2">
                    Document Rejected
                  </p>
                  <p className="text-sm text-red-800">
                    This document has been rejected and cannot be issued. Please address
                    the rejection reasons noted above before requesting approval again.
                  </p>
                </div>
              )}
            </div>
          )}

          {action && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {action === 'reject' ? 'Rejection Reason (Required)' : 'Notes (Optional)'}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={
                    action === 'reject'
                      ? 'Explain why this document is being rejected...'
                      : 'Add any comments or notes...'
                  }
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setAction(null);
                    setNotes('');
                  }}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 border-2 border-neutral-300 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (action === 'request') handleRequestApproval();
                    else if (action === 'approve') handleApprove();
                    else if (action === 'reject') handleReject();
                  }}
                  disabled={isProcessing || (action === 'reject' && !notes.trim())}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    action === 'approve'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : action === 'reject'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isProcessing
                    ? 'Processing...'
                    : action === 'request'
                    ? 'Request Approval'
                    : action === 'approve'
                    ? 'Approve'
                    : 'Reject'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
