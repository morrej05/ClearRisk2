import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertTriangle, CheckCircle, FileCheck, Shield, ArrowRight, Lock } from 'lucide-react';
import { issueDocument, validateDocumentForIssue } from '../../utils/documentVersioning';
import { assignActionReferenceNumbers } from '../../utils/actionReferenceNumbers';
import { supabase } from '../../lib/supabase';
import { getModuleName } from '../../lib/modules/moduleCatalog';
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
  const [missingRequiredModules, setMissingRequiredModules] = useState<string[]>([]);
  const [validated, setValidated] = useState(false);
  const [issueProgress, setIssueProgress] = useState<string>('');
  const [documentVersion, setDocumentVersion] = useState<number>(1);
  const [baseDocumentId, setBaseDocumentId] = useState<string | null>(null);

  const navigate = useNavigate();

  // Helper to extract module keys from error messages
  const extractMissingModules = (errors: string[]): string[] => {
    const moduleKeys: string[] = [];
    errors.forEach(error => {
      // Match patterns like "Required module A1_DOC_CONTROL has no data"
      const match = error.match(/module ([A-Z0-9_]+)/i);
      if (match && match[1]) {
        moduleKeys.push(match[1]);
      }
    });
    return moduleKeys;
  };

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const { data: doc } = await supabase
        .from('documents')
        .select('version_number, base_document_id')
        .eq('id', documentId)
        .single();

      if (doc) {
        setDocumentVersion(doc.version_number);
        setBaseDocumentId(doc.base_document_id || documentId);
      }

      const result = await validateDocumentForIssue(documentId, organisationId);

      if (result.valid) {
        setValidationError('');
        setValidationErrorCode('');
        setValidationWarnings(result.warnings || []);
        setMissingRequiredModules([]);
        setValidated(true);
      } else {
        setValidationError(result.errors.join(', '));
        setValidationErrorCode('VALIDATION_FAILED');
        setValidationWarnings(result.warnings || []);
        setMissingRequiredModules(extractMissingModules(result.errors));
        setValidated(true);
      }
    } catch (error) {
      console.error('Error validating document:', error);
      setValidationError('Failed to validate document. Please try again.');
      setValidationErrorCode('VALIDATION_FAILED');
      setValidationWarnings([]);
      setMissingRequiredModules([]);
      setValidated(true);
    } finally {
      setIsValidating(false);
    }
  };

  const handleNavigateToModule = async (moduleKey: string) => {
    try {
      // Fetch module instance ID for this module key
      const { data: moduleInstance } = await supabase
        .from('module_instances')
        .select('id')
        .eq('document_id', documentId)
        .eq('organisation_id', organisationId)
        .eq('module_key', moduleKey)
        .maybeSingle();

      if (moduleInstance) {
        onClose();
        navigate(`/documents/${documentId}/workspace?m=${moduleInstance.id}`, {
          state: { returnTo: `/documents/${documentId}` }
        });
      }
    } catch (error) {
      console.error('Error navigating to module:', error);
    }
  };

  const handleIssue = async () => {
    setIsIssuing(true);
    setIssueProgress('Preparing to issue document...');

    try {
      console.log('[Issue] Starting issue process for document:', documentId);

      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError) throw docError;

      console.log('[Issue] Document fetched:', document.id, 'status:', document.issue_status);
      setIssueProgress('Assigning recommendation reference numbers...');

      const actualBaseDocumentId = document.base_document_id || document.id;
      try {
        await assignActionReferenceNumbers(documentId, actualBaseDocumentId);
        console.log('[Issue] Reference numbers assigned');
      } catch (refError) {
        console.warn('[Issue] Failed to assign reference numbers (non-fatal):', refError);
      }

      setIssueProgress('Updating document status...');
      console.log('[Issue] Calling issueDocument()');

      const issueResult = await issueDocument(documentId, userId, organisationId);

      if (issueResult.success) {
        console.log('[Issue] Document issued successfully');
        setIssueProgress('Generating locked PDF...');

        // Call generate-issued-pdf edge function to get signed URL
        try {
          console.log('[generate-issued-pdf] sending survey_report_id', documentId);

          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;

          if (!accessToken) {
            throw new Error('No access token (user not signed in)');
          }

          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

          const pdfResp = await fetch(`${supabaseUrl}/functions/v1/generate-issued-pdf`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': anonKey,
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ survey_report_id: documentId }),
          });

          const respJson = await pdfResp.json().catch(() => null);

          console.log('[generate-issued-pdf] status', pdfResp.status, respJson);

          if (!pdfResp.ok) {
            throw new Error(`generate-issued-pdf failed (${pdfResp.status}): ${JSON.stringify(respJson)}`);
          }

          if (respJson?.signed_url) {
            window.open(respJson.signed_url, '_blank', 'noopener,noreferrer');
          }
        } catch (pdfError) {
          console.warn('[Issue] Failed to generate PDF (non-fatal):', pdfError);
          // Don't fail the entire issue process if PDF generation fails
        }

        setIssueProgress('Complete!');
        setTimeout(() => {
          try { onSuccess(); } catch (e) { console.warn('onSuccess failed', e); }
          try { onClose(); } catch (e) { console.warn('onClose failed', e); }
          navigate(`/documents/${documentId}/workspace`, { replace: true });
        }, 500);
      } else {
        throw new Error(issueResult.error || 'Failed to issue document');
      }
    } catch (error: any) {
      console.error('[Issue] Error issuing document:', error);
      alert(error.message || 'Failed to issue document. Document remains in draft.');
      setIssueProgress('');
    } finally {
      console.log('[Issue] Issue process complete, resetting UI state');
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
            <p className="text-sm text-neutral-600 mb-4">
              You are about to issue <strong>Version {documentVersion}.0</strong> of this document.
            </p>
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <Lock className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <strong className="font-semibold">Once issued, this version cannot be edited.</strong>
                <br />
                Any changes will require creating a new version.
              </div>
            </div>
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
              {missingRequiredModules.length > 0 ? (
                <>
                  <p className="mb-3 font-medium">
                    This document can't be issued yet. The following required sections are incomplete:
                  </p>
                  <div className="space-y-2">
                    {missingRequiredModules.map((moduleKey) => (
                      <button
                        key={moduleKey}
                        onClick={() => handleNavigateToModule(moduleKey)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-white border border-red-200 rounded-md hover:bg-red-50 hover:border-red-300 transition-colors text-left group"
                      >
                        <span className="font-medium text-neutral-900">
                          {getModuleName(moduleKey)}
                        </span>
                        <ArrowRight className="w-4 h-4 text-red-600 group-hover:translate-x-1 transition-transform" />
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-neutral-600">
                    Click on a section above to complete it, then return here to issue.
                  </p>
                </>
              ) : (
                <>
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
                </>
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
              <li>• The document will be marked as issued with today's date</li>
              <li>• All editing will be locked to preserve integrity</li>
              <li>• Action reference numbers will be assigned</li>
              <li>• You can download a PDF after issuing</li>
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
