interface RatingButtonsProps {
  value: number | null;
  onChange: (rating: number) => void;
  disabled?: boolean;
  className?: string;
  showLabels?: boolean;
  labels?: Record<number, string>;
  size?: 'sm' | 'md' | 'lg';
}

const DEFAULT_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Below Avg',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
};

function getRatingButtonStyles(value: number, isSelected: boolean, size: 'sm' | 'md' | 'lg'): string {
  const baseStyles = 'rounded-lg border-2 font-medium transition-all flex flex-col items-center justify-center gap-1';

  const sizeStyles = {
    sm: 'px-2 py-2 text-xs',
    md: 'px-3 py-3 text-sm',
    lg: 'px-4 py-4 text-base',
  };

  if (!isSelected) {
    return `${baseStyles} ${sizeStyles[size]} border-slate-200 text-slate-700 bg-white hover:border-slate-300 hover:bg-slate-50`;
  }

  // Color-code based on rating value: 1-2=red, 3=amber, 4-5=green
  let colorStyles = '';
  if (value <= 2) {
    colorStyles = 'bg-red-100 border-red-500 text-red-700';
  } else if (value === 3) {
    colorStyles = 'bg-amber-100 border-amber-500 text-amber-700';
  } else {
    colorStyles = 'bg-green-100 border-green-500 text-green-700';
  }

  return `${baseStyles} ${sizeStyles[size]} ${colorStyles}`;
}

export default function RatingButtons({
  value,
  onChange,
  disabled = false,
  className = '',
  showLabels = true,
  labels = DEFAULT_LABELS,
  size = 'md',
}: RatingButtonsProps) {
  return (
    <div className={`grid grid-cols-5 gap-2 ${className}`}>
      {[1, 2, 3, 4, 5].map((rating) => {
        const isSelected = value === rating;
        return (
          <button
            key={rating}
            type="button"
            onClick={() => !disabled && onChange(rating)}
            disabled={disabled}
            className={getRatingButtonStyles(rating, isSelected, size)}
          >
            <span className={`font-bold ${size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-lg' : 'text-base'}`}>
              {rating}
            </span>
            {showLabels && (
              <span className="text-center leading-tight">
                {labels[rating]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
