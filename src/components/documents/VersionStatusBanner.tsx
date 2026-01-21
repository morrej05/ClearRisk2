import { AlertCircle, CheckCircle, Clock, FileText } from 'lucide-react';

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
  const getStatusConfig = () => {
    switch (issueStatus) {
      case 'draft':
        return {
          icon: Clock,
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
          textColor: 'text-amber-900',
          iconColor: 'text-amber-600',
          label: 'Draft',
          message: 'This document is in draft and can be edited',
        };
      case 'issued':
        return {
          icon: CheckCircle,
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-900',
          iconColor: 'text-green-600',
          label: 'Issued',
          message: `Issued on ${issueDate ? new Date(issueDate).toLocaleDateString('en-GB') : 'N/A'} - This document is locked and cannot be edited`,
        };
      case 'superseded':
        return {
          icon: AlertCircle,
          bgColor: 'bg-neutral-50',
          borderColor: 'border-neutral-300',
          textColor: 'text-neutral-700',
          iconColor: 'text-neutral-500',
          label: 'Superseded',
          message: 'This document has been superseded by a newer version and is locked',
        };
      default:
        return {
          icon: FileText,
          bgColor: 'bg-neutral-50',
          borderColor: 'border-neutral-200',
          textColor: 'text-neutral-900',
          iconColor: 'text-neutral-600',
          label: 'Unknown',
          message: 'Document status unknown',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div
      className={`${config.bgColor} border ${config.borderColor} rounded-lg p-4 mb-6`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${config.iconColor} mt-0.5 flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className={`font-bold ${config.textColor}`}>
              Version {versionNumber}
            </span>
            <span
              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${config.bgColor} ${config.borderColor} border ${config.textColor}`}
            >
              {config.label}
            </span>
          </div>
          <p className={`text-sm ${config.textColor}`}>{config.message}</p>
          {supersededByDocumentId && (
            <p className="text-xs text-neutral-600 mt-1">
              Superseded by newer version
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
