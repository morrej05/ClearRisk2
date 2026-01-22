import { useState, useEffect } from 'react';
import { X, Copy, ExternalLink, AlertCircle, CheckCircle, Link as LinkIcon } from 'lucide-react';
import {
  createExternalLink,
  getDocumentExternalLinks,
  revokeExternalLink,
  type DocumentExternalLink,
} from '../../utils/clientAccess';

interface ClientAccessModalProps {
  baseDocumentId: string;
  documentTitle: string;
  userId: string;
  issueStatus: string;
  onClose: () => void;
}

export default function ClientAccessModal({
  baseDocumentId,
  documentTitle,
  userId,
  issueStatus,
  onClose,
}: ClientAccessModalProps) {
  const [links, setLinks] = useState<DocumentExternalLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newLinkDescription, setNewLinkDescription] = useState('');
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  useEffect(() => {
    loadLinks();
  }, [baseDocumentId]);

  const loadLinks = async () => {
    setIsLoading(true);
    try {
      const data = await getDocumentExternalLinks(baseDocumentId);
      setLinks(data);
    } catch (error) {
      console.error('Error loading links:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLink = async () => {
    if (issueStatus !== 'issued') {
      alert('Cannot create link for non-issued documents. Please issue the document first.');
      return;
    }

    setIsCreating(true);
    try {
      const result = await createExternalLink(
        baseDocumentId,
        userId,
        undefined,
        newLinkDescription || undefined
      );

      if (result.success && result.url) {
        await loadLinks();
        setNewLinkDescription('');
        navigator.clipboard.writeText(result.url);
        alert('Link created and copied to clipboard!');
      } else {
        alert(result.error || 'Failed to create link');
      }
    } catch (error) {
      console.error('Error creating link:', error);
      alert('Failed to create link');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = (linkToken: string, linkId: string) => {
    const url = `${window.location.origin}/client/document/${linkToken}`;
    navigator.clipboard.writeText(url);
    setCopiedLinkId(linkId);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  const handleRevokeLink = async (linkId: string) => {
    if (!confirm('Are you sure you want to revoke this link? It will no longer work.')) {
      return;
    }

    try {
      const result = await revokeExternalLink(linkId, userId);
      if (result.success) {
        await loadLinks();
      } else {
        alert(result.error || 'Failed to revoke link');
      }
    } catch (error) {
      console.error('Error revoking link:', error);
      alert('Failed to revoke link');
    }
  };

  const activeLinks = links.filter((l) => l.is_active && (!l.expires_at || new Date(l.expires_at) > new Date()));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Client Access Links</h2>
            <p className="text-sm text-neutral-600 mt-1">{documentTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <LinkIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-900 mb-1">How External Links Work</p>
                <p className="text-sm text-blue-800">
                  External links always resolve to the latest issued version of this document.
                  When you create a new version and issue it, clients will automatically see
                  the new version through existing links. Clients cannot see drafts or superseded versions.
                </p>
              </div>
            </div>
          </div>

          {issueStatus !== 'issued' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-900 mb-1">Document Not Issued</p>
                  <p className="text-sm text-amber-800">
                    This document must be issued before you can create client access links.
                    Issue status: <span className="font-medium">{issueStatus}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h3 className="font-semibold text-neutral-900 mb-3">Create New Link</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={newLinkDescription}
                onChange={(e) => setNewLinkDescription(e.target.value)}
                placeholder="Description (optional, e.g. 'For Client ABC')"
                className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isCreating || issueStatus !== 'issued'}
              />
              <button
                onClick={handleCreateLink}
                disabled={isCreating || issueStatus !== 'issued'}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                {isCreating ? 'Creating...' : 'Create Link'}
              </button>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-neutral-900 mb-3">
              Active Links ({activeLinks.length})
            </h3>

            {isLoading ? (
              <div className="text-center py-8 text-neutral-500">Loading links...</div>
            ) : activeLinks.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                No active links. Create one to share with clients.
              </div>
            ) : (
              <div className="space-y-3">
                {activeLinks.map((link) => (
                  <div
                    key={link.id}
                    className="border border-neutral-200 rounded-lg p-4 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1 min-w-0">
                        {link.description && (
                          <p className="font-medium text-neutral-900 mb-1">{link.description}</p>
                        )}
                        <p className="text-sm text-neutral-600 font-mono break-all">
                          {window.location.origin}/client/document/{link.token}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleCopyLink(link.token, link.id)}
                          className="p-2 hover:bg-blue-100 text-blue-600 rounded transition-colors"
                          title="Copy link"
                        >
                          {copiedLinkId === link.id ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleRevokeLink(link.id)}
                          className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-neutral-500">
                      <span>Created: {new Date(link.created_at).toLocaleDateString('en-GB')}</span>
                      <span>Accessed: {link.access_count} times</span>
                      {link.last_accessed_at && (
                        <span>
                          Last: {new Date(link.last_accessed_at).toLocaleDateString('en-GB')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {links.filter((l) => !l.is_active).length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-neutral-900 mb-3 text-sm">
                Revoked Links ({links.filter((l) => !l.is_active).length})
              </h3>
              <div className="space-y-2">
                {links
                  .filter((l) => !l.is_active)
                  .map((link) => (
                    <div
                      key={link.id}
                      className="border border-neutral-200 rounded-lg p-3 bg-neutral-50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-600">
                          {link.description || 'Unnamed link'}
                        </span>
                        <span className="text-xs text-red-600 font-medium">Revoked</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
