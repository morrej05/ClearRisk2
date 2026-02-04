import { useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'success' | 'error' | 'warning';
  title: string;
  message: string;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export default function FeedbackModal({
  isOpen,
  onClose,
  type,
  title,
  message,
  autoClose = false,
  autoCloseDelay = 2000,
}: FeedbackModalProps) {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, autoCloseDelay, onClose]);

  if (!isOpen) return null;

  const colorClasses = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: 'text-green-600',
      iconBg: 'bg-green-100',
      title: 'text-green-900',
      message: 'text-green-800',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: 'text-red-600',
      iconBg: 'bg-red-100',
      title: 'text-red-900',
      message: 'text-red-800',
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: 'text-amber-600',
      iconBg: 'bg-amber-100',
      title: 'text-amber-900',
      message: 'text-amber-800',
    },
  };

  const colors = colorClasses[type];
  const Icon = type === 'success' ? CheckCircle : AlertCircle;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div
        className={`relative w-full max-w-md mx-4 ${colors.bg} border ${colors.border} rounded-xl shadow-xl p-6`}
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 ${colors.iconBg} rounded-full p-2`}>
            <Icon className={`w-6 h-6 ${colors.icon}`} />
          </div>
          <div className="flex-1 pt-0.5">
            <h3 className={`text-lg font-semibold ${colors.title} mb-1`}>{title}</h3>
            <p className={`text-sm ${colors.message}`}>{message}</p>
          </div>
        </div>

        {!autoClose && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
            >
              OK
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
