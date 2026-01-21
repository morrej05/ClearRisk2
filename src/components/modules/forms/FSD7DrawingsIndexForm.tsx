import { useState } from 'react';
import { FileImage, CheckCircle, Plus, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import AddActionModal from '../../actions/AddActionModal';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';

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

interface FSD7DrawingsIndexFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface QuickActionTemplate {
  action: string;
  likelihood: number;
  impact: number;
}

interface Drawing {
  name: string;
  type: string;
  url_or_storage_ref: string;
  notes: string;
}

export default function FSD7DrawingsIndexForm({
  moduleInstance,
  document,
  onSaved,
}: FSD7DrawingsIndexFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [quickActionTemplate, setQuickActionTemplate] = useState<QuickActionTemplate | null>(null);

  const [formData, setFormData] = useState({
    drawings_checklist: moduleInstance.data.drawings_checklist || {
      general_arrangement: false,
      escape_routes: false,
      compartmentation: false,
      fire_doors: false,
      detection_zones: false,
      smoke_control: false,
      firefighting_access: false,
    },
    drawings_uploaded: moduleInstance.data.drawings_uploaded || [],
    notes: moduleInstance.data.notes || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const getSuggestedOutcome = (): { outcome: string; reason: string } | null => {
    const checklist = formData.drawings_checklist;
    const completedItems = Object.values(checklist).filter(Boolean).length;
    const totalItems = Object.keys(checklist).length;
    const completionPercent = (completedItems / totalItems) * 100;

    if (completionPercent < 30) {
      return {
        outcome: 'material_def',
        reason: `Only ${completedItems}/${totalItems} drawing types provided - insufficient for strategy`,
      };
    }

    if (completionPercent < 70) {
      return {
        outcome: 'minor_def',
        reason: `${completedItems}/${totalItems} drawing types provided - some key drawings missing`,
      };
    }

    return {
      outcome: 'compliant',
      reason: 'Drawing index adequately documented',
    };
  };

  const suggestedOutcome = !outcome ? getSuggestedOutcome() : null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = sanitizeModuleInstancePayload({
        data: formData,
        outcome,
        assessor_notes: assessorNotes,
        updated_at: new Date().toISOString(),
      });

      const { error } = await supabase
        .from('module_instances')
        .update(payload)
        .eq('id', moduleInstance.id);

      if (error) throw error;

      const now = new Date().toLocaleTimeString();
      setLastSaved(now);
      onSaved();
    } catch (error) {
      console.error('Error saving FSD-7 module:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAction = (template: QuickActionTemplate) => {
    setQuickActionTemplate(template);
    setShowActionModal(true);
  };

  const handleChecklistToggle = (key: string) => {
    setFormData({
      ...formData,
      drawings_checklist: {
        ...formData.drawings_checklist,
        [key]: !formData.drawings_checklist[key],
      },
    });
  };

  const addDrawing = () => {
    setFormData({
      ...formData,
      drawings_uploaded: [
        ...formData.drawings_uploaded,
        { name: '', type: '', url_or_storage_ref: '', notes: '' },
      ],
    });
  };

  const removeDrawing = (index: number) => {
    const updated = formData.drawings_uploaded.filter((_: any, i: number) => i !== index);
    setFormData({ ...formData, drawings_uploaded: updated });
  };

  const updateDrawing = (index: number, field: keyof Drawing, value: string) => {
    const updated = formData.drawings_uploaded.map((d: Drawing, i: number) =>
      i === index ? { ...d, [field]: value } : d
    );
    setFormData({ ...formData, drawings_uploaded: updated });
  };

  const checklistLabels: Record<string, string> = {
    general_arrangement: 'General Arrangement Plans',
    escape_routes: 'Escape Routes & Travel Distances',
    compartmentation: 'Compartmentation & Fire Separation',
    fire_doors: 'Fire Door Schedules',
    detection_zones: 'Fire Detection Zones',
    smoke_control: 'Smoke Control Layouts',
    firefighting_access: 'Fire Service Access & Facilities',
  };

  const missingItems = Object.entries(formData.drawings_checklist)
    .filter(([_, checked]) => !checked)
    .map(([key, _]) => checklistLabels[key]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FileImage className="w-6 h-6 text-neutral-700" />
          <h2 className="text-2xl font-bold text-neutral-900">
            FSD-7 - Strategy Drawings & Plans
          </h2>
        </div>
        <p className="text-neutral-600">
          Index and reference fire strategy drawings and supporting documentation
        </p>
        {lastSaved && (
          <div className="flex items-center gap-2 mt-2 text-sm text-green-700">
            <CheckCircle className="w-4 h-4" />
            Last saved at {lastSaved}
          </div>
        )}
      </div>

      {suggestedOutcome && !outcome && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h3 className="text-sm font-bold text-amber-900 mb-1">Suggested Outcome</h3>
          <p className="text-sm text-amber-800">
            Based on your responses: <strong>{suggestedOutcome.outcome.replace('_', ' ')}</strong>
          </p>
          <p className="text-xs text-amber-700 mt-1">{suggestedOutcome.reason}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Drawings Checklist */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Required Drawings Checklist
          </h3>
          <div className="space-y-3">
            <p className="text-sm text-neutral-600 mb-4">
              Check off the drawing types that are available or will be provided:
            </p>
            {Object.entries(checklistLabels).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={formData.drawings_checklist[key]}
                  onChange={() => handleChecklistToggle(key)}
                  className="w-5 h-5 text-neutral-900 border-neutral-300 rounded focus:ring-neutral-900"
                />
                <span className="font-medium">{label}</span>
              </label>
            ))}
          </div>

          {missingItems.length > 0 && (
            <button
              onClick={() =>
                handleQuickAction({
                  action: `Provide/update fire strategy drawings for: ${missingItems.join(', ')}.`,
                  likelihood: 3,
                  impact: 4,
                })
              }
              className="mt-4 flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Quick Add: Request missing drawings
            </button>
          )}
        </div>

        {/* Drawings Uploaded/Referenced */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-neutral-900">
              Drawings & Documents Index
            </h3>
            <button
              onClick={addDrawing}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Drawing
            </button>
          </div>

          {formData.drawings_uploaded.length === 0 ? (
            <p className="text-sm text-neutral-500 italic">
              No drawings indexed yet. Click "Add Drawing" to reference drawings and documents.
            </p>
          ) : (
            <div className="space-y-4">
              {formData.drawings_uploaded.map((drawing: Drawing, index: number) => (
                <div key={index} className="border border-neutral-200 rounded-lg p-4 bg-neutral-50">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-sm font-bold text-neutral-900">Drawing #{index + 1}</h4>
                    <button
                      onClick={() => removeDrawing(index)}
                      className="text-neutral-400 hover:text-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          Drawing Name / Number
                        </label>
                        <input
                          type="text"
                          value={drawing.name}
                          onChange={(e) => updateDrawing(index, 'name', e.target.value)}
                          placeholder="e.g., FSD-GA-001 Rev A"
                          className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          Drawing Type
                        </label>
                        <input
                          type="text"
                          value={drawing.type}
                          onChange={(e) => updateDrawing(index, 'type', e.target.value)}
                          placeholder="e.g., General Arrangement, Escape Routes"
                          className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        URL / Reference / Storage Location
                      </label>
                      <input
                        type="text"
                        value={drawing.url_or_storage_ref}
                        onChange={(e) => updateDrawing(index, 'url_or_storage_ref', e.target.value)}
                        placeholder="e.g., SharePoint link, document management ref, file path"
                        className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Notes
                      </label>
                      <textarea
                        value={drawing.notes}
                        onChange={(e) => updateDrawing(index, 'notes', e.target.value)}
                        placeholder="Additional notes about this drawing"
                        rows={2}
                        className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Additional Notes
          </h3>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Add any additional observations about drawings, document management, version control, or special requirements..."
            rows={4}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
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

      <ModuleActions
        documentId={document.id}
        moduleInstanceId={moduleInstance.id}
      />

      {showActionModal && (
        <AddActionModal
          documentId={document.id}
          moduleInstanceId={moduleInstance.id}
          onClose={() => {
            setShowActionModal(false);
            setQuickActionTemplate(null);
          }}
          onActionCreated={() => {
            setShowActionModal(false);
            setQuickActionTemplate(null);
          }}
          defaultAction={quickActionTemplate?.action}
          defaultLikelihood={quickActionTemplate?.likelihood}
          defaultImpact={quickActionTemplate?.impact}
        />
      )}
    </div>
  );
}
