import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import AutoExpandTextarea from '../../AutoExpandTextarea';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';

interface ModuleInstance { id: string; outcome: string | null; assessor_notes: string; data: Record<string, any>; }
interface Document { id: string; title: string; }
interface Props { moduleInstance: ModuleInstance; document: Document; onSaved: () => void; }

export default function DSEAR10HierarchyControlForm({ moduleInstance, document, onSaved }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [substitutionConsidered, setSubstitutionConsidered] = useState(moduleInstance.data.substitution_considered || '');
  const [eliminationPossible, setEliminationPossible] = useState(moduleInstance.data.elimination_possible || '');
  const [engineeringControls, setEngineeringControls] = useState(moduleInstance.data.engineering_controls || '');
  const [administrativeControls, setAdministrativeControls] = useState(moduleInstance.data.administrative_controls || '');
  const [ppeControls, setPpeControls] = useState(moduleInstance.data.PPE_controls || '');
  const [justification, setJustification] = useState(moduleInstance.data.justification_for_retained_risk || '');
  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const getSuggestedOutcome = () => {
    if (substitutionConsidered === 'unknown') return 'info_gap';
    if (eliminationPossible === 'yes' && !justification) return 'material_def';
    return 'compliant';
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('module_instances').update({ data: { substitution_considered: substitutionConsidered, elimination_possible: eliminationPossible, engineering_controls: engineeringControls, administrative_controls: administrativeControls, PPE_controls: ppeControls, justification_for_retained_risk: justification }, outcome, assessor_notes: assessorNotes, updated_at: new Date().toISOString() }).eq('id', moduleInstance.id);
      if (error) throw error;
      setLastSaved(new Date().toLocaleTimeString());
      onSaved();
    } catch (error) { console.error('Error:', error); alert('Failed to save.'); } finally { setIsSaving(false); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">DSEAR-10 - Hierarchy of Control</h2>
        <p className="text-neutral-600">Apply the hierarchy of control to minimize explosion risk</p>
        {lastSaved && <div className="flex items-center gap-2 mt-2 text-sm text-green-700"><CheckCircle className="w-4 h-4" />Last saved at {lastSaved}</div>}
      </div>
      <div className="space-y-6 mb-6">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">1. Elimination & Substitution</h4>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Has substitution been considered?</label><select value={substitutionConsidered} onChange={(e) => setSubstitutionConsidered(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option></select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Is elimination possible?</label><select value={eliminationPossible} onChange={(e) => setEliminationPossible(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option></select></div>
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">2. Engineering Controls</h4>
          <AutoExpandTextarea value={engineeringControls} onChange={(e) => setEngineeringControls(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="e.g., Closed transfer systems, LEV, inerting, venting" />
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">3. Administrative Controls</h4>
          <AutoExpandTextarea value={administrativeControls} onChange={(e) => setAdministrativeControls(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="e.g., Hot work permits, training, procedures" />
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">4. PPE (Lowest Level)</h4>
          <AutoExpandTextarea value={ppeControls} onChange={(e) => setPpeControls(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="e.g., Conductive footwear, flame-resistant clothing" />
        </div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Justification for Retained Risk (ALARP)</label><AutoExpandTextarea value={justification} onChange={(e) => setJustification(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Explain why further risk reduction is not reasonably practicable" /></div>
      </div>
      <OutcomePanel outcome={outcome} assessorNotes={assessorNotes} onOutcomeChange={setOutcome} onNotesChange={setAssessorNotes} onSave={handleSave} isSaving={isSaving} suggestedOutcome={getSuggestedOutcome()} />
      <ModuleActions documentId={document.id} moduleInstanceId={moduleInstance.id} />
    </div>
  );
}
