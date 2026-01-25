import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertTriangle, CheckCircle, FileCheck, Shield } from 'lucide-react';
import { issueDocument, validateDocumentForIssue } from '../../utils/documentVersioning';
import { generateAndLockPdf } from '../../utils/pdfLocking';
import { supabase } from '../../lib/supabase';
import { buildFraPdf } from '../../lib/pdf/buildFraPdf';
import { buildFsdPdf } from '../../lib/pdf/buildFsdPdf';
import { buildDsearPdf } from '../../lib/pdf/buildDsearPdf';
import { buildCombinedPdf } from '../../lib/pdf/buildCombinedPdf';
import { Button, Callout } from '../ui/DesignSystem';

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
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [validated, setValidated] = useState(false);
  const [issueProgress, setIssueProgress] = useState<string>('');

  const navigate = useNavigate();
  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const result = await validateDocumentForIssue(documentId, organisationId);

      if (result.valid) {
        setValidationError('');
        setValidationErrorCode('');
        setValidationWarnings(result.warnings || []);
        setValidated(true);
      } else {
        setValidationError(result.errors.join(', '));
        setValidationErrorCode('VALIDATION_FAILED');
        setValidationWarnings(result.warnings || []);
        setValidated(true);
      }
    } catch (error) {
      console.error('Error validating document:', error);
      setValidationError('Failed to validate document. Please try again.');
      setValidationErrorCode('VALIDATION_FAILED');
      setValidationWarnings([]);
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
        .eq('organisation_id', organisationId)
        .order('created_at', { ascending: true });

      if (moduleError) throw moduleError;

      const { data: actions, error: actionError } = await supabase
        .from('actions')
        .select('*')
        .eq('document_id', documentId)
        .eq('organisation_id', organisationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

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
        actionRatings: [],
        organisation: org,
      };

      const enabledModules = document.enabled_modules || [document.document_type];
      const isCombined = enabledModules.length > 1 &&
                         enabledModules.includes('FRA') &&
                         enabledModules.includes('FSD');

      if (isCombined) {
        pdfBytes = await buildCombinedPdf(buildOptions);
      } else if (document.document_type === 'FRA') {
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

      // Verify the locked PDF path was actually saved to the database
      setIssueProgress('Verifying PDF lock...');

      const { data: verifyDoc, error: verifyError } = await supabase
        .from('documents')
        .select('locked_pdf_path')
        .eq('id', documentId)
        .single();

      if (verifyError) {
        throw new Error(`Failed to verify PDF lock: ${verifyError.message}`);
      }

      if (!verifyDoc?.locked_pdf_path) {
        throw new Error('Locked PDF path was not saved; cannot issue. Please try again.');
      }

      setIssueProgress('Updating document status...');

      const issueResult = await issueDocument(documentId, userId, organisationId);

      if (issueResult.success) {
        setIssueProgress('Complete!');
        setTimeout(() => {
          // Keep existing callbacks, but don't let them break navigation
          try { onSuccess(); } catch (e) { console.warn('onSuccess failed', e); }
          try { onClose(); } catch (e) { console.warn('onClose failed', e); }

          // Safe navigation (relative URL only; avoids local-credentialless absolute URL failures)
          navigate(`/documents/${documentId}/workspace`, { replace: true });
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
      <div className="bg-white rounded-lg border border-neutral-200 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900">Issue Document</h2>
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
            <Callout variant="warning" title="Validation Required" className="mb-6">
              <p className="mb-2">
                Before issuing, the document must pass server-side validation checks including:
              </p>
              <ul className="space-y-1 ml-4">
                <li>• Permissions verification</li>
                <li>• Module completeness check</li>
                <li>• Approval workflow compliance</li>
                <li>• Lifecycle state validation</li>
              </ul>
            </Callout>
          ) : !validationError ? (
            <>
              <Callout variant="success" title="Validation Passed" className="mb-6">
                All required checks passed. This document is ready to be issued.
              </Callout>
              {validationWarnings.length > 0 && (
                <Callout variant="warning" title="Optional Modules Incomplete" className="mb-6">
                  <p className="mb-2 text-sm">
                    The following optional modules have no data. You can still issue the document, but consider completing them:
                  </p>
                  <ul className="space-y-1 ml-4 text-sm">
                    {validationWarnings.map((warning, idx) => (
                      <li key={idx}>• {warning}</li>
                    ))}
                  </ul>
                </Callout>
              )}
            </>
          ) : (
            <Callout variant="danger" title="Cannot Issue Document" className="mb-6">
              <p className="mb-2">{validationError}</p>
              {validationErrorCode === 'APPROVAL_REQUIRED' && (
                <p className="mt-2 text-sm">
                  Go to Document Overview → Request Approval
                </p>
              )}
              {validationErrorCode === 'NO_PERMISSION' && (
                <p className="mt-2 text-sm">
                  Only users with edit permissions can issue documents.
                </p>
              )}
            </Callout>
          )}

          {isIssuing && (
            <Callout variant="info" className="mb-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                <div>
                  <p className="font-medium">Issuing Document...</p>
                  <p className="text-sm mt-1">{issueProgress}</p>
                </div>
              </div>
            </Callout>
          )}

          <Callout variant="info" title="What happens when you issue:">
            <ul className="space-y-1">
              <li>• A locked PDF will be generated and stored</li>
              <li>• The document will be marked as issued with today's date</li>
              <li>• All editing will be locked to preserve integrity</li>
              <li>• The PDF cannot change unless you create a new version</li>
              <li>• The document will be available for client sharing</li>
            </ul>
          </Callout>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 bg-white">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isValidating || isIssuing}
          >
            Cancel
          </Button>
          {!validated ? (
            <Button
              onClick={handleValidate}
              disabled={isValidating}
            >
              {isValidating ? 'Validating...' : 'Validate Document'}
            </Button>
          ) : !validationError ? (
            <Button
              onClick={handleIssue}
              disabled={isIssuing}
            >
              {isIssuing ? 'Issuing...' : 'Issue Document'}
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={onClose}
            >
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
