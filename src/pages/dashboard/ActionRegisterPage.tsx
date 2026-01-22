import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Download,
  Filter,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  ActionRegisterEntry,
  OrgActionStats,
  getActionRegisterOrgLevel,
  getOrgActionStats,
  filterActionRegister,
  downloadActionRegisterCSV,
  getActionRegisterStats,
  getTrackingStatusColor,
  getTrackingStatusLabel,
  getUniqueModuleKeys,
  getUniqueDocumentTypes,
  getModuleKeyLabel,
} from '../../utils/actionRegister';

export default function ActionRegisterPage() {
  const { organisation } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const documentFilter = searchParams.get('document');

  const [actions, setActions] = useState<ActionRegisterEntry[]>([]);
  const [filteredActions, setFilteredActions] = useState<ActionRegisterEntry[]>([]);
  const [orgStats, setOrgStats] = useState<OrgActionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [documentTitle, setDocumentTitle] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    status: [] as string[],
    priority: [] as string[],
    trackingStatus: [] as string[],
    documentType: [] as string[],
    moduleKey: [] as string[],
    overdue: false,
    documentId: documentFilter || undefined,
  });

  useEffect(() => {
    if (organisation?.id) {
      fetchData();
    }
  }, [organisation?.id]);

  useEffect(() => {
    if (documentFilter && actions.length > 0) {
      const doc = actions.find(a => a.document_id === documentFilter);
      if (doc) {
        setDocumentTitle(doc.document_title);
      }
    }
  }, [documentFilter, actions]);

  useEffect(() => {
    const filtered = filterActionRegister(actions, filters);
    setFilteredActions(filtered);
  }, [actions, filters]);

  const fetchData = async () => {
    if (!organisation?.id) return;

    setIsLoading(true);
    const [actionsData, statsData] = await Promise.all([
      getActionRegisterOrgLevel(organisation.id),
      getOrgActionStats(organisation.id),
    ]);

    setActions(actionsData);
    setFilteredActions(actionsData);
    setOrgStats(statsData);
    setIsLoading(false);
  };

  const handleExportCSV = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = documentFilter && documentTitle
      ? `actions_${documentTitle.replace(/[^a-z0-9]/gi, '_')}_${dateStr}.csv`
      : `action_register_${dateStr}.csv`;
    downloadActionRegisterCSV(filteredActions, filename);
  };

  const toggleFilter = (
    filterType: 'status' | 'priority' | 'trackingStatus' | 'documentType' | 'moduleKey',
    value: string
  ) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: prev[filterType].includes(value)
        ? prev[filterType].filter((v) => v !== value)
        : [...prev[filterType], value],
    }));
  };

  const clearFilters = () => {
    setFilters({
      status: [],
      priority: [],
      trackingStatus: [],
      documentType: [],
      moduleKey: [],
      overdue: false,
    });
  };

  const stats = getActionRegisterStats(filteredActions);
  const availableModuleKeys = getUniqueModuleKeys(actions);
  const availableDocumentTypes = getUniqueDocumentTypes(actions);
  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.priority.length > 0 ||
    filters.trackingStatus.length > 0 ||
    filters.documentType.length > 0 ||
    filters.moduleKey.length > 0 ||
    filters.overdue;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-neutral-300 border-t-neutral-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-neutral-900">
                  Action Register
                  {documentTitle && (
                    <span className="text-lg font-normal text-neutral-600 ml-2">
                      — {documentTitle}
                    </span>
                  )}
                </h1>
                <p className="text-sm text-neutral-600">
                  {documentFilter
                    ? 'Document-level action tracking'
                    : 'Organisation-wide action tracking and management'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {documentFilter && (
                <button
                  onClick={() => navigate('/dashboard/actions')}
                  className="px-4 py-2 border-2 border-neutral-300 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition-colors"
                >
                  View All Actions
                </button>
              )}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
                  hasActiveFilters
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <Filter className="w-4 h-4 inline mr-2" />
                Filter {hasActiveFilters && `(${
                  filters.status.length +
                  filters.priority.length +
                  filters.trackingStatus.length +
                  filters.documentType.length +
                  filters.moduleKey.length
                })`}
              </button>

              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium"
              >
                <Download className="w-4 h-4 inline mr-2" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-neutral-700">Total Actions</span>
            </div>
            <p className="text-3xl font-bold text-neutral-900">{stats.total}</p>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-neutral-700">Overdue</span>
            </div>
            <p className="text-3xl font-bold text-red-600">{stats.overdue}</p>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <span className="text-sm font-medium text-neutral-700">In Progress</span>
            </div>
            <p className="text-3xl font-bold text-amber-600">{stats.inProgress}</p>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-neutral-700">Closed</span>
            </div>
            <p className="text-3xl font-bold text-green-600">{stats.closed}</p>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-900">Filters</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Status
                </label>
                <div className="space-y-2">
                  {['open', 'in_progress', 'deferred', 'closed'].map((status) => (
                    <label key={status} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.status.includes(status)}
                        onChange={() => toggleFilter('status', status)}
                        className="rounded border-neutral-300"
                      />
                      <span className="text-sm text-neutral-700 capitalize">
                        {status.replace('_', ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Priority
                </label>
                <div className="space-y-2">
                  {['P1', 'P2', 'P3', 'P4'].map((priority) => (
                    <label key={priority} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.priority.includes(priority)}
                        onChange={() => toggleFilter('priority', priority)}
                        className="rounded border-neutral-300"
                      />
                      <span className="text-sm text-neutral-700">{priority}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Tracking Status Filter */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Tracking Status
                </label>
                <div className="space-y-2">
                  {['overdue', 'due_soon', 'on_track', 'closed'].map((status) => (
                    <label key={status} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.trackingStatus.includes(status)}
                        onChange={() => toggleFilter('trackingStatus', status)}
                        className="rounded border-neutral-300"
                      />
                      <span className="text-sm text-neutral-700">
                        {getTrackingStatusLabel(status)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Document Type Filter */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Document Type
                </label>
                <div className="space-y-2">
                  {availableDocumentTypes.map((type) => (
                    <label key={type} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.documentType.includes(type)}
                        onChange={() => toggleFilter('documentType', type)}
                        className="rounded border-neutral-300"
                      />
                      <span className="text-sm text-neutral-700">{type}</span>
                    </label>
                  ))}
                  {availableDocumentTypes.length === 0 && (
                    <p className="text-sm text-neutral-500">No types available</p>
                  )}
                </div>
              </div>

              {/* Module Filter */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Module
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableModuleKeys.map((key) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.moduleKey.includes(key)}
                        onChange={() => toggleFilter('moduleKey', key)}
                        className="rounded border-neutral-300"
                      />
                      <span className="text-sm text-neutral-700" title={getModuleKeyLabel(key)}>
                        {key}
                      </span>
                    </label>
                  ))}
                  {availableModuleKeys.length === 0 && (
                    <p className="text-sm text-neutral-500">No modules available</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions Table */}
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                    Tracking
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                    Target Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                    Owner
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredActions.map((action) => (
                  <tr
                    key={action.id}
                    className="hover:bg-neutral-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/documents/${action.document_id}/workspace`)}
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-neutral-900">
                        {action.document_title}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-neutral-500">
                          {action.document_type} v{action.version_number}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          action.issue_status === 'issued'
                            ? 'bg-green-100 text-green-700'
                            : action.issue_status === 'draft'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-neutral-100 text-neutral-700'
                        }`}>
                          {action.issue_status}
                        </span>
                      </div>
                      {action.module_key && (
                        <div className="text-xs text-neutral-500 mt-0.5">
                          {action.module_key}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-neutral-700 max-w-md truncate">
                        {action.recommended_action}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        action.priority_band === 'P1' ? 'bg-red-100 text-red-700' :
                        action.priority_band === 'P2' ? 'bg-amber-100 text-amber-700' :
                        action.priority_band === 'P3' ? 'bg-blue-100 text-blue-700' :
                        'bg-neutral-100 text-neutral-700'
                      }`}>
                        {action.priority_band}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-neutral-700 capitalize">
                        {action.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${
                        getTrackingStatusColor(action.tracking_status)
                      }`}>
                        {getTrackingStatusLabel(action.tracking_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {action.target_date ? (
                        <span className="text-sm text-neutral-700">
                          {new Date(action.target_date).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-sm text-neutral-400">No date</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-neutral-700">
                        {action.owner_name || 'Unassigned'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredActions.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-600 font-medium">No actions found</p>
              <p className="text-sm text-neutral-500 mt-1">
                {hasActiveFilters
                  ? 'Try adjusting your filters'
                  : 'Actions will appear here as documents are issued'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
