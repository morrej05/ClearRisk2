import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Eye, CreditCard as Edit, Trash2, CheckCircle2, RefreshCw, Lock, Shield, ExternalLink, FileText, FileEdit, Sparkles, TrendingUp, AlertCircle, Building2, Filter, Palette } from 'lucide-react';
import NewSurveyReport from '../components/NewSurveyReport';
import NewSurveyModal from '../components/NewSurveyModal';
import ExternalLinkModal from '../components/ExternalLinkModal';
import RecommendationReport from '../components/RecommendationReport';
import SurveyTextEditor from '../components/SurveyTextEditor';
import TextReportModal from '../components/TextReportModal';
import ClientBrandingModal from '../components/ClientBrandingModal';
import { supabase } from '../lib/supabase';
import { aggregatePortfolioMetrics } from '../utils/portfolioMetricsAggregation';

interface Survey {
  id: string;
  property_name: string;
  property_address: string;
  form_data: any;
  generated_report: string | null;
  survey_text: string | null;
  recommendation_text: string | null;
  ai_polished: boolean;
  created_at: string;
  updated_at: string;
  framework_type: 'fire_property' | 'fire_risk_assessment' | 'atex';
  survey_type: 'Full' | 'Abridged';
  report_status: 'Draft' | 'Internally Reviewed' | 'Issue Ready';
  company_name: string | null;
  survey_date: string | null;
  issue_date: string | null;
  issued: boolean;
  superseded_by_id: string | null;
}

interface PortfolioMetrics {
  averageScore: number;
  totalIssued: number;
  scoredReports: number;
  distribution: Record<string, number>;
  bestScore: number;
  worstScore: number;
  bestSite: string;
  worstSite: string;
}

type UserRole = 'admin' | 'user' | 'external';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  user: 'Editor',
  external: 'Viewer',
};

const ROLE_PERMISSIONS = {
  canCreateSurvey: (role: UserRole | null) => role === 'admin' || role === 'user',
  canEditSurvey: (role: UserRole | null) => role === 'admin' || role === 'user',
  canDeleteSurvey: (role: UserRole | null) => role === 'admin' || role === 'user',
  canIssueSurvey: (role: UserRole | null) => role === 'admin' || role === 'user',
  canResurvey: (role: UserRole | null) => role === 'admin' || role === 'user',
  canGenerateExternalLink: (role: UserRole | null) => role === 'admin' || role === 'user',
  canEditText: (role: UserRole | null) => role === 'admin' || role === 'user',
  canGeneratePortfolioSummary: (role: UserRole | null) => role === 'admin' || role === 'user',
  canViewReports: (role: UserRole | null) => true,
};

export default function Dashboard() {
  const { signOut, user, userRole } = useAuth();
  const navigate = useNavigate();
  const [showNewSurvey, setShowNewSurvey] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [showNewSurveyModal, setShowNewSurveyModal] = useState(false);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [issueConfirmId, setIssueConfirmId] = useState<string | null>(null);
  const [resurveyConfirmId, setResurveyConfirmId] = useState<string | null>(null);
  const [companyNameFilter, setCompanyNameFilter] = useState<string>('');
  const [industrySectorFilter, setIndustrySectorFilter] = useState<string>('all');
  const [frameworkFilter, setFrameworkFilter] = useState<string>('all');
  const [externalLinkSurveyId, setExternalLinkSurveyId] = useState<string | null>(null);
  const [recommendationReportSurveyId, setRecommendationReportSurveyId] = useState<string | null>(null);
  const [textReportSurveyId, setTextReportSurveyId] = useState<string | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryFilterState, setSummaryFilterState] = useState<{
    companyName: string;
    industrySector: string;
    framework: string;
  } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [clientBranding, setClientBranding] = useState<{
    companyName: string;
    logoUrl: string | null;
  }>({ companyName: 'ClearRisk', logoUrl: null });
  const [showBrandingModal, setShowBrandingModal] = useState(false);

  useEffect(() => {
    fetchSurveys();
    fetchClientBranding();
  }, [user]);

  const fetchSurveys = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('survey_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setSurveys(data || []);
    } catch (error) {
      console.error('Error fetching surveys:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClientBranding = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('client_branding')
        .select('company_name, logo_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setClientBranding({
          companyName: data.company_name,
          logoUrl: data.logo_url,
        });
      }
    } catch (error) {
      console.error('Error fetching client branding:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleNewSurvey = () => {
    if (!ROLE_PERMISSIONS.canCreateSurvey(userRole)) {
      alert('You do not have permission to create surveys. Please contact your administrator.');
      return;
    }
    setShowNewSurveyModal(true);
  };

  const handleSurveyCreated = (surveyId: string) => {
    setShowNewSurveyModal(false);
    setSelectedSurveyId(surveyId);
    setShowNewSurvey(true);
  };

  const handleSelectSurvey = (surveyId: string) => {
    if (!ROLE_PERMISSIONS.canEditSurvey(userRole)) {
      alert('You do not have permission to edit surveys. View-only access granted.');
      return;
    }
    setSelectedSurveyId(surveyId);
    setShowNewSurvey(true);
  };

  const handleBackToList = () => {
    setShowNewSurvey(false);
    setShowTextEditor(false);
    setSelectedSurveyId(null);
    fetchSurveys();
  };

  const handleOpenTextEditor = (surveyId: string) => {
    if (!ROLE_PERMISSIONS.canEditText(userRole)) {
      alert('You do not have permission to edit survey text. View-only access granted.');
      return;
    }
    setSelectedSurveyId(surveyId);
    setShowTextEditor(true);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getFrameworkLabel = (framework: string) => {
    const labels: Record<string, string> = {
      fire_property: 'Fire Property',
      fire_risk_assessment: 'FRA',
      atex: 'ATEX',
    };
    return labels[framework] || framework;
  };

  const getRiskBandColor = (band: string) => {
    switch (band) {
      case 'Very Good':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'Good':
        return 'bg-green-100 text-green-600 border-green-200';
      case 'Tolerable':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Poor':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Very Poor':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const calculateLegacyPortfolioMetrics = (surveysToAnalyze: Survey[]): PortfolioMetrics => {
    const issuedSurveys = surveysToAnalyze.filter(s => s.issued && !s.superseded_by_id);
    const scoredSurveys = issuedSurveys.filter(s =>
      s.form_data?.overallRiskScore !== undefined && s.form_data?.overallRiskScore > 0
    );

    if (scoredSurveys.length === 0) {
      return {
        averageScore: 0,
        totalIssued: issuedSurveys.length,
        scoredReports: 0,
        distribution: {},
        bestScore: 0,
        worstScore: 0,
        bestSite: '',
        worstSite: '',
      };
    }

    const scores = scoredSurveys.map(s => s.form_data.overallRiskScore);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    const distribution: Record<string, number> = {};
    scoredSurveys.forEach(s => {
      const band = s.form_data.riskBand || 'Unknown';
      distribution[band] = (distribution[band] || 0) + 1;
    });

    const sortedSurveys = [...scoredSurveys].sort((a, b) =>
      b.form_data.overallRiskScore - a.form_data.overallRiskScore
    );

    return {
      averageScore: Math.round(averageScore),
      totalIssued: issuedSurveys.length,
      scoredReports: scoredSurveys.length,
      distribution,
      bestScore: sortedSurveys[0]?.form_data.overallRiskScore || 0,
      worstScore: sortedSurveys[sortedSurveys.length - 1]?.form_data.overallRiskScore || 0,
      bestSite: sortedSurveys[0]?.property_name || '',
      worstSite: sortedSurveys[sortedSurveys.length - 1]?.property_name || '',
    };
  };

  const getRiskBandLabel = (score: number): string => {
    if (score >= 85) return 'Very Good';
    if (score >= 70) return 'Good';
    if (score >= 55) return 'Tolerable';
    if (score >= 40) return 'Poor';
    return 'Very Poor';
  };

  const filteredSurveys = surveys.filter(survey => {
    if (companyNameFilter && !survey.company_name?.toLowerCase().includes(companyNameFilter.toLowerCase())) {
      return false;
    }

    if (industrySectorFilter !== 'all') {
      const industrySector = survey.form_data?.industrySector;
      if (industrySector !== industrySectorFilter) {
        return false;
      }
    }

    if (frameworkFilter !== 'all' && survey.framework_type !== frameworkFilter) {
      return false;
    }

    return true;
  });

  const portfolioMetrics = calculateLegacyPortfolioMetrics(filteredSurveys);

  const handleIssueReport = async (surveyId: string) => {
    if (!ROLE_PERMISSIONS.canIssueSurvey(userRole)) {
      alert('You do not have permission to issue reports.');
      return;
    }

    try {
      const { error } = await supabase
        .from('survey_reports')
        .update({
          issued: true,
          issue_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', surveyId);

      if (error) throw error;

      setIssueConfirmId(null);
      fetchSurveys();
    } catch (error) {
      console.error('Error issuing report:', error);
      alert('Failed to issue report. Please try again.');
    }
  };

  const handleDeleteSurvey = async (surveyId: string) => {
    if (!ROLE_PERMISSIONS.canDeleteSurvey(userRole)) {
      alert('You do not have permission to delete surveys.');
      return;
    }

    try {
      const survey = surveys.find(s => s.id === surveyId);
      if (survey && survey.issued) {
        alert('Cannot delete an issued report. Issued reports are protected from deletion.');
        setDeleteConfirmId(null);
        return;
      }

      const { error } = await supabase
        .from('survey_reports')
        .delete()
        .eq('id', surveyId);

      if (error) throw error;

      setDeleteConfirmId(null);
      fetchSurveys();
    } catch (error) {
      console.error('Error deleting survey:', error);
      alert('Failed to delete survey. Please try again.');
    }
  };

  const handleResurvey = async (originalSurvey: Survey) => {
    if (!user) return;
    if (!ROLE_PERMISSIONS.canResurvey(userRole)) {
      alert('You do not have permission to create resurveys.');
      return;
    }

    try {
      const newSurveyData = {
        user_id: user.id,
        property_name: originalSurvey.property_name,
        property_address: originalSurvey.property_address,
        company_name: originalSurvey.company_name,
        framework_type: originalSurvey.framework_type,
        survey_type: originalSurvey.survey_type,
        report_status: 'Draft' as const,
        survey_date: new Date().toISOString().split('T')[0],
        issued: false,
        issue_date: null,
        superseded_by_id: null,
        form_data: {
          ...originalSurvey.form_data,
          propertyName: originalSurvey.property_name,
          propertyAddress: originalSurvey.property_address,
          companyName: originalSurvey.company_name || '',
          surveyDate: new Date().toISOString().split('T')[0],
          reportStatus: 'Draft',
        },
      };

      const { data: newSurvey, error: insertError } = await supabase
        .from('survey_reports')
        .insert([newSurveyData])
        .select()
        .single();

      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('survey_reports')
        .update({ superseded_by_id: newSurvey.id })
        .eq('id', originalSurvey.id);

      if (updateError) throw updateError;

      setResurveyConfirmId(null);
      fetchSurveys();

      setSelectedSurveyId(newSurvey.id);
      setShowNewSurvey(true);
    } catch (error) {
      console.error('Error creating resurvey:', error);
      alert('Failed to create resurvey. Please try again.');
    }
  };

  const handleGeneratePortfolioSummary = async () => {
    if (!ROLE_PERMISSIONS.canGeneratePortfolioSummary(userRole)) {
      alert('You do not have permission to generate portfolio summaries.');
      return;
    }

    setIsGeneratingSummary(true);
    try {
      const activeFilters = {
        companyName: companyNameFilter || null,
        industrySector: industrySectorFilter !== 'all' ? industrySectorFilter : null,
        framework: frameworkFilter !== 'all' ? frameworkFilter : null,
      };

      const aggregatedMetrics = aggregatePortfolioMetrics(filteredSurveys, activeFilters);

      if (!aggregatedMetrics) {
        alert('Insufficient data to generate portfolio summary. At least 2 issued surveys are required.');
        setIsGeneratingSummary(false);
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-portfolio-summary`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          portfolioMetrics: aggregatedMetrics,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate portfolio summary');
      }

      const data = await response.json();
      setPortfolioSummary(data.summary);
      setSummaryFilterState({
        companyName: companyNameFilter,
        industrySector: industrySectorFilter,
        framework: frameworkFilter,
      });
    } catch (error) {
      console.error('Error generating portfolio summary:', error);
      alert('Failed to generate portfolio summary. Please try again.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const isSummaryOutOfDate = portfolioSummary && summaryFilterState && (
    summaryFilterState.companyName !== companyNameFilter ||
    summaryFilterState.industrySector !== industrySectorFilter ||
    summaryFilterState.framework !== frameworkFilter
  );

  const getCompanyLogo = () => {
    return clientBranding.logoUrl;
  };

  const getCompanyName = () => {
    return clientBranding.companyName;
  };

  const handleBrandingUpdated = () => {
    fetchClientBranding();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {showNewSurveyModal && (
        <NewSurveyModal
          onClose={() => setShowNewSurveyModal(false)}
          onSurveyCreated={handleSurveyCreated}
        />
      )}

      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              {getCompanyLogo() ? (
                <img src={getCompanyLogo()!} alt={getCompanyName()} className="h-8" />
              ) : (
                <Building2 className="w-8 h-8 text-slate-900" />
              )}
              <div className="flex flex-col">
                <div className="text-xl font-bold text-slate-900">{getCompanyName()}</div>
                <div className="text-xs text-slate-500">Fire Risk Assessment Platform</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-sm text-slate-600">{user?.email}</span>
                <span className="text-xs text-slate-500">
                  Role: {userRole ? ROLE_LABELS[userRole as UserRole] : 'Loading...'}
                </span>
              </div>
              {userRole === 'admin' && (
                <>
                  <button
                    onClick={() => setShowBrandingModal(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                    title="Client Branding"
                  >
                    <Palette className="w-4 h-4" />
                    Branding
                  </button>
                  <button
                    onClick={() => navigate('/admin')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    Admin
                  </button>
                </>
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Log out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!showNewSurvey && !showTextEditor ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Survey Portfolio</h1>
                <p className="text-slate-600 mt-1">Manage and monitor your fire risk assessments</p>
              </div>
              {ROLE_PERMISSIONS.canCreateSurvey(userRole) ? (
                <button
                  onClick={handleNewSurvey}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                >
                  <Plus className="w-5 h-5" />
                  New Survey
                </button>
              ) : (
                <div className="px-4 py-2 bg-slate-100 text-slate-500 rounded-lg text-sm font-medium">
                  View-Only Access
                </div>
              )}
            </div>

            {surveys.length > 0 && portfolioMetrics.scoredReports > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Portfolio Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-slate-600">Portfolio Average</h3>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="text-4xl font-bold text-slate-900">{portfolioMetrics.averageScore}</div>
                      <div className={`mb-1 px-2 py-0.5 rounded text-xs font-semibold ${getRiskBandColor(getRiskBandLabel(portfolioMetrics.averageScore))}`}>
                        {getRiskBandLabel(portfolioMetrics.averageScore)}
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">
                      Based on {portfolioMetrics.scoredReports} issued site{portfolioMetrics.scoredReports !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-medium text-slate-600 mb-3">Best & Worst Sites</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Best:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 truncate max-w-[120px]" title={portfolioMetrics.bestSite}>
                            {portfolioMetrics.bestSite}
                          </span>
                          <span className="text-lg font-bold text-green-600">{portfolioMetrics.bestScore}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Worst:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 truncate max-w-[120px]" title={portfolioMetrics.worstSite}>
                            {portfolioMetrics.worstSite}
                          </span>
                          <span className="text-lg font-bold text-orange-600">{portfolioMetrics.worstScore}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-medium text-slate-600 mb-3">Risk Distribution</h3>
                    <div className="space-y-1.5">
                      {Object.entries(portfolioMetrics.distribution)
                        .sort((a, b) => {
                          const order = ['Very Good', 'Good', 'Tolerable', 'Poor', 'Very Poor'];
                          return order.indexOf(a[0]) - order.indexOf(b[0]);
                        })
                        .map(([band, count]) => (
                          <div key={band} className="flex items-center justify-between text-sm">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRiskBandColor(band)}`}>
                              {band}
                            </span>
                            <span className="font-semibold text-slate-900">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {surveys.length > 0 && (
              <div className="mb-6">
                <div className="bg-white rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
                    >
                      <Filter className="w-4 h-4" />
                      Filters {showFilters ? '▼' : '▶'}
                    </button>
                    <div className="text-sm text-slate-600">
                      Showing {filteredSurveys.length} of {surveys.length} surveys
                    </div>
                  </div>

                  {showFilters && (
                    <div className="flex flex-wrap items-end gap-4 pb-2 border-t border-slate-200 pt-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-slate-700">Company Name:</label>
                        <input
                          type="text"
                          placeholder="Search company..."
                          value={companyNameFilter}
                          onChange={(e) => setCompanyNameFilter(e.target.value)}
                          className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 min-w-[200px]"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-slate-700">Industry Sector:</label>
                        <select
                          value={industrySectorFilter}
                          onChange={(e) => setIndustrySectorFilter(e.target.value)}
                          className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 min-w-[200px]"
                        >
                          <option value="all">All Sectors</option>
                          <option value="Food & Beverage">Food & Beverage</option>
                          <option value="Foundry / Metal">Foundry / Metal</option>
                          <option value="Chemical / ATEX">Chemical / ATEX</option>
                          <option value="Logistics / Warehouse">Logistics / Warehouse</option>
                          <option value="Office / Commercial">Office / Commercial</option>
                          <option value="General Industrial">General Industrial</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-slate-700">Framework:</label>
                        <select
                          value={frameworkFilter}
                          onChange={(e) => setFrameworkFilter(e.target.value)}
                          className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 min-w-[180px]"
                        >
                          <option value="all">All Frameworks</option>
                          <option value="fire_property">Fire Property</option>
                          <option value="fire_risk_assessment">FRA</option>
                          <option value="atex">ATEX</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {surveys.length > 0 && ROLE_PERMISSIONS.canGeneratePortfolioSummary(userRole) && (
              <div className="mb-6 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-slate-50 px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-bold text-slate-900">Portfolio Summary</h3>
                    </div>
                    {portfolioSummary && (
                      <button
                        onClick={handleGeneratePortfolioSummary}
                        disabled={filteredSurveys.length < 2 || isGeneratingSummary}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          filteredSurveys.length < 2 || isGeneratingSummary
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                        title={filteredSurveys.length < 2 ? 'At least 2 survey reports required' : 'Regenerate portfolio summary'}
                      >
                        <RefreshCw className={`w-4 h-4 ${isGeneratingSummary ? 'animate-spin' : ''}`} />
                        {isGeneratingSummary ? 'Regenerating...' : 'Regenerate'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  {portfolioSummary ? (
                    <>
                      {isSummaryOutOfDate && (
                        <div className="flex items-center gap-2 px-4 py-2.5 mb-4 bg-amber-50 border border-amber-200 rounded-lg">
                          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <span className="text-sm text-amber-700 font-medium">
                            Filters have changed. Click "Regenerate" to update the summary with current filters.
                          </span>
                        </div>
                      )}
                      <div className="prose prose-slate max-w-none">
                        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{portfolioSummary}</p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <p className="text-xs text-slate-500">
                          AI-generated portfolio analysis based on {filteredSurveys.filter(s => s.issued && !s.superseded_by_id).length} issued surveys
                          {summaryFilterState?.companyName && ` • Filtered by: ${summaryFilterState.companyName}`}
                          {summaryFilterState?.industrySector && summaryFilterState.industrySector !== 'all' && ` • Sector: ${summaryFilterState.industrySector}`}
                          {summaryFilterState?.framework && summaryFilterState.framework !== 'all' && ` • Framework: ${getFrameworkLabel(summaryFilterState.framework)}`}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                        <Sparkles className="w-8 h-8 text-blue-600" />
                      </div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-2">No Summary Generated Yet</h4>
                      <p className="text-slate-600 mb-6 max-w-md mx-auto">
                        Generate an AI-powered analysis of your portfolio to identify trends, risks, and insights across your surveys.
                      </p>
                      <button
                        onClick={handleGeneratePortfolioSummary}
                        disabled={filteredSurveys.length < 2 || isGeneratingSummary}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-lg transition-colors mx-auto ${
                          filteredSurveys.length < 2 || isGeneratingSummary
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                        }`}
                        title={filteredSurveys.length < 2 ? 'At least 2 issued survey reports required' : 'Generate AI-powered portfolio summary'}
                      >
                        <Sparkles className={`w-4 h-4 ${isGeneratingSummary ? 'animate-pulse' : ''}`} />
                        {isGeneratingSummary ? 'Generating Summary...' : 'Generate AI Summary'}
                      </button>
                      {filteredSurveys.length < 2 && (
                        <p className="text-xs text-slate-500 mt-3">
                          At least 2 issued survey reports are required to generate a portfolio summary
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-slate-900"></div>
              </div>
            ) : surveys.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-lg border border-slate-200">
                <div className="w-16 h-16 text-slate-300 mb-4">📋</div>
                <p className="text-slate-500 text-lg mb-2">No surveys yet</p>
                <p className="text-slate-400 text-sm">
                  {ROLE_PERMISSIONS.canCreateSurvey(userRole)
                    ? 'Create your first survey to get started'
                    : 'No surveys available for viewing'}
                </p>
              </div>
            ) : filteredSurveys.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-lg border border-slate-200">
                <div className="w-16 h-16 text-slate-300 mb-4">🔍</div>
                <p className="text-slate-500 text-lg mb-2">No surveys match your filters</p>
                <p className="text-slate-400 text-sm">Try adjusting your filter criteria</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                          Company Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                          Site / Location
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                          Industry Sector
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                          Risk Score
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                          Risk Band
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                          Framework
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                          Survey Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider min-w-[200px]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {filteredSurveys.map((survey) => {
                        const canIssue = survey.report_status === 'Issue Ready' && !survey.issued && ROLE_PERMISSIONS.canIssueSurvey(userRole);
                        const canDelete = !survey.issued && ROLE_PERMISSIONS.canDeleteSurvey(userRole);
                        const isSuperseded = survey.superseded_by_id !== null;

                        const industrySector = survey.form_data?.industrySector;
                        const overallScore = survey.form_data?.overallRiskScore;
                        const riskBand = survey.form_data?.riskBand;

                        return (
                          <tr key={survey.id} className={`hover:bg-slate-50 transition-colors ${isSuperseded ? 'opacity-60' : ''}`}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                              {survey.company_name || '—'}
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-slate-900">
                                {survey.property_name || 'Untitled Survey'}
                              </div>
                              <div className="text-sm text-slate-500 truncate max-w-xs">
                                {(() => {
                                  if (!survey.property_address) return '';
                                  const parts = survey.property_address.split(',').map(p => p.trim());
                                  return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
                                })()}
                              </div>
                              {isSuperseded && (
                                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-xs font-medium text-slate-600 bg-slate-100 rounded">
                                  Superseded
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                              {industrySector || '—'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {overallScore ? (
                                <span className="text-2xl font-bold text-slate-900">{overallScore}</span>
                              ) : (
                                <span className="text-sm text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {riskBand ? (
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded border ${getRiskBandColor(riskBand)}`}>
                                  {riskBand}
                                </span>
                              ) : (
                                <span className="text-sm text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                                {getFrameworkLabel(survey.framework_type)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                              {formatDate(survey.survey_date)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                    survey.report_status === 'Draft'
                                      ? 'bg-slate-100 text-slate-700'
                                      : survey.report_status === 'Internally Reviewed'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-green-100 text-green-700'
                                  }`}
                                >
                                  {survey.report_status || 'Draft'}
                                </span>
                                {survey.issued && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                                    <Lock className="w-3 h-3" />
                                    ISSUED
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm min-w-[200px]">
                              <div className="flex items-center gap-2 flex-wrap">
                                {survey.generated_report && ROLE_PERMISSIONS.canViewReports(userRole) && (
                                  <button
                                    onClick={() => navigate(`/report/${survey.id}`)}
                                    className="text-blue-600 hover:text-blue-900 transition-colors"
                                    title="Preview Full Report"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                )}
                                {(survey.survey_text || survey.recommendation_text) && ROLE_PERMISSIONS.canViewReports(userRole) && (
                                  <button
                                    onClick={() => setTextReportSurveyId(survey.id)}
                                    className="text-teal-600 hover:text-teal-900 transition-colors"
                                    title="View Text Reports"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </button>
                                )}
                                {survey.issued && survey.form_data?.overallComments?.length > 0 && ROLE_PERMISSIONS.canViewReports(userRole) && (
                                  <button
                                    onClick={() => setRecommendationReportSurveyId(survey.id)}
                                    className="text-emerald-600 hover:text-emerald-900 transition-colors"
                                    title="View Recommendations"
                                  >
                                    <Sparkles className="w-4 h-4" />
                                  </button>
                                )}
                                {ROLE_PERMISSIONS.canEditSurvey(userRole) && (
                                  <button
                                    onClick={() => handleSelectSurvey(survey.id)}
                                    className={`transition-colors ${
                                      survey.issued
                                        ? 'text-slate-400 cursor-not-allowed'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                    title={survey.issued ? 'Issued reports are read-only' : 'Edit Survey'}
                                    disabled={survey.issued}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                )}
                                {ROLE_PERMISSIONS.canEditText(userRole) && (
                                  <button
                                    onClick={() => handleOpenTextEditor(survey.id)}
                                    className="text-indigo-600 hover:text-indigo-900 transition-colors"
                                    title="Text Editor"
                                  >
                                    <FileEdit className="w-4 h-4" />
                                  </button>
                                )}
                                {ROLE_PERMISSIONS.canResurvey(userRole) && (
                                  <button
                                    onClick={() => setResurveyConfirmId(survey.id)}
                                    className="text-blue-600 hover:text-blue-900 transition-colors"
                                    title="Resurvey Site"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                )}
                                {ROLE_PERMISSIONS.canGenerateExternalLink(userRole) && (
                                  <button
                                    onClick={() => setExternalLinkSurveyId(survey.id)}
                                    className="text-violet-600 hover:text-violet-900 transition-colors"
                                    title="Generate External Link"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </button>
                                )}
                                {canIssue && (
                                  <button
                                    onClick={() => setIssueConfirmId(survey.id)}
                                    className="text-green-600 hover:text-green-900 transition-colors"
                                    title="Issue Report"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                )}
                                {canDelete ? (
                                  <button
                                    onClick={() => setDeleteConfirmId(survey.id)}
                                    className="text-red-600 hover:text-red-900 transition-colors"
                                    title="Delete Survey"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                ) : survey.issued ? (
                                  <button
                                    disabled
                                    className="text-slate-300 cursor-not-allowed"
                                    title="Issued reports cannot be deleted"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : showTextEditor ? (
          <div className="pt-8">
            <SurveyTextEditor
              surveyId={selectedSurveyId!}
              onBack={handleBackToList}
            />
          </div>
        ) : (
          <div className="pt-32">
            <div className="mb-6">
              <button
                onClick={handleBackToList}
                className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
              >
                ← Back to Survey List
              </button>
            </div>
            <NewSurveyReport
              surveyId={selectedSurveyId}
              onCancel={handleBackToList}
            />
          </div>
        )}
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Survey</h3>
            <p className="text-slate-600 mb-1">Are you sure you want to delete this survey?</p>
            <p className="text-slate-600 mb-4">This action cannot be undone. All associated data will be permanently removed.</p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSurvey(deleteConfirmId)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Delete Survey
              </button>
            </div>
          </div>
        </div>
      )}

      {issueConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Issue Report</h3>
            <p className="text-slate-600 mb-4">
              Are you sure you want to issue this report? Once issued, the report will be locked and cannot be edited or deleted.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setIssueConfirmId(null)}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleIssueReport(issueConfirmId)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Issue Report
              </button>
            </div>
          </div>
        </div>
      )}

      {resurveyConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Resurvey Site</h3>
            <p className="text-slate-600 mb-4">
              This will create a new survey based on the selected site. The current survey will be marked as superseded.
              Do you want to continue?
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setResurveyConfirmId(null)}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const survey = surveys.find(s => s.id === resurveyConfirmId);
                  if (survey) handleResurvey(survey);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Create Resurvey
              </button>
            </div>
          </div>
        </div>
      )}

      {externalLinkSurveyId && (
        <ExternalLinkModal
          isOpen={!!externalLinkSurveyId}
          onClose={() => setExternalLinkSurveyId(null)}
          surveyId={externalLinkSurveyId}
          surveyName={surveys.find(s => s.id === externalLinkSurveyId)?.company_name || surveys.find(s => s.id === externalLinkSurveyId)?.property_name || 'Survey'}
          surveyStatus={surveys.find(s => s.id === externalLinkSurveyId)?.report_status.toLowerCase() || 'draft'}
        />
      )}

      {recommendationReportSurveyId && (
        <RecommendationReport
          surveyId={recommendationReportSurveyId}
          onClose={() => setRecommendationReportSurveyId(null)}
        />
      )}

      {textReportSurveyId && (
        <TextReportModal
          surveyId={textReportSurveyId}
          onClose={() => setTextReportSurveyId(null)}
        />
      )}

      <ClientBrandingModal
        isOpen={showBrandingModal}
        onClose={() => setShowBrandingModal(false)}
        onBrandingUpdated={handleBrandingUpdated}
      />
    </div>
  );
}
