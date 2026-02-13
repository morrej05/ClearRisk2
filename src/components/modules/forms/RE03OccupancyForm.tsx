import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import ModuleActions from '../ModuleActions';
import ReRatingPanel from '../../re/ReRatingPanel';
import FloatingSaveBar from './FloatingSaveBar';
import FeedbackModal from '../../FeedbackModal';
import { getHrgConfig, HRG_MASTER_MAP } from '../../../lib/re/reference/hrgMasterMap';
import { getRating, setRating } from '../../../lib/re/scoring/riskEngineeringHelpers';
import { ensureAutoRecommendation } from '../../../lib/re/recommendations/autoRecommendations';
import { syncAutoRecToRegister } from '../../../lib/re/recommendations/recommendationPipeline';
import { Plus, X, AlertCircle, BookOpen } from 'lucide-react';

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

interface RE03OccupancyFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface Hazard {
  id: string;
  hazard_key: string;
  hazard_label: string;
  description: string;
  assessment: string;
  free_text: string;
}

function getIndustrySpecialHazardKeys(industryKey: string | null): string[] {
  if (!industryKey || !HRG_MASTER_MAP.industries[industryKey]) {
    return [];
  }

  const industry = HRG_MASTER_MAP.industries[industryKey];
  return Object.keys(industry.modules);
}

const GENERIC_HAZARD_OPTIONS = [
  { key: 'ignitable_liquids', label: 'Ignitable liquids' },
  { key: 'flammable_gases_chemicals', label: 'Flammable gases & chemicals' },
  { key: 'dusts_explosive_atmospheres', label: 'Dusts and explosive atmospheres' },
  { key: 'specialised_industrial_equipment', label: 'Specialised industrial equipment' },
  { key: 'emerging_risks', label: 'Emerging risks (PV panels, lithium-ion, etc.)' },
];

export default function RE03OccupancyForm({
  moduleInstance,
  document,
  onSaved,
}: RE03OccupancyFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingRecommendation, setIsAddingRecommendation] = useState(false);
  const d = moduleInstance?.data ?? {};

  const safeHazards: Hazard[] = Array.isArray(d.occupancy?.hazards)
    ? d.occupancy.hazards.map((h: any) => ({
        id: h.id ?? crypto.randomUUID(),
        hazard_key: h.hazard_key ?? '',
        hazard_label: h.hazard_label ?? '',
        description: h.description ?? '',
        assessment: h.assessment ?? '',
        free_text: h.free_text ?? '',
      }))
    : [];

  const [formData, setFormData] = useState({
    process_overview: d.occupancy?.process_overview ?? '',
    industry_special_hazards_notes: d.occupancy?.industry_special_hazards_notes ?? '',
    hazards: safeHazards,
    hazards_free_text: d.occupancy?.hazards_free_text ?? '',
  });

  const [riskEngData, setRiskEngData] = useState<any>({});
  const [riskEngInstanceId, setRiskEngInstanceId] = useState<string | null>(null);
  const [industryKey, setIndustryKey] = useState<string | null>(null);
  const [selectedHazardToAdd, setSelectedHazardToAdd] = useState('');

  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
    autoClose?: boolean;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
    autoClose: false,
  });

  useEffect(() => {
    async function loadRiskEngModule() {
      try {
        const { data: instance, error } = await supabase
          .from('module_instances')
          .select('id, data')
          .eq('document_id', moduleInstance.document_id)
          .eq('module_key', 'RISK_ENGINEERING')
          .maybeSingle();

        if (error) {
          console.error('Error loading RISK_ENGINEERING module:', error);
          return;
        }

        if (instance) {
          setRiskEngInstanceId(instance.id);
          setRiskEngData(instance.data ?? {});
          setIndustryKey(instance.data?.industry_key ?? null);
        }
      } catch (err) {
        console.error('Error loading RISK_ENGINEERING module:', err);
      }
    }

    loadRiskEngModule();
  }, [moduleInstance.document_id]);

  const industrySpecialHazardKeys = getIndustrySpecialHazardKeys(industryKey);

  const handleRatingChange = async (canonicalKey: string, newRating: number) => {
    if (!riskEngInstanceId) return;

    try {
      const updatedRiskEngData = setRating(riskEngData, canonicalKey, newRating);

      const { error } = await supabase
        .from('module_instances')
        .update({ data: updatedRiskEngData })
        .eq('id', riskEngInstanceId);

      if (error) throw error;

      setRiskEngData(updatedRiskEngData);

      await syncAutoRecToRegister({
        documentId: moduleInstance.document_id,
        moduleKey: 'RE_03_OCCUPANCY',
        canonicalKey,
        rating_1_5: newRating,
        industryKey,
      });

      const updatedFormData = ensureAutoRecommendation(formData, canonicalKey, newRating, industryKey);
      if (updatedFormData !== formData) {
        setFormData(updatedFormData);
        const sanitized = sanitizeModuleInstancePayload({ data: { occupancy: updatedFormData } });
        await supabase
          .from('module_instances')
          .update({ data: sanitized.data })
          .eq('id', moduleInstance.id);
      }
    } catch (err) {
      console.error('Error updating rating:', err);
      setFeedback({
        isOpen: true,
        type: 'error',
        title: 'Failed to update rating',
        message: 'Unable to save the rating change. Please try again.',
        autoClose: false,
      });
    }
  };

  const addHazardEntry = () => {
    if (!selectedHazardToAdd) return;

    const option = GENERIC_HAZARD_OPTIONS.find(opt => opt.key === selectedHazardToAdd);
    if (!option) return;

    const newHazard: Hazard = {
      id: crypto.randomUUID(),
      hazard_key: option.key,
      hazard_label: option.label,
      description: '',
      assessment: '',
      free_text: '',
    };

    setFormData({
      ...formData,
      hazards: [...formData.hazards, newHazard],
    });
    setSelectedHazardToAdd('');
  };

  const removeHazard = (id: string) => {
    setFormData({
      ...formData,
      hazards: formData.hazards.filter(h => h.id !== id),
    });
  };

  const updateHazard = (id: string, updates: Partial<Hazard>) => {
    setFormData({
      ...formData,
      hazards: formData.hazards.map(h => h.id === id ? { ...h, ...updates } : h),
    });
  };

  const addRecommendation = async (title: string, detail: string, relatedSection: string = 'Hazards') => {
    setIsAddingRecommendation(true);
    try {
      const { data: reModule, error: fetchError } = await supabase
        .from('module_instances')
        .select('id, data')
        .eq('document_id', moduleInstance.document_id)
        .eq('module_key', 'RE_13_RECOMMENDATIONS')
        .maybeSingle();

      if (fetchError) throw fetchError;

      const newRecommendation = {
        id: crypto.randomUUID(),
        title,
        detail,
        priority: 'Medium',
        target_date: '',
        owner: '',
        status: 'Open',
        related_section: relatedSection,
        photos: [],
        is_auto_generated: false,
        source_module: 'RE_03_OCCUPANCY',
      };

      if (reModule) {
        const existingRecs = Array.isArray(reModule.data?.recommendations) ? reModule.data.recommendations : [];
        const updatedRecs = [...existingRecs, newRecommendation];
        const sanitized = sanitizeModuleInstancePayload({ data: { recommendations: updatedRecs } });

        const { error: updateError } = await supabase
          .from('module_instances')
          .update({ data: sanitized.data })
          .eq('id', reModule.id);

        if (updateError) throw updateError;
      } else {
        const sanitized = sanitizeModuleInstancePayload({ data: { recommendations: [newRecommendation] } });

        const { error: insertError } = await supabase
          .from('module_instances')
          .insert({
            document_id: moduleInstance.document_id,
            module_key: 'RE_13_RECOMMENDATIONS',
            data: sanitized.data,
          });

        if (insertError) throw insertError;
      }

      setFeedback({
        isOpen: true,
        type: 'success',
        title: 'Recommendation added',
        message: 'The recommendation has been successfully added.',
        autoClose: true,
      });
    } catch (err) {
      console.error('Error adding recommendation:', err);
      setFeedback({
        isOpen: true,
        type: 'error',
        title: 'Failed to add recommendation',
        message: 'Unable to add the recommendation. Please try again.',
        autoClose: false,
      });
    } finally {
      setIsAddingRecommendation(false);
    }
  };

  const handleAddIndustryRecommendation = () => {
    if (!formData.industry_special_hazards_notes.trim()) {
      setFeedback({
        isOpen: true,
        type: 'warning',
        title: 'Notes required',
        message: 'Please add notes before creating a recommendation.',
        autoClose: false,
      });
      return;
    }
    addRecommendation(
      'RE-03: Industry-specific hazards',
      formData.industry_special_hazards_notes,
      'Hazards'
    );
  };

  const handleAddHazardRecommendation = (hazard: Hazard) => {
    const detailParts = [];
    if (hazard.description) detailParts.push(`Description: ${hazard.description}`);
    if (hazard.assessment) detailParts.push(`Assessment: ${hazard.assessment}`);
    if (hazard.free_text) detailParts.push(`Notes: ${hazard.free_text}`);

    const detail = detailParts.length > 0 ? detailParts.join('\n\n') : 'See RE-03 for details.';

    addRecommendation(
      `RE-03: ${hazard.hazard_label}`,
      detail,
      'Hazards'
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const sanitized = sanitizeModuleInstancePayload({ data: { occupancy: formData } });

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
      setFeedback({
        isOpen: true,
        type: 'error',
        title: 'Save failed',
        message: 'Unable to save changes. Please try again.',
        autoClose: false,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto pb-24">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-3 - Occupancy</h2>
          <p className="text-slate-600">Occupancy classification and process control assessment</p>
        </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Occupancy / Process Overview</h3>
        <p className="text-sm text-slate-600 mb-4">
          Provide a comprehensive overview of the occupancy classification, primary processes, operations, and activities at this site.
        </p>
        <textarea
          value={formData.process_overview}
          onChange={(e) => setFormData({ ...formData, process_overview: e.target.value })}
          rows={8}
          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
          placeholder="Describe the site occupancy, business operations, manufacturing processes, storage activities, operating hours, staffing levels, and any other relevant occupancy information..."
        />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">
              Industry-Specific Special Hazards & High-Risk Processes
            </h3>
            {!industryKey && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2 mb-4">
                <p className="text-sm text-amber-900">
                  No industry selected in RE-01. Industry-specific guidance will appear once an industry is selected.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes on Industry-Specific Hazards
            </label>
            <textarea
              value={formData.industry_special_hazards_notes}
              onChange={(e) => setFormData({ ...formData, industry_special_hazards_notes: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              placeholder="Document industry-specific hazards and high-risk processes identified at this site..."
            />
          </div>
          <button
            type="button"
            onClick={handleAddIndustryRecommendation}
            disabled={isAddingRecommendation || !formData.industry_special_hazards_notes.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add Recommendation to RE-9
          </button>
        </div>
      </div>

      {industrySpecialHazardKeys.length > 0 && (
        <div className="mb-6 space-y-6">
          <div className="bg-slate-50 border border-slate-300 rounded-lg p-4">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Industry-Specific Risk Factors - Rating Panels</h3>
            <p className="text-sm text-slate-600">
              Rate the quality of controls for each industry-specific risk factor.
            </p>
          </div>
          {industrySpecialHazardKeys.map((canonicalKey) => {
            const rating = getRating(riskEngData, canonicalKey);
            const hrgConfig = getHrgConfig(industryKey, canonicalKey);
            return (
              <ReRatingPanel
                key={canonicalKey}
                canonicalKey={canonicalKey}
                industryKey={industryKey}
                rating={rating}
                onChangeRating={(newRating) => handleRatingChange(canonicalKey, newRating)}
                helpText={hrgConfig.helpText}
                weight={hrgConfig.weight}
              />
            );
          })}
        </div>
      )}

      {!industryKey && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-900 mb-1">No Industry Selected</h3>
              <p className="text-sm text-amber-800">
                Industry-specific risk factor rating panels will appear once you select an industry classification in RE-01 Document Control.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Generic Special Hazards</h3>
        <p className="text-sm text-slate-600 mb-4">
          Document the presence and key characteristics of generic special hazards at this site.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">Add Hazard</label>
          <div className="flex gap-2">
            <select
              value={selectedHazardToAdd}
              onChange={(e) => setSelectedHazardToAdd(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">Select a hazard type...</option>
              {GENERIC_HAZARD_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addHazardEntry}
              disabled={!selectedHazardToAdd}
              className="px-4 py-2 bg-slate-700 text-white text-sm rounded-md hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {formData.hazards.map((hazard) => (
            <div key={hazard.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-slate-900">{hazard.hazard_label}</h4>
                <button
                  type="button"
                  onClick={() => removeHazard(hazard.id)}
                  className="text-red-600 hover:text-red-700 p-1"
                  title="Remove hazard"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    value={hazard.description}
                    onChange={(e) => updateHazard(hazard.id, { description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                    placeholder="Describe this hazard at the site..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Assessment</label>
                  <textarea
                    value={hazard.assessment}
                    onChange={(e) => updateHazard(hazard.id, { assessment: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                    placeholder="Assessment of controls and risk level..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Additional Notes</label>
                  <textarea
                    value={hazard.free_text}
                    onChange={(e) => updateHazard(hazard.id, { free_text: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                    placeholder="Any additional notes or observations..."
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleAddHazardRecommendation(hazard)}
                  disabled={isAddingRecommendation}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Add Recommendation to RE-9
                </button>
              </div>
            </div>
          ))}

          {formData.hazards.length === 0 && (
            <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-300 rounded-lg">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No hazards added yet</p>
              <p className="text-xs text-slate-400">Use the dropdown above to add hazard entries</p>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Additional Hazards / Catch-All Notes
          </label>
          <textarea
            value={formData.hazards_free_text}
            onChange={(e) => setFormData({ ...formData, hazards_free_text: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            placeholder="Any other hazards or observations not captured above..."
          />
        </div>
      </div>

        {document?.id && moduleInstance?.id && (
          <ModuleActions
            documentId={document.id}
            moduleInstanceId={moduleInstance.id}
            buttonLabel="Add Recommendation"
          />
        )}
      </div>

      <FloatingSaveBar onSave={handleSave} isSaving={isSaving} />

      <FeedbackModal
        isOpen={feedback.isOpen}
        onClose={() => setFeedback({ ...feedback, isOpen: false })}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        autoClose={feedback.autoClose}
      />
    </>
  );
}
