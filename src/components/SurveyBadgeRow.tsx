import { AlertCircle } from 'lucide-react';

interface SurveyBadgeRowProps {
  status: 'draft' | 'in_review' | 'approved' | 'issued';
  jurisdiction: 'UK' | 'IE';
  enabledModules?: string[];
  className?: string;
}

export function SurveyBadgeRow({ status, jurisdiction, enabledModules, className = '' }: SurveyBadgeRowProps) {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-700 border-gray-300',
    in_review: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    approved: 'bg-green-100 text-green-800 border-green-300',
    issued: 'bg-blue-100 text-blue-800 border-blue-300',
  };

  const statusLabels = {
    draft: 'Draft',
    in_review: 'In Review',
    approved: 'Approved',
    issued: 'Issued',
  };

  const jurisdictionColors = {
    UK: 'bg-slate-100 text-slate-700 border-slate-300',
    IE: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  };

  const jurisdictionLabels = {
    UK: 'UK',
    IE: 'Ireland',
  };

  const hasFRA = enabledModules?.some(m => m.startsWith('FRA_'));
  const hasFSD = enabledModules?.some(m => m.startsWith('FSD_'));

  let moduleLabel = '';
  let moduleColor = '';

  if (hasFRA && hasFSD) {
    moduleLabel = 'FRA + FSD';
    moduleColor = 'bg-purple-100 text-purple-700 border-purple-300';
  } else if (hasFRA) {
    moduleLabel = 'FRA';
    moduleColor = 'bg-orange-100 text-orange-700 border-orange-300';
  } else if (hasFSD) {
    moduleLabel = 'FSD';
    moduleColor = 'bg-cyan-100 text-cyan-700 border-cyan-300';
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${statusColors[status]}`}
      >
        <AlertCircle className="w-4 h-4" />
        {statusLabels[status]}
      </span>

      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${jurisdictionColors[jurisdiction]}`}
      >
        {jurisdictionLabels[jurisdiction]}
      </span>

      {moduleLabel && (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${moduleColor}`}
        >
          {moduleLabel}
        </span>
      )}
    </div>
  );
}
