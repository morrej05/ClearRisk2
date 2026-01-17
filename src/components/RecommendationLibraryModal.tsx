import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Search, BookOpen, Plus, Check } from 'lucide-react';

interface RecommendationTemplate {
  id: string;
  code: string | null;
  hazard: string;
  description: string;
  action: string;
  client_response_prompt: string | null;
  title: string;
  body: string;
  category: string;
  default_priority: number;
  is_active: boolean;
}

interface RecommendationLibraryModalProps {
  surveyId: string;
  onClose: () => void;
  onRecommendationAdded: () => void;
}

const CATEGORIES = [
  'Construction',
  'Management Systems',
  'Fire Protection & Detection',
  'Special Hazards',
  'Business Continuity'
];

export default function RecommendationLibraryModal({
  surveyId,
  onClose,
  onRecommendationAdded
}: RecommendationLibraryModalProps) {
  const [templates, setTemplates] = useState<RecommendationTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('recommendation_templates')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('title', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err: any) {
      console.error('Error fetching templates:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRecommendation = async (template: RecommendationTemplate) => {
    setAddingIds(prev => new Set(prev).add(template.id));
    setError(null);

    try {
      const { data: existingRecs, error: fetchError } = await supabase
        .from('survey_recommendations')
        .select('sort_index')
        .eq('survey_id', surveyId)
        .order('sort_index', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      const maxSortIndex = existingRecs && existingRecs.length > 0
        ? existingRecs[0].sort_index
        : -1;

      const { error } = await supabase
        .from('survey_recommendations')
        .insert([{
          survey_id: surveyId,
          template_id: template.id,
          hazard: template.hazard,
          description_final: template.description,
          action_final: template.action,
          client_response: template.client_response_prompt || null,
          priority: template.default_priority,
          status: 'open',
          source: 'library',
          sort_index: maxSortIndex + 1,
          include_in_report: true
        }]);

      if (error) throw error;

      setTimeout(() => {
        setAddingIds(prev => {
          const next = new Set(prev);
          next.delete(template.id);
          return next;
        });
      }, 1000);

      onRecommendationAdded();
    } catch (err: any) {
      console.error('Error adding recommendation:', err);
      setError(err.message);
      setAddingIds(prev => {
        const next = new Set(prev);
        next.delete(template.id);
        return next;
      });
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = searchQuery === '' ||
      template.hazard.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (template.code && template.code.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const templatesByCategory = CATEGORIES.reduce((acc, category) => {
    acc[category] = filteredTemplates.filter(t => t.category === category);
    return acc;
  }, {} as Record<string, RecommendationTemplate[]>);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Add from Library</h2>
              <p className="text-sm text-gray-600 mt-0.5">
                Select recommendations from the global library
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 border-b border-gray-200">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search recommendations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Loading recommendations...</div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No recommendations found matching your criteria
            </div>
          ) : (
            <div className="space-y-8">
              {CATEGORIES.map(category => {
                const categoryTemplates = templatesByCategory[category];
                if (categoryTemplates.length === 0) return null;

                return (
                  <div key={category}>
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
                      {category}
                    </h3>
                    <div className="space-y-3">
                      {categoryTemplates.map(template => {
                        const isAdding = addingIds.has(template.id);

                        return (
                          <div
                            key={template.id}
                            className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  {template.code && (
                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-mono rounded">
                                      {template.code}
                                    </span>
                                  )}
                                  <span className="text-xs text-gray-500">
                                    Priority: {template.default_priority}/5
                                  </span>
                                </div>
                                <h4 className="font-semibold text-gray-900 mb-2">
                                  {template.hazard}
                                </h4>
                                <div className="space-y-2">
                                  <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-0.5">
                                      Observation
                                    </p>
                                    <p className="text-sm text-gray-700 leading-relaxed">
                                      {template.description}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-0.5">
                                      Recommended Action
                                    </p>
                                    <p className="text-sm text-gray-700 leading-relaxed">
                                      {template.action}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleAddRecommendation(template)}
                                disabled={isAdding}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors flex-shrink-0 ${
                                  isAdding
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                              >
                                {isAdding ? (
                                  <>
                                    <Check className="w-4 h-4" />
                                    Added
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-4 h-4" />
                                    Add
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Click "Add" to copy a recommendation to this survey
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
