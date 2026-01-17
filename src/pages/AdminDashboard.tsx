import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Eye, Edit, Trash2, RefreshCw, Lock, Filter, Download, Shield, Users, ArrowLeft, Sliders } from 'lucide-react';
import { supabase } from '../lib/supabase';
import UserManagement from '../components/UserManagement';
import SectorWeightings from '../components/SectorWeightings';

interface Survey {
  id: string;
  property_name: string;
  property_address: string;
  company_name: string | null;
  framework_type: 'fire_property' | 'fire_risk_assessment' | 'atex';
  survey_type: 'Full' | 'Abridged';
  report_status: 'Draft' | 'Internally Reviewed' | 'Issue Ready';
  issued: boolean;
  survey_date: string | null;
  issue_date: string | null;
  superseded_by_id: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  creator_name?: string;
}

export default function AdminDashboard() {
  const { signOut, user, userRole, refreshUserRole } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'users' | 'surveys' | 'weightings'>('users');
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [filteredSurveys, setFilteredSurveys] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);

  // Filter states
  const [companyFilter, setCompanyFilter] = useState('');
  const [industrySectorFilter, setIndustrySectorFilter] = useState('all');
  const [frameworkFilter, setFrameworkFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [issuedFilter, setIssuedFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'survey_date' | 'issue_date' | 'company_name' | 'updated_at'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (userRole !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchSurveys();
  }, [userRole, navigate]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [surveys, companyFilter, industrySectorFilter, frameworkFilter, statusFilter, issuedFilter, sortBy, sortOrder]);

  const fetchSurveys = async () => {
    setIsLoading(true);
    try {
      const { data: surveysData, error: surveysError } = await supabase
        .from('survey_reports')
        .select('id, property_name, property_address, company_name, framework_type, survey_type, report_status, issued, survey_date, issue_date, superseded_by_id, created_at, updated_at, user_id, form_data')
        .order('updated_at', { ascending: false });

      if (surveysError) {
        console.error('Error fetching surveys:', surveysError);
        throw surveysError;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, name');

      const profilesMap = new Map<string, string>();
      if (!profilesError && profilesData) {
        profilesData.forEach(profile => {
          profilesMap.set(profile.id, profile.name || 'Unknown');
        });
      }

      const surveysWithCreator = (surveysData || []).map((survey: any) => ({
        ...survey,
        creator_name: profilesMap.get(survey.user_id) || 'Unknown',
      }));

      setSurveys(surveysWithCreator);
    } catch (error) {
      console.error('Error fetching surveys:', error);
      alert('Failed to load surveys. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let result = [...surveys];

    if (companyFilter) {
      result = result.filter(s =>
        s.company_name?.toLowerCase().includes(companyFilter.toLowerCase()) ||
        s.property_name.toLowerCase().includes(companyFilter.toLowerCase())
      );
    }

    if (industrySectorFilter !== 'all') {
      result = result.filter(s => {
        const industrySector = (s as any).form_data?.industrySector;
        return industrySector === industrySectorFilter;
      });
    }

    if (frameworkFilter !== 'all') {
      result = result.filter(s => s.framework_type === frameworkFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter(s => s.report_status === statusFilter);
    }

    if (issuedFilter !== 'all') {
      const isIssued = issuedFilter === 'yes';
      result = result.filter(s => s.issued === isIssued);
    }

    result.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortBy) {
        case 'survey_date':
          aVal = a.survey_date || '';
          bVal = b.survey_date || '';
          break;
        case 'issue_date':
          aVal = a.issue_date || '';
          bVal = b.issue_date || '';
          break;
        case 'company_name':
          aVal = a.company_name || '';
          bVal = b.company_name || '';
          break;
        case 'updated_at':
          aVal = a.updated_at;
          bVal = b.updated_at;
          break;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredSurveys(result);
  };

  const handleView = (surveyId: string) => {
    navigate(`/survey/${surveyId}/view`);
  };

  const handleEdit = (surveyId: string) => {
    navigate(`/survey/${surveyId}/edit`);
  };

  const handleDeleteClick = (surveyId: string) => {
    setSelectedSurveyId(surveyId);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSurveyId) return;

    try {
      const { error } = await supabase
        .from('survey_reports')
        .delete()
        .eq('id', selectedSurveyId);

      if (error) throw error;

      setSurveys(surveys.filter(s => s.id !== selectedSurveyId));
      setDeleteModalOpen(false);
      setSelectedSurveyId(null);
    } catch (error) {
      console.error('Error deleting survey:', error);
      alert('Failed to delete survey');
    }
  };

  const handleResurvey = async (survey: Survey) => {
    try {
      const { data: newSurvey, error: insertError } = await supabase
        .from('survey_reports')
        .insert({
          property_name: survey.property_name,
          property_address: survey.property_address,
          company_name: survey.company_name,
          framework_type: survey.framework_type,
          survey_type: survey.survey_type,
          survey_date: new Date().toISOString().split('T')[0],
          report_status: 'Draft',
          issued: false,
          issue_date: null,
          superseded_by_id: null,
          form_data: {},
          user_id: user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('survey_reports')
        .update({ superseded_by_id: newSurvey.id })
        .eq('id', survey.id);

      if (updateError) throw updateError;

      navigate(`/survey/${newSurvey.id}/edit`);
    } catch (error) {
      console.error('Error creating resurvey:', error);
      alert('Failed to create resurvey');
    }
  };

  const handleIssue = async (surveyId: string) => {
    try {
      const { error } = await supabase
        .from('survey_reports')
        .update({
          issued: true,
          issue_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', surveyId);

      if (error) throw error;

      fetchSurveys();
    } catch (error) {
      console.error('Error issuing report:', error);
      alert('Failed to issue report');
    }
  };

  const handleExport = () => {
    const csvContent = [
      ['Company', 'Site', 'Framework', 'Type', 'Status', 'Issued', 'Survey Date', 'Issue Date', 'Created By'].join(','),
      ...filteredSurveys.map(s => [
        s.company_name || '',
        s.property_name,
        s.framework_type,
        s.survey_type,
        s.report_status,
        s.issued ? 'Yes' : 'No',
        s.survey_date || '',
        s.issue_date || '',
        s.creator_name || '',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clearrisk-surveys-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getFrameworkLabel = (framework: string) => {
    const labels: Record<string, string> = {
      fire_property: 'Fire Property',
      fire_risk_assessment: 'FRA',
      atex: 'ATEX',
    };
    return labels[framework] || framework;
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-slate-100 text-slate-700';
      case 'Internally Reviewed':
        return 'bg-amber-100 text-amber-700';
      case 'Issue Ready':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (userRole !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-slate-900" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
                <p className="text-sm text-slate-600">User & Survey Management</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:text-slate-900 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>

          <div className="flex border-b border-slate-200 mt-4">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'users'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Users className="w-4 h-4" />
              User Management
            </button>
            <button
              onClick={() => setActiveTab('surveys')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'surveys'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Shield className="w-4 h-4" />
              Survey Management
            </button>
            <button
              onClick={() => setActiveTab('weightings')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'weightings'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Sliders className="w-4 h-4" />
              Sector Weightings
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {activeTab === 'users' ? (
          <UserManagement />
        ) : activeTab === 'weightings' ? (
          <SectorWeightings />
        ) : (
          <div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-700" />
              <h2 className="text-lg font-semibold text-slate-900">Filters & Sort</h2>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Company or site name..."
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Industry Sector</label>
              <select
                value={industrySectorFilter}
                onChange={(e) => setIndustrySectorFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
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

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Framework</label>
              <select
                value={frameworkFilter}
                onChange={(e) => setFrameworkFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              >
                <option value="all">All Frameworks</option>
                <option value="fire_property">Fire Property</option>
                <option value="fire_risk_assessment">FRA</option>
                <option value="atex">ATEX</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Internally Reviewed">Internally Reviewed</option>
                <option value="Issue Ready">Issue Ready</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Issued</label>
              <select
                value={issuedFilter}
                onChange={(e) => setIssuedFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sort By</label>
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                >
                  <option value="updated_at">Last Updated</option>
                  <option value="survey_date">Survey Date</option>
                  <option value="issue_date">Issue Date</option>
                  <option value="company_name">Company</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-slate-900"></div>
          </div>
        ) : filteredSurveys.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-slate-500">No surveys found matching your filters</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Site / Survey</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Framework</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Issued</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Survey Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Issue Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredSurveys.map((survey) => (
                    <tr key={survey.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 text-sm text-slate-900">
                        {survey.company_name || '-'}
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <div className="text-sm font-medium text-slate-900">{survey.property_name}</div>
                          {survey.superseded_by_id && (
                            <div className="text-xs text-amber-600 mt-1">Resurvey exists</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                          {getFrameworkLabel(survey.framework_type)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{survey.survey_type}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${getStatusBadgeColor(survey.report_status)}`}>
                          {survey.report_status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {survey.issued ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-700">
                            <Lock className="w-3 h-3" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-sm text-slate-500">No</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatDate(survey.survey_date)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatDate(survey.issue_date)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleView(survey.id)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {!survey.issued && (
                            <button
                              onClick={() => handleEdit(survey.id)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {!survey.issued && (
                            <button
                              onClick={() => handleDeleteClick(survey.id)}
                              className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleResurvey(survey)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                            title="Resurvey"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          {survey.report_status === 'Issue Ready' && !survey.issued && (
                            <button
                              onClick={() => handleIssue(survey.id)}
                              className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                              title="Issue Report"
                            >
                              <Lock className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-4 text-sm text-slate-600">
          Showing {filteredSurveys.length} of {surveys.length} surveys
        </div>
          </div>
        )}
      </div>

      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-slate-900 mb-4">Delete Survey</h3>
            <p className="text-slate-700 mb-6">
              Are you sure you want to delete this survey? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-700 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
