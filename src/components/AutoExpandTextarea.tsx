import { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';

interface AutoExpandTextareaProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  minRows?: number;
  disabled?: boolean;
}

export default function AutoExpandTextarea({
  id,
  name,
  value,
  onChange,
  placeholder,
  required = false,
  className = '',
  minRows = 3,
  disabled = false,
}: AutoExpandTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    setHasContent(value.trim().length > 0);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const lineHeight = 24;
      const minHeight = lineHeight * minRows + 20;

      if (isFocused || hasContent) {
        textareaRef.current.style.height = `${Math.max(scrollHeight, minHeight)}px`;
      } else {
        textareaRef.current.style.height = `${minHeight}px`;
      }
    }
  }, [value, isFocused, hasContent, minRows]);

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={`w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all disabled:bg-slate-100 disabled:cursor-not-allowed ${
          isFocused || hasContent ? 'resize-y' : 'resize-none'
        } ${className}`}
        style={{
          minHeight: `${24 * minRows + 20}px`,
          overflow: 'hidden',
        }}
      />
      {(isFocused || hasContent) && (
        <div className="absolute bottom-2 right-2 text-slate-400 pointer-events-none">
          <GripVertical size={16} />
        </div>
      )}
    </div>
  );
}
