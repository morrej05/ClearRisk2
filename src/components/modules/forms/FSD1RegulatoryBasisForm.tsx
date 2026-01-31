import { useState } from 'react';
import { FileText, CheckCircle, Plus, X } from 'lucide-react';
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

interface FSD1RegulatoryBasisFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface QuickActionTemplate {
  action: string;
  likelihood: number;
  impact: number;
}

interface Deviation {
  topic: string;
  deviation: string;
  justification: string;
}

export default function FSD1RegulatoryBasisForm({
  moduleInstance,
  document,
  onSaved,
}: FSD1RegulatoryBasisFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [quickActionTemplate, setQuickActionTemplate] = useState<QuickActionTemplate | null>(null);

  const [formData, setFormData] = useState({
    regulatory_framework: moduleInstance.data.regulatory_framework || 'unknown',
    design_objectives: moduleInstance.data.design_objectives || [],
    design_objectives_notes: moduleInstance.data.design_objectives_notes || '',
    life_safety_scope: moduleInstance.data.life_safety_scope || '',
    property_protection_scope: moduleInstance.data.property_protection_scope || 'excluded',
    property_protection_notes: moduleInstance.data.property_protection_notes || '',
    building_reg_control_body: moduleInstance.data.building_reg_control_body || '',
    deviations: moduleInstance.data.deviations || [],
    key_assumptions: moduleInstance.data.key_assumptions || '',
    standards_referenced: moduleInstance.data.standards_referenced || [],
    notes: moduleInstance.data.notes || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const getSuggestedOutcome = (): { outcome: string; reason: string } | null => {
    if (formData.regulatory_framework === 'unknown') {
      return {
        outcome: 'info_gap',
        reason: 'Regulatory framework not defined - cannot proceed with design',
      };
    }

    const deviationsWithoutJustification = formData.deviations.filter(
      (d: Deviation) => !d.justification || d.justification.trim().length < 10
    ).length;

    if (deviationsWithoutJustification >= 2) {
      return {
        outcome: 'material_def',
        reason: `${deviationsWithoutJustification} deviations lack adequate justification`,
      };
    }

    if (deviationsWithoutJustification >= 1) {
      return {
        outcome: 'minor_def',
        reason: 'Some deviations require better justification',
      };
    }

    if (!formData.key_assumptions || formData.key_assumptions.trim().length < 50) {
      return {
        outcome: 'minor_def',
        reason: 'Key design assumptions should be documented',
      };
    }

    return {
      outcome: 'compliant',
      reason: 'Regulatory basis adequately defined',
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
      console.error('Error saving FSD-1 module:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAction = (template: QuickActionTemplate) => {
    setQuickActionTemplate(template);
    setShowActionModal(true);
  };

  const handleObjectiveToggle = (objective: string) => {
    const updated = formData.design_objectives.includes(objective)
      ? formData.design_objectives.filter((o: string) => o !== objective)
      : [...formData.design_objectives, objective];
    setFormData({ ...formData, design_objectives: updated });
  };

  const handleStandardToggle = (standard: string) => {
    const updated = formData.standards_referenced.includes(standard)
      ? formData.standards_referenced.filter((s: string) => s !== standard)
      : [...formData.standards_referenced, standard];
    setFormData({ ...formData, standards_referenced: updated });
  };

  const addDeviation = () => {
    setFormData({
      ...formData,
      deviations: [...formData.deviations, { topic: '', deviation: '', justification: '' }],
    });
  };

  const removeDeviation = (index: number) => {
    const updated = formData.deviations.filter((_: any, i: number) => i !== index);
    setFormData({ ...formData, deviations: updated });
  };

  const updateDeviation = (index: number, field: keyof Deviation, value: string) => {
    const updated = formData.deviations.map((d: Deviation, i: number) =>
      i === index ? { ...d, [field]: value } : d
    );
    setFormData({ ...formData, deviations: updated });
  };

  const frameworkUnknown = formData.regulatory_framework === 'unknown';
  const hasUnjustifiedDeviations = formData.deviations.some(
    (d: Deviation) => d.topic && d.deviation && (!d.justification || d.justification.trim().length < 10)
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-6 h-6 text-neutral-700" />
          <h2 className="text-2xl font-bold text-neutral-900">
            FSD-1 - Regulatory & Design Basis
          </h2>
        </div>
        <p className="text-neutral-600">
          Define compliance framework, design objectives, and key assumptions
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
        {/* Regulatory Framework */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Regulatory Framework
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Primary Compliance Framework
              </label>
              <select
                value={formData.regulatory_framework}
                onChange={(e) => setFormData({ ...formData, regulatory_framework: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="ADB">Approved Document B</option>
                <option value="BS9999">BS 9999</option>
                <option value="BS9991">BS 9991</option>
                <option value="fire_engineered">Fire Engineered Solution</option>
                <option value="other">Other / Mixed</option>
              </select>
            </div>

            {frameworkUnknown && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Confirm compliance framework (ADB vs BS 9999/9991 vs engineered) and record design basis.',
                    likelihood: 3,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Confirm compliance framework
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Building Control Body
              </label>
              <input
                type="text"
                value={formData.building_reg_control_body}
                onChange={(e) => setFormData({ ...formData, building_reg_control_body: e.target.value })}
                placeholder="e.g., Local Authority, Approved Inspector name"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Design Objectives */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Design Objectives
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Select all that apply
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  'Life safety',
                  'Property protection',
                  'Business continuity',
                  'Firefighter safety',
                  'Heritage protection',
                  'Environmental protection',
                  'Other'
                ].map((objective) => (
                  <label key={objective} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.design_objectives.includes(objective)}
                      onChange={() => handleObjectiveToggle(objective)}
                      className="w-4 h-4 text-neutral-900 border-neutral-300 rounded focus:ring-neutral-900"
                    />
                    <span>{objective}</span>
                  </label>
                ))}
              </div>
            </div>

            {formData.design_objectives.includes('Other') && (
              <input
                type="text"
                value={formData.design_objectives_notes}
                onChange={(e) => setFormData({ ...formData, design_objectives_notes: e.target.value })}
                placeholder="Specify other design objectives"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Life Safety Scope
              </label>
              <textarea
                value={formData.life_safety_scope}
                onChange={(e) => setFormData({ ...formData, life_safety_scope: e.target.value })}
                placeholder="Define life safety objectives (e.g., safe evacuation of all occupants, protection of fire service personnel, etc.)"
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Property Protection Scope
              </label>
              <select
                value={formData.property_protection_scope}
                onChange={(e) => setFormData({ ...formData, property_protection_scope: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent mb-2"
              >
                <option value="excluded">Excluded from scope</option>
                <option value="included">Included in design</option>
                <option value="limited">Limited provisions</option>
              </select>
              {formData.property_protection_scope !== 'excluded' && (
                <textarea
                  value={formData.property_protection_notes}
                  onChange={(e) => setFormData({ ...formData, property_protection_notes: e.target.value })}
                  placeholder="Describe property protection objectives and measures"
                  rows={2}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                />
              )}
            </div>
          </div>
        </div>

        {/* Deviations */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-neutral-900">
              Deviations from Guidance
            </h3>
            <button
              onClick={addDeviation}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Deviation
            </button>
          </div>

          {formData.deviations.length === 0 ? (
            <p className="text-sm text-neutral-500 italic">
              No deviations from guidance documented. Click "Add Deviation" if design departs from standard guidance.
            </p>
          ) : (
            <div className="space-y-4">
              {formData.deviations.map((deviation: Deviation, index: number) => (
                <div key={index} className="border border-neutral-200 rounded-lg p-4 bg-neutral-50">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-sm font-bold text-neutral-900">Deviation #{index + 1}</h4>
                    <button
                      onClick={() => removeDeviation(index)}
                      className="text-neutral-400 hover:text-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Topic / Standard
                      </label>
                      <input
                        type="text"
                        value={deviation.topic}
                        onChange={(e) => updateDeviation(index, 'topic', e.target.value)}
                        placeholder="e.g., Travel distance, Stair width, Compartment size"
                        className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Deviation Description
                      </label>
                      <textarea
                        value={deviation.deviation}
                        onChange={(e) => updateDeviation(index, 'deviation', e.target.value)}
                        placeholder="Describe how the design deviates from guidance"
                        rows={2}
                        className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Justification / Compensatory Measures
                      </label>
                      <textarea
                        value={deviation.justification}
                        onChange={(e) => updateDeviation(index, 'justification', e.target.value)}
                        placeholder="Provide justification and any compensatory measures"
                        rows={3}
                        className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasUnjustifiedDeviations && (
            <button
              onClick={() =>
                handleQuickAction({
                  action: 'Provide written justification/evidence for deviations from guidance and capture approvals.',
                  likelihood: 3,
                  impact: 4,
                })
              }
              className="mt-4 flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Quick Add: Justify deviations
            </button>
          )}
        </div>

        {/* Key Assumptions */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Key Design Assumptions
          </h3>
          <textarea
            value={formData.key_assumptions}
            onChange={(e) => setFormData({ ...formData, key_assumptions: e.target.value })}
            placeholder="Document key assumptions underpinning the fire strategy (e.g., occupancy numbers, staffing levels, management arrangements, compartmentation integrity, etc.)"
            rows={5}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
          />
        </div>

        {/* Standards Referenced */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Standards Referenced
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              'BS 9999',
              'BS 9991',
              'BS 5839-1',
              'BS 5266',
              'BS 5499',
              'BS 9251',
              'EN 13501',
              'EN 1363',
              'Other'
            ].map((standard) => (
              <label key={standard} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.standards_referenced.includes(standard)}
                  onChange={() => handleStandardToggle(standard)}
                  className="w-4 h-4 text-neutral-900 border-neutral-300 rounded focus:ring-neutral-900"
                />
                <span>{standard}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Additional Notes
          </h3>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Add any additional observations about the regulatory basis, design objectives, or constraints..."
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

      {document?.id && moduleInstance?.id && (


        <ModuleActions


          key={actionsRefreshKey}


          documentId={document.id}


          moduleInstanceId={moduleInstance.id}


        />


      )}

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
