import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Archive, CheckCircle, Sparkles, AlertTriangle } from 'lucide-react';
import { generateHazardText, validateHazardNeutrality } from '../../utils/hazardTextGenerator';
import ConfirmModal from '../../components/ConfirmModal';
import FeedbackModal from '../../components/FeedbackModal';

interface LibraryItem {
  id: string;
  title: string;
  body: string;
  observation: string;
  action_required: string;
  hazard_risk_description: string;
  client_response_prompt: string | null;
  default_priority: number;
  related_module_key: string | null;
  category: string;
  is_active: boolean;
  code: string | null;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  'Construction',
  'Management Systems',
  'Fire Protection & Detection',
  'Special Hazards',
  'Business Continuity',
  'Other'
];

const MODULE_OPTIONS = [
  { key: 'RE_01_DOC_CONTROL', label: 'RE-01 Document Control' },
  { key: 'RE_02_CONSTRUCTION', label: 'RE-02 Construction' },
  { key: 'RE_03_OCCUPANCY', label: 'RE-03 Occupancy' },
  { key: 'RE_06_FIRE_PROTECTION', label: 'RE-04 Fire Protection' },
  { key: 'RE_07_NATURAL_HAZARDS', label: 'RE-05 Exposures' },
  { key: 'RE_08_UTILITIES', label: 'RE-06 Utilities' },
  { key: 'RE_09_MANAGEMENT', label: 'RE-07 Management' },
  { key: 'RE_12_LOSS_VALUES', label: 'RE-08 Loss & Values' },
  { key: 'OTHER', label: 'Other / General' },
];

const priorityToText = (priority: number): 'High' | 'Medium' | 'Low' => {
  if (priority <= 2) return 'High';
  if (priority <= 3) return 'Medium';
  return 'Low';
};

const textToPriority = (text: 'High' | 'Medium' | 'Low'): number => {
  if (text === 'High') return 1;
  if (text === 'Medium') return 3;
  return 5;
};

export default function RecommendationLibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active');

  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
  }>({ isOpen: false, type: 'success', title: '', message: '' });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    loadLibraryItems();
  }, []);

  const loadLibraryItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recommendation_templates')
        .select('*')
        .order('category', { ascending: true })
        .order('title', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading library items:', error);
      setFeedback({
        isOpen: true,
        type: 'error',
        title: 'Failed to load library',
        message: 'Unable to load recommendation library items.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingItem({
      id: crypto.randomUUID(),
      title: '',
      body: '',
      observation: '',
      action_required: '',
      hazard_risk_description: '',
      client_response_prompt: null,
      default_priority: 3,
      related_module_key: null,
      category: 'Other',
      is_active: true,
      code: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setIsModalOpen(true);
  };

  const handleEdit = (item: LibraryItem) => {
    setEditingItem({ ...item });
    setIsModalOpen(true);
  };

  const handleToggleActive = async (item: LibraryItem) => {
    try {
      const { error } = await supabase
        .from('recommendation_templates')
        .update({ is_active: !item.is_active })
        .eq('id', item.id);

      if (error) throw error;

      await loadLibraryItems();
      setFeedback({
        isOpen: true,
        type: 'success',
        title: item.is_active ? 'Item deactivated' : 'Item activated',
        message: `Library item has been ${item.is_active ? 'deactivated' : 'activated'}.`,
      });
    } catch (error) {
      console.error('Error toggling active state:', error);
      setFeedback({
        isOpen: true,
        type: 'error',
        title: 'Update failed',
        message: 'Unable to update library item status.',
      });
    }
  };

  const filteredItems = items.filter((item) => {
    if (filterActive === 'active') return item.is_active;
    if (filterActive === 'inactive') return !item.is_active;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Recommendation Library</h1>
          <p className="text-slate-600">
            Platform admin management of reusable recommendation templates
          </p>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterActive('all')}
                className={`px-4 py-2 text-sm rounded-lg ${
                  filterActive === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All ({items.length})
              </button>
              <button
                onClick={() => setFilterActive('active')}
                className={`px-4 py-2 text-sm rounded-lg ${
                  filterActive === 'active'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Active ({items.filter((i) => i.is_active).length})
              </button>
              <button
                onClick={() => setFilterActive('inactive')}
                className={`px-4 py-2 text-sm rounded-lg ${
                  filterActive === 'inactive'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Inactive ({items.filter((i) => !i.is_active).length})
              </button>
            </div>

            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create New
            </button>
          </div>
        </div>

        {/* Items List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-slate-600">Loading library...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <p className="text-slate-600">
              {filterActive === 'all'
                ? 'No library items yet. Create your first recommendation template.'
                : `No ${filterActive} library items.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <LibraryItemCard
                key={item.id}
                item={item}
                onEdit={handleEdit}
                onToggleActive={handleToggleActive}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isModalOpen && editingItem && (
        <LibraryItemModal
          item={editingItem}
          onClose={() => {
            setIsModalOpen(false);
            setEditingItem(null);
          }}
          onSaved={() => {
            loadLibraryItems();
            setIsModalOpen(false);
            setEditingItem(null);
            setFeedback({
              isOpen: true,
              type: 'success',
              title: 'Library item saved',
              message: 'Recommendation template has been saved successfully.',
            });
          }}
        />
      )}

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={feedback.isOpen}
        onClose={() => setFeedback({ ...feedback, isOpen: false })}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
      />
    </div>
  );
}

function LibraryItemCard({
  item,
  onEdit,
  onToggleActive,
}: {
  item: LibraryItem;
  onEdit: (item: LibraryItem) => void;
  onToggleActive: (item: LibraryItem) => void;
}) {
  const moduleLabel = MODULE_OPTIONS.find((m) => m.key === item.related_module_key)?.label || item.related_module_key || 'General';
  const priorityText = priorityToText(item.default_priority);

  return (
    <div className={`bg-white rounded-lg border p-6 ${item.is_active ? 'border-slate-200' : 'border-slate-300 bg-slate-50'}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className={`text-lg font-semibold ${item.is_active ? 'text-slate-900' : 'text-slate-500'}`}>
              {item.title}
            </h3>
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${
                priorityText === 'High'
                  ? 'bg-red-100 text-red-800'
                  : priorityText === 'Medium'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {priorityText}
            </span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">
              {item.category}
            </span>
            {item.related_module_key && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                {moduleLabel}
              </span>
            )}
            {!item.is_active && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-slate-200 text-slate-600">
                Inactive
              </span>
            )}
          </div>

          <div className="space-y-2 text-sm text-slate-600">
            <p><strong>Observation:</strong> {item.observation.substring(0, 150)}{item.observation.length > 150 ? '...' : ''}</p>
            <p><strong>Action:</strong> {item.action_required.substring(0, 150)}{item.action_required.length > 150 ? '...' : ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => onEdit(item)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onToggleActive(item)}
            className={`p-2 rounded-lg ${
              item.is_active
                ? 'text-amber-600 hover:bg-amber-50'
                : 'text-green-600 hover:bg-green-50'
            }`}
            title={item.is_active ? 'Deactivate' : 'Activate'}
          >
            {item.is_active ? <Archive className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function LibraryItemModal({
  item,
  onClose,
  onSaved,
}: {
  item: LibraryItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState<LibraryItem>(item);
  const [saving, setSaving] = useState(false);
  const [generatingHazard, setGeneratingHazard] = useState(false);
  const [hazardValidation, setHazardValidation] = useState<{ valid: boolean; issues: string[] } | null>(null);

  const isNewItem = !item.created_at || new Date(item.created_at).getTime() === new Date(item.updated_at).getTime();

  const handleGenerateHazard = () => {
    if (!formData.observation || !formData.action_required) {
      alert('Please fill in Observation and Action Required fields first.');
      return;
    }

    setGeneratingHazard(true);
    setTimeout(() => {
      const hazardText = generateHazardText({
        observation: formData.observation,
        actionRequired: formData.action_required,
      });

      setFormData({ ...formData, hazard_risk_description: hazardText });
      const validation = validateHazardNeutrality(hazardText);
      setHazardValidation(validation);
      setGeneratingHazard(false);
    }, 300);
  };

  const handleValidateHazard = () => {
    const validation = validateHazardNeutrality(formData.hazard_risk_description);
    setHazardValidation(validation);
  };

  const priorityText = priorityToText(formData.default_priority);

  const handleSave = async () => {
    if (!formData.title || !formData.observation || !formData.action_required || !formData.hazard_risk_description) {
      alert('Please fill in all required fields (title, observation, action, hazard).');
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        id: isNewItem ? undefined : formData.id,
        title: formData.title,
        body: formData.body || formData.title,
        observation: formData.observation,
        action_required: formData.action_required,
        hazard_risk_description: formData.hazard_risk_description,
        client_response_prompt: formData.client_response_prompt || null,
        default_priority: formData.default_priority,
        related_module_key: formData.related_module_key || null,
        category: formData.category,
        is_active: formData.is_active,
        code: formData.code || null,
      };

      const { error } = isNewItem
        ? await supabase.from('recommendation_templates').insert([dataToSave])
        : await supabase.from('recommendation_templates').update(dataToSave).eq('id', formData.id);

      if (error) throw error;

      onSaved();
    } catch (error) {
      console.error('Error saving library item:', error);
      alert('Failed to save library item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-4xl w-full my-8">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">
            {isNewItem ? 'Create Library Item' : 'Edit Library Item'}
          </h2>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Title <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
              placeholder="Brief title for this recommendation"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Observation */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Observation <span className="text-red-600">*</span>
            </label>
            <textarea
              value={formData.observation}
              onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
              placeholder="What was observed during the assessment?"
            />
          </div>

          {/* Action Required */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Action Required <span className="text-red-600">*</span>
            </label>
            <textarea
              value={formData.action_required}
              onChange={(e) => setFormData({ ...formData, action_required: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
              placeholder="What action needs to be taken?"
            />
          </div>

          {/* Hazard Risk Description */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <label className="block text-sm font-medium text-amber-900">
                    Hazard / Risk Description <span className="text-red-600">*</span>
                  </label>
                  <p className="text-xs text-amber-700 mt-1">
                    Neutral, factual risk statement (no client/insurer references)
                  </p>
                </div>
              </div>
              <button
                onClick={handleGenerateHazard}
                disabled={generatingHazard}
                className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 flex items-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {generatingHazard ? 'Generating...' : 'Generate'}
              </button>
            </div>
            <textarea
              value={formData.hazard_risk_description}
              onChange={(e) => setFormData({ ...formData, hazard_risk_description: e.target.value })}
              onBlur={handleValidateHazard}
              rows={4}
              className="w-full px-3 py-2 border border-amber-300 rounded-md text-sm bg-white mt-2"
              placeholder="Describe the hazard or risk in neutral terms"
            />
            {hazardValidation && (
              <div className={`mt-2 p-2 rounded text-sm ${hazardValidation.valid ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {hazardValidation.valid ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>Neutrality validation passed</span>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-medium">Neutrality issues found:</span>
                    </div>
                    <ul className="list-disc list-inside ml-6">
                      {hazardValidation.issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Client Response Prompt */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Client Response Prompt (Optional)
            </label>
            <textarea
              value={formData.client_response_prompt || ''}
              onChange={(e) => setFormData({ ...formData, client_response_prompt: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              placeholder="Optional guidance for client response/closeout"
            />
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={priorityText}
                onChange={(e) => setFormData({ ...formData, default_priority: textToPriority(e.target.value as 'High' | 'Medium' | 'Low') })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Related Module</label>
              <select
                value={formData.related_module_key || ''}
                onChange={(e) => setFormData({ ...formData, related_module_key: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              >
                <option value="">Select module...</option>
                {MODULE_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
              Active (visible to users)
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Library Item'}
          </button>
        </div>
      </div>
    </div>
  );
}
