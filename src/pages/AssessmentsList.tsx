import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { canAccessPillarB } from '../utils/entitlements';
import { Plus, FileText, ListChecks, Lock, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAssessmentDisplayName } from '../utils/displayNames';

interface Assessment {
  id: string;
  type: string;
  jurisdiction: string;
  status: string;
  site_name: string;
  client_name: string | null;
  assessment_date: string;
  created_at: string;
  issued_at: string | null;
}

export default function AssessmentsList() {
  const { user, userProfile, organisation } = useAuth();
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    if (user && organisation) {
      fetchAssessments();
    } else {
      setIsLoading(false);
    }
  }, [user, organisation]);

  const fetchAssessments = async () => {
    if (!organisation?.id) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from('assessments')
        .select('*')
        .eq('org_id', organisation.id)
        .order('created_at', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('type', filterType);
      }

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAssessments(data || []);
    } catch (error) {
      console.error('Error fetching assessments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && organisation) {
      fetchAssessments();
    }
  }, [filterType, filterStatus]);

  const getTypeLabel = (type: string, jurisdiction?: string) => {
    return getAssessmentDisplayName(type, jurisdiction);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-neutral-300 border-t-neutral-900 mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading assessments...</p>
        </div>
      </div>
    );
  }

  if (!user || !organisation) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-neutral-200 p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-300 border-t-blue-600"></div>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-3 text-center">
            Setting Up Your Account
          </h2>
          <p className="text-neutral-600 mb-6 text-center">
            Please wait while we prepare your organisation. This should only take a moment.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-semibold"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Assessments</h1>
            <p className="text-neutral-600 mt-1">
              Manage your FRA, Fire Strategy, Explosive Atmospheres, and Wildfire assessments
            </p>
          </div>
          <button
            onClick={() => navigate('/assessments/new')}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Assessment
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-neutral-400" />
            <div className="flex gap-4 flex-1">
              <div>
                <label className="text-sm font-medium text-neutral-700 mr-2">Type:</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="border border-neutral-300 rounded px-3 py-1.5 text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="fra">FRA</option>
                  <option value="fire_strategy">Fire Strategy</option>
                  <option value="dsear">Explosive Atmospheres</option>
                  <option value="wildfire">Wildfire</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 mr-2">Status:</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="border border-neutral-300 rounded px-3 py-1.5 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="issued">Issued</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-neutral-300 border-t-neutral-900"></div>
          </div>
        ) : assessments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-12 text-center">
            <FileText className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">No assessments yet</h3>
            <p className="text-neutral-600 mb-6">
              Create your first assessment to get started
            </p>
            <button
              onClick={() => navigate('/assessments/new')}
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Assessment
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Site Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Jurisdiction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {assessments.map((assessment) => (
                  <tr key={assessment.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {formatDate(assessment.assessment_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {getTypeLabel(assessment.type, assessment.jurisdiction)}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-900">
                      <div className="font-medium">{assessment.site_name}</div>
                      {assessment.client_name && (
                        <div className="text-neutral-500 text-xs">{assessment.client_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                      {assessment.jurisdiction}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          assessment.status === 'issued'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {assessment.status === 'issued' ? 'Issued' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            const docId = (assessment as any).document_id;
                            if (docId) {
                              navigate(`/documents/${docId}`);
                            } else {
                              console.warn(`Assessment ${assessment.id} missing document_id, using legacy route`);
                              navigate(`/assessments/${assessment.id}/edit`);
                            }
                          }}
                          className="text-primary-600 hover:text-primary-900"
                          title="Edit"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            const docId = (assessment as any).document_id;
                        
                            if (!docId) {
                              alert('This assessment is not linked to a document yet, so modules cannot load.');
                              return;
                            }
                        
                            // 🔒 FORCE old module workspace
                            navigate(`/documents/${docId}/workspace`);
                          }}
                          className="text-primary-600 hover:text-primary-900"
                          title="Edit"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => navigate(`/assessments/${assessment.id}/recommendations`)}
                          className="text-neutral-600 hover:text-neutral-900"
                          title="Recommendations Report"
                        >
                          <ListChecks className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
