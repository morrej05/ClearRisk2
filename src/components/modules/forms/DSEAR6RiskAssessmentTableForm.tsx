import { useState } from 'react';
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import { getActionsRefreshKey } from '../../../utils/actionsRefreshKey';
import AutoExpandTextarea from '../../AutoExpandTextarea';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';

interface RiskRow {
  activity: string;
  hazard: string;
  persons_at_risk: string;
  existing_controls: string;
  likelihood?: string;
  severity?: string;
  residual_risk?: string;
  additional_controls: string;
  residualRiskBand: string;
  rationale?: string;
}

interface ModuleInstance { id: string; module_key: string; outcome: string | null; assessor_notes: string; data: Record<string, any>; }
interface Document { id: string; title: string; }
interface Props { moduleInstance: ModuleInstance; document: Document; onSaved: () => void; }

const emptyRiskRow = (): RiskRow => ({
  activity: '',
  hazard: '',
  persons_at_risk: '',
  existing_controls: '',
  additional_controls: '',
  residualRiskBand: '',
  rationale: ''
});

const migrateLegacyRiskRow = (row: any): RiskRow => {
  if (row.residualRiskBand) {
    return row as RiskRow;
  }

  let band = '';

  if (row.residual_risk) {
    const riskValue = row.residual_risk.toLowerCase();
    if (riskValue === 'high') band = 'High';
    else if (riskValue === 'medium') band = 'Moderate';
    else if (riskValue === 'low') band = 'Low';
  } else if (row.likelihood && row.severity) {
    const likelihoodMap: Record<string, number> = {
      very_low: 1, low: 2, medium: 3, high: 4, very_high: 5
    };
    const severityMap: Record<string, number> = {
      minor: 1, low: 2, moderate: 3, major: 4, catastrophic: 5
    };

    const L = likelihoodMap[row.likelihood] || 0;
    const S = severityMap[row.severity] || 0;
    const score = L * S;

    if (score >= 16) band = 'Critical';
    else if (score >= 10) band = 'High';
    else if (score >= 5) band = 'Moderate';
    else if (score >= 1) band = 'Low';
  }

  return {
    ...row,
    residualRiskBand: band,
    rationale: row.rationale || ''
  };
};

export default function DSEAR6RiskAssessmentTableForm({ moduleInstance, document, onSaved }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const actionsRefreshKey = getActionsRefreshKey(document.id, moduleInstance.id);

  const migratedRows = moduleInstance.data.risk_rows?.length > 0
    ? moduleInstance.data.risk_rows.map(migrateLegacyRiskRow)
    : [emptyRiskRow()];

  const [riskRows, setRiskRows] = useState<RiskRow[]>(migratedRows);
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
    const hasCritical = riskRows.some(r => r.activity && r.residualRiskBand === 'Critical');
    if (hasCritical) return 'material_def';

    const hasHigh = riskRows.some(r => r.activity && r.residualRiskBand === 'High');
    if (hasHigh) return 'material_def';

    const hasModerate = riskRows.some(r => r.activity && r.residualRiskBand === 'Moderate');
    if (hasModerate) return 'minor_def';

    return 'compliant';
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = sanitizeModuleInstancePayload({ data: { risk_rows: riskRows }, outcome, assessor_notes: assessorNotes, updated_at: new Date().toISOString() }, moduleInstance.module_key);
      console.log('MODULE SAVE PAYLOAD', JSON.parse(JSON.stringify(payload)));
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
              <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Additional Controls Required</label><AutoExpandTextarea value={row.additional_controls} onChange={(e) => updateRiskRow(index, 'additional_controls', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Residual Risk Band</label>
                <select value={row.residualRiskBand} onChange={(e) => updateRiskRow(index, 'residualRiskBand', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="">Select...</option>
                  <option value="Low">Low (tolerable with routine controls)</option>
                  <option value="Moderate">Moderate (improvement recommended)</option>
                  <option value="High">High (significant improvement required)</option>
                  <option value="Critical">Critical (urgent / compliance-critical)</option>
                </select>
                {row.residualRiskBand && (
                  <div className="mt-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      row.residualRiskBand === 'Critical' ? 'bg-red-100 text-red-800 border border-red-200' :
                      row.residualRiskBand === 'High' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                      row.residualRiskBand === 'Moderate' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      'bg-green-100 text-green-800 border border-green-200'
                    }`}>
                      {row.residualRiskBand}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Band (Optional)</label>
                <input type="text" value={row.rationale || ''} onChange={(e) => updateRiskRow(index, 'rationale', e.target.value)} placeholder="Brief justification..." maxLength={200} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                {row.rationale && (
                  <p className="text-xs text-gray-600 mt-1 italic">{row.rationale}</p>
                )}
              </div>
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
