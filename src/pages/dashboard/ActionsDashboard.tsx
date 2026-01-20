import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Filter, X, ClipboardList } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Action {
  id: string;
  recommended_action: string;
  status: string;
  priority_band: string | null;
  target_date: string | null;
  updated_at: string;
  document: {
    id: string;
    title: string;
    document_type: string;
  } | null;
  latest_rating: {
    likelihood: number;
    impact: number;
    score: number;
  } | null;
}

export default function ActionsDashboard() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const [actions, setActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>('all');

  useEffect(() => {
    if (organisation?.id) {
      fetchActions();
    }
  }, [organisation?.id, statusFilter, priorityFilter, documentTypeFilter]);

  const fetchActions = async () => {
    if (!organisation?.id) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from('actions')
        .select(`
          *,
          document:documents(id, title, document_type)
        `)
        .eq('organisation_id', organisation.id)
        .order('updated_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (priorityFilter !== 'all') {
        query = query.eq('priority_band', priorityFilter);
      }

      const { data: actionsData, error } = await query;

      if (error) throw error;

      const actionsWithRatings = await Promise.all(
        (actionsData || []).map(async (action) => {
          const { data: ratings } = await supabase
            .from('action_ratings')
            .select('likelihood, impact, score')
            .eq('action_id', action.id)
            .order('rated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...action,
            latest_rating: ratings,
          };
        })
      );

      let filtered = actionsWithRatings;

      if (documentTypeFilter !== 'all') {
        filtered = actionsWithRatings.filter(
          (action) => action.document?.document_type === documentTypeFilter
        );
      }

      setActions(filtered);
    } catch (error) {
      console.error('Error fetching actions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'P1':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'P2':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'P3':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'P4':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-neutral-100 text-neutral-600 border-neutral-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-700';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700';
      case 'complete':
        return 'bg-green-100 text-green-700';
      case 'deferred':
        return 'bg-amber-100 text-amber-700';
      case 'not_applicable':
        return 'bg-neutral-100 text-neutral-600';
      default:
        return 'bg-neutral-100 text-neutral-600';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const handleClearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setDocumentTypeFilter('all');
  };

  const hasActiveFilters = statusFilter !== 'all' || priorityFilter !== 'all' || documentTypeFilter !== 'all';

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/common-dashboard')}
            className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 font-medium transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Actions Register</h1>
            <p className="text-neutral-600 mt-1">Track and manage actions across all documents</p>
          </div>
        </div>

        <div className="mb-6 bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-sm font-medium text-neutral-700 hover:text-neutral-900"
            >
              <Filter className="w-4 h-4" />
              Filters {showFilters ? '▼' : '▶'}
            </button>
            <div className="text-sm text-neutral-600">
              Showing {actions.length} action{actions.length !== 1 ? 's' : ''}
            </div>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-end gap-4 pb-2 border-t border-neutral-200 pt-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-neutral-700">Status:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-500 min-w-[180px]"
                >
                  <option value="all">All Status</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="complete">Complete</option>
                  <option value="deferred">Deferred</option>
                  <option value="not_applicable">Not Applicable</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-neutral-700">Priority:</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-500 min-w-[150px]"
                >
                  <option value="all">All Priorities</option>
                  <option value="P1">P1 (Critical)</option>
                  <option value="P2">P2 (High)</option>
                  <option value="P3">P3 (Medium)</option>
                  <option value="P4">P4 (Low)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-neutral-700">Document Type:</label>
                <select
                  value={documentTypeFilter}
                  onChange={(e) => setDocumentTypeFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-500 min-w-[150px]"
                >
                  <option value="all">All Types</option>
                  <option value="FRA">FRA</option>
                  <option value="FSD">FSD</option>
                  <option value="DSEAR">DSEAR</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-neutral-700 opacity-0">Clear</label>
                <button
                  onClick={handleClearFilters}
                  disabled={!hasActiveFilters}
                  className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    hasActiveFilters
                      ? 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-neutral-300'
                      : 'bg-neutral-50 text-neutral-400 cursor-not-allowed border border-neutral-200'
                  }`}
                  title="Clear all filters"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-neutral-300 border-t-neutral-900"></div>
          </div>
        ) : actions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-lg border border-neutral-200">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
              <ClipboardList className="w-8 h-8 text-neutral-400" />
            </div>
            <p className="text-neutral-500 text-lg mb-2">No actions found</p>
            <p className="text-neutral-400 text-sm">
              {hasActiveFilters
                ? 'Try adjusting your filters'
                : 'Actions will appear here when created from document modules'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                      Document
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                      Risk Rating
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                      Last Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {actions.map((action) => (
                    <tr
                      key={action.id}
                      className="hover:bg-neutral-50 transition-colors cursor-pointer"
                      onClick={() => action.document && navigate(`/documents/${action.document.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-bold rounded border ${getPriorityColor(action.priority_band)}`}>
                          {action.priority_band || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(action.status)}`}>
                          {formatStatus(action.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-neutral-900 max-w-md">
                          {action.recommended_action}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {action.document ? (
                          <div>
                            <div className="text-sm font-medium text-neutral-900">{action.document.title}</div>
                            <div className="text-xs text-neutral-500">{action.document.document_type}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {action.latest_rating ? (
                          <div className="text-xs text-neutral-600">
                            <div>L: {action.latest_rating.likelihood} × I: {action.latest_rating.impact}</div>
                            <div className="font-semibold">Score: {action.latest_rating.score}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                        {formatDate(action.target_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                        {formatDate(action.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
