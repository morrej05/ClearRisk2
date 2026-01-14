interface RatingRadioProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement> | any) => void;
  name?: string;
  label?: string;
  options?: string[];
}

export default function RatingRadio({ value, onChange, name, label, options }: RatingRadioProps) {
  const defaultRatings = [
    { label: 'Good', value: 'Good', color: 'text-green-600', bgColor: 'bg-green-100', borderColor: 'border-green-500' },
    { label: 'Tolerable', value: 'Tolerable', color: 'text-amber-600', bgColor: 'bg-amber-100', borderColor: 'border-amber-500' },
    { label: 'Poor', value: 'Poor', color: 'text-red-600', bgColor: 'bg-red-100', borderColor: 'border-red-500' }
  ];

  const ratings = options ? options.map(opt => {
    const found = defaultRatings.find(r => r.value === opt);
    return found || { label: opt, value: opt, color: 'text-slate-600', bgColor: 'bg-slate-100', borderColor: 'border-slate-500' };
  }) : defaultRatings;

  const handleChange = (ratingValue: string) => {
    if (name) {
      onChange({
        target: {
          name,
          value: ratingValue,
          type: 'radio'
        }
      } as any);
    } else {
      onChange(ratingValue as any);
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-slate-700">{label}</label>
      )}
      <div className="flex items-center gap-4">
        {ratings.map((rating) => (
          <label
            key={rating.value}
            className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border-2 transition-all ${
              value === rating.value
                ? `${rating.bgColor} ${rating.borderColor}`
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              name={name || `rating-${Math.random()}`}
              value={rating.value}
              checked={value === rating.value}
              onChange={() => handleChange(rating.value)}
              className="sr-only"
            />
            <div
              className={`w-3 h-3 rounded-full ${
                rating.value === 'Good' ? 'bg-green-500' :
                rating.value === 'Tolerable' ? 'bg-amber-500' :
                'bg-red-500'
              }`}
            />
            <span className={`text-sm font-medium ${value === rating.value ? rating.color : 'text-slate-700'}`}>
              {rating.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
