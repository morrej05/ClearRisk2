import { useState } from 'react';
import { Shield, CheckCircle, Plus } from 'lucide-react';
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

interface FSD4PassiveFireProtectionFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface QuickActionTemplate {
  action: string;
  likelihood: number;
  impact: number;
}

export default function FSD4PassiveFireProtectionForm({
  moduleInstance,
  document,
  onSaved,
}: FSD4PassiveFireProtectionFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [quickActionTemplate, setQuickActionTemplate] = useState<QuickActionTemplate | null>(null);

  const [formData, setFormData] = useState({
    structural_fire_resistance_minutes: moduleInstance.data.structural_fire_resistance_minutes || '',
    compartmentation_strategy: moduleInstance.data.compartmentation_strategy || '',
    compartmentation_standard: moduleInstance.data.compartmentation_standard || 'unknown',
    fire_door_ratings: moduleInstance.data.fire_door_ratings || '',
    cavity_barriers_strategy: moduleInstance.data.cavity_barriers_strategy || '',
    internal_lining_classifications: moduleInstance.data.internal_lining_classifications || 'unknown',
    internal_lining_notes: moduleInstance.data.internal_lining_notes || '',
    penetrations_fire_stopping_strategy: moduleInstance.data.penetrations_fire_stopping_strategy || '',
    facade_considerations: moduleInstance.data.facade_considerations || '',
    notes: moduleInstance.data.notes || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const getSuggestedOutcome = (): { outcome: string; reason: string } | null => {
    const unknowns = [
      formData.structural_fire_resistance_minutes === '' || formData.structural_fire_resistance_minutes === 'unknown',
      formData.compartmentation_strategy === '' || formData.compartmentation_strategy.trim().length < 20,
      formData.compartmentation_standard === 'unknown',
      formData.cavity_barriers_strategy === '' || formData.cavity_barriers_strategy === 'unknown',
    ].filter(Boolean).length;

    if (unknowns >= 3) {
      return {
        outcome: 'info_gap',
        reason: `${unknowns} key passive protection fields unknown`,
      };
    }

    if (!formData.compartmentation_strategy || formData.compartmentation_strategy.trim().length < 20) {
      return {
        outcome: 'material_def',
        reason: 'Compartmentation strategy must be defined for fire strategy',
      };
    }

    if (unknowns >= 1) {
      return {
        outcome: 'minor_def',
        reason: 'Some passive protection details require clarification',
      };
    }

    return {
      outcome: 'compliant',
      reason: 'Passive protection strategy adequately defined',
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
      console.error('Error saving FSD-4 module:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAction = (template: QuickActionTemplate) => {
    setQuickActionTemplate(template);
    setShowActionModal(true);
  };

  const structuralUnknown = formData.structural_fire_resistance_minutes === '' || formData.structural_fire_resistance_minutes === 'unknown';
  const compartmentationWeak = !formData.compartmentation_strategy || formData.compartmentation_strategy.trim().length < 20;
  const cavityBarriersUnknown = formData.cavity_barriers_strategy === '' || formData.cavity_barriers_strategy === 'unknown';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-6 h-6 text-neutral-700" />
          <h2 className="text-2xl font-bold text-neutral-900">
            FSD-4 - Passive Fire Protection
          </h2>
        </div>
        <p className="text-neutral-600">
          Define structural fire resistance, compartmentation, and passive protection strategy
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
        {/* Structural Fire Resistance */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Structural Fire Resistance
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Required Fire Resistance (minutes)
              </label>
              <input
                type="text"
                value={formData.structural_fire_resistance_minutes}
                onChange={(e) => setFormData({ ...formData, structural_fire_resistance_minutes: e.target.value })}
                placeholder="e.g., 60, 90, 120 or unknown"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Based on building height, use, and applicable guidance
              </p>
            </div>

            {structuralUnknown && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Confirm structural fire resistance assumptions and supporting evidence.',
                    likelihood: 3,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Confirm structural fire resistance
              </button>
            )}
          </div>
        </div>

        {/* Compartmentation */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Compartmentation Strategy
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Compartmentation Standard
              </label>
              <select
                value={formData.compartmentation_standard}
                onChange={(e) => setFormData({ ...formData, compartmentation_standard: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="ADB">Approved Document B</option>
                <option value="BS9999">BS 9999</option>
                <option value="engineered">Fire Engineered</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Compartmentation Strategy Description
              </label>
              <textarea
                value={formData.compartmentation_strategy}
                onChange={(e) => setFormData({ ...formData, compartmentation_strategy: e.target.value })}
                placeholder="Describe compartmentation approach (e.g., compartment sizes, sub-division strategy, corridor protection, riser protection, floor-to-floor fire resistance, etc.)"
                rows={4}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>

            {compartmentationWeak && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Define compartmentation strategy (sub-compartments, risers, corridors) and record assumptions.',
                    likelihood: 4,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Define compartmentation strategy
              </button>
            )}
          </div>
        </div>

        {/* Fire Doors */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Fire Doors
          </h3>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Fire Door Ratings Summary
            </label>
            <textarea
              value={formData.fire_door_ratings}
              onChange={(e) => setFormData({ ...formData, fire_door_ratings: e.target.value })}
              placeholder="Summarize fire door ratings (e.g., FD30s for flat entrance doors, FD60 for riser doors, etc.)"
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Cavity Barriers */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Cavity Barriers
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Cavity Barrier Strategy
              </label>
              <textarea
                value={formData.cavity_barriers_strategy}
                onChange={(e) => setFormData({ ...formData, cavity_barriers_strategy: e.target.value })}
                placeholder="Describe cavity barrier strategy (locations, specifications, interface with external wall system, etc.)"
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>

            {cavityBarriersUnknown && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Confirm cavity barrier strategy and interface with external wall system details.',
                    likelihood: 4,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Define cavity barrier strategy
              </button>
            )}
          </div>
        </div>

        {/* Internal Linings */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Internal Linings
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Classification System
              </label>
              <select
                value={formData.internal_lining_classifications}
                onChange={(e) => setFormData({ ...formData, internal_lining_classifications: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="EN13501">EN 13501 (European Classes)</option>
                <option value="legacy">Legacy UK Classes (Class 0, 1, etc.)</option>
                <option value="mixed">Mixed / Transitional</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Internal Lining Notes
              </label>
              <textarea
                value={formData.internal_lining_notes}
                onChange={(e) => setFormData({ ...formData, internal_lining_notes: e.target.value })}
                placeholder="Provide notes on internal lining classifications required (e.g., circulation spaces require Class B-s3,d2, other areas less onerous, etc.)"
                rows={2}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>
          </div>
        </div>

        {/* Fire Stopping */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Penetrations & Fire Stopping
          </h3>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Fire Stopping Strategy
            </label>
            <textarea
              value={formData.penetrations_fire_stopping_strategy}
              onChange={(e) => setFormData({ ...formData, penetrations_fire_stopping_strategy: e.target.value })}
              placeholder="Describe fire stopping approach for service penetrations (pipes, cables, ducts) through fire-resisting elements"
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Facade */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Facade Considerations
          </h3>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              External Wall / Facade Notes
            </label>
            <textarea
              value={formData.facade_considerations}
              onChange={(e) => setFormData({ ...formData, facade_considerations: e.target.value })}
              placeholder="Provide high-level facade considerations (detailed external wall assessment should be in FRA-5 or separate EWS appraisal)"
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
            />
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
            placeholder="Add any additional observations about passive fire protection, construction details, or special considerations..."
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
