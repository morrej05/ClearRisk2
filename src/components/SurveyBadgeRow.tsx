import { AlertCircle } from 'lucide-react';
import { getJurisdictionLabel, normalizeJurisdiction, resolveExplosionRegime } from '../lib/jurisdictions';

interface SurveyBadgeRowProps {
  status: 'draft' | 'in_review' | 'approved' | 'issued';
  jurisdiction: string;
  product?: string; // 'DSEAR' | 'GENERIC' (keep loose)
  enabledModules?: string[];
  className?: string;
}

export function SurveyBadgeRow({
  status,
  jurisdiction,
  product,
  enabledModules,
  className = '',
}: SurveyBadgeRowProps) {
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

  const isDsear = product === 'DSEAR';

  // --- Jurisdiction label ---
  const normalizedJurisdiction = normalizeJurisdiction(jurisdiction);
  const jurisdictionLabel = getJurisdictionLabel(normalizedJurisdiction);

  // --- Jurisdiction color ---
  const getGenericJurisdictionColor = (jur: string) => {
    const label = getJurisdictionLabel(jur);
    if (label.includes('Scotland')) return 'bg-blue-100 text-blue-700 border-blue-300';
    if (label.includes('Northern Ireland')) return 'bg-indigo-100 text-indigo-700 border-indigo-300';
    if (label.includes('Republic') || label.includes('Ireland'))
      return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    return 'bg-slate-100 text-slate-700 border-slate-300'; // England & Wales
  };

  const getDsearJurisdictionColor = (jur: string) =>
    resolveExplosionRegime(jur) === 'ROI_ATEX'
      ? 'bg-violet-100 text-violet-700 border-violet-300'
       : getGenericJurisdictionColor(jur);

  const jurisdictionColor = isDsear
    ? getDsearJurisdictionColor(normalizedJurisdiction)
    : getGenericJurisdictionColor(normalizedJurisdiction);

  const hasFRA = enabledModules?.some((m) => m.startsWith('FRA_'));
  const hasFSD = enabledModules?.some((m) => m.startsWith('FSD_'));
  const hasDSEAR = enabledModules?.some((m) => m.startsWith('DSEAR_')) || enabledModules?.includes('DSEAR');
  const hasRE = enabledModules?.includes('RE');

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
  } else if (hasDSEAR) {
    moduleLabel = 'DSEAR';
    moduleColor = 'bg-amber-100 text-amber-800 border-amber-300';
  }

  // Hide jurisdiction only for pure RE docs; always show for DSEAR
  const showJurisdiction = isDsear || !hasRE || hasFRA || hasFSD;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${statusColors[status]}`}
      >
        <AlertCircle className="w-4 h-4" />
        {statusLabels[status]}
      </span>

      {showJurisdiction && (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${jurisdictionColor}`}
        >
          {jurisdictionLabel}
        </span>
      )}

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