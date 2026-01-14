import { Save, FileText, ArrowLeft } from 'lucide-react';

interface StickySaveButtonProps {
  onSave: () => void;
  onViewDraft: () => void;
  lastSaved: string | null;
  isSaving: boolean;
  onBackToDashboard?: () => void;
  isReadOnly?: boolean;
}

export default function StickySaveButton({
  onSave,
  onViewDraft,
  lastSaved,
  isSaving,
  onBackToDashboard,
  isReadOnly = false,
}: StickySaveButtonProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t-2 border-slate-300 z-40">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="flex items-center gap-2 px-5 py-2.5 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-colors font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>
            )}
            {lastSaved && (
              <p className="text-sm text-slate-600">
                Draft saved at {lastSaved}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onViewDraft}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
            >
              <FileText className="w-4 h-4" />
              View Draft Report
            </button>

            {!isReadOnly && (
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                {isSaving ? 'Saving...' : 'Save Draft'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
