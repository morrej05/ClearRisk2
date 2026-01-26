interface DocumentStatusBadgeProps {
  status: 'draft' | 'issued' | 'superseded';
  className?: string;
}

export default function DocumentStatusBadge({ status, className = '' }: DocumentStatusBadgeProps) {
  const styles = {
    draft: 'bg-slate-100 text-slate-700 border-slate-300',
    issued: 'bg-green-100 text-green-800 border-green-300',
    superseded: 'bg-orange-100 text-orange-800 border-orange-300',
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
