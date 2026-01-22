import { Lock, AlertTriangle, Info } from 'lucide-react';

interface EditLockBannerProps {
  issueStatus: 'draft' | 'issued' | 'superseded';
  supersededByDocumentId?: string | null;
  onNavigateToSuccessor?: () => void;
  className?: string;
}

export default function EditLockBanner({
  issueStatus,
  supersededByDocumentId,
  onNavigateToSuccessor,
  className = '',
}: EditLockBannerProps) {
  if (issueStatus === 'draft') {
    return null;
  }

  if (issueStatus === 'issued') {
    return (
      <div className={`bg-blue-50 border-l-4 border-blue-500 p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-blue-900">Document Locked</p>
            <p className="text-sm text-blue-800 mt-1">
              This document has been issued and is locked to preserve integrity. To make changes, create a new version.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (issueStatus === 'superseded') {
    return (
      <div className={`bg-amber-50 border-l-4 border-amber-500 p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-900">Document Superseded</p>
            <p className="text-sm text-amber-800 mt-1">
              This document has been superseded by a newer version and cannot be edited.
              {supersededByDocumentId && ' View the current version for the latest information.'}
            </p>
            {supersededByDocumentId && onNavigateToSuccessor && (
              <button
                onClick={onNavigateToSuccessor}
                className="mt-2 text-sm font-medium text-amber-900 hover:text-amber-700 underline"
              >
                Go to Current Version
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

interface PermissionDeniedBannerProps {
  message: string;
  actionHint?: string;
  className?: string;
}

export function PermissionDeniedBanner({
  message,
  actionHint,
  className = '',
}: PermissionDeniedBannerProps) {
  return (
    <div className={`bg-red-50 border-l-4 border-red-500 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-red-900">Permission Denied</p>
          <p className="text-sm text-red-800 mt-1">{message}</p>
          {actionHint && (
            <p className="text-sm text-red-700 mt-2">{actionHint}</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface InfoBannerProps {
  title: string;
  message: string;
  className?: string;
}

export function InfoBanner({ title, message, className = '' }: InfoBannerProps) {
  return (
    <div className={`bg-blue-50 border-l-4 border-blue-500 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-blue-900">{title}</p>
          <p className="text-sm text-blue-800 mt-1">{message}</p>
        </div>
      </div>
    </div>
  );
}
