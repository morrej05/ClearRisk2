import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import ReRatingPanel from '../../re/ReRatingPanel';
import { getHrgConfig } from '../../../lib/re/reference/hrgMasterMap';
import { getRating, setRating } from '../../../lib/re/scoring/riskEngineeringHelpers';
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

interface RE03OccupancyFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

const CANONICAL_KEY = 'process_control_and_stability';

const SPECIAL_HAZARDS_CANONICAL_KEYS = [
  'flammable_liquids_and_fire_risk',
  'high_energy_materials_control',
  'high_energy_process_equipment',
];

const SPECIAL_HAZARDS_LABELS: Record<string, string> = {
  ignitable_liquids: 'Ignitable liquids',
  flammable_gases_chemicals: 'Flammable gases & chemicals',
  dusts_explosive_atmospheres: 'Dusts and explosive atmospheres',
  specialised_industrial_equipment: 'Specialised industrial equipment',
  emerging_risks: 'Emerging risks (PV panels, lithium-ion, etc.)',
};

export default function RE03OccupancyForm({
  moduleInstance,
  document,
  onSaved,
}: RE03OccupancyFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const d = moduleInstance?.data ?? {};

  const defaultSpecialHazards = {
    ignitable_liquids: { present: false, notes: '' },
    flammable_gases_chemicals: { present: false, notes: '' },
    dusts_explosive_atmospheres: { present: false, notes: '' },
    specialised_industrial_equipment: { present: false, notes: '' },
    emerging_risks: { present: false, notes: '' },
  };

  const safeSpecialHazards = typeof d.special_hazards === 'object' && d.special_hazards !== null
    ? { ...defaultSpecialHazards, ...d.special_hazards }
    : defaultSpecialHazards;

  const [formData, setFormData] = useState({
    process_overview: d.process_overview ?? '',
    operating_hours: d.operating_hours ?? '',
    headcount: d.headcount ?? null,
    notes: d.notes ?? '',
    special_hazards: safeSpecialHazards,
    recommendations: Array.isArray(d.recommendations) ? d.recommendations : [],
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

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

  const rating = getRating(riskEngData, CANONICAL_KEY);
  const hrgConfig = getHrgConfig(industryKey, CANONICAL_KEY);

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

      const updatedFormData = ensureAutoRecommendation(formData, canonicalKey, newRating, industryKey);
      if (updatedFormData !== formData) {
        setFormData(updatedFormData);
        const sanitized = sanitizeModuleInstancePayload({ data: updatedFormData });
        await supabase
          .from('module_instances')
          .update({ data: sanitized.data })
          .eq('id', moduleInstance.id);
      }
    } catch (err) {
      console.error('Error updating rating:', err);
      alert('Failed to update rating');
    }
  };

  const updateSpecialHazard = (key: string, field: 'present' | 'notes', value: any) => {
    const currentHazard = formData.special_hazards[key] ?? { present: false, notes: '' };
    setFormData({
      ...formData,
      special_hazards: {
        ...formData.special_hazards,
        [key]: {
          ...currentHazard,
          [field]: value,
        },
      },
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const completedAt = outcome ? new Date().toISOString() : null;
      const sanitized = sanitizeModuleInstancePayload({ data: formData });

      const { error } = await supabase
        .from('module_instances')
        .update({
          data: sanitized.data,
          outcome: outcome || null,
          assessor_notes: assessorNotes,
          completed_at: completedAt,
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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-3 - Occupancy</h2>
        <p className="text-slate-600">Occupancy classification and process control assessment</p>
      </div>

      <div className="mb-6">
        <ReRatingPanel
          canonicalKey={CANONICAL_KEY}
          industryKey={industryKey}
          rating={rating}
          onChangeRating={(newRating) => handleRatingChange(CANONICAL_KEY, newRating)}
          helpText={hrgConfig.helpText}
          weight={hrgConfig.weight}
        />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Occupancy Information</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Process Overview</label>
              <textarea
                value={formData.process_overview}
                onChange={(e) => setFormData({ ...formData, process_overview: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Describe the primary processes and operations at this site"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Operating Hours</label>
                <input
                  type="text"
                  value={formData.operating_hours}
                  onChange={(e) => setFormData({ ...formData, operating_hours: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="e.g., 24/7, Mon-Fri 9-5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Headcount</label>
                <input
                  type="number"
                  value={formData.headcount || ''}
                  onChange={(e) => setFormData({ ...formData, headcount: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Additional Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Additional observations and notes"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Special Hazards (Generic)</h3>
        <p className="text-sm text-slate-600 mb-4">
          Document the presence and key characteristics of special hazards at this site. Use the rating panels below to assess control quality.
        </p>
        <div className="space-y-4">
          {Object.entries(SPECIAL_HAZARDS_LABELS).map(([key, label]) => {
            const hazard = formData.special_hazards[key] ?? { present: false, notes: '' };
            return (
              <div key={key} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-slate-900">{label}</h4>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-600">Present?</span>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={hazard.present}
                        onChange={(e) => updateSpecialHazard(key, 'present', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        {hazard.present ? 'Yes' : 'No'}
                      </span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea
                    value={hazard.notes}
                    onChange={(e) => updateSpecialHazard(key, 'notes', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder={`Describe ${label.toLowerCase()} present at this site...`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-6 space-y-6">
        <div className="bg-slate-50 border border-slate-300 rounded-lg p-4">
          <h3 className="text-base font-semibold text-slate-900 mb-2">Special Hazards & High-Risk Processes</h3>
          <p className="text-sm text-slate-600">
            Rate the quality of controls for special hazards and high-risk processes identified above.
          </p>
        </div>
        {SPECIAL_HAZARDS_CANONICAL_KEYS.map((canonicalKey) => {
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

      <OutcomePanel
        outcome={outcome}
        assessorNotes={assessorNotes}
        onOutcomeChange={setOutcome}
        onNotesChange={setAssessorNotes}
        onSave={handleSave}
        isSaving={isSaving}
      />

      {document?.id && moduleInstance?.id && (
        <ModuleActions documentId={document.id} moduleInstanceId={moduleInstance.id} />
      )}
    </div>
  );
}
