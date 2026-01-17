import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  GripVertical,
  Edit,
  Trash2,
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  Filter,
  BookOpen,
  Plus
} from 'lucide-react';
import RecommendationLibraryModal from './RecommendationLibraryModal';

interface SurveyRecommendation {
  id: string;
  survey_id: string;
  template_id: string | null;
  hazard: string;
  description_final: string;
  action_final: string;
  client_response: string | null;
  title_final: string;
  body_final: string;
  priority: number;
  status: 'open' | 'in_progress' | 'closed' | 'deferred';
  owner: string | null;
  target_date: string | null;
  source: 'manual' | 'library' | 'triggered' | 'ai';
  section_key: string | null;
  sort_index: number;
  include_in_report: boolean;
  created_at: string;
  updated_at: string;
}

interface SmartRecommendationsTableProps {
  surveyId: string;
  readonly?: boolean;
}

const CATEGORIES = [
  'Construction',
  'Management Systems',
  'Fire Protection & Detection',
  'Special Hazards',
  'Business Continuity',
  'General'
];

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open', color: 'bg-blue-100 text-blue-800' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'closed', label: 'Closed', color: 'bg-green-100 text-green-800' },
  { value: 'deferred', label: 'Deferred', color: 'bg-gray-100 text-gray-800' }
];

const SOURCE_OPTIONS = [
  { value: 'manual', label: 'Manual', color: 'bg-slate-100 text-slate-800' },
  { value: 'library', label: 'Library', color: 'bg-purple-100 text-purple-800' },
  { value: 'triggered', label: 'Triggered', color: 'bg-orange-100 text-orange-800' },
  { value: 'ai', label: 'AI', color: 'bg-indigo-100 text-indigo-800' }
];

export default function SmartRecommendationsTable({ surveyId, readonly = false }: SmartRecommendationsTableProps) {
  const [recommendations, setRecommendations] = useState<SurveyRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingBodyId, setEditingBodyId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState({
    hazard: '',
    description: '',
    action: '',
    clientResponse: ''
  });
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showLibraryModal, setShowLibraryModal] = useState(false);

  const [filters, setFilters] = useState({
    status: [] as string[],
    category: 'all',
    source: 'all',
    includeInReport: 'all'
  });

  const [sortConfig, setSortConfig] = useState<{
    key: keyof SurveyRecommendation | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  useEffect(() => {
    fetchRecommendations();
  }, [surveyId]);

  const fetchRecommendations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('survey_recommendations')
        .select('*')
        .eq('survey_id', surveyId)
        .order('sort_index', { ascending: true });

      if (error) throw error;
      setRecommendations(data || []);
    } catch (err: any) {
      console.error('Error fetching recommendations:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateRecommendation = useCallback(async (
    id: string,
    updates: Partial<SurveyRecommendation>
  ) => {
    try {
      const { error } = await supabase
        .from('survey_recommendations')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setRecommendations(prev =>
        prev.map(rec => rec.id === id ? { ...rec, ...updates } : rec)
      );
    } catch (err: any) {
      console.error('Error updating recommendation:', err);
      setError(err.message);
    }
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recommendation?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('survey_recommendations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccessMessage('Recommendation deleted');
      setTimeout(() => setSuccessMessage(null), 2000);
      fetchRecommendations();
    } catch (err: any) {
      console.error('Error deleting recommendation:', err);
      setError(err.message);
    }
  };

  const handleAddManual = async () => {
    try {
      const maxSortIndex = recommendations.length > 0
        ? Math.max(...recommendations.map(r => r.sort_index))
        : -1;

      const { error } = await supabase
        .from('survey_recommendations')
        .insert([{
          survey_id: surveyId,
          hazard: 'New Recommendation',
          description_final: 'Enter observation details here',
          action_final: 'Enter recommended action here',
          client_response: null,
          priority: 3,
          status: 'open',
          source: 'manual',
          sort_index: maxSortIndex + 1,
          include_in_report: true
        }]);

      if (error) throw error;

      setSuccessMessage('Recommendation added');
      setTimeout(() => setSuccessMessage(null), 2000);
      fetchRecommendations();
    } catch (err: any) {
      console.error('Error adding recommendation:', err);
      setError(err.message);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newRecommendations = [...filteredAndSortedRecommendations];
    const draggedItem = newRecommendations[draggedIndex];
    newRecommendations.splice(draggedIndex, 1);
    newRecommendations.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    setRecommendations(newRecommendations);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;

    const updates = filteredAndSortedRecommendations.map((rec, index) => ({
      id: rec.id,
      sort_index: index
    }));

    try {
      for (const update of updates) {
        await supabase
          .from('survey_recommendations')
          .update({ sort_index: update.sort_index })
          .eq('id', update.id);
      }
    } catch (err: any) {
      console.error('Error updating sort order:', err);
      setError(err.message);
      fetchRecommendations();
    }

    setDraggedIndex(null);
  };

  const handleEditBody = (rec: SurveyRecommendation) => {
    setEditingBodyId(rec.id);
    setEditingBody({
      hazard: rec.hazard,
      description: rec.description_final,
      action: rec.action_final,
      clientResponse: rec.client_response || ''
    });
  };

  const handleSaveBody = async () => {
    if (!editingBodyId) return;

    try {
      const { error } = await supabase
        .from('survey_recommendations')
        .update({
          hazard: editingBody.hazard,
          description_final: editingBody.description,
          action_final: editingBody.action,
          client_response: editingBody.clientResponse || null
        })
        .eq('id', editingBodyId);

      if (error) throw error;

      setSuccessMessage('Recommendation updated');
      setTimeout(() => setSuccessMessage(null), 2000);
      setEditingBodyId(null);
      fetchRecommendations();
    } catch (err: any) {
      console.error('Error saving body:', err);
      setError(err.message);
    }
  };

  const handleSort = (key: keyof SurveyRecommendation) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getCategoryFromTemplate = async (templateId: string | null): Promise<string> => {
    if (!templateId) return 'General';

    try {
      const { data, error } = await supabase
        .from('recommendation_templates')
        .select('category')
        .eq('id', templateId)
        .maybeSingle();

      if (error || !data) return 'General';
      return data.category;
    } catch {
      return 'General';
    }
  };

  const filteredAndSortedRecommendations = recommendations.filter(rec => {
    if (filters.status.length > 0 && !filters.status.includes(rec.status)) {
      return false;
    }
    if (filters.source !== 'all' && rec.source !== filters.source) {
      return false;
    }
    if (filters.includeInReport === 'yes' && !rec.include_in_report) {
      return false;
    }
    if (filters.includeInReport === 'no' && rec.include_in_report) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    if (!sortConfig.key) {
      return a.sort_index - b.sort_index;
    }

    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const clearSort = () => {
    setSortConfig({ key: null, direction: 'asc' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading recommendations...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-800">{successMessage}</div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Recommendations Register</h3>
          <p className="text-sm text-gray-600 mt-0.5">
            Drag rows to reorder • {recommendations.length} total
          </p>
        </div>
        {!readonly && (
          <div className="flex gap-2">
            <button
              onClick={handleAddManual}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Manual
            </button>
            <button
              onClick={() => setShowLibraryModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Add from Library
            </button>
          </div>
        )}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
          {sortConfig.key && (
            <button
              onClick={clearSort}
              className="ml-auto text-xs text-blue-600 hover:text-blue-700"
            >
              Clear sort
            </button>
          )}
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select
              multiple
              value={filters.status}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                setFilters({ ...filters, status: selected });
              }}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              size={4}
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Source</label>
            <select
              value={filters.source}
              onChange={(e) => setFilters({ ...filters, source: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Sources</option>
              {SOURCE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">In Report</label>
            <select
              value={filters.includeInReport}
              onChange={(e) => setFilters({ ...filters, includeInReport: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-8 px-2 py-3"></th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('title_final')}
                >
                  Title {sortConfig.key === 'title_final' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('priority')}
                >
                  Priority {sortConfig.key === 'priority' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Owner
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('target_date')}
                >
                  Target Date {sortConfig.key === 'target_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('source')}
                >
                  Source {sortConfig.key === 'source' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  In Report
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedRecommendations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    No recommendations found. Add one to get started.
                  </td>
                </tr>
              ) : (
                filteredAndSortedRecommendations.map((rec, index) => (
                  <RecommendationRow
                    key={rec.id}
                    recommendation={rec}
                    index={index}
                    readonly={readonly}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    onUpdate={updateRecommendation}
                    onEditBody={handleEditBody}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingBodyId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Edit Recommendation</h3>
              <button
                onClick={() => setEditingBodyId(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hazard / Identification
                </label>
                <input
                  type="text"
                  value={editingBody.hazard}
                  onChange={(e) => setEditingBody({ ...editingBody, hazard: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Hot Work, DSEAR, Malicious Arson"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observation / Description
                </label>
                <textarea
                  value={editingBody.description}
                  onChange={(e) => setEditingBody({ ...editingBody, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe the observation or current state"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recommended Action
                </label>
                <textarea
                  value={editingBody.action}
                  onChange={(e) => setEditingBody({ ...editingBody, action: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Specify the recommended action to address the issue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Response / Site Response
                </label>
                <textarea
                  value={editingBody.clientResponse}
                  onChange={(e) => setEditingBody({ ...editingBody, clientResponse: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Client's response or comments (optional)"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setEditingBodyId(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBody}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {showLibraryModal && (
        <RecommendationLibraryModal
          surveyId={surveyId}
          onClose={() => setShowLibraryModal(false)}
          onRecommendationAdded={fetchRecommendations}
        />
      )}
    </div>
  );
}

interface RecommendationRowProps {
  recommendation: SurveyRecommendation;
  index: number;
  readonly: boolean;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onUpdate: (id: string, updates: Partial<SurveyRecommendation>) => void;
  onEditBody: (rec: SurveyRecommendation) => void;
  onDelete: (id: string) => void;
}

function RecommendationRow({
  recommendation,
  index,
  readonly,
  onDragStart,
  onDragOver,
  onDragEnd,
  onUpdate,
  onEditBody,
  onDelete
}: RecommendationRowProps) {
  const [localOwner, setLocalOwner] = useState(recommendation.owner || '');
  const [ownerTimeout, setOwnerTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleOwnerChange = (value: string) => {
    setLocalOwner(value);

    if (ownerTimeout) {
      clearTimeout(ownerTimeout);
    }

    const timeout = setTimeout(() => {
      onUpdate(recommendation.id, { owner: value || null });
    }, 1000);

    setOwnerTimeout(timeout);
  };

  const statusOption = STATUS_OPTIONS.find(opt => opt.value === recommendation.status);
  const sourceOption = SOURCE_OPTIONS.find(opt => opt.value === recommendation.source);

  return (
    <tr
      draggable={!readonly}
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      className="hover:bg-gray-50 transition-colors"
    >
      <td className="px-2 py-3">
        {!readonly && (
          <div className="cursor-move text-gray-400 hover:text-gray-600">
            <GripVertical className="w-4 h-4" />
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-gray-900">{recommendation.hazard}</div>
        <div className="text-xs text-gray-500 mt-0.5 truncate max-w-md">
          {recommendation.description_final || recommendation.action_final}
        </div>
      </td>
      <td className="px-4 py-3">
        <select
          value={recommendation.priority}
          onChange={(e) => onUpdate(recommendation.id, { priority: parseInt(e.target.value) })}
          disabled={readonly}
          className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
        >
          {[1, 2, 3, 4, 5].map(p => (
            <option key={p} value={p}>
              {p} {p === 5 ? '(Critical)' : p === 1 ? '(Low)' : ''}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <select
          value={recommendation.status}
          onChange={(e) => onUpdate(recommendation.id, { status: e.target.value as any })}
          disabled={readonly}
          className={`px-2 py-1 text-xs font-medium rounded-lg border-0 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed ${statusOption?.color || ''}`}
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <input
          type="text"
          value={localOwner}
          onChange={(e) => handleOwnerChange(e.target.value)}
          disabled={readonly}
          placeholder="Assign owner"
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="date"
          value={recommendation.target_date || ''}
          onChange={(e) => onUpdate(recommendation.id, { target_date: e.target.value || null })}
          disabled={readonly}
          className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
        />
      </td>
      <td className="px-4 py-3">
        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-lg ${sourceOption?.color || ''}`}>
          {sourceOption?.label || recommendation.source}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <input
          type="checkbox"
          checked={recommendation.include_in_report}
          onChange={(e) => onUpdate(recommendation.id, { include_in_report: e.target.checked })}
          disabled={readonly}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => onEditBody(recommendation)}
            disabled={readonly}
            className="text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Edit body"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(recommendation.id)}
            disabled={readonly}
            className="text-red-600 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
