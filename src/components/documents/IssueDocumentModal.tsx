import { useState } from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';
import { issueDocument, validateDocumentForIssue } from '../../utils/documentVersioning';

interface IssueDocumentModalProps {
  documentId: string;
  documentTitle: string;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function IssueDocumentModal({
  documentId,
  documentTitle,
  userId,
  onClose,
  onSuccess,
}: IssueDocumentModalProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validated, setValidated] = useState(false);

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const result = await validateDocumentForIssue(documentId);
      setValidationErrors(result.errors);
      setValidated(true);
    } catch (error) {
      console.error('Error validating document:', error);
      setValidationErrors(['Failed to validate document']);
    } finally {
      setIsValidating(false);
    }
  };

  const handleIssue = async () => {
    setIsIssuing(true);
    try {
      const result = await issueDocument(documentId, userId);
      if (result.success) {
        onSuccess();
        onClose();
      } else {
        alert(result.error || 'Failed to issue document');
      }
    } catch (error) {
      console.error('Error issuing document:', error);
      alert('Failed to issue document');
    } finally {
      setIsIssuing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-bold text-neutral-900">Issue Document</h2>
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
              Issuing this document will lock it from further editing and make it available
              for download. This action will set the issue date to today.
            </p>
          </div>

          {!validated ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-900 mb-1">
                    Validation Required
                  </p>
                  <p className="text-sm text-amber-800">
                    Before issuing, the document must be validated to ensure all mandatory
                    sections are complete and there are no blocking errors.
                  </p>
                </div>
              </div>
            </div>
          ) : validationErrors.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-900 mb-1">Validation Passed</p>
                  <p className="text-sm text-green-800">
                    This document is ready to be issued.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-900 mb-2">Validation Failed</p>
                  <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900 font-medium mb-2">After issuing:</p>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>The document will be marked as issued with today's date</li>
              <li>All editing will be locked</li>
              <li>The document will remain available for download</li>
              <li>To make changes, you will need to create a new version</li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 bg-neutral-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors font-medium"
            disabled={isValidating || isIssuing}
          >
            Cancel
          </button>
          {!validated ? (
            <button
              onClick={handleValidate}
              disabled={isValidating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isValidating ? 'Validating...' : 'Validate Document'}
            </button>
          ) : validationErrors.length === 0 ? (
            <button
              onClick={handleIssue}
              disabled={isIssuing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isIssuing ? 'Issuing...' : 'Issue Document'}
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
