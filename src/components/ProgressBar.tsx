import { CheckCircle, Circle } from 'lucide-react';

interface Section {
  name: string;
  isComplete: boolean;
}

interface ProgressBarProps {
  sections: Section[];
}

export default function ProgressBar({ sections }: ProgressBarProps) {
  const completedCount = sections.filter(s => s.isComplete).length;
  const totalCount = sections.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="fixed top-0 left-0 right-0 bg-white shadow-md border-b border-slate-200 z-50">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Survey Progress
          </h3>
          <span className="text-sm font-medium text-slate-600">
            {completedCount} of {totalCount} sections started
          </span>
        </div>

        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-green-600 h-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {sections.map((section, index) => (
            <div
              key={index}
              className="flex items-center gap-1"
              title={section.name}
            >
              {section.isComplete ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <Circle className="w-4 h-4 text-slate-300" />
              )}
              <span className={`text-xs ${section.isComplete ? 'text-green-700 font-medium' : 'text-slate-400'}`}>
                {section.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
