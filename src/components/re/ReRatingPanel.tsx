import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { humanizeCanonicalKey } from '../../lib/re/reference/hrgMasterMap';
import { calculateScore } from '../../lib/re/scoring/riskEngineeringHelpers';

interface ReRatingPanelProps {
  canonicalKey: string;
  industryKey: string | null;
  rating: number;
  onChangeRating: (next: number) => void;
  helpText: string;
  weight: number;
  defaultCollapsed?: boolean;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Poor / Inadequate',
  2: 'Below Average',
  3: 'Average / Acceptable',
  4: 'Good',
  5: 'Excellent',
};

export default function ReRatingPanel({
  canonicalKey,
  industryKey,
  rating,
  onChangeRating,
  helpText,
  weight,
  defaultCollapsed = true,
}: ReRatingPanelProps) {
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed);
  const score = calculateScore(rating, weight);
  const label = humanizeCanonicalKey(canonicalKey);
  const showAutoRecIndicator = rating <= 2;

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      {/* Compact Header - Always Visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-slate-600" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-600" />
          )}
        </div>

        <div className="flex-1 flex items-center gap-4 text-left">
          <h3 className="font-semibold text-slate-900 flex-1">{label}</h3>

          <div className="flex items-center gap-3 text-sm">
            <div className="text-center">
              <div className="text-xs text-slate-500">Rating</div>
              <div className="text-lg font-bold text-slate-900">{rating}</div>
            </div>

            <div className="text-center">
              <div className="text-xs text-slate-500">Weight</div>
              <div className="text-lg font-bold text-slate-900">{weight}</div>
            </div>

            <div className="text-center">
              <div className="text-xs text-slate-500">Score</div>
              <div className="text-lg font-bold text-blue-600">{score}</div>
            </div>

            {showAutoRecIndicator && (
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                <AlertCircle className="w-3 h-3" />
                Auto-rec
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Expanded Body */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-200">
          <div className="mt-4">
            <p className="text-sm text-slate-600 mb-4">{helpText}</p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Engineer Rating (1-5)
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChangeRating(value)}
                    className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all text-center ${
                      rating === value
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-semibold'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    <div className="text-lg font-bold">{value}</div>
                    <div className="text-xs mt-0.5">{RATING_LABELS[value]}</div>
                  </button>
                ))}
              </div>
            </div>

            {rating <= 2 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-900">
                  <strong>Note:</strong> This rating will generate an automatic recommendation for improvement.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
