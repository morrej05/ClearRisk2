import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import OrganisationBranding from '../../components/OrganisationBranding';

type AdminTab = 'organisation' | 'users' | 'assessment-settings' | 'recommendations' | 'document-control' | 'audit-log';

export default function AdminPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('organisation');

  const tabs = [
    { id: 'organisation' as AdminTab, label: 'Organisation' },
    { id: 'users' as AdminTab, label: 'Users & Roles' },
    { id: 'assessment-settings' as AdminTab, label: 'Assessment Settings' },
    { id: 'recommendations' as AdminTab, label: 'Recommendations' },
    { id: 'document-control' as AdminTab, label: 'Document Control' },
    { id: 'audit-log' as AdminTab, label: 'Audit Log' },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 min-w-0">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
            <div className="h-6 w-px bg-slate-300" />
            <h1 className="text-3xl font-bold text-slate-900">Admin</h1>
          </div>
          <button
            onClick={() => navigate('/assessments')}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Assessments
          </button>
        </div>

        <div className="mb-6 border-b border-slate-200">
          <nav className="flex gap-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          {activeTab === 'organisation' && (
            <OrganisationBranding />
          )}

          {activeTab === 'users' && (
            <div className="w-full min-w-0 overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                      No users found
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'assessment-settings' && (
            <div className="p-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Assessment Settings</h2>
              <p className="text-sm text-slate-600">Configure default assessment parameters and workflows.</p>
            </div>
          )}

          {activeTab === 'recommendations' && (
            <div className="p-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Recommendations Management</h2>
              <p className="text-sm text-slate-600">Manage recommendation templates and approval workflows.</p>
            </div>
          )}

          {activeTab === 'document-control' && (
            <div className="p-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Document Control</h2>
              <p className="text-sm text-slate-600">Configure document numbering, versioning, and approval processes.</p>
            </div>
          )}

          {activeTab === 'audit-log' && (
            <div className="w-full min-w-0 overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Resource
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                      No audit log entries
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
  );
}
