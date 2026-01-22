import { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Plus, Search, MoreVertical } from 'lucide-react';
import AppLayout from '../../components/AppLayout';
import { useAssessments, AssessmentViewModel } from '../../hooks/useAssessments';

export default function AssessmentsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { assessments, loading } = useAssessments();

  const [searchTerm, setSearchTerm] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sortBy, setSortBy] = useState('updated');

  const subNavItems = [
    { label: 'All Assessments', path: '/assessments' },
    { label: 'New Assessment', path: '/assessments/new' },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const availableTypes = useMemo(() => {
    const types = new Set(assessments.map(a => a.type));
    return ['All', ...Array.from(types)];
  }, [assessments]);

  const filteredAndSortedAssessments = useMemo(() => {
    let filtered = assessments;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        a =>
          a.clientName.toLowerCase().includes(term) ||
          a.siteName.toLowerCase().includes(term)
      );
    }

    if (disciplineFilter !== 'All') {
      filtered = filtered.filter(a => a.discipline === disciplineFilter);
    }

    if (statusFilter !== 'All') {
      filtered = filtered.filter(a => a.status === statusFilter);
    }

    if (typeFilter !== 'All') {
      filtered = filtered.filter(a => a.type === typeFilter);
    }

    const sorted = [...filtered];
    switch (sortBy) {
      case 'updated':
        sorted.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        break;
      case 'created':
        sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case 'client':
        sorted.sort((a, b) => a.clientName.localeCompare(b.clientName));
        break;
    }

    return sorted;
  }, [assessments, searchTerm, disciplineFilter, statusFilter, typeFilter, sortBy]);

  function formatDate(date: Date): string {
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  function handleContinue(assessmentId: string, status: string) {
    navigate(`/documents/${assessmentId}/workspace`);
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-900">Assessments</h1>
          <button
            onClick={() => navigate('/assessments/new')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Assessment
          </button>
        </div>

        <div className="mb-6 border-b border-slate-200">
          <nav className="flex gap-6">
            {subNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive(item.path)
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mb-6 bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search client, site, reference…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>
            <select
              value={disciplineFilter}
              onChange={(e) => setDisciplineFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              <option value="All">All Disciplines</option>
              <option value="Fire">Fire</option>
              <option value="Risk Engineering">Risk Engineering</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Issued">Issued</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              {availableTypes.map(type => (
                <option key={type} value={type}>
                  {type === 'All' ? 'All Types' : type}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              <option value="updated">Last Updated</option>
              <option value="created">Date Created</option>
              <option value="client">Client A–Z</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
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
                ) : filteredAndSortedAssessments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="text-sm text-slate-500 mb-4">
                        {assessments.length === 0 ? 'No assessments yet' : 'No assessments match your filters'}
                      </div>
                      {assessments.length === 0 && (
                        <button
                          onClick={() => navigate('/assessments/new')}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          New Assessment
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedAssessments.map((assessment) => (
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
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleContinue(assessment.id, assessment.status)}
                            className="text-slate-900 hover:text-slate-700 font-medium"
                          >
                            {assessment.status === 'Draft' ? 'Continue' : 'View'}
                          </button>
                          <div className="relative group">
                            <button className="p-1 text-slate-400 hover:text-slate-600">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            <div className="hidden group-hover:block absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-slate-200 z-10">
                              <div className="py-1">
                                <button
                                  onClick={() => navigate(`/documents/${assessment.id}`)}
                                  className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                >
                                  View details
                                </button>
                                <button
                                  disabled
                                  className="block w-full text-left px-4 py-2 text-sm text-slate-400 cursor-not-allowed"
                                  title="Coming soon"
                                >
                                  Duplicate
                                </button>
                                <button
                                  disabled
                                  className="block w-full text-left px-4 py-2 text-sm text-slate-400 cursor-not-allowed"
                                  title="Coming soon"
                                >
                                  Export
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
