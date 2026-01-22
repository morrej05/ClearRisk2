import { useState, useEffect } from 'react';
import { X, Copy, ExternalLink, AlertCircle, CheckCircle, Link as LinkIcon, Trash2 } from 'lucide-react';
import {
  createDocumentAccessLink,
  getDocumentAccessLinks,
  revokeDocumentAccessLink,
  deleteDocumentAccessLink,
  getDocumentLinkStatus,
  copyToClipboard,
  type DocumentAccessLink,
} from '../../utils/externalAccess';
import { useAuth } from '../../contexts/AuthContext';

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
  const { organisation } = useAuth();
  const [links, setLinks] = useState<DocumentAccessLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  useEffect(() => {
    loadLinks();
  }, [baseDocumentId]);

  const loadLinks = async () => {
    if (!organisation?.id) return;

    setIsLoading(true);
    try {
      const data = await getDocumentAccessLinks(baseDocumentId, organisation.id);
      setLinks(data);
    } catch (error) {
      console.error('Error loading links:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLink = async () => {
    if (!organisation?.id) {
      alert('Organisation not found');
      return;
    }

    if (issueStatus !== 'issued') {
      alert('Cannot create link for non-issued documents. Please issue the document first.');
      return;
    }

    setIsCreating(true);
    try {
      const result = await createDocumentAccessLink({
        baseDocumentId,
        organisationId: organisation.id,
        expiresInDays,
        label: newLinkLabel || undefined,
      });

      if (result.success && result.url) {
        await loadLinks();
        setNewLinkLabel('');
        await copyToClipboard(result.url);
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

  const handleCopyLink = async (linkToken: string, linkId: string) => {
    const url = `${window.location.origin}/public/documents?token=${linkToken}`;
    try {
      await copyToClipboard(url);
      setCopiedLinkId(linkId);
      setTimeout(() => setCopiedLinkId(null), 2000);
    } catch (error) {
      console.error('Error copying link:', error);
      alert('Failed to copy link');
    }
  };

  const handleRevokeLink = async (linkId: string) => {
    if (!confirm('Are you sure you want to revoke this link? It will no longer work.')) {
      return;
    }

    try {
      const result = await revokeDocumentAccessLink(linkId);
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

  const handleDeleteLink = async (linkId: string) => {
    if (!confirm('Are you sure you want to permanently delete this link?')) {
      return;
    }

    try {
      const result = await deleteDocumentAccessLink(linkId);
      if (result.success) {
        await loadLinks();
      } else {
        alert(result.error || 'Failed to delete link');
      }
    } catch (error) {
      console.error('Error deleting link:', error);
      alert('Failed to delete link');
    }
  };

  const activeLinks = links.filter((l) => getDocumentLinkStatus(l) === 'active');
  const expiredLinks = links.filter((l) => getDocumentLinkStatus(l) === 'expired');
  const revokedLinks = links.filter((l) => getDocumentLinkStatus(l) === 'revoked');

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
            <div className="grid grid-cols-1 gap-3 mb-3">
              <input
                type="text"
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                placeholder="Label (optional, e.g. 'Broker', 'Client ABC', 'Insurer')"
                className="px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isCreating || issueStatus !== 'issued'}
              />
              <div className="flex gap-3">
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isCreating || issueStatus !== 'issued'}
                >
                  <option value={7}>Expires in 7 days</option>
                  <option value={30}>Expires in 30 days</option>
                  <option value={90}>Expires in 90 days</option>
                  <option value={180}>Expires in 6 months</option>
                  <option value={365}>Expires in 1 year</option>
                </select>
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
                        <div className="flex items-center gap-2 mb-1">
                          {link.label && (
                            <p className="font-medium text-neutral-900">{link.label}</p>
                          )}
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                            Active
                          </span>
                        </div>
                        <p className="text-sm text-neutral-600 font-mono break-all">
                          {window.location.origin}/public/documents?token={link.token}
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
                      <span>Expires: {new Date(link.expires_at).toLocaleDateString('en-GB')}</span>
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

          {(revokedLinks.length > 0 || expiredLinks.length > 0) && (
            <div className="mt-6">
              <h3 className="font-semibold text-neutral-900 mb-3 text-sm">
                Inactive Links ({revokedLinks.length + expiredLinks.length})
              </h3>
              <div className="space-y-2">
                {revokedLinks.map((link) => (
                  <div
                    key={link.id}
                    className="border border-neutral-200 rounded-lg p-3 bg-neutral-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-neutral-600">
                          {link.label || 'Unnamed link'}
                        </span>
                        <span className="text-xs text-red-600 font-medium">Revoked</span>
                      </div>
                      <button
                        onClick={() => handleDeleteLink(link.id)}
                        className="p-1.5 hover:bg-red-100 text-red-600 rounded transition-colors"
                        title="Delete permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {expiredLinks.map((link) => (
                  <div
                    key={link.id}
                    className="border border-neutral-200 rounded-lg p-3 bg-neutral-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-neutral-600">
                          {link.label || 'Unnamed link'}
                        </span>
                        <span className="text-xs text-amber-600 font-medium">
                          Expired {new Date(link.expires_at).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteLink(link.id)}
                        className="p-1.5 hover:bg-red-100 text-red-600 rounded transition-colors"
                        title="Delete permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
