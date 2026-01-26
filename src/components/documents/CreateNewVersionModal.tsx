import { useState } from 'react';
import { X, AlertTriangle, Copy } from 'lucide-react';
import { createNewVersion } from '../../utils/documentVersioning';

interface CreateNewVersionModalProps {
  baseDocumentId: string;
  currentVersion: number;
  documentTitle: string;
  userId: string;
  organisationId: string;
  onClose: () => void;
  onSuccess: (newDocumentId: string, newVersionNumber: number) => void;
}

export default function CreateNewVersionModal({
  baseDocumentId,
  currentVersion,
  documentTitle,
  userId,
  organisationId,
  onClose,
  onSuccess,
}: CreateNewVersionModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [carryForwardEvidence, setCarryForwardEvidence] = useState(true);

  const handleCreateNewVersion = async () => {
    setIsCreating(true);
    try {
      const result = await createNewVersion(baseDocumentId, userId, organisationId, carryForwardEvidence);
      if (result.success && result.newDocumentId) {
        onSuccess(result.newDocumentId, result.newVersionNumber ?? 0);
      } else {
        alert(result.error || 'Failed to create new version');
      }
    } catch (error) {
      console.error('Error creating new version:', error);
      alert('Failed to create new version');
    } finally {
      setIsCreating(false);
    }
  };

  const newVersionNumber = currentVersion + 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-bold text-neutral-900">Create New Version</h2>
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
              Creating a new version will generate Version {newVersionNumber} as a draft,
              copying all data from the current issued version.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <Copy className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-900 mb-2">What will be copied:</p>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>All module data and form content</li>
                  <li>Open, In Progress, and Deferred actions</li>
                  <li>Document title and metadata</li>
                  <li>Evidence and attachments (if enabled below)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-4 mb-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={carryForwardEvidence}
                onChange={(e) => setCarryForwardEvidence(e.target.checked)}
                className="mt-0.5 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="font-medium text-neutral-900 mb-1">
                  Carry forward evidence and attachments
                </p>
                <p className="text-sm text-neutral-600">
                  Evidence files will be linked to the new version without duplication.
                  Recommended for maintaining continuity of evidence across versions.
                </p>
              </div>
            </label>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-900 mb-2">Important notes:</p>
                <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                  <li>The new version will be created as a Draft</li>
                  <li>Only one draft can exist at a time</li>
                  <li>Closed and Not Applicable actions will NOT be carried forward</li>
                  <li>
                    The current version (v{currentVersion}) will remain issued and
                    accessible
                  </li>
                  <li>You can edit the new draft before issuing it</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
            <p className="text-sm text-neutral-700">
              <span className="font-medium">After creating v{newVersionNumber}:</span> You
              will be redirected to the new draft version where you can make updates
              before issuing. When you issue v{newVersionNumber}, version {currentVersion}{' '}
              will automatically be marked as superseded.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 bg-neutral-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors font-medium"
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            onClick={handleCreateNewVersion}
            disabled={isCreating}
            className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : `Create Version ${newVersionNumber}`}
          </button>
        </div>
      </div>
    </div>
  );
}
