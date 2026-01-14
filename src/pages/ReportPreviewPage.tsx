import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, List, Download, ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import HtmlReportViewer from '../components/HtmlReportViewer';
import RecommendationReport from '../components/RecommendationReport';

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
  const [isEditingAI, setIsEditingAI] = useState(false);

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
      setAiSummary(data.notes_summary || '');
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
      const notesData = {
        propertyName: survey.property_name,
        companyName: survey.company_name,
        formData: survey.form_data,
        reportType: activeTab === 'survey' ? 'Full Survey Report' : 'Recommendation Report'
      };

      const mockAISummary = generateMockAISummary(notesData);

      const { error } = await supabase
        .from('survey_reports')
        .update({ notes_summary: mockAISummary })
        .eq('id', surveyId);

      if (error) throw error;

      setAiSummary(mockAISummary);
      alert('AI summary generated successfully!');
    } catch (error) {
      console.error('Error generating AI summary:', error);
      alert('Failed to generate AI summary');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSaveAISummary = async () => {
    if (!surveyId) return;

    try {
      const { error } = await supabase
        .from('survey_reports')
        .update({ notes_summary: aiSummary })
        .eq('id', surveyId);

      if (error) throw error;

      setIsEditingAI(false);
      alert('AI summary saved successfully!');
    } catch (error) {
      console.error('Error saving AI summary:', error);
      alert('Failed to save AI summary');
    }
  };

  const generateMockAISummary = (data: any) => {
    const score = data.formData?.overallRiskScore || 'N/A';
    const band = data.formData?.riskBand || 'Not Assessed';

    return `Executive Summary

Site: ${data.propertyName}
Company: ${data.companyName || 'N/A'}
Overall Risk Score: ${score}
Risk Band: ${band}

Key Findings:
This ${data.reportType.toLowerCase()} provides a comprehensive assessment of fire risk at the subject property. The overall risk score of ${score} places this site in the ${band} category.

Critical Areas:
${data.formData?.constructionScore < 80 ? '- Construction and combustibility require immediate attention\n' : ''}${data.formData?.fireProtectionScore < 80 ? '- Fire protection systems need upgrading\n' : ''}${data.formData?.detectionScore < 80 ? '- Detection systems require enhancement\n' : ''}

Recommendations:
Based on the findings, priority recommendations have been identified to address the key risk drivers. Implementation of these recommendations will significantly improve the overall fire risk profile of the site.

${activeTab === 'recommendations' ? '\nThis report focuses specifically on actionable recommendations that require management attention and implementation tracking.' : ''}`;
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
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8 print:break-inside-avoid">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-600" />
                <h2 className="text-lg font-bold text-slate-900">AI-Generated Summary</h2>
              </div>
              <div className="flex gap-2 print:hidden">
                {!isEditingAI ? (
                  <button
                    onClick={() => setIsEditingAI(true)}
                    className="text-sm text-slate-600 hover:text-slate-900"
                  >
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSaveAISummary}
                      className="text-sm text-green-600 hover:text-green-700 font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingAI(false);
                        setAiSummary(survey.notes_summary || '');
                      }}
                      className="text-sm text-slate-600 hover:text-slate-900"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
            {isEditingAI ? (
              <textarea
                value={aiSummary}
                onChange={(e) => setAiSummary(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 font-mono text-sm"
              />
            ) : (
              <div className="prose prose-slate max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">
                  {aiSummary}
                </pre>
              </div>
            )}
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
            />
          </div>
        )}
      </div>
    </div>
  );
}
