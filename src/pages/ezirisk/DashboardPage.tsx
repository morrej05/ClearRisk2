import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import AppLayout from '../../components/AppLayout';
import { isFeatureEnabled } from '../../utils/featureFlags';

export default function DashboardPage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        </div>

        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={() => navigate('/assessments/new')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Assessment
          </button>
          <button
            onClick={() => navigate('/assessments')}
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
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                        No active assessments
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
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
