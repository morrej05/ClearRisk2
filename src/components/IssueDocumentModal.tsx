import { X, FileCheck, AlertCircle } from 'lucide-react';

interface IssueDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isProcessing?: boolean;
}

export default function IssueDocumentModal({
  isOpen,
  onClose,
  onConfirm,
  isProcessing = false,
}: IssueDocumentModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-start justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-neutral-900">Issue Document?</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-neutral-400 hover:text-neutral-600 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-3 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">This action cannot be undone</p>
              <p>Once issued, the document will be locked and cannot be modified.</p>
            </div>
          </div>
          <p className="text-neutral-700 leading-relaxed">
            Issuing will lock actions, recommendations, and evidence from deletion and mark the
            report as final.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-neutral-50 rounded-b-lg">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Issuing...
              </>
            ) : (
              <>
                <FileCheck className="w-4 h-4" />
                Issue
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
