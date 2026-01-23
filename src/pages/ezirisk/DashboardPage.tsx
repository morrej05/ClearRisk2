import { useNavigate } from 'react-router-dom';
import { Plus, ArrowRight } from 'lucide-react';
import AppLayout from '../../components/AppLayout';
import { isFeatureEnabled } from '../../utils/featureFlags';
import { useAssessments } from '../../hooks/useAssessments';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { assessments, loading } = useAssessments({ limit: 8 });

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
    navigate(`/documents/${assessmentId}/workspace`, { state: { returnTo: '/dashboard' } });
  }

  return (
    <AppLayout>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
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
                        Discipline(s)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Type
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
                            {assessment.discipline}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-900">
                            {assessment.type}
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
    </AppLayout>
  );
}
