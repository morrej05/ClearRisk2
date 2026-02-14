import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Search, Library } from 'lucide-react';

interface LibraryItem {
  id: string;
  title: string;
  observation_text: string;
  action_required_text: string;
  hazard_risk_description: string;
  client_response_prompt: string | null;
  priority: 'High' | 'Medium' | 'Low';
  related_module_key: string | null;
  tags: string[];
}

interface AddFromLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: LibraryItem) => void;
}

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

export default function AddFromLibraryModal({
  isOpen,
  onClose,
  onSelect,
}: AddFromLibraryModalProps) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadLibraryItems();
    }
  }, [isOpen]);

  const loadLibraryItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recommendation_library')
        .select('*')
        .eq('is_active', true)
        .order('title', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading library items:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.observation_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.action_required_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesModule = !selectedModule || item.related_module_key === selectedModule;
    const matchesPriority = !selectedPriority || item.priority === selectedPriority;

    return matchesSearch && matchesModule && matchesPriority;
  });

  const handleSelect = (item: LibraryItem) => {
    onSelect(item);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Library className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Add from Library</h2>
              <p className="text-sm text-slate-600 mt-1">
                Select a recommendation template from the library
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-slate-200 space-y-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, description, or tags..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex gap-4">
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="">All Modules</option>
              {MODULE_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="text-sm text-slate-600">
            Showing {filteredItems.length} of {items.length} items
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-slate-600">Loading library...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No library items match your filters
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <LibraryItemCard key={item.id} item={item} onSelect={handleSelect} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LibraryItemCard({
  item,
  onSelect,
}: {
  item: LibraryItem;
  onSelect: (item: LibraryItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const moduleLabel =
    MODULE_OPTIONS.find((m) => m.key === item.related_module_key)?.label ||
    item.related_module_key ||
    'General';

  return (
    <div className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-slate-900">{item.title}</h3>
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${
                item.priority === 'High'
                  ? 'bg-red-100 text-red-800'
                  : item.priority === 'Medium'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {item.priority}
            </span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
              {moduleLabel}
            </span>
          </div>

          <div className="text-sm text-slate-600 space-y-1 mb-3">
            <p>
              <strong>Observation:</strong>{' '}
              {expanded
                ? item.observation_text
                : `${item.observation_text.substring(0, 100)}${
                    item.observation_text.length > 100 ? '...' : ''
                  }`}
            </p>
            {expanded && (
              <>
                <p>
                  <strong>Action Required:</strong> {item.action_required_text}
                </p>
                <p>
                  <strong>Hazard/Risk:</strong> {item.hazard_risk_description}
                </p>
                {item.client_response_prompt && (
                  <p>
                    <strong>Client Response Prompt:</strong> {item.client_response_prompt}
                  </p>
                )}
              </>
            )}
          </div>

          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {item.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        </div>

        <button
          onClick={() => onSelect(item)}
          className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 whitespace-nowrap"
        >
          Add to Assessment
        </button>
      </div>
    </div>
  );
}
