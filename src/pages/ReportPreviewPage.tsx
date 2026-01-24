import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, List, Download, ArrowLeft, Sparkles, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import SurveyReport from '../components/SurveyReport';
import RecommendationReport from '../components/RecommendationReport';
import { generateSurveySummary, prepareSurveyDataForSummary } from '../utils/surveySummaryApi';
import { useAuth } from '../contexts/AuthContext';

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
  survey_type: 'fra' | 'risk_engineering' | 'combined';
}

export default function ReportPreviewPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('survey');
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [isTestingIssue, setIsTestingIssue] = useState(false);
  const [issueTestResult, setIssueTestResult] = useState<any>(null);

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
        .select('*, survey_type')
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

  // TEMPORARY: Test /issueSurvey endpoint
  const handleTestIssue = async () => {
    if (!surveyId) return;

    setIsTestingIssue(true);
    setIssueTestResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/issue-survey`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          survey_id: surveyId,
          change_log: 'Test issue via admin button',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setIssueTestResult({
          success: false,
          error: result.error,
          blockers: result.blockers || [],
        });
      } else {
        setIssueTestResult({
          success: true,
          ...result,
        });
        // Refresh survey data
        fetchSurvey();
      }
    } catch (err: any) {
      console.error('Error testing issue:', err);
      setIssueTestResult({
        success: false,
        error: err.message || 'Failed to call issue endpoint',
      });
    } finally {
      setIsTestingIssue(false);
    }
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

  // ROUTER-LEVEL GUARD: Prevent non-FRA surveys from accessing FRA report UI
  if (survey.survey_type !== 'fra') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-xl w-full">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Report not available</h2>
          <p className="text-slate-600">
            This report viewer currently supports Fire Risk (FRA) surveys only.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4 border-b border-slate-200">
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

              {/* TEMPORARY: Test Issue Button (Admin Only) */}
              {user && !survey.issued && (
                <button
                  onClick={handleTestIssue}
                  disabled={isTestingIssue}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Developer Test: Call /issueSurvey endpoint"
                >
                  {isTestingIssue ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Testing Issue...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Test Issue</span>
                    </>
                  )}
                </button>
              )}

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
              <span>Fire Risk Survey Report</span>
              {!survey.issued && (
                <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded">
                  Draft
                </span>
              )}
              {survey.issued && (
                <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded">
                  Issued
                </span>
              )}
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
              <span>Fire Risk Recommendation Report</span>
              {!survey.issued && (
                <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded">
                  Draft
                </span>
              )}
              {survey.issued && (
                <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded">
                  Issued
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* TEMPORARY: Issue Test Result Display */}
        {issueTestResult && (
          <div className={`mb-6 p-4 rounded-lg border ${
            issueTestResult.success
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <h3 className={`font-semibold mb-2 ${
              issueTestResult.success ? 'text-green-900' : 'text-red-900'
            }`}>
              {issueTestResult.success ? 'Success!' : 'Issue Failed'}
            </h3>
            {issueTestResult.success ? (
              <div className="text-sm text-green-800">
                <p>Survey issued successfully!</p>
                <p className="mt-1">Revision: {issueTestResult.revision_number}</p>
                <p>Revision ID: {issueTestResult.revision_id}</p>
              </div>
            ) : (
              <div className="text-sm text-red-800">
                <p className="font-medium mb-2">{issueTestResult.error}</p>
                {issueTestResult.blockers && issueTestResult.blockers.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="font-semibold">Blockers:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {issueTestResult.blockers.map((blocker: any, idx: number) => (
                        <li key={idx}>
                          {blocker.moduleKey && <span className="font-medium">[{blocker.moduleKey}]</span>} {blocker.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setIssueTestResult(null)}
              className="mt-3 text-sm underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {activeTab === 'survey' ? (
          <SurveyReport
            surveyId={surveyId!}
            surveyType={survey.survey_type}
            embedded={true}
            aiSummary={aiSummary}
          />
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <RecommendationReport
              surveyId={surveyId!}
              surveyType={survey.survey_type}
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
