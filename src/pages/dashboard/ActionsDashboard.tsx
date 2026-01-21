import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Filter, X, ClipboardList, AlertTriangle, Paperclip, Camera, ExternalLink, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ActionDetailModal from '../../components/actions/ActionDetailModal';
import EvidencePanel from '../../components/actions/EvidencePanel';

interface ActionOwner {
  id: string;
  name: string | null;
}

interface Action {
  id: string;
  recommended_action: string;
  status: string;
  priority_band: string | null;
  target_date: string | null;
  owner_user_id: string | null;
  updated_at: string;
  document: {
    id: string;
    title: string;
    document_type: string;
  } | null;
  module_instance: {
    id: string;
    module_key: string;
    outcome: string | null;
  } | null;
  owner: ActionOwner | null;
  attachment_count: number;
}

interface SummaryMetrics {
  openP1: number;
  openP2: number;
  overdue: number;
  documentsAffected: number;
}

export default function ActionsDashboard() {
  const navigate = useNavigate();
  const { organisation, isPlatformAdmin } = useAuth();
  const [actions, setActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [evidenceActionId, setEvidenceActionId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'target_date'>('priority');

  const [summaryMetrics, setSummaryMetrics] = useState<SummaryMetrics>({
    openP1: 0,
    openP2: 0,
    overdue: 0,
    documentsAffected: 0,
  });

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
          document:documents(id, title, document_type),
          module_instance:module_instances(id, module_key, outcome),
          owner:user_profiles(id, name)
        `)
        .eq('organisation_id', organisation.id);

      if (statusFilter === 'open') {
        query = query.in('status', ['open', 'in_progress']);
      } else if (statusFilter === 'closed') {
        query = query.eq('status', 'complete');
      } else if (statusFilter === 'overdue') {
        query = query
          .neq('status', 'complete')
          .not('target_date', 'is', null)
          .lt('target_date', new Date().toISOString().split('T')[0]);
      } else if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (priorityFilter.length > 0) {
        query = query.in('priority_band', priorityFilter);
      }

      const { data: actionsData, error } = await query;

      if (error) throw error;

      const actionIds = (actionsData || []).map((a) => a.id);

      let attachmentCounts: Record<string, number> = {};
      if (actionIds.length > 0) {
        const { data: attachmentData } = await supabase
          .from('attachments')
          .select('action_id')
          .in('action_id', actionIds)
          .not('action_id', 'is', null);

        attachmentData?.forEach((att) => {
          if (att.action_id) {
            attachmentCounts[att.action_id] = (attachmentCounts[att.action_id] || 0) + 1;
          }
        });
      }

      const actionsWithAttachments = (actionsData || []).map((action) => ({
        ...action,
        attachment_count: attachmentCounts[action.id] || 0,
      }));

      let filtered = actionsWithAttachments;

      if (documentTypeFilter !== 'all') {
        filtered = actionsWithAttachments.filter(
          (action) => action.document?.document_type === documentTypeFilter
        );
      }

      const sorted = sortActions(filtered);
      setActions(sorted);
      calculateSummaryMetrics(actionsWithAttachments);
    } catch (error) {
      console.error('Error fetching actions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sortActions = (actionsToSort: Action[]) => {
    if (sortBy === 'priority') {
      const priorityOrder = { P1: 1, P2: 2, P3: 3, P4: 4 };
      return [...actionsToSort].sort((a, b) => {
        const aPriority = priorityOrder[a.priority_band as keyof typeof priorityOrder] || 999;
        const bPriority = priorityOrder[b.priority_band as keyof typeof priorityOrder] || 999;
        if (aPriority !== bPriority) return aPriority - bPriority;

        const aDate = a.target_date ? new Date(a.target_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bDate = b.target_date ? new Date(b.target_date).getTime() : Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
      });
    } else {
      return [...actionsToSort].sort((a, b) => {
        const aDate = a.target_date ? new Date(a.target_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bDate = b.target_date ? new Date(b.target_date).getTime() : Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
      });
    }
  };

  const calculateSummaryMetrics = (allActions: Action[]) => {
    const today = new Date().toISOString().split('T')[0];

    const openP1 = allActions.filter(
      (a) => a.priority_band === 'P1' && a.status !== 'complete'
    ).length;

    const openP2 = allActions.filter(
      (a) => a.priority_band === 'P2' && a.status !== 'complete'
    ).length;

    const overdue = allActions.filter(
      (a) =>
        a.status !== 'complete' &&
        a.target_date &&
        a.target_date < today
    ).length;

    const documentsAffected = new Set(
      allActions
        .filter((a) => a.document?.id)
        .map((a) => a.document!.id)
    ).size;

    setSummaryMetrics({ openP1, openP2, overdue, documentsAffected });
  };

  const isOverdue = (action: Action) => {
    if (!action.target_date || action.status === 'complete') return false;
    const today = new Date().toISOString().split('T')[0];
    return action.target_date < today;
  };

  const isInfoGap = (action: Action) => {
    return action.module_instance?.outcome === 'info_gap';
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
    setPriorityFilter([]);
    setDocumentTypeFilter('all');
  };

  const togglePriorityFilter = (priority: string) => {
    setPriorityFilter((prev) =>
      prev.includes(priority)
        ? prev.filter((p) => p !== priority)
        : [...prev, priority]
    );
  };

  const handleActionClick = (action: Action) => {
    setSelectedAction(action);
  };

  const handleActionUpdated = () => {
    fetchActions();
  };

  const handleEvidenceBadgeClick = (e: React.MouseEvent, actionId: string) => {
    e.stopPropagation();
    setEvidenceActionId(actionId);
  };

  const hasActiveFilters =
    statusFilter !== 'all' ||
    priorityFilter.length > 0 ||
    documentTypeFilter !== 'all';

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
            <p className="text-neutral-600 mt-1">
              Track and manage actions across all documents
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600">Open P1 Actions</p>
                <p className="text-3xl font-bold text-red-600 mt-1">
                  {summaryMetrics.openP1}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600">Open P2 Actions</p>
                <p className="text-3xl font-bold text-orange-600 mt-1">
                  {summaryMetrics.openP2}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600">Overdue Actions</p>
                <p className="text-3xl font-bold text-red-600 mt-1">
                  {summaryMetrics.overdue}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <ClipboardList className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600">Documents Affected</p>
                <p className="text-3xl font-bold text-neutral-900 mt-1">
                  {summaryMetrics.documentsAffected}
                </p>
              </div>
              <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center">
                <ExternalLink className="w-6 h-6 text-neutral-600" />
              </div>
            </div>
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
            <div className="flex items-center gap-4">
              <div className="text-sm text-neutral-600">
                Showing {actions.length} action{actions.length !== 1 ? 's' : ''}
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'priority' | 'target_date')}
                className="px-3 py-1.5 text-sm border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-500"
              >
                <option value="priority">Sort by Priority</option>
                <option value="target_date">Sort by Due Date</option>
              </select>
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
                  <option value="overdue">Overdue</option>
                  <option value="deferred">Deferred</option>
                  <option value="not_applicable">Not Applicable</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-neutral-700">Priority:</label>
                <div className="flex gap-2">
                  {['P1', 'P2', 'P3', 'P4'].map((p) => (
                    <button
                      key={p}
                      onClick={() => togglePriorityFilter(p)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                        priorityFilter.includes(p)
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
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
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                      Document
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                      Owner
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                      Evidence
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {actions.map((action) => (
                    <tr
                      key={action.id}
                      className="hover:bg-neutral-50 transition-colors cursor-pointer"
                      onClick={() => handleActionClick(action)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-bold rounded border ${getPriorityColor(
                            action.priority_band
                          )}`}
                        >
                          {action.priority_band || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-neutral-900 max-w-md">
                          {action.recommended_action}
                        </div>
                        {isInfoGap(action) && (
                          <div className="flex items-center gap-1 mt-1">
                            <AlertCircle className="w-3 h-3 text-blue-600" />
                            <span className="text-xs text-blue-600 font-medium">Info gap</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {action.document ? (
                          <div>
                            <div className="text-sm font-medium text-neutral-900">
                              {action.document.title}
                            </div>
                            <div className="text-xs text-neutral-500">
                              {action.document.document_type}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                        {action.owner?.name || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                            action.status
                          )}`}
                        >
                          {formatStatus(action.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-neutral-600">
                            {formatDate(action.target_date)}
                          </span>
                          {isOverdue(action) && (
                            <span className="text-red-600 font-bold text-xs">OVERDUE</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {action.attachment_count > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => handleEvidenceBadgeClick(e, action.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                            title="View evidence for this action"
                          >
                            <Paperclip className="w-3 h-3" />
                            <span className="text-xs font-medium">
                              {action.attachment_count}
                            </span>
                          </button>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selectedAction && (
        <ActionDetailModal
          action={selectedAction}
          onClose={() => setSelectedAction(null)}
          onActionUpdated={handleActionUpdated}
          returnTo="/dashboard/actions"
        />
      )}

      {evidenceActionId && (
        <EvidencePanel
          actionId={evidenceActionId}
          onClose={() => setEvidenceActionId(null)}
        />
      )}
    </div>
  );
}
