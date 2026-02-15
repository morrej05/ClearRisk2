import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import { getActionsRefreshKey } from '../../../utils/actionsRefreshKey';
import AutoExpandTextarea from '../../AutoExpandTextarea';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';

interface ModuleInstance { id: string; outcome: string | null; assessor_notes: string; data: Record<string, any>; }
interface Document { id: string; title: string; }
interface Props { moduleInstance: ModuleInstance; document: Document; onSaved: () => void; }

export default function DSEAR11ExplosionEmergencyResponseForm({ moduleInstance, document, onSaved }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const actionsRefreshKey = getActionsRefreshKey(document.id, moduleInstance.id);
  const [scenarios, setScenarios] = useState(moduleInstance.data.explosion_scenarios_considered || '');
  const [shutdownProcs, setShutdownProcs] = useState(moduleInstance.data.emergency_shutdown_procedures || '');
  const [isolation, setIsolation] = useState(moduleInstance.data.isolation_arrangements || '');
  const [emergencyInfo, setEmergencyInfo] = useState(moduleInstance.data.emergency_services_information || '');
  const [drills, setDrills] = useState(moduleInstance.data.drills_and_training || '');
  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const getSuggestedOutcome = () => {
    if (shutdownProcs === 'unknown' || drills === 'unknown') return 'info_gap';
    if (shutdownProcs === 'no' || drills === 'no') return 'material_def';
    return 'compliant';
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = sanitizeModuleInstancePayload({ data: { explosion_scenarios_considered: scenarios, emergency_shutdown_procedures: shutdownProcs, isolation_arrangements: isolation, emergency_services_information: emergencyInfo, drills_and_training: drills }, outcome, assessor_notes: assessorNotes, updated_at: new Date().toISOString() });
      const { error } = await supabase.from('module_instances').update(payload).eq('id', moduleInstance.id);
      if (error) throw error;
      setLastSaved(new Date().toLocaleTimeString());
      onSaved();
    } catch (error) { console.error('Error:', error); alert('Failed to save.'); } finally { setIsSaving(false); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">DSEAR-11 - Explosion Emergency Response</h2>
        <p className="text-neutral-600">Document arrangements for responding to explosion incidents</p>
        {lastSaved && <div className="flex items-center gap-2 mt-2 text-sm text-green-700"><CheckCircle className="w-4 h-4" />Last saved at {lastSaved}</div>}
      </div>
      <div className="space-y-4 mb-6">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Explosion Scenarios Considered</label><AutoExpandTextarea value={scenarios} onChange={(e) => setScenarios(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="e.g., Dust explosion in extraction system, vapour cloud ignition" /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Emergency Shutdown Procedures in Place?</label><select value={shutdownProcs} onChange={(e) => setShutdownProcs(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option></select></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Isolation Arrangements</label><AutoExpandTextarea value={isolation} onChange={(e) => setIsolation(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="e.g., Emergency stop buttons, isolation valves, electrical isolation" /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Emergency Services Information Provided?</label><select value={emergencyInfo} onChange={(e) => setEmergencyInfo(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option></select></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Emergency Drills & Training in Place?</label><select value={drills} onChange={(e) => setDrills(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option></select></div>
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
