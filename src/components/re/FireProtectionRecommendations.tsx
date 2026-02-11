import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import type { FireProtectionRecommendation } from '../../lib/modules/re04FireProtectionRecommendations';

type Props = {
  recommendations: FireProtectionRecommendation[];
  title?: string;
  showEmpty?: boolean;
};

export default function FireProtectionRecommendations({
  recommendations,
  title = 'Recommendations',
  showEmpty = true,
}: Props) {
  if (recommendations.length === 0 && !showEmpty) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {recommendations.length > 0 && (
          <span className="text-xs text-slate-600">
            {recommendations.length} {recommendations.length === 1 ? 'item' : 'items'}
          </span>
        )}
      </div>

      {recommendations.length === 0 ? (
        <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <Info className="w-4 h-4 text-slate-500" />
          <p className="text-sm text-slate-600">No recommendations triggered from recorded data.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recommendations.map(rec => (
            <RecommendationCard key={rec.id} recommendation={rec} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecommendationCard({ recommendation }: { recommendation: FireProtectionRecommendation }) {
  const { priority, category, text } = recommendation;

  // Priority styling
  const priorityConfig = {
    high: {
      icon: AlertTriangle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-700',
      badgeBg: 'bg-red-100',
      badgeText: 'text-red-800',
      label: 'High',
    },
    medium: {
      icon: AlertCircle,
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      textColor: 'text-amber-700',
      badgeBg: 'bg-amber-100',
      badgeText: 'text-amber-800',
      label: 'Medium',
    },
    low: {
      icon: Info,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700',
      badgeBg: 'bg-blue-100',
      badgeText: 'text-blue-800',
      label: 'Low',
    },
  };

  const config = priorityConfig[priority];
  const Icon = config.icon;

  // Category label
  const categoryLabel = {
    suppression: 'Suppression',
    detection: 'Detection',
    water_supply: 'Water Supply',
  }[category];

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${config.bgColor} ${config.borderColor}`}>
      <Icon className={`w-4 h-4 ${config.textColor} mt-0.5 flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${config.badgeBg} ${config.badgeText}`}>
            {config.label}
          </span>
          <span className="text-xs text-slate-600">{categoryLabel}</span>
        </div>
        <p className={`text-sm ${config.textColor}`}>{text}</p>
      </div>
    </div>
  );
}
