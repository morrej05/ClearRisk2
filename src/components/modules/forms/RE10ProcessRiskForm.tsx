import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import FloatingSaveBar from './FloatingSaveBar';
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

interface RE10ProcessRiskFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

const CANONICAL_KEYS = [
  'flammable_liquids_and_fire_risk',
  'critical_equipment_reliability',
  'high_energy_materials_control',
  'high_energy_process_equipment',
];

export default function RE10ProcessRiskForm({
  moduleInstance,
  document,
  onSaved,
}: RE10ProcessRiskFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const d = moduleInstance.data || {};

  const [formData, setFormData] = useState({
    notes: d.notes || '',
    recommendations: d.recommendations || [],
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
    <>
    <div className="p-6 max-w-5xl mx-auto pb-24">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-10 - Process Risk</h2>
        <p className="text-slate-600">Process hazards and high-risk materials assessment</p>
      </div>

      <div className="space-y-6 mb-6">
        {CANONICAL_KEYS.map((canonicalKey) => {
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

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Additional Notes</h3>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={4}
          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          placeholder="Additional observations about process risks and controls"
        />
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

      <FloatingSaveBar onSave={handleSave} isSaving={isSaving} />
    </>
  );
}
