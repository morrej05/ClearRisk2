import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';

interface Document {
  id: string;
  title: string;
}

interface ModuleInstance {
  id: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
}

interface RE12LossValuesFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

export default function RE12LossValuesForm({
  moduleInstance,
  document,
  onSaved,
}: RE12LossValuesFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const d = moduleInstance.data || {};

  const [formData, setFormData] = useState({
    currency: d.currency || 'GBP',
    property_sums_insured: d.property_sums_insured || { breakdown: [], total: null },
    business_interruption: d.business_interruption || {
      gross_profit: null,
      indemnity_period_months: null,
      dependencies: [],
    },
    worst_case_le: d.worst_case_le || { scenario_description: '', calc_table: [] },
    normal_loss_expectancy: d.normal_loss_expectancy || { scenario_description: '', calc_table: [] },
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

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
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-8 - Loss & Values</h2>
        <p className="text-slate-600">Loss expectancy calculations and valuation data</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Currency</h3>
          <div className="max-w-xs">
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="GBP">GBP (£)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="AUD">AUD (A$)</option>
              <option value="CAD">CAD (C$)</option>
            </select>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Property Sums Insured</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Total Property Value</label>
            <input
              type="number"
              value={formData.property_sums_insured.total || ''}
              onChange={(e) => setFormData({
                ...formData,
                property_sums_insured: {
                  ...formData.property_sums_insured,
                  total: e.target.value ? parseFloat(e.target.value) : null
                }
              })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              placeholder="Total property value"
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Business Interruption</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Gross Profit (Annual)</label>
              <input
                type="number"
                value={formData.business_interruption.gross_profit || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  business_interruption: {
                    ...formData.business_interruption,
                    gross_profit: e.target.value ? parseFloat(e.target.value) : null
                  }
                })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Indemnity Period (Months)</label>
              <input
                type="number"
                value={formData.business_interruption.indemnity_period_months || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  business_interruption: {
                    ...formData.business_interruption,
                    indemnity_period_months: e.target.value ? parseInt(e.target.value) : null
                  }
                })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Worst Case Loss Expectancy</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Scenario Description</label>
            <textarea
              value={formData.worst_case_le.scenario_description}
              onChange={(e) => setFormData({
                ...formData,
                worst_case_le: { ...formData.worst_case_le, scenario_description: e.target.value }
              })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              placeholder="Describe the worst-case loss scenario and assumptions"
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Normal Loss Expectancy (NLE)</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Scenario Description</label>
            <textarea
              value={formData.normal_loss_expectancy.scenario_description}
              onChange={(e) => setFormData({
                ...formData,
                normal_loss_expectancy: { ...formData.normal_loss_expectancy, scenario_description: e.target.value }
              })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              placeholder="Describe the normal/expected loss scenario with fire protection credited"
            />
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
