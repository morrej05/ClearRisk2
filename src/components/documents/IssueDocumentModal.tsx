import { useState } from 'react';
import { X, AlertTriangle, CheckCircle, FileCheck, Shield } from 'lucide-react';
import { issueDocument, validateDocumentForIssue } from '../../utils/documentVersioning';
import { generateAndLockPdf } from '../../utils/pdfLocking';
import { supabase } from '../../lib/supabase';
import { buildFraPdf } from '../../lib/pdf/buildFraPdf';
import { buildFsdPdf } from '../../lib/pdf/buildFsdPdf';
import { buildDsearPdf } from '../../lib/pdf/buildDsearPdf';

interface IssueDocumentModalProps {
  documentId: string;
  documentTitle: string;
  userId: string;
  organisationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function IssueDocumentModal({
  documentId,
  documentTitle,
  userId,
  organisationId,
  onClose,
  onSuccess,
}: IssueDocumentModalProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [validationErrorCode, setValidationErrorCode] = useState<string>('');
  const [validated, setValidated] = useState(false);
  const [issueProgress, setIssueProgress] = useState<string>('');

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const result = await validateDocumentForIssue(documentId, organisationId);

      if (result.valid) {
        setValidationError('');
        setValidationErrorCode('');
        setValidated(true);
      } else {
        setValidationError(result.errors.join(', '));
        setValidationErrorCode('VALIDATION_FAILED');
        setValidated(true);
      }
    } catch (error) {
      console.error('Error validating document:', error);
      setValidationError('Failed to validate document. Please try again.');
      setValidationErrorCode('VALIDATION_FAILED');
      setValidated(true);
    } finally {
      setIsValidating(false);
    }
  };

  const handleIssue = async () => {
    setIsIssuing(true);
    setIssueProgress('Fetching document data...');

    try {
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError) throw docError;

      setIssueProgress('Loading modules and actions...');

      const { data: modules, error: moduleError } = await supabase
        .from('module_instances')
        .select('*')
        .eq('document_id', documentId)
        .order('display_order', { ascending: true });

      if (moduleError) throw moduleError;

      const { data: actions, error: actionError } = await supabase
        .from('actions')
        .select('*')
        .eq('document_id', documentId)
        .eq('is_deleted', false)
        .order('priority', { ascending: true });

      if (actionError) throw actionError;

      const { data: org, error: orgError } = await supabase
        .from('organisations')
        .select('*')
        .eq('id', organisationId)
        .single();

      if (orgError) throw orgError;

      setIssueProgress('Generating PDF...');

      let pdfBytes: Uint8Array;

      const buildOptions = {
        document,
        moduleInstances: modules || [],
        actions: actions || [],
        actionRatings: {},
        organisation: org,
      };

      if (document.document_type === 'FRA') {
        pdfBytes = await buildFraPdf(buildOptions);
      } else if (document.document_type === 'FSD') {
        pdfBytes = await buildFsdPdf(buildOptions);
      } else if (document.document_type === 'DSEAR') {
        pdfBytes = await buildDsearPdf(buildOptions);
      } else {
        throw new Error('Unsupported document type');
      }

      setIssueProgress('Uploading and locking PDF...');

      const lockResult = await generateAndLockPdf(
        documentId,
        organisationId,
        document.title,
        document.version_number,
        pdfBytes
      );

      if (!lockResult.success) {
        throw new Error(lockResult.error || 'Failed to lock PDF');
      }

      setIssueProgress('Updating document status...');

      const issueResult = await issueDocument(documentId, userId, organisationId);

      if (issueResult.success) {
        setIssueProgress('Complete!');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 500);
      } else {
        throw new Error(issueResult.error || 'Failed to issue document');
      }
    } catch (error: any) {
      console.error('Error issuing document:', error);
      alert(error.message || 'Failed to issue document. Document remains in draft.');
      setIssueProgress('');
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
                <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-900 mb-1">
                    Validation Required
                  </p>
                  <p className="text-sm text-amber-800">
                    Before issuing, the document must pass server-side validation checks including:
                  </p>
                  <ul className="text-sm text-amber-800 mt-2 space-y-1 ml-4">
                    <li>• Permissions verification</li>
                    <li>• Module completeness check</li>
                    <li>• Approval workflow compliance</li>
                    <li>• Lifecycle state validation</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : !validationError ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-900 mb-1">Validation Passed</p>
                  <p className="text-sm text-green-800">
                    All checks passed. This document is ready to be issued.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-900 mb-2">Cannot Issue Document</p>
                  <p className="text-sm text-red-800">{validationError}</p>
                  {validationErrorCode === 'APPROVAL_REQUIRED' && (
                    <p className="text-sm text-red-700 mt-2">
                      Go to Document Overview → Request Approval
                    </p>
                  )}
                  {validationErrorCode === 'NO_PERMISSION' && (
                    <p className="text-sm text-red-700 mt-2">
                      Only users with edit permissions can issue documents.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {isIssuing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <div>
                  <p className="font-medium text-blue-900">Issuing Document...</p>
                  <p className="text-sm text-blue-800">{issueProgress}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileCheck className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-900 font-medium mb-2">What happens when you issue:</p>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• A locked PDF will be generated and stored</li>
                  <li>• The document will be marked as issued with today's date</li>
                  <li>• All editing will be locked to preserve integrity</li>
                  <li>• The PDF cannot change unless you create a new version</li>
                  <li>• The document will be available for client sharing</li>
                </ul>
              </div>
            </div>
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
          ) : !validationError ? (
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
