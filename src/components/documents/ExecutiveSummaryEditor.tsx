import { useState, useEffect } from 'react';
import { Sparkles, Edit3, FileText, X, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ExecutiveSummaryEditorProps {
  documentId: string;
  documentType: string;
  isImmutable: boolean;
  initialAiSummary: string | null;
  initialAuthorSummary: string | null;
  initialMode: 'ai' | 'author' | 'both' | 'none';
  onUpdate?: () => void;
}

type SummaryMode = 'ai' | 'author' | 'both' | 'none';

export default function ExecutiveSummaryEditor({
  documentId,
  documentType,
  isImmutable,
  initialAiSummary,
  initialAuthorSummary,
  initialMode,
  onUpdate,
}: ExecutiveSummaryEditorProps) {
  const [mode, setMode] = useState<SummaryMode>(initialMode);
  const [aiSummary, setAiSummary] = useState(initialAiSummary || '');
  const [authorSummary, setAuthorSummary] = useState(initialAuthorSummary || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setAiSummary(initialAiSummary || '');
    setAuthorSummary(initialAuthorSummary || '');
  }, [initialMode, initialAiSummary, initialAuthorSummary]);

  const handleGenerateAiSummary = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-executive-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ document_id: documentId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate summary');
      }

      const result = await response.json();

      if (result.success) {
        setAiSummary(result.summary);
        if (onUpdate) {
          onUpdate();
        }
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Error generating AI summary:', err);
      setError(err.message || 'Failed to generate AI summary');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          executive_summary_mode: mode,
          executive_summary_author: authorSummary || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      if (updateError) throw updateError;

      setHasUnsavedChanges(false);
      if (onUpdate) {
        onUpdate();
      }
    } catch (err: any) {
      console.error('Error saving changes:', err);
      setError(err.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleModeChange = (newMode: SummaryMode) => {
    setMode(newMode);
    setHasUnsavedChanges(true);
  };

  const handleAuthorSummaryChange = (value: string) => {
    setAuthorSummary(value);
    setHasUnsavedChanges(true);
  };

  if (isImmutable) {
    return (
      <div className="bg-white rounded-lg shadow-sm border-2 border-neutral-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-6 h-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Executive Summary</h3>
            <p className="text-xs text-neutral-500">Locked (document issued)</p>
          </div>
        </div>

        {mode === 'none' ? (
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-center">
            <p className="text-sm text-neutral-600">No executive summary included in this document</p>
          </div>
        ) : (
          <>
            {(mode === 'ai' || mode === 'both') && aiSummary && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-neutral-700 mb-2">Executive Summary</h4>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-neutral-700 whitespace-pre-wrap">{aiSummary}</p>
                </div>
              </div>
            )}

            {(mode === 'author' || mode === 'both') && authorSummary && (
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 mb-2">
                  {mode === 'both' ? 'Author Commentary' : 'Executive Summary'}
                </h4>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-neutral-700 whitespace-pre-wrap">{authorSummary}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border-2 border-neutral-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Executive Summary</h3>
            <p className="text-xs text-neutral-500">Configure summary for report output</p>
          </div>
        </div>

        {hasUnsavedChanges && (
          <button
            onClick={handleSaveChanges}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-neutral-300 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="mb-6">
        <label className="block text-sm font-semibold text-neutral-700 mb-3">Display Mode</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => handleModeChange('ai')}
            className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
              mode === 'ai'
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
            }`}
          >
            <Sparkles className="w-4 h-4 mx-auto mb-1" />
            AI Only
          </button>
          <button
            onClick={() => handleModeChange('author')}
            className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
              mode === 'author'
                ? 'border-amber-600 bg-amber-50 text-amber-700'
                : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
            }`}
          >
            <Edit3 className="w-4 h-4 mx-auto mb-1" />
            Author Only
          </button>
          <button
            onClick={() => handleModeChange('both')}
            className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
              mode === 'both'
                ? 'border-purple-600 bg-purple-50 text-purple-700'
                : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
            }`}
          >
            <FileText className="w-4 h-4 mx-auto mb-1" />
            Both
          </button>
          <button
            onClick={() => handleModeChange('none')}
            className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
              mode === 'none'
                ? 'border-neutral-600 bg-neutral-50 text-neutral-700'
                : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
            }`}
          >
            <X className="w-4 h-4 mx-auto mb-1" />
            None
          </button>
        </div>
      </div>

      {mode !== 'none' && (
        <div className="space-y-6">
          {(mode === 'ai' || mode === 'both') && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  AI-Generated Summary
                </label>
                <button
                  onClick={handleGenerateAiSummary}
                  disabled={isGenerating}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-neutral-300 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {aiSummary ? 'Regenerate' : 'Generate'}
                    </>
                  )}
                </button>
              </div>
              {aiSummary ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-neutral-700 whitespace-pre-wrap">{aiSummary}</p>
                </div>
              ) : (
                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-neutral-600">Click "Generate" to create an AI summary based on your assessment data</p>
                </div>
              )}
            </div>
          )}

          {(mode === 'author' || mode === 'both') && (
            <div>
              <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2 mb-3">
                <Edit3 className="w-4 h-4 text-amber-600" />
                {mode === 'both' ? 'Author Commentary (Optional)' : 'Author Summary'}
              </label>
              <textarea
                value={authorSummary}
                onChange={(e) => handleAuthorSummaryChange(e.target.value)}
                placeholder={
                  mode === 'both'
                    ? 'Add optional commentary to supplement the AI summary...'
                    : 'Write your executive summary...'
                }
                rows={8}
                className="w-full px-4 py-3 border-2 border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none text-sm"
              />
              <p className="text-xs text-neutral-500 mt-2">
                {mode === 'both'
                  ? 'This will appear after the AI summary in the report'
                  : 'This will be the only executive summary in the report'}
              </p>
            </div>
          )}
        </div>
      )}

      {mode === 'none' && (
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6 text-center">
          <X className="w-12 h-12 text-neutral-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-neutral-700 mb-1">No Executive Summary</p>
          <p className="text-xs text-neutral-600">
            The executive summary section will be omitted from the report
          </p>
        </div>
      )}
    </div>
  );
}
