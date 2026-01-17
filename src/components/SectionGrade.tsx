import { Lock } from 'lucide-react';

interface SectionGradeProps {
  sectionKey: string;
  sectionTitle: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export default function SectionGrade({ sectionKey, sectionTitle, value, onChange, disabled = false }: SectionGradeProps) {
  const gradeLabels: Record<number, string> = {
    1: 'High risk / poor quality',
    2: 'Material improvement required',
    3: 'Adequate / tolerable',
    4: 'Good',
    5: 'Very good / low risk',
  };

  const getGradeColor = (grade: number) => {
    if (grade === 1) return 'text-red-700';
    if (grade === 2) return 'text-orange-700';
    if (grade === 3) return 'text-amber-700';
    if (grade === 4) return 'text-blue-700';
    return 'text-green-700';
  };

  const getSliderColor = (grade: number) => {
    if (grade === 1) return 'accent-red-600';
    if (grade === 2) return 'accent-orange-600';
    if (grade === 3) return 'accent-amber-600';
    if (grade === 4) return 'accent-blue-600';
    return 'accent-green-600';
  };

  return (
    <div className={`bg-slate-50 border border-slate-200 rounded-lg p-6 ${disabled ? 'opacity-75' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-slate-900">Section Grade: {sectionTitle}</h4>
        {disabled && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <Lock className="w-3 h-3" />
            <span>Locked</span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            disabled={disabled}
            className={`flex-1 h-2 rounded-lg appearance-none cursor-pointer ${getSliderColor(value)} ${disabled ? 'cursor-not-allowed' : ''}`}
            style={{
              background: disabled
                ? '#cbd5e1'
                : `linear-gradient(to right,
                    #dc2626 0%, #dc2626 ${((value - 1) / 4) * 100}%,
                    #e5e7eb ${((value - 1) / 4) * 100}%, #e5e7eb 100%)`
            }}
          />
          <span className={`text-3xl font-bold ${getGradeColor(value)} min-w-[3rem] text-center`}>
            {value}
          </span>
        </div>

        <div className="flex justify-between text-xs text-slate-600">
          <span>1 (Poor)</span>
          <span className={`font-semibold ${getGradeColor(value)}`}>
            {gradeLabels[value]}
          </span>
          <span>5 (Excellent)</span>
        </div>
      </div>
    </div>
  );
}
