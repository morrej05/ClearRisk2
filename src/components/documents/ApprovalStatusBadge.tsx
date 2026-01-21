import { CheckCircle, XCircle, Clock, Minus } from 'lucide-react';
import { getApprovalStatusDisplay, ApprovalStatus } from '../../utils/approvalWorkflow';

interface ApprovalStatusBadgeProps {
  status: ApprovalStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function ApprovalStatusBadge({
  status,
  showIcon = true,
  size = 'md',
}: ApprovalStatusBadgeProps) {
  const config = getApprovalStatusDisplay(status);

  const getIcon = () => {
    switch (status) {
      case 'approved':
        return CheckCircle;
      case 'rejected':
        return XCircle;
      case 'pending':
        return Clock;
      case 'not_required':
        return Minus;
      default:
        return Minus;
    }
  };

  const Icon = getIcon();

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${sizeClasses[size]} ${config.bgColor} ${config.borderColor} ${config.color}`}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {config.label}
    </span>
  );
}
