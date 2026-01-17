import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit, Trash2, Save, X, AlertCircle, CheckCircle2, Search } from 'lucide-react';

interface RecommendationTemplate {
  id: string;
  hazard: string;
  description: string;
  action: string;
  client_response_prompt: string | null;
  category: string;
  default_priority: number;
  is_active: boolean;
  scope: string;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  'Construction',
  'Management Systems',
  'Fire Protection & Detection',
  'Special Hazards',
  'Business Continuity'
];

export default function RecommendationLibrary() {
  const [templates, setTemplates] = useState<RecommendationTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    hazard: '',
    description: '',
    action: '',
    client_response_prompt: '',
    category: 'Management Systems',
    default_priority: 3,
    is_active: true,
    scope: 'global'
  });

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
        .order('category', { ascending: true })
        .order('code', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err: any) {
      console.error('Error fetching templates:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    setError(null);
    try {
      const { error } = await supabase
        .from('recommendation_templates')
        .insert([formData]);

      if (error) throw error;

      setSuccessMessage('Template created successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      setIsCreating(false);
      resetForm();
      fetchTemplates();
    } catch (err: any) {
      console.error('Error creating template:', err);
      setError(err.message);
    }
  };

  const handleUpdate = async (id: string) => {
    setError(null);
    try {
      const { error } = await supabase
        .from('recommendation_templates')
        .update(formData)
        .eq('id', id);

      if (error) throw error;

      setSuccessMessage('Template updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      setEditingId(null);
      resetForm();
      fetchTemplates();
    } catch (err: any) {
      console.error('Error updating template:', err);
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template? This cannot be undone.')) {
      return;
    }

    setError(null);
    try {
      const { error } = await supabase
        .from('recommendation_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccessMessage('Template deleted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchTemplates();
    } catch (err: any) {
      console.error('Error deleting template:', err);
      setError(err.message);
    }
  };

  const handleToggleActive = async (template: RecommendationTemplate) => {
    setError(null);
    try {
      const { error } = await supabase
        .from('recommendation_templates')
        .update({ is_active: !template.is_active })
        .eq('id', template.id);

      if (error) throw error;

      fetchTemplates();
    } catch (err: any) {
      console.error('Error toggling template:', err);
      setError(err.message);
    }
  };

  const startEdit = (template: RecommendationTemplate) => {
    setEditingId(template.id);
    setFormData({
      hazard: template.hazard,
      description: template.description,
      action: template.action,
      client_response_prompt: template.client_response_prompt || '',
      category: template.category,
      default_priority: template.default_priority,
      is_active: template.is_active,
      scope: template.scope
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    resetForm();
    setError(null);
  };

  const resetForm = () => {
    setFormData({
      hazard: '',
      description: '',
      action: '',
      client_response_prompt: '',
      category: 'Management Systems',
      default_priority: 3,
      is_active: true,
      scope: 'global'
    });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading recommendation library...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Recommendation Library</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage global recommendation templates for all surveys
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          disabled={isCreating || editingId !== null}
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
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

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search templates..."
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

      {isCreating && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Template</h3>
          <TemplateForm
            formData={formData}
            setFormData={setFormData}
            onSave={handleCreate}
            onCancel={cancelEdit}
          />
        </div>
      )}

      <div className="space-y-4">
        {filteredTemplates.map(template => (
          <div
            key={template.id}
            className={`bg-white border rounded-lg p-6 shadow-sm ${
              !template.is_active ? 'opacity-60' : ''
            }`}
          >
            {editingId === template.id ? (
              <TemplateForm
                formData={formData}
                setFormData={setFormData}
                onSave={() => handleUpdate(template.id)}
                onCancel={cancelEdit}
              />
            ) : (
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                        {template.category}
                      </span>
                      <span className="text-xs text-gray-500">
                        Priority: {template.default_priority}/5
                      </span>
                      {!template.is_active && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">{template.hazard}</h3>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleToggleActive(template)}
                      className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                        template.is_active
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {template.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => startEdit(template)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      disabled={editingId !== null || isCreating}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      disabled={editingId !== null || isCreating}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Observation</p>
                    <p className="text-gray-700 text-sm leading-relaxed">{template.description}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Recommended Action</p>
                    <p className="text-gray-700 text-sm leading-relaxed">{template.action}</p>
                  </div>
                  {template.client_response_prompt && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Client Response Prompt</p>
                      <p className="text-gray-500 text-sm italic">{template.client_response_prompt}</p>
                    </div>
                  )}
                </div>
                {template.trigger_type !== 'manual' && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">Trigger:</span> {template.trigger_type}
                      {template.trigger_field_key && ` • Field: ${template.trigger_field_key}`}
                      {template.trigger_value && ` • Value: ${template.trigger_value}`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {filteredTemplates.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No templates found matching your criteria
          </div>
        )}
      </div>
    </div>
  );
}

interface TemplateFormProps {
  formData: any;
  setFormData: (data: any) => void;
  onSave: () => void;
  onCancel: () => void;
}

function TemplateForm({ formData, setFormData, onSave, onCancel }: TemplateFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Category *
        </label>
        <select
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        >
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Hazard / Identification *
        </label>
        <input
          type="text"
          placeholder="e.g., Hot Work, DSEAR, Malicious Arson"
          value={formData.hazard}
          onChange={(e) => setFormData({ ...formData, hazard: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Observation / Description *
        </label>
        <textarea
          placeholder="Describe the observation or current state"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Recommended Action *
        </label>
        <textarea
          placeholder="Specify the recommended action to address the issue"
          value={formData.action}
          onChange={(e) => setFormData({ ...formData, action: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Client Response Prompt (Optional)
        </label>
        <input
          type="text"
          placeholder="e.g., Site Response, Client Comments"
          value={formData.client_response_prompt}
          onChange={(e) => setFormData({ ...formData, client_response_prompt: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Default Priority
        </label>
        <select
          value={formData.default_priority}
          onChange={(e) => setFormData({ ...formData, default_priority: parseInt(e.target.value) })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {[1, 2, 3, 4, 5].map(p => (
            <option key={p} value={p}>
              {p} {p === 5 ? '(Critical)' : p === 1 ? '(Low)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_active"
          checked={formData.is_active}
          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <label htmlFor="is_active" className="text-sm text-gray-700">
          Active (available for use in surveys)
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button
          onClick={onSave}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          disabled={!formData.title || !formData.body}
        >
          <Save className="w-4 h-4" />
          Save Template
        </button>
      </div>
    </div>
  );
}
