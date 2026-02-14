import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowUpCircle, CheckCircle2, AlertCircle, Loader2, Search } from 'lucide-react';

interface ReRecommendation {
  id: string;
  title: string;
  observation_text: string;
  action_required_text: string;
  hazard_text: string;
  comments_text: string | null;
  priority: string;
  source_module_key: string;
  created_at: string;
}

export default function PromoteRecommendationsToTemplates() {
  const [recommendations, setRecommendations] = useState<ReRecommendation[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isPromoting, setIsPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('re_recommendations')
        .select('id, title, observation_text, action_required_text, hazard_text, comments_text, priority, source_module_key, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecommendations(data || []);
    } catch (err: any) {
      console.error('Error fetching recommendations:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromote = async () => {
    if (selectedIds.size === 0) {
      setError('Please select at least one recommendation');
      return;
    }

    setIsPromoting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/promote-recommendations-to-templates`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recommendation_ids: Array.from(selectedIds),
          }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to promote recommendations');
      }

      setSuccessMessage(
        `Successfully promoted ${result.inserted} recommendation(s) to templates. ${
          result.skipped > 0 ? `Skipped ${result.skipped} duplicate(s).` : ''
        }`
      );
      setSelectedIds(new Set());
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Error promoting recommendations:', err);
      setError(err.message);
    } finally {
      setIsPromoting(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const selectAll = () => {
    const filtered = getFilteredRecommendations();
    setSelectedIds(new Set(filtered.map(r => r.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const getFilteredRecommendations = () => {
    return recommendations.filter(rec => {
      const matchesSearch = searchQuery === '' ||
        rec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.observation_text?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesModule = moduleFilter === 'all' || rec.source_module_key === moduleFilter;

      return matchesSearch && matchesModule;
    });
  };

  const modules = [...new Set(recommendations.map(r => r.source_module_key))].sort();
  const filteredRecommendations = getFilteredRecommendations();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Promote Recommendations to Templates</h2>
        <p className="mt-2 text-sm text-gray-600">
          Select recommendations from actual assessments to convert into reusable templates.
          This helps build your template library from real-world examples.
        </p>
      </div>

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

      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search recommendations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Modules</option>
            {modules.map(module => (
              <option key={module} value={module}>{module}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={selectAll}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              disabled={filteredRecommendations.length === 0}
            >
              Select All ({filteredRecommendations.length})
            </button>
            <button
              onClick={deselectAll}
              className="text-sm text-gray-600 hover:text-gray-700 font-medium"
              disabled={selectedIds.size === 0}
            >
              Deselect All
            </button>
            <span className="text-sm text-gray-600">
              {selectedIds.size} selected
            </span>
          </div>
          <button
            onClick={handlePromote}
            disabled={selectedIds.size === 0 || isPromoting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPromoting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Promoting...
              </>
            ) : (
              <>
                <ArrowUpCircle className="w-4 h-4" />
                Promote to Templates
              </>
            )}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : filteredRecommendations.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No recommendations found
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-12 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={filteredRecommendations.length > 0 && filteredRecommendations.every(r => selectedIds.has(r.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          selectAll();
                        } else {
                          deselectAll();
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Module
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Observation
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRecommendations.map((rec) => (
                  <tr
                    key={rec.id}
                    className={`hover:bg-gray-50 ${selectedIds.has(rec.id) ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(rec.id)}
                        onChange={() => toggleSelection(rec.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{rec.title}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {rec.source_module_key}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        rec.priority === '1' || rec.priority === 'Critical' ? 'bg-red-100 text-red-800' :
                        rec.priority === '2' || rec.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                        rec.priority === '3' || rec.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {rec.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <div className="text-sm text-gray-600 truncate">
                        {rec.observation_text || 'No observation'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">How it works</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Selected recommendations will be converted to reusable templates</li>
          <li>Templates are tagged as 'derived' and scoped as 'derived'</li>
          <li>Duplicates are automatically detected and skipped (based on title + observation)</li>
          <li>Category is inferred from the source module key</li>
          <li>All promoted templates are set to active by default</li>
        </ul>
      </div>
    </div>
  );
}
