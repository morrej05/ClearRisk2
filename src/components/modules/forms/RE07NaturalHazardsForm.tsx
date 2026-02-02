import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import FloatingSaveBar from './FloatingSaveBar';
import ReRatingPanel from '../../re/ReRatingPanel';
import { HRG_MASTER_MAP } from '../../../lib/re/reference/hrgMasterMap';
import { getRating, setRating } from '../../../lib/re/scoring/riskEngineeringHelpers';

interface Document {
  id: string;
  title: string;
  document_type: string;
}

interface ModuleInstance {
  id: string;
  document_id: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
}

interface RE07NaturalHazardsFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

const CANONICAL_KEY = 'natural_hazard_exposure_and_controls';

export default function RE07NaturalHazardsForm({
  moduleInstance,
  document,
  onSaved,
}: RE07NaturalHazardsFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const d = moduleInstance.data || {};

  const [formData, setFormData] = useState({
    natural_hazards_notes: typeof d.natural_hazards_notes === 'string' ? d.natural_hazards_notes : '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const [riskEngInstanceId, setRiskEngInstanceId] = useState<string | null>(null);
  const [riskEngData, setRiskEngData] = useState<Record<string, any>>({});
  const [industryKey, setIndustryKey] = useState<string | null>(null);

  useEffect(() => {
    async function loadRiskEngModule() {
      try {
        const { data: instances, error } = await supabase
          .from('module_instances')
          .select('id, data')
          .eq('document_id', moduleInstance.document_id)
          .eq('module_key', 'RISK_ENGINEERING')
          .single();

        if (error) throw error;

        if (instances) {
          setRiskEngInstanceId(instances.id);
          setRiskEngData(instances.data || {});
          setIndustryKey(instances.data?.industry_key || null);
        }
      } catch (err) {
        console.error('Error loading RISK_ENGINEERING module:', err);
      }
    }

    loadRiskEngModule();
  }, [moduleInstance.document_id]);

  const rating = getRating(riskEngData, CANONICAL_KEY);

  const getHelpText = (): string => {
    if (!industryKey) return 'Rate the overall natural hazard exposure and effectiveness of controls.';
    const industryConfig = HRG_MASTER_MAP.industries[industryKey];
    return industryConfig?.modules?.[CANONICAL_KEY]?.help_text || 'Rate the overall natural hazard exposure and controls.';
  };

  const getWeight = (): number => {
    if (!industryKey) return HRG_MASTER_MAP.meta.default_weight;
    const industryConfig = HRG_MASTER_MAP.industries[industryKey];
    return industryConfig?.modules?.[CANONICAL_KEY]?.weight || HRG_MASTER_MAP.meta.default_weight;
  };

  const handleRatingChange = async (newRating: number) => {
    if (!riskEngInstanceId) return;

    try {
      const updatedData = setRating(riskEngData, CANONICAL_KEY, newRating);
      const sanitized = sanitizeModuleInstancePayload({ data: updatedData });

      const { error } = await supabase
        .from('module_instances')
        .update({ data: sanitized.data })
        .eq('id', riskEngInstanceId);

      if (error) throw error;

      setRiskEngData(updatedData);
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
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-7 - Natural Hazards</h2>
        <p className="text-slate-600">Natural hazards exposure and controls assessment</p>
      </div>

      <div className="mb-6">
        <ReRatingPanel
          canonicalKey={CANONICAL_KEY}
          industryKey={industryKey}
          rating={rating}
          onChangeRating={handleRatingChange}
          helpText={getHelpText()}
          weight={getWeight()}
        />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Natural Hazards Assessment</h3>
        <p className="text-sm text-slate-600 mb-4">
          Document the natural hazards at this location (flood, earthquake, wildfire, storm, lightning, subsidence, etc.) and the controls in place to mitigate them.
        </p>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Assessment Notes</label>
          <textarea
            value={formData.natural_hazards_notes}
            onChange={(e) => setFormData({ ...formData, natural_hazards_notes: e.target.value })}
            rows={10}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            placeholder="Document natural hazards exposure and mitigation measures. Consider: flood risk, seismic activity, wildfire exposure, storm/wind risk, lightning protection, ground stability, and any other relevant natural hazards for this location..."
          />
        </div>
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
