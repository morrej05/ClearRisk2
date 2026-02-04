import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import ModuleActions from '../ModuleActions';
import FloatingSaveBar from './FloatingSaveBar';
import { getHrgConfig } from '../../../lib/re/reference/hrgMasterMap';
import { setRating } from '../../../lib/re/scoring/riskEngineeringHelpers';
import { ensureAutoRecommendation } from '../../../lib/re/recommendations/autoRecommendations';

interface Document {
  id: string;
  title: string;
}

interface ModuleInstance {
  id: string;
  document_id: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
}

interface RE09ManagementFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

const CANONICAL_KEY = 'process_safety_management';

const CATEGORY_LABELS: Record<string, string> = {
  housekeeping: 'Housekeeping',
  hot_work: 'Hot Work Controls',
  impairment_management: 'Impairment Management',
  contractor_control: 'Contractor Control',
  maintenance: 'Maintenance Programs',
  emergency_planning: 'Emergency Planning',
  change_management: 'Change Management',
};

const RATING_LABELS: Record<number, string> = {
  1: 'Poor / Inadequate',
  2: 'Below Average',
  3: 'Average / Acceptable',
  4: 'Good',
  5: 'Excellent',
};

// Invert rating for UI display: stored 1=excellent, UI 1=poor
const invertRatingForUI = (stored: number | null): number | null => {
  if (stored === null) return null;
  return 6 - stored;
};

// Invert rating for storage: UI 1=poor, stored 1=excellent
const invertRatingForStorage = (ui: number | null): number | null => {
  if (ui === null) return null;
  return 6 - ui;
};

export default function RE09ManagementForm({
  moduleInstance,
  document,
  onSaved,
}: RE09ManagementFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const d = moduleInstance.data || {};

  // Initialize categories with UI-inverted ratings
  const initialCategories = (d.categories || [
    { key: 'housekeeping', rating_1_5: null, notes: '' },
    { key: 'hot_work', rating_1_5: null, notes: '' },
    { key: 'impairment_management', rating_1_5: null, notes: '' },
    { key: 'contractor_control', rating_1_5: null, notes: '' },
    { key: 'maintenance', rating_1_5: null, notes: '' },
    { key: 'emergency_planning', rating_1_5: null, notes: '' },
    { key: 'change_management', rating_1_5: null, notes: '' },
  ]).map((cat: any) => {
    const uiRating = invertRatingForUI(cat.rating_1_5);
    return {
      ...cat,
      rating_1_5: uiRating !== null ? Number(uiRating) : null,
    };
  });

  const [formData, setFormData] = useState({
    categories: initialCategories,
    recommendations: d.recommendations || [],
  });

  const [riskEngData, setRiskEngData] = useState<any>({});
  const [riskEngInstanceId, setRiskEngInstanceId] = useState<string | null>(null);
  const [industryKey, setIndustryKey] = useState<string | null>(null);

  useEffect(() => {
    async function loadRiskEngModule() {
      try {
        const { data: instance, error } = await supabase
          .from('module_instances')
          .select('id, data')
          .eq('document_id', moduleInstance.document_id)
          .eq('module_key', 'RISK_ENGINEERING')
          .single();

        if (error) throw error;

        if (instance) {
          setRiskEngInstanceId(instance.id);
          setRiskEngData(instance.data || {});
          setIndustryKey(instance.data?.industry_key || null);
        }
      } catch (err) {
        console.error('Error loading RISK_ENGINEERING module:', err);
      }
    }

    loadRiskEngModule();
  }, [moduleInstance.document_id]);

  const hrgConfig = getHrgConfig(industryKey, CANONICAL_KEY);

  // Calculate overall rating from categories (weighted average)
  const calculateOverallRating = (categories: any[]): number | null => {
    const rated = categories.filter((c) => c.rating_1_5 !== null && c.rating_1_5 !== undefined);
    if (rated.length === 0) return null;

    // All categories have equal weight (1)
    const sum = rated.reduce((acc, c) => acc + Number(c.rating_1_5), 0);
    const avg = sum / rated.length;

    // Round and clamp to 1-5, then invert back to storage format (1=excellent)
    const uiRating = Math.max(1, Math.min(5, Math.round(avg)));
    return Number(invertRatingForStorage(uiRating));
  };

  // Update overall rating in RISK_ENGINEERING module
  const updateOverallRating = async (categories: any[]) => {
    if (!riskEngInstanceId) return;

    const overallRating = calculateOverallRating(categories);
    if (overallRating === null) return;

    try {
      const updatedRiskEngData = setRating(riskEngData, CANONICAL_KEY, overallRating);

      const { error } = await supabase
        .from('module_instances')
        .update({ data: updatedRiskEngData })
        .eq('id', riskEngInstanceId);

      if (error) throw error;

      setRiskEngData(updatedRiskEngData);

      const updatedFormData = ensureAutoRecommendation(formData, CANONICAL_KEY, overallRating, industryKey);
      if (updatedFormData !== formData) {
        setFormData(updatedFormData);
      }
    } catch (err) {
      console.error('Error updating overall rating:', err);
    }
  };

  const updateCategory = (key: string, field: string, value: any) => {
    // Ensure numeric values are stored as numbers
    const normalizedValue = field === 'rating_1_5' && value !== null ? Number(value) : value;

    setFormData((prev) => {
      const nextCategories = (prev.categories ?? []).map((c: any) =>
        c.key === key ? { ...c, [field]: normalizedValue } : c
      );

      // Auto-update overall rating when a category rating changes
      if (field === 'rating_1_5') {
        updateOverallRating(nextCategories);
      }

      return { ...prev, categories: nextCategories };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Invert ratings back to storage format before saving
      const dataToSave = {
        ...formData,
        categories: formData.categories.map((cat: any) => {
          const uiRating = cat.rating_1_5 !== null ? Number(cat.rating_1_5) : null;
          const storedRating = invertRatingForStorage(uiRating);
          return {
            ...cat,
            rating_1_5: storedRating !== null ? Number(storedRating) : null,
          };
        }),
      };

      const sanitized = sanitizeModuleInstancePayload({ data: dataToSave });

      const { error } = await supabase
        .from('module_instances')
        .update({
          data: sanitized.data,
        })
        .eq('id', moduleInstance.id);

      if (error) throw error;
      onSaved();
    } catch (error) {
      console.error('Error saving module:', error);
      alert('Failed to save module. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate display values for overall rating
  const overallRatingStored = calculateOverallRating(formData.categories);
  const overallRatingUI = overallRatingStored !== null ? Number(invertRatingForUI(overallRatingStored)) : null;
  const overallRatingLabel = overallRatingUI !== null ? RATING_LABELS[overallRatingUI] : 'Not rated';

  return (
    <>
    <div className="p-6 max-w-5xl mx-auto pb-24">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-7 - Management Systems</h2>
        <p className="text-slate-600">Assessment of operational management and control systems</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Overall Management Systems Rating</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-sm text-slate-600 mb-2">
              Auto-calculated from category ratings below (weighted average)
            </p>
            {hrgConfig.helpText && (
              <p className="text-sm text-slate-500 italic">{hrgConfig.helpText}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">{overallRatingUI || '—'}</div>
            <div className="text-sm text-slate-600">{overallRatingLabel}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Industry-Specific Risk Factors - Rating Panels</h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-900">
              <strong>Rating Scale:</strong> 1 = Poor/Inadequate, 2 = Below Average, 3 = Average/Acceptable, 4 = Good, 5 = Excellent.
              Poor ratings should typically trigger recommendations for improvement.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {formData.categories.map((category: any) => (
              <div key={category.key} className="border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-3">{CATEGORY_LABELS[category.key]}</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Engineer Rating (1 = Poor, 5 = Excellent)
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map((num) => {
                        const isSelected = Number(category.rating_1_5) === Number(num);
                        return (
                          <button
                            key={num}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              updateCategory(category.key, 'rating_1_5', Number(num));
                            }}
                            className={`px-2 py-3 rounded-lg border-2 font-medium text-xs transition-all flex flex-col items-center gap-1 ${
                              isSelected
                                ? num >= 4
                                  ? 'bg-green-100 border-green-500 text-green-700'
                                  : num === 3
                                  ? 'bg-amber-100 border-amber-500 text-amber-700'
                                  : 'bg-red-100 border-red-500 text-red-700'
                                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <span className="text-lg font-bold">{num}</span>
                            <span className="text-center leading-tight">{RATING_LABELS[num]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                    <textarea
                      value={category.notes ?? ''}
                      onChange={(e) => updateCategory(category.key, 'notes', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      placeholder="Describe current practices, gaps, and observations"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {document?.id && moduleInstance?.id && (
        <ModuleActions documentId={document.id} moduleInstanceId={moduleInstance.id} />
      )}
    </div>

      <FloatingSaveBar onSave={handleSave} isSaving={isSaving} />
    </>
  );
}
