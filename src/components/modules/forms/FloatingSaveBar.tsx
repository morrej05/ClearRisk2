import { Save } from 'lucide-react';

interface FloatingSaveBarProps {
  onSave: () => void | Promise<void>;
  isSaving: boolean;
  statusText?: string;
}

export default function FloatingSaveBar({ onSave, isSaving, statusText }: FloatingSaveBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-40">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {statusText && (
            <span className="text-sm text-slate-600">{statusText}</span>
          )}
        </div>

        <button
          type="button"
          onClick={async () => {
            if (!isSaving) await onSave();
          }}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Module'}
        </button>
      </div>
    </div>
  );
}
