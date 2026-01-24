import { Lock, FileEdit } from 'lucide-react';
import { isIssued } from '../utils/lockState';

interface IssuedLockBannerProps {
  survey: {
    status?: string;
    issued?: boolean;
    current_revision?: number;
    [key: string]: any;
  } | null;
  canEdit?: boolean;
  onCreateRevision?: () => void;
}

export default function IssuedLockBanner({
  survey,
  canEdit = true,
  onCreateRevision,
}: IssuedLockBannerProps) {
  // Only show for issued surveys (not in_review or approved)
  if (!survey || !isIssued(survey)) {
    return null;
  }

  const revisionNumber = survey.current_revision || 1;

  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Issued v{revisionNumber} (locked)
            </p>
            <p className="text-sm text-amber-700 mt-0.5">
              This survey is issued and cannot be edited. Create a revision to make changes.
            </p>
          </div>
        </div>

        {canEdit && onCreateRevision && (
          <button
            onClick={onCreateRevision}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex-shrink-0 ml-4"
          >
            <FileEdit className="w-4 h-4" />
            <span className="font-medium">Create Revision</span>
          </button>
        )}
      </div>
    </div>
  );
}
