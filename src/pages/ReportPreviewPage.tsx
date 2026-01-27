import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, List, Download, ArrowLeft, Sparkles, Loader2, CheckCircle, Archive, Copy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import SurveyReport from '../components/SurveyReport';
import RecommendationReport from '../components/RecommendationReport';
import { generateSurveySummary, prepareSurveyDataForSummary } from '../utils/surveySummaryApi';
import { useAuth } from '../contexts/AuthContext';
import IssuedLockBanner from '../components/IssuedLockBanner';
import ApprovalWorkflowBanner from '../components/ApprovalWorkflowBanner';
import CloneSurveyModal from '../components/CloneSurveyModal';
import { isLocked } from '../utils/lockState';
import { loadReportData, listIssuedRevisions, getSurveyStatus, type ReportData } from '../utils/reportData';
import IssueReadinessPanel from '../components/issue/IssueReadinessPanel';
import IssueBlockersModal from '../components/issue/IssueBlockersModal';
import {
  getRequiredModules,
  type SurveyType,
  type IssueCtx,
} from '../utils/issueRequirements';
import {
  validateIssueEligibility,
  type Blocker,
  type ModuleProgress,
} from '../utils/issueValidation';
import { isOrgAdmin } from '../utils/entitlements';

async function generateIssuedPdf(surveyReportId: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-issued-pdf`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ survey_report_id: surveyReportId }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to generate PDF");
  }

  return res.json();
}

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
  status?: string;
  current_revision?: number;
  survey_type: 'fra' | 'risk_engineering' | 'combined';
}

export default function ReportPreviewPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('survey');
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [isTestingIssue, setIsTestingIssue] = useState(false);
  const [issueTestResult, setIssueTestResult] = useState<any>(null);
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);

  // Revision mode state
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [availableRevisions, setAvailableRevisions] = useState<any[]>([]);
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);

  // Issue flow state
  const [showBlockersModal, setShowBlockersModal] = useState(false);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueConfirmed, setIssueConfirmed] = useState(false);
  const [changeLog, setChangeLog] = useState('');
  const [isDownloadingCompliancePack, setIsDownloadingCompliancePack] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);

  // Parse rev query param and load data
  useEffect(() => {
    if (surveyId) {
      const revParam = searchParams.get('rev');
      const revNumber = revParam ? parseInt(revParam, 10) : null;
      setSelectedRevision(revNumber);
      fetchSurvey();
      loadReportDataForView(revNumber);
      loadAvailableRevisions();
    }
  }, [surveyId, searchParams]);

  const fetchSurvey = async () => {
    if (!surveyId) return;

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
    }
  };

  const loadReportDataForView = async (revNumber: number | null) => {
    if (!surveyId) return;

    setIsLoading(true);
    try {
      const data = await loadReportData({
        surveyId,
        revisionNumber: revNumber,
      });

      setReportData(data);
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableRevisions = async () => {
    if (!surveyId) return;

    try {
      const revisions = await listIssuedRevisions(surveyId);
      setAvailableRevisions(revisions);
    } catch (error) {
      console.error('Error loading revisions:', error);
    }
  };

  const handleRevisionChange = (revNumber: number | null) => {
    if (revNumber === null) {
      setSearchParams({});
    } else {
      setSearchParams({ rev: revNumber.toString() });
    }
  };

  const handleIssue = async () => {
    if (!surveyId || !user) return;

    setIsIssuing(true);
    setBlockers([]);

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
          change_log: changeLog.trim() || 'Survey issued',
        }),
      });

      const result = await response.json();

      if (response.status === 400) {
        setBlockers(result.blockers || []);
        setShowBlockersModal(true);
        return;
      }

      if (!response.ok) {
        throw new Error(result.error || 'Failed to issue survey');
      }

      alert(`Successfully issued as Revision ${result.revision_number}`);

      await fetchSurvey();
      await loadAvailableRevisions();
      handleRevisionChange(result.revision_number);

      setIssueConfirmed(false);
      setChangeLog('');
    } catch (err: any) {
      console.error('Error issuing survey:', err);
      alert(`Failed to issue survey: ${err.message}`);
    } finally {
      setIsIssuing(false);
    }
  };

  const handleExplainBlockers = () => {
    if (!survey) return;

    const ctx: IssueCtx = {
      scope_type: survey.form_data?.scope_type,
      engineered_solutions_used: survey.form_data?.engineered_solutions_used,
      suppression_applicable: survey.form_data?.suppression_applicable,
      smoke_control_applicable: survey.form_data?.smoke_control_applicable,
    };

    const moduleProgress: ModuleProgress = survey.form_data?.moduleProgress || {};
    const validation = validateIssueEligibility(
      survey.survey_type.toUpperCase() as SurveyType,
      ctx,
      survey.form_data || {},
      moduleProgress,
      []
    );

    setBlockers(validation.blockers);
    setShowBlockersModal(true);
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
    if (reportData?.source === 'snapshot') {
      const confirmed = window.confirm(
        `You are about to export Issued v${reportData.revisionNumber}.\n\nThis is an immutable snapshot from ${reportData.issuedAt ? new Date(reportData.issuedAt).toLocaleDateString() : 'the issue date'}.\n\nContinue?`
      );
      if (!confirmed) return;
    }
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
        // Refresh survey data and revisions
        await fetchSurvey();
        await loadAvailableRevisions();
        await loadReportDataForView(selectedRevision);
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

  const handleCreateRevision = async () => {
    if (!surveyId) return;

    const confirmed = window.confirm(
      'Create a new revision? This will create a draft version that you can edit, while preserving the issued version.'
    );

    if (!confirmed) return;

    setIsCreatingRevision(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/create-revision`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          survey_id: surveyId,
          note: 'Revision created from report preview',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create revision');
      }

      alert(`Revision ${result.revision_number} created successfully! The survey is now in draft mode.`);

      // Refresh survey data, revisions, and switch to draft view
      await fetchSurvey();
      await loadAvailableRevisions();
      handleRevisionChange(null); // Switch back to draft view
    } catch (err: any) {
      console.error('Error creating revision:', err);
      alert(`Failed to create revision: ${err.message}`);
    } finally {
      setIsCreatingRevision(false);
    }
  };

  const handleDownloadCompliancePack = async () => {
    if (!surveyId || !selectedRevision) return;

    setIsDownloadingCompliancePack(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/download-compliance-pack`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          survey_id: surveyId,
          revision_number: selectedRevision,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate compliance pack');
      }

      // Open the signed URL in a new window to trigger download
      if (result.download_url) {
        window.open(result.download_url, '_blank');
      }
    } catch (err: any) {
      console.error('Error downloading compliance pack:', err);
      alert(`Failed to download compliance pack: ${err.message}`);
    } finally {
      setIsDownloadingCompliancePack(false);
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

            {/* Revision Picker */}
            <div className="flex items-center gap-2">
              <label htmlFor="revision-select" className="text-sm font-medium text-slate-700">
                Revision:
              </label>
              <select
                id="revision-select"
                value={selectedRevision || 'draft'}
                onChange={(e) => {
                  const value = e.target.value;
                  handleRevisionChange(value === 'draft' ? null : parseInt(value, 10));
                }}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              >
                <option value="draft">Draft (current)</option>
                {availableRevisions.map((rev) => (
                  <option key={rev.revision_number} value={rev.revision_number}>
                    Issued v{rev.revision_number} ({new Date(rev.issued_at).toLocaleDateString()})
                  </option>
                ))}
              </select>
              {reportData?.source === 'snapshot' && (
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                  Viewing Immutable Snapshot
                </span>
              )}
            </div>

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

              {/* Compliance Pack Download - Only for issued revisions */}
              {reportData?.source === 'snapshot' && selectedRevision && (
                <button
                  onClick={handleDownloadCompliancePack}
                  disabled={isDownloadingCompliancePack}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Download compliance pack (PDF + Actions + Audit Trail)"
                >
                  {isDownloadingCompliancePack ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Archive className="w-4 h-4" />
                      <span>Compliance Pack</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={() => setShowCloneModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title="Clone this survey as a new draft"
              >
                <Copy className="w-4 h-4" />
                <span>Clone Survey</span>
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

      {/* Approval Workflow Banner - Show when not viewing a specific revision */}
      {selectedRevision === null && (
        <ApprovalWorkflowBanner
          surveyId={survey.id}
          status={survey.status || 'draft'}
          approvedAt={survey.approved_at}
          approvedBy={survey.approved_by}
          approvalNote={survey.approval_note}
          onStatusChange={() => {
            fetchSurvey();
            loadReportDataForView(selectedRevision);
          }}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Issued Lock Banner */}
        <IssuedLockBanner
          survey={survey}
          canEdit={true}
          onCreateRevision={handleCreateRevision}
        />

        {/* Issue Bar - Only show when approved and viewing current draft (not a revision) */}
        {survey.status === 'approved' && selectedRevision === null && (
          <div className="mb-6 bg-white rounded-lg border border-slate-200 p-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                    <input
                      type="checkbox"
                      checked={issueConfirmed}
                      onChange={(e) => setIssueConfirmed(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                    />
                    <span>
                      I confirm this document is complete within the stated scope and limitations
                    </span>
                  </label>
                </div>

                <div>
                  <label htmlFor="change-log" className="block text-sm font-medium text-slate-700 mb-2">
                    Change Log <span className="text-slate-500">(optional but recommended)</span>
                  </label>
                  <textarea
                    id="change-log"
                    value={changeLog}
                    onChange={(e) => setChangeLog(e.target.value)}
                    placeholder="Describe what changed in this issue/revision..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>

                <div className="flex items-center gap-3">
                  {(() => {
                    const canIssue = user && isOrgAdmin(user);
                    const ctx: IssueCtx = {
                      scope_type: survey.form_data?.scope_type,
                      engineered_solutions_used: survey.form_data?.engineered_solutions_used,
                      suppression_applicable: survey.form_data?.suppression_applicable,
                      smoke_control_applicable: survey.form_data?.smoke_control_applicable,
                    };
                    const moduleProgress: ModuleProgress = survey.form_data?.moduleProgress || {};
                    const validation = validateIssueEligibility(
                      survey.survey_type.toUpperCase() as SurveyType,
                      ctx,
                      survey.form_data || {},
                      moduleProgress,
                      []
                    );
                    const isDisabled = !canIssue || !issueConfirmed || !validation.eligible;

                    return (
                      <>
                        <button
                          onClick={handleIssue}
                          disabled={isDisabled || isIssuing}
                          className="px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                          {isIssuing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                              Issuing...
                            </>
                          ) : (
                            'Issue Survey'
                          )}
                        </button>
                        {isDisabled && !isIssuing && (
                          <button
                            onClick={handleExplainBlockers}
                            className="px-4 py-2 text-slate-600 hover:text-slate-900 text-sm underline"
                          >
                            Why is this disabled?
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="lg:col-span-1">
                <IssueReadinessPanel
                  surveyId={surveyId!}
                  surveyType={survey.survey_type.toUpperCase() as SurveyType}
                  ctx={{
                    scope_type: survey.form_data?.scope_type,
                    engineered_solutions_used: survey.form_data?.engineered_solutions_used,
                    suppression_applicable: survey.form_data?.suppression_applicable,
                    smoke_control_applicable: survey.form_data?.smoke_control_applicable,
                  }}
                  moduleProgress={survey.form_data?.moduleProgress || {}}
                  answers={survey.form_data || {}}
                  actions={[]}
                  canIssue={user ? isOrgAdmin(user) : false}
                />
              </div>
            </div>
          </div>
        )}

        {/* Blockers Modal */}
        <IssueBlockersModal
          open={showBlockersModal}
          onClose={() => setShowBlockersModal(false)}
          blockers={blockers}
          moduleLabels={(() => {
            if (!survey) return {};
            const modules = getRequiredModules(
              survey.survey_type.toUpperCase() as SurveyType,
              {
                scope_type: survey.form_data?.scope_type,
                engineered_solutions_used: survey.form_data?.engineered_solutions_used,
                suppression_applicable: survey.form_data?.suppression_applicable,
                smoke_control_applicable: survey.form_data?.smoke_control_applicable,
              }
            );
            return Object.fromEntries(modules.map((m) => [m.key, m.label]));
          })()}
        />

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

      {/* Clone Survey Modal */}
      {showCloneModal && survey && (
        <CloneSurveyModal
          surveyId={survey.id}
          surveyTitle={survey.site_name || survey.property_name || 'Survey'}
          onClose={() => setShowCloneModal(false)}
        />
      )}
    </div>
  );
}
