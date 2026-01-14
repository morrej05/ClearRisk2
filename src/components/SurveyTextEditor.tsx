import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, Sparkles, Save, Eye, ArrowLeft, Clock } from 'lucide-react';
import AutoExpandTextarea from './AutoExpandTextarea';

interface SurveyTextEditorProps {
  surveyId: string;
  onBack: () => void;
}

interface Survey {
  id: string;
  property_name: string;
  survey_text: string | null;
  recommendation_text: string | null;
  ai_polished: boolean;
  issued: boolean;
}

export default function SurveyTextEditor({ surveyId, onBack }: SurveyTextEditorProps) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [surveyText, setSurveyText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [polishStatus, setPolishStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<'survey' | 'recommendation'>('survey');

  useEffect(() => {
    fetchSurvey();
  }, [surveyId]);

  const fetchSurvey = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('survey_reports')
        .select('id, property_name, survey_text, recommendation_text, ai_polished, issued')
        .eq('id', surveyId)
        .single();

      if (error) throw error;

      setSurvey(data);
      setSurveyText(data.survey_text || '');
    } catch (error: any) {
      console.error('Error fetching survey:', error);
      setErrorMessage(error.message || 'Failed to load survey');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMessage('');

    try {
      const { error } = await supabase
        .from('survey_reports')
        .update({ survey_text: surveyText })
        .eq('id', surveyId);

      if (error) throw error;

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);

      await fetchSurvey();
    } catch (error: any) {
      console.error('Error saving survey:', error);
      setErrorMessage(error.message || 'Failed to save survey text');
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePolish = async (forceRepolish = false) => {
    if (!surveyText.trim()) {
      setErrorMessage('Please enter survey text before polishing');
      return;
    }

    setIsPolishing(true);
    setPolishStatus('idle');
    setErrorMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/polish-survey-report`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          surveyText,
          surveyId,
          forceRepolish,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to polish report');
      }

      const { polishedText } = await response.json();

      const { error: updateError } = await supabase
        .from('survey_reports')
        .update({
          recommendation_text: polishedText,
          ai_polished: true,
        })
        .eq('id', surveyId);

      if (updateError) throw updateError;

      setPolishStatus('success');
      setTimeout(() => setPolishStatus('idle'), 3000);

      await fetchSurvey();
      setActiveTab('recommendation');
      setShowPreview(true);
    } catch (error: any) {
      console.error('Error polishing report:', error);
      setErrorMessage(error.message || 'Failed to polish report with AI');
      setPolishStatus('error');
    } finally {
      setIsPolishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-slate-900"></div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-600">Survey not found</p>
        <button
          onClick={onBack}
          className="mt-4 text-slate-900 hover:underline"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const isReadOnly = survey.issued;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold text-slate-900">{survey.property_name}</h1>
      </div>

      {isReadOnly && (
        <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-amber-900 mb-1">Read-Only Mode</h3>
              <p className="text-sm text-amber-800">
                This report has been issued and cannot be edited.
              </p>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-800">{errorMessage}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowPreview(false)}
                className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                  !showPreview
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Edit
              </button>
              {survey.recommendation_text && (
                <button
                  onClick={() => setShowPreview(true)}
                  className={`flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors ${
                    showPreview
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
              )}
            </div>

            {!isReadOnly && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={isSaving || isPolishing}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                {!survey.ai_polished ? (
                  <button
                    onClick={() => handlePolish(false)}
                    disabled={isSaving || isPolishing || !surveyText.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isPolishing ? 'Polishing...' : 'Polish Report'}
                  </button>
                ) : (
                  <button
                    onClick={() => handlePolish(true)}
                    disabled={isSaving || isPolishing || !surveyText.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isPolishing ? 'Refreshing...' : 'Refresh AI Draft'}
                  </button>
                )}
              </div>
            )}
          </div>

          {saveStatus === 'success' && (
            <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Saved successfully
            </p>
          )}

          {polishStatus === 'success' && (
            <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Report polished successfully
            </p>
          )}
        </div>

        {!showPreview ? (
          <div className="p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Survey Report Text
              </label>
              <p className="text-sm text-slate-500 mb-4">
                Write your survey report here. Click "Polish Report" to generate an AI-enhanced version.
              </p>
            </div>
            <AutoExpandTextarea
              value={surveyText}
              onChange={(e) => setSurveyText(e.target.value)}
              placeholder="Enter your survey report text here..."
              disabled={isReadOnly}
              className="w-full min-h-[400px] p-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        ) : (
          <div className="p-6">
            <div className="border-b border-slate-200 mb-6">
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab('survey')}
                  className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                    activeTab === 'survey'
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Survey Report
                </button>
                <button
                  onClick={() => setActiveTab('recommendation')}
                  className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                    activeTab === 'recommendation'
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Recommendation Report (AI-Polished)
                </button>
              </div>
            </div>

            <div className="prose max-w-none">
              {activeTab === 'survey' ? (
                <div className="whitespace-pre-wrap text-slate-900 leading-relaxed">
                  {survey.survey_text || 'No survey text available'}
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-slate-900 leading-relaxed">
                  {survey.recommendation_text || 'No recommendation text available. Click "Polish Report" to generate.'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {survey.ai_polished && !showPreview && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-blue-900 mb-1">AI Polished</h3>
              <p className="text-sm text-blue-800">
                This report has been polished with AI. Click "Preview" to view both versions.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
