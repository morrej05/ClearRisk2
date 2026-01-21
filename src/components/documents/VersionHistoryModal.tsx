import { useState, useEffect } from 'react';
import { X, Clock, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { getDocumentVersionHistory, DocumentVersion } from '../../utils/documentVersioning';

interface VersionHistoryModalProps {
  baseDocumentId: string;
  currentDocumentId: string;
  onClose: () => void;
  onNavigateToVersion: (documentId: string) => void;
}

export default function VersionHistoryModal({
  baseDocumentId,
  currentDocumentId,
  onClose,
  onNavigateToVersion,
}: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchVersionHistory();
  }, [baseDocumentId]);

  const fetchVersionHistory = async () => {
    setIsLoading(true);
    try {
      const history = await getDocumentVersionHistory(baseDocumentId);
      setVersions(history);
    } catch (error) {
      console.error('Error fetching version history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'draft':
        return {
          icon: Clock,
          color: 'text-amber-600',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
          label: 'Draft',
        };
      case 'issued':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          label: 'Issued',
        };
      case 'superseded':
        return {
          icon: AlertCircle,
          color: 'text-neutral-500',
          bgColor: 'bg-neutral-50',
          borderColor: 'border-neutral-200',
          label: 'Superseded',
        };
      default:
        return {
          icon: Clock,
          color: 'text-neutral-600',
          bgColor: 'bg-neutral-50',
          borderColor: 'border-neutral-200',
          label: status,
        };
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-bold text-neutral-900">Version History</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-neutral-300 border-t-neutral-900"></div>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500">No version history available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {versions.map((version, index) => {
                const config = getStatusConfig(version.issue_status);
                const Icon = config.icon;
                const isCurrentVersion = version.id === currentDocumentId;

                return (
                  <div
                    key={version.id}
                    className={`border rounded-lg p-4 transition-all ${
                      isCurrentVersion
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-bold text-neutral-900">
                            Version {version.version_number}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${config.bgColor} ${config.borderColor} border ${config.color}`}
                          >
                            <Icon className="w-3 h-3" />
                            {config.label}
                          </span>
                          {isCurrentVersion && (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 border border-blue-300 text-blue-700">
                              Current
                            </span>
                          )}
                        </div>

                        <div className="text-sm text-neutral-600 space-y-1">
                          <p>
                            <span className="font-medium">Created:</span>{' '}
                            {formatDate(version.created_at)}
                          </p>
                          {version.issue_date && (
                            <p>
                              <span className="font-medium">Issued:</span>{' '}
                              {formatDate(version.issue_date)}
                            </p>
                          )}
                          {version.superseded_date && (
                            <p>
                              <span className="font-medium">Superseded:</span>{' '}
                              {formatDate(version.superseded_date)}
                            </p>
                          )}
                          <p>
                            <span className="font-medium">Type:</span>{' '}
                            {version.document_type.replace('_', ' ').toUpperCase()}
                          </p>
                        </div>
                      </div>

                      {!isCurrentVersion && (
                        <button
                          onClick={() => {
                            onNavigateToVersion(version.id);
                            onClose();
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors"
                        >
                          View
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {index === 0 && version.issue_status === 'issued' && (
                      <div className="mt-3 pt-3 border-t border-neutral-200">
                        <p className="text-xs text-neutral-600">
                          This is the current issued version available to clients
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 bg-neutral-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
