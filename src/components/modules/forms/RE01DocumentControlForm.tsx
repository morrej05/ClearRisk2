import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import { HRG_MASTER_MAP, humanizeIndustryKey } from '../../../lib/re/reference/hrgMasterMap';
import { ensureRatingsObject } from '../../../lib/re/scoring/riskEngineeringHelpers';

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

interface RE01DocumentControlFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

export default function RE01DocumentControlForm({
  moduleInstance,
  document,
  onSaved,
}: RE01DocumentControlFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const d = moduleInstance.data || {};

  const [formData, setFormData] = useState({
    assessor: d.assessor || { name: '', role: '', company: '' },
    attendance: d.attendance || { met_onsite_with: '', present_during_survey: '' },
    dates: d.dates || { assessment_date: null, review_date: null },
    client_site: d.client_site || { client: '', site: '', address: '', country: '' },
    scope: d.scope || { scope_description: '', limitations_assumptions: '' },
    reference_documents_reviewed: d.reference_documents_reviewed || [],
  });

  const [riskEngInstanceId, setRiskEngInstanceId] = useState<string | null>(null);
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
          setIndustryKey(instances.data?.industry_key || null);
        }
      } catch (err) {
        console.error('Error loading RISK_ENGINEERING module:', err);
      }
    }

    loadRiskEngModule();
  }, [moduleInstance.document_id]);

  const handleIndustryChange = async (newIndustryKey: string) => {
    if (!riskEngInstanceId) return;

    try {
      const { data: current, error: fetchError } = await supabase
        .from('module_instances')
        .select('data')
        .eq('id', riskEngInstanceId)
        .single();

      if (fetchError) throw fetchError;

      const ensured = ensureRatingsObject({ ...current?.data, industry_key: newIndustryKey });

      const { error: updateError } = await supabase
        .from('module_instances')
        .update({ data: ensured })
        .eq('id', riskEngInstanceId);

      if (updateError) throw updateError;

      setIndustryKey(newIndustryKey);
    } catch (err) {
      console.error('Error updating industry key:', err);
      alert('Failed to update industry classification');
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
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-1 - Document Control</h2>
        <p className="text-slate-600">Survey metadata and document control information</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Industry Classification</h3>
          <p className="text-sm text-slate-600 mb-3">
            Select the industry type for this site. This determines the risk weighting factors applied across all assessment modules.
          </p>
          <div className="max-w-md">
            <select
              value={industryKey || ''}
              onChange={(e) => handleIndustryChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">Select Industry...</option>
              {Object.keys(HRG_MASTER_MAP.industries).map((key) => (
                <option key={key} value={key}>
                  {humanizeIndustryKey(key)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Assessor</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.assessor.name}
                onChange={(e) => setFormData({ ...formData, assessor: { ...formData.assessor, name: e.target.value } })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <input
                type="text"
                value={formData.assessor.role}
                onChange={(e) => setFormData({ ...formData, assessor: { ...formData.assessor, role: e.target.value } })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
              <input
                type="text"
                value={formData.assessor.company}
                onChange={(e) => setFormData({ ...formData, assessor: { ...formData.assessor, company: e.target.value } })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Client & Site</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client</label>
              <input
                type="text"
                value={formData.client_site.client}
                onChange={(e) => setFormData({ ...formData, client_site: { ...formData.client_site, client: e.target.value } })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Site</label>
              <input
                type="text"
                value={formData.client_site.site}
                onChange={(e) => setFormData({ ...formData, client_site: { ...formData.client_site, site: e.target.value } })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <textarea
                value={formData.client_site.address}
                onChange={(e) => setFormData({ ...formData, client_site: { ...formData.client_site, address: e.target.value } })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Scope</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Scope Description</label>
              <textarea
                value={formData.scope.scope_description}
                onChange={(e) => setFormData({ ...formData, scope: { ...formData.scope, scope_description: e.target.value } })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Limitations & Assumptions</label>
              <textarea
                value={formData.scope.limitations_assumptions}
                onChange={(e) => setFormData({ ...formData, scope: { ...formData.scope, limitations_assumptions: e.target.value } })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>
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
  );
}
