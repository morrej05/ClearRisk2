import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Download, AlertCircle, Clock, Ban, FileX, Loader } from 'lucide-react';
import {
  fetchPublicDocument,
  fetchPublicDocumentDownloadUrl,
  type PublicDocumentInfo,
} from '../utils/externalAccess';

export default function PublicDocumentViewer() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [document, setDocument] = useState<PublicDocumentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No access token provided');
      setIsLoading(false);
      return;
    }

    loadDocument();
  }, [token]);

  const loadDocument = async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchPublicDocument(token);

      if (result.success && result.data) {
        setDocument(result.data);
      } else {
        setError(result.error || 'Failed to load document');
        setErrorStatus(result.status || null);
      }
    } catch (err: any) {
      console.error('Error loading document:', err);
      setError(err.message || 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!token) return;

    setIsDownloading(true);

    try {
      const result = await fetchPublicDocumentDownloadUrl(token);

      if (result.success && result.url) {
        window.open(result.url, '_blank');
      } else {
        alert(result.error || 'Failed to download document');
      }
    } catch (err: any) {
      console.error('Error downloading document:', err);
      alert(err.message || 'Failed to download document');
    } finally {
      setIsDownloading(false);
    }
  };

  const getErrorIcon = () => {
    switch (errorStatus) {
      case 'revoked':
        return <Ban className="w-16 h-16 text-red-500" />;
      case 'expired':
        return <Clock className="w-16 h-16 text-amber-500" />;
      case 'no_issued_document':
        return <FileX className="w-16 h-16 text-neutral-400" />;
      default:
        return <AlertCircle className="w-16 h-16 text-red-500" />;
    }
  };

  const getErrorTitle = () => {
    switch (errorStatus) {
      case 'revoked':
        return 'Access Revoked';
      case 'expired':
        return 'Link Expired';
      case 'no_issued_document':
        return 'Document Not Yet Issued';
      default:
        return 'Access Denied';
    }
  };

  const getErrorMessage = () => {
    switch (errorStatus) {
      case 'revoked':
        return 'This access link has been revoked and is no longer valid. Please contact the document owner for a new link.';
      case 'expired':
        return 'This access link has expired. Please contact the document owner for a new link.';
      case 'no_issued_document':
        return 'This document has not been issued yet. Please check back later or contact the document owner.';
      default:
        return error || 'You do not have permission to access this document.';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-neutral-600 font-medium">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-8 text-center">
          <div className="mb-6">{getErrorIcon()}</div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-3">{getErrorTitle()}</h1>
          <p className="text-neutral-600 mb-6">{getErrorMessage()}</p>
          <div className="bg-neutral-100 rounded-lg p-4">
            <p className="text-sm text-neutral-700">
              If you believe this is an error, please contact the person who shared this
              link with you.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">{document.title}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-neutral-600">
                <span className="flex items-center gap-1">
                  <span className="font-medium">Type:</span> {document.document_type.toUpperCase()}
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-medium">Version:</span> {document.version_number}
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-medium">Issue Date:</span>{' '}
                  {new Date(document.issue_date).toLocaleDateString('en-GB')}
                </span>
              </div>
              {document.label && (
                <div className="mt-2">
                  <span className="inline-flex px-2 py-1 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-full">
                    {document.label}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Document Information</h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-900">
              <span className="font-medium">Note:</span> This link always provides access to
              the latest issued version of this document. The current version is shown above.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <h3 className="text-sm font-medium text-neutral-700 mb-1">Document Title</h3>
              <p className="text-neutral-900">{document.title}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-neutral-700 mb-1">Document Type</h3>
              <p className="text-neutral-900">{document.document_type.toUpperCase()}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-neutral-700 mb-1">Version Number</h3>
                <p className="text-neutral-900">Version {document.version_number}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-neutral-700 mb-1">Issue Date</h3>
                <p className="text-neutral-900">
                  {new Date(document.issue_date).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {document.has_pdf ? (
          <div className="bg-white rounded-lg border border-neutral-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">Download Document</h2>
            </div>
            <p className="text-sm text-neutral-600 mb-4">
              Download the complete document as a PDF file. This is the official issued version
              of the document.
            </p>
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              {isDownloading ? 'Preparing Download...' : 'Download PDF'}
            </button>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-900 mb-1">PDF Not Available</p>
                <p className="text-sm text-amber-800">
                  The PDF version of this document is not yet available. Please contact the
                  document owner for more information.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-sm text-neutral-500">
          <p>
            This is a secure, read-only view of the document. If you have questions or need
            assistance, please contact the person who shared this link with you.
          </p>
        </div>
      </div>
    </div>
  );
}
