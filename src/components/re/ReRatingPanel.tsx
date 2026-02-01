import { humanizeCanonicalKey } from '../../lib/re/reference/hrgMasterMap';
import { calculateScore } from '../../lib/re/scoring/riskEngineeringHelpers';

interface ReRatingPanelProps {
  canonicalKey: string;
  industryKey: string | null;
  rating: number;
  onChangeRating: (next: number) => void;
  helpText: string;
  weight: number;
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
}: ReRatingPanelProps) {
  const score = calculateScore(rating, weight);
  const label = humanizeCanonicalKey(canonicalKey);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{label}</h3>
        <p className="text-sm text-slate-600">{helpText}</p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Engineer Rating (1-5)
        </label>
        <div className="flex gap-3">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChangeRating(value)}
              className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all text-center ${
                rating === value
                  ? 'border-blue-600 bg-blue-50 text-blue-900 font-semibold'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
              }`}
            >
              <div className="text-xl font-bold">{value}</div>
              <div className="text-xs mt-1">{RATING_LABELS[value]}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200">
        <div>
          <div className="text-xs text-slate-500 mb-1">Rating</div>
          <div className="text-2xl font-bold text-slate-900">{rating}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">
            Weight {industryKey ? '(Industry-specific)' : '(Default)'}
          </div>
          <div className="text-2xl font-bold text-slate-900">{weight}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">Weighted Score</div>
          <div className="text-2xl font-bold text-blue-600">{score}</div>
        </div>
      </div>

      {rating <= 2 && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-900">
            <strong>Note:</strong> This rating will generate an automatic recommendation for improvement.
          </p>
        </div>
      )}
    </div>
  );
}
