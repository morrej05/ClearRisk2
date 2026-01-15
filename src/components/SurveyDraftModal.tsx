import { useState, useEffect } from 'react';
import { X, Download, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import SurveyReport from './SurveyReport';
import { generateSurveySummary, prepareSurveyDataForSummary } from '../utils/surveySummaryApi';

interface SurveyDraftModalProps {
  surveyId: string;
  onClose: () => void;
  cachedSummary?: string;
  onSummaryGenerated?: (summary: string) => void;
}

interface Survey {
  id: string;
  property_name: string;
  form_data: any;
}

export default function SurveyDraftModal({ surveyId, onClose, cachedSummary, onSummaryGenerated }: SurveyDraftModalProps) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSummary, setAiSummary] = useState(cachedSummary || '');

  useEffect(() => {
    fetchSurvey();
  }, [surveyId]);

  useEffect(() => {
    if (cachedSummary) {
      setAiSummary(cachedSummary);
    }
  }, [cachedSummary]);

  const fetchSurvey = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('survey_reports')
        .select('id, property_name, form_data')
        .eq('id', surveyId)
        .single();

      if (error) throw error;
      setSurvey(data);
    } catch (error) {
      console.error('Error fetching survey:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateAISummary = async () => {
    if (!survey) return;

    setIsGeneratingAI(true);
    try {
      const surveyData = prepareSurveyDataForSummary(survey.form_data);
      const summary = await generateSurveySummary(surveyData);
      setAiSummary(summary);
      if (onSummaryGenerated) {
        onSummaryGenerated(summary);
      }
    } catch (error) {
      console.error('Error generating AI summary:', error);
      alert('Failed to generate AI summary. Please try again.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleDownload = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading survey draft...</p>
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg shadow-xl">
            <div className="bg-slate-900 text-white px-8 py-6 rounded-t-lg print:hidden">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-bold mb-2">Draft Survey Report</h1>
                  <p className="text-slate-300">{survey.property_name}</p>
                </div>
                <button
                  onClick={onClose}
                  className="text-white hover:text-slate-200 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="border-b border-slate-200 px-8 py-4 bg-slate-50 print:hidden">
              <div className="flex items-center justify-between">
                <button
                  onClick={handleGenerateAISummary}
                  disabled={isGeneratingAI}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingAI ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate AI Summary</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="overflow-hidden">
              <SurveyReport
                surveyId={surveyId}
                embedded={true}
                aiSummary={aiSummary}
              />
            </div>

            <div className="px-8 py-6 bg-slate-50 rounded-b-lg border-t border-slate-200 print:hidden">
              <div className="flex justify-between items-center">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export PDF
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
