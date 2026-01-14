import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, FileText, Sparkles } from 'lucide-react';

interface TextReportModalProps {
  surveyId: string;
  onClose: () => void;
}

interface Survey {
  id: string;
  property_name: string;
  property_address: string;
  company_name: string;
  survey_date: string;
  survey_text: string | null;
  recommendation_text: string | null;
  ai_polished: boolean;
}

export default function TextReportModal({ surveyId, onClose }: TextReportModalProps) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'survey' | 'recommendation'>('survey');

  useEffect(() => {
    fetchSurvey();
  }, [surveyId]);

  const fetchSurvey = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('survey_reports')
        .select('id, property_name, property_address, company_name, survey_date, survey_text, recommendation_text, ai_polished')
        .eq('id', surveyId)
        .single();

      if (error) throw error;

      setSurvey(data);

      if (data.recommendation_text && data.ai_polished) {
        setActiveTab('recommendation');
      }
    } catch (error) {
      console.error('Error fetching survey:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8">
          <p className="text-slate-600">Survey not found</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const hasSurveyText = survey.survey_text && survey.survey_text.trim().length > 0;
  const hasRecommendationText = survey.recommendation_text && survey.recommendation_text.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg shadow-xl">
            <div className="bg-slate-900 text-white px-8 py-6 rounded-t-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{survey.property_name}</h1>
                  <p className="text-slate-300">{survey.company_name || survey.property_address}</p>
                </div>
                <button
                  onClick={onClose}
                  className="text-white hover:text-slate-200 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="px-8 py-6 border-b border-slate-200 bg-slate-50">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Site</h3>
                  <p className="text-lg font-semibold text-slate-900">{survey.property_name}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Company</h3>
                  <p className="text-lg font-semibold text-slate-900">{survey.company_name || '—'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Survey Date</h3>
                  <p className="text-slate-700">{formatDate(survey.survey_date)}</p>
                </div>
                {survey.ai_polished && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-500 mb-1">AI Status</h3>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg">
                      <Sparkles className="w-4 h-4" />
                      Polished
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-b border-slate-200">
              <div className="px-8 flex gap-1">
                <button
                  onClick={() => setActiveTab('survey')}
                  className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors ${
                    activeTab === 'survey'
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                  disabled={!hasSurveyText}
                >
                  <FileText className="w-4 h-4" />
                  Survey Report
                </button>
                <button
                  onClick={() => setActiveTab('recommendation')}
                  className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors ${
                    activeTab === 'recommendation'
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                  disabled={!hasRecommendationText}
                >
                  <Sparkles className="w-4 h-4" />
                  Recommendation Report
                </button>
              </div>
            </div>

            <div className="px-8 py-8">
              {activeTab === 'survey' ? (
                <div>
                  {hasSurveyText ? (
                    <div className="prose max-w-none">
                      <div className="whitespace-pre-wrap text-slate-900 leading-relaxed">
                        {survey.survey_text}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 text-lg mb-2">No survey text available</p>
                      <p className="text-slate-400 text-sm">Use the text editor to write your survey report</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {hasRecommendationText ? (
                    <div>
                      {survey.ai_polished && (
                        <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 p-4">
                          <div className="flex items-start gap-3">
                            <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <h3 className="text-sm font-bold text-blue-900 mb-1">AI-Enhanced Report</h3>
                              <p className="text-sm text-blue-800">
                                This recommendation report was generated with AI using temperature=0 for deterministic output.
                                The same survey text will always produce the same recommendation.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="prose max-w-none">
                        <div className="whitespace-pre-wrap text-slate-900 leading-relaxed">
                          {survey.recommendation_text}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <Sparkles className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 text-lg mb-2">No recommendation text available</p>
                      <p className="text-slate-400 text-sm">Use the text editor and click "Polish Report" to generate AI-enhanced recommendations</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-8 py-6 bg-slate-50 rounded-b-lg border-t border-slate-200">
              <div className="flex justify-between items-center">
                <button
                  onClick={() => window.print()}
                  className="px-6 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Print Report
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
