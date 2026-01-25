import { useNavigate } from 'react-router-dom';
import { Plus, ArrowRight, FileText, Sparkles } from 'lucide-react';
import { isFeatureEnabled } from '../../utils/featureFlags';
import { useAssessments } from '../../hooks/useAssessments';
import { usePropertySurveys } from '../../hooks/usePropertySurveys';
import { useAuth } from '../../contexts/AuthContext';
import { canAccessRiskEngineering } from '../../utils/entitlements';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const { assessments, loading } = useAssessments({ limit: 8 });
  const { surveys: propertySurveys, loading: surveysLoading } = usePropertySurveys({ limit: 5 });

  const hasRiskEngineering = organisation ? canAccessRiskEngineering(organisation) : false;

  function formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  function handleContinue(assessmentId: string) {
    navigate(`/documents/${assessmentId}`, { state: { returnTo: '/dashboard' } });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        </div>

        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={() => navigate('/assessments/new', { state: { returnTo: '/dashboard' } })}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Assessment
          </button>
          <button
            onClick={() => navigate('/assessments', { state: { returnTo: '/dashboard' } })}
            className="px-4 py-2 bg-white text-slate-900 text-sm font-medium rounded-md border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            View Assessments
          </button>
          <button
            onClick={() => navigate('/reports')}
            className="px-4 py-2 bg-white text-slate-900 text-sm font-medium rounded-md border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            View Reports
          </button>
        </div>

        <div className="mb-6 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Summary</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Plan:</span>
              <span className="text-sm font-medium text-slate-900">
                {organisation?.plan_id || 'N/A'} / {organisation?.subscription_status || 'inactive'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Last updated assessment:</span>
              <span className="text-sm font-medium text-slate-900">
                {assessments[0]?.siteName || '—'}
              </span>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-500 italic">AI summary panel (coming next)</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <div className="lg:col-span-2 xl:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">Active Work</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Client / Site
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Surveyor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Last Updated
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                          Loading...
                        </td>
                      </tr>
                    ) : assessments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                          No assessments yet
                        </td>
                      </tr>
                    ) : (
                      assessments.map((assessment) => (
                        <tr key={assessment.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-slate-900">
                              {assessment.clientName}
                            </div>
                            <div className="text-sm text-slate-500">{assessment.siteName}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-900">
                            {assessment.type}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-900">
                            {assessment.surveyor || '—'}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                assessment.status === 'Draft'
                                  ? 'bg-slate-100 text-slate-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {assessment.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {formatDate(assessment.updatedAt)}
                          </td>
                          <td className="px-6 py-4 text-sm text-right">
                            <button
                              onClick={() => handleContinue(assessment.id)}
                              className="text-slate-900 hover:text-slate-700 font-medium"
                            >
                              {assessment.status === 'Draft' ? 'Continue' : 'View'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {assessments.length > 0 && (
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                  <button
                    onClick={() => navigate('/assessments')}
                    className="text-sm text-slate-700 hover:text-slate-900 font-medium flex items-center gap-1"
                  >
                    View all assessments
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {hasRiskEngineering && (
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900">Risk Engineering Summary</h2>
                </div>

                {surveysLoading ? (
                  <div className="p-6 text-center text-sm text-slate-500">
                    Loading...
                  </div>
                ) : (
                  <>
                    {propertySurveys.length > 0 ? (
                      <>
                        <div className="px-6 py-4 bg-blue-50 border-b border-slate-200">
                          <div className="flex items-start gap-3">
                            <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <h3 className="text-sm font-semibold text-slate-900 mb-2">AI Overview</h3>
                              <p className="text-sm text-slate-700">
                                {propertySurveys[0]?.notes_summary || propertySurveys[0]?.summary_text || 'No AI summary available yet'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="p-6">
                          <h3 className="text-sm font-semibold text-slate-900 mb-3">Recent Surveys</h3>
                          <div className="space-y-3">
                            {propertySurveys.slice(0, 5).map((survey) => (
                              <div
                                key={survey.id}
                                className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                                onClick={() => navigate(`/report/${survey.id}`)}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                    <p className="text-sm font-medium text-slate-900 truncate">
                                      {survey.property_name || 'Untitled Survey'}
                                    </p>
                                  </div>
                                  {survey.property_address && (
                                    <p className="text-xs text-slate-500 mt-1 ml-6 truncate">
                                      {survey.property_address}
                                    </p>
                                  )}
                                  <p className="text-xs text-slate-400 mt-1 ml-6">
                                    {formatDate(new Date(survey.updated_at))}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => navigate('/reports')}
                            className="mt-4 w-full px-4 py-2 bg-slate-100 text-slate-900 text-sm font-medium rounded-md hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                          >
                            View All Risk Surveys
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="p-6 text-center">
                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500 mb-4">No property surveys yet</p>
                        <button
                          onClick={() => navigate('/assessments/new')}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Create Survey
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {isFeatureEnabled('IMPAIRMENTS_ENABLED') && (
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900">Impairments Summary</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Open</span>
                      <span className="text-2xl font-bold text-slate-900">0</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Overdue</span>
                      <span className="text-2xl font-bold text-red-600">0</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Due This Week</span>
                      <span className="text-2xl font-bold text-amber-600">0</span>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/impairments')}
                    className="mt-6 w-full px-4 py-2 bg-slate-100 text-slate-900 text-sm font-medium rounded-md hover:bg-slate-200 transition-colors"
                  >
                    View All Impairments
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
