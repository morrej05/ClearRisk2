interface DocumentStatusBadgeProps {
  status: 'draft' | 'issued' | 'superseded';
  className?: string;
}

export default function DocumentStatusBadge({ status, className = '' }: DocumentStatusBadgeProps) {
  const styles = {
    draft: 'bg-risk-info-bg text-risk-info-fg border border-risk-info-border',
    issued: 'bg-risk-low-bg text-risk-low-fg border border-risk-low-border',
    superseded: 'bg-risk-medium-bg text-risk-medium-fg border border-risk-medium-border',
  };

  const labels = {
    draft: 'Draft',
    issued: 'Issued',
    superseded: 'Superseded',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        styles[status]
      } ${className}`}
    >
      {labels[status]}
    </span>
  );
}
