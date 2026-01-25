import { AlertCircle, CheckCircle, Clock, Lock, Info } from 'lucide-react';

interface VersionStatusBannerProps {
  versionNumber: number;
  issueStatus: 'draft' | 'issued' | 'superseded';
  issueDate: string | null;
  supersededByDocumentId: string | null;
}

export default function VersionStatusBanner({
  versionNumber,
  issueStatus,
  issueDate,
  supersededByDocumentId,
}: VersionStatusBannerProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusConfig = () => {
    switch (issueStatus) {
      case 'draft':
        return {
          icon: Clock,
          iconColor: 'text-amber-600',
          textColor: 'text-neutral-700',
          statusLabel: 'DRAFT',
        };
      case 'issued':
        return {
          icon: CheckCircle,
          iconColor: 'text-green-600',
          textColor: 'text-neutral-700',
          statusLabel: 'ISSUED',
        };
      case 'superseded':
        return {
          icon: AlertCircle,
          iconColor: 'text-neutral-500',
          textColor: 'text-neutral-600',
          statusLabel: 'SUPERSEDED',
        };
      default:
        return {
          icon: Info,
          iconColor: 'text-neutral-600',
          textColor: 'text-neutral-700',
          statusLabel: 'UNKNOWN',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg mb-4 text-sm">
      <Icon className={`w-4 h-4 ${config.iconColor} flex-shrink-0`} />
      <div className={`flex items-center gap-2 ${config.textColor}`}>
        <span className="font-medium">Version {versionNumber}</span>
        <span className="text-neutral-400">·</span>
        <span className="font-semibold">{config.statusLabel}</span>
        {issueDate && issueStatus === 'issued' && (
          <>
            <span className="text-neutral-400">·</span>
            <span>{formatDate(issueDate)}</span>
          </>
        )}
        {issueStatus !== 'draft' && (
          <>
            <span className="text-neutral-400">·</span>
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Locked
            </span>
          </>
        )}
      </div>
      {supersededByDocumentId && (
        <span className="ml-auto text-xs text-neutral-500 italic">
          Superseded by newer version
        </span>
      )}
    </div>
  );
}
