import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, List, Download, ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import HtmlReportViewer from '../components/HtmlReportViewer';
import RecommendationReport from '../components/RecommendationReport';
import { generateSurveySummary, prepareSurveyDataForSummary } from '../utils/surveySummaryApi';

type TabType = 'survey' | 'recommendations';

interface Survey {
  id: string;
  property_name: string;
  property_address: string;
  company_name: string | null;
  form_data: any;
  generated_report: string | null;
  notes_summary: string | null;
  report_status: string;
  survey_date: string | null;
  issue_date: string | null;
  issued: boolean;
}

export default function ReportPreviewPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('survey');
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSummary, setAiSummary] = useState('');

  useEffect(() => {
    if (surveyId) {
      fetchSurvey();
    }
  }, [surveyId]);

  const fetchSurvey = async () => {
    if (!surveyId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('survey_reports')
        .select('*')
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
    } catch (error) {
      console.error('Error generating AI summary:', error);
      alert('Failed to generate AI summary. Please try again.');
    } finally {
      setIsGeneratingAI(false);
    }
  };



  const handleExportPDF = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-slate-900"></div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Survey not found</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-slate-900 hover:text-slate-700 font-medium"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Dashboard</span>
            </button>

            <div className="flex items-center gap-3">
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

              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('survey')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'survey'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Survey Report</span>
            </button>

            <button
              onClick={() => setActiveTab('recommendations')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'recommendations'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <List className="w-4 h-4" />
              <span>Recommendation Report</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {aiSummary && (
          <div className="bg-gradient-to-r from-violet-50 to-blue-50 rounded-lg border-2 border-violet-200 p-6 mb-8 print:break-inside-avoid">
            <div className="flex items-start gap-3 mb-4">
              <Sparkles className="w-5 h-5 text-violet-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900 mb-3">Executive Summary</h2>
                <div className="prose prose-slate max-w-none">
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {aiSummary}
                  </p>
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-500 border-t border-violet-200 pt-3 mt-4">
              AI-generated summary based on structured survey data. Not persisted automatically.
            </div>
          </div>
        )}

        {activeTab === 'survey' ? (
          survey.generated_report ? (
            <HtmlReportViewer reportHtml={survey.generated_report} />
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Survey Report Generated</h3>
              <p className="text-slate-600">
                Complete the survey form and generate a report to view it here.
              </p>
            </div>
          )
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <RecommendationReport
              surveyId={surveyId!}
              onClose={() => {}}
              embedded={true}
              aiSummary={aiSummary}
            />
          </div>
        )}
      </div>
    </div>
  );
}
