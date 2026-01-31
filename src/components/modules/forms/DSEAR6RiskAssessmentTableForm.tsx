import { useState } from 'react';
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import AutoExpandTextarea from '../../AutoExpandTextarea';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';

interface RiskRow {
  activity: string;
  hazard: string;
  persons_at_risk: string;
  existing_controls: string;
  likelihood: string;
  severity: string;
  additional_controls: string;
  residual_risk: string;
}

interface ModuleInstance { id: string; outcome: string | null; assessor_notes: string; data: Record<string, any>; }
interface Document { id: string; title: string; }
interface Props { moduleInstance: ModuleInstance; document: Document; onSaved: () => void; }

const emptyRiskRow = (): RiskRow => ({ activity: '', hazard: '', persons_at_risk: '', existing_controls: '', likelihood: '', severity: '', additional_controls: '', residual_risk: '' });

export default function DSEAR6RiskAssessmentTableForm({ moduleInstance, document, onSaved }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [riskRows, setRiskRows] = useState<RiskRow[]>(moduleInstance.data.risk_rows?.length > 0 ? moduleInstance.data.risk_rows : [emptyRiskRow()]);
  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const addRiskRow = () => setRiskRows([...riskRows, emptyRiskRow()]);
  const removeRiskRow = (index: number) => setRiskRows(riskRows.filter((_, i) => i !== index));
  const updateRiskRow = (index: number, field: keyof RiskRow, value: string) => {
    const updated = [...riskRows];
    updated[index] = { ...updated[index], [field]: value };
    setRiskRows(updated);
  };

  const getSuggestedOutcome = () => {
    const hasHighRisk = riskRows.some(r => r.activity && r.residual_risk === 'high');
    if (hasHighRisk) return 'material_def';
    const hasMediumRisk = riskRows.some(r => r.activity && r.residual_risk === 'medium');
    if (hasMediumRisk) return 'acceptable';
    return 'compliant';
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = sanitizeModuleInstancePayload({ data: { risk_rows: riskRows }, outcome, assessor_notes: assessorNotes, updated_at: new Date().toISOString() });
      const { error } = await supabase.from('module_instances').update(payload).eq('id', moduleInstance.id);
      if (error) throw error;
      setLastSaved(new Date().toLocaleTimeString());
      onSaved();
    } catch (error) { console.error('Error:', error); alert('Failed to save.'); } finally { setIsSaving(false); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">DSEAR-6 - Risk Assessment Table</h2>
        <p className="text-neutral-600">Formal risk assessment (Regulation 5 DSEAR)</p>
        {lastSaved && <div className="flex items-center gap-2 mt-2 text-sm text-green-700"><CheckCircle className="w-4 h-4" />Last saved at {lastSaved}</div>}
      </div>
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Risk Assessment (Reg 5)</h3>
          <button onClick={addRiskRow} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4" />Add Risk Row</button>
        </div>
        {riskRows.map((row, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4 bg-white">
            <div className="flex items-start justify-between">
              <h4 className="font-semibold text-gray-900">Risk {index + 1}</h4>
              {riskRows.length > 1 && <button onClick={() => removeRiskRow(index)} className="text-red-600 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Activity/Task</label><input type="text" value={row.activity} onChange={(e) => updateRiskRow(index, 'activity', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Explosion Hazard</label><input type="text" value={row.hazard} onChange={(e) => updateRiskRow(index, 'hazard', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Persons at Risk</label><input type="text" value={row.persons_at_risk} onChange={(e) => updateRiskRow(index, 'persons_at_risk', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
              <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Existing Controls</label><AutoExpandTextarea value={row.existing_controls} onChange={(e) => updateRiskRow(index, 'existing_controls', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Likelihood</label><select value={row.likelihood} onChange={(e) => updateRiskRow(index, 'likelihood', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="">Select...</option><option value="very_low">Very Low (1)</option><option value="low">Low (2)</option><option value="medium">Medium (3)</option><option value="high">High (4)</option><option value="very_high">Very High (5)</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Severity</label><select value={row.severity} onChange={(e) => updateRiskRow(index, 'severity', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="">Select...</option><option value="minor">Minor (1)</option><option value="low">Low (2)</option><option value="moderate">Moderate (3)</option><option value="major">Major (4)</option><option value="catastrophic">Catastrophic (5)</option></select></div>
              <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Additional Controls Required</label><AutoExpandTextarea value={row.additional_controls} onChange={(e) => updateRiskRow(index, 'additional_controls', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Residual Risk</label><select value={row.residual_risk} onChange={(e) => updateRiskRow(index, 'residual_risk', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="">Select...</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
            </div>
          </div>
        ))}
      </div>
      <OutcomePanel outcome={outcome} assessorNotes={assessorNotes} onOutcomeChange={setOutcome} onNotesChange={setAssessorNotes} onSave={handleSave} isSaving={isSaving} suggestedOutcome={getSuggestedOutcome()} />
      {document?.id && moduleInstance?.id && (

        <ModuleActions

          key={actionsRefreshKey}

          documentId={document.id}

          moduleInstanceId={moduleInstance.id}

        />

      )}
    </div>
  );
}
