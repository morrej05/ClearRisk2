import { useState } from 'react';
import { DoorOpen, CheckCircle, Plus } from 'lucide-react';
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

interface FSD3MeansOfEscapeDesignFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface QuickActionTemplate {
  action: string;
  likelihood: number;
  impact: number;
}

export default function FSD3MeansOfEscapeDesignForm({
  moduleInstance,
  document,
  onSaved,
}: FSD3MeansOfEscapeDesignFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [quickActionTemplate, setQuickActionTemplate] = useState<QuickActionTemplate | null>(null);

  const [formData, setFormData] = useState({
    travel_distance_basis: moduleInstance.data.travel_distance_basis || 'unknown',
    travel_distance_limits_summary: moduleInstance.data.travel_distance_limits_summary || '',
    exit_capacity_calculation_done: moduleInstance.data.exit_capacity_calculation_done || 'unknown',
    exit_widths_summary: moduleInstance.data.exit_widths_summary || '',
    number_of_exits_per_storey: moduleInstance.data.number_of_exits_per_storey || '',
    stairs_strategy: moduleInstance.data.stairs_strategy || 'unknown',
    stairs_strategy_notes: moduleInstance.data.stairs_strategy_notes || '',
    disabled_evacuation_assumptions: moduleInstance.data.disabled_evacuation_assumptions || '',
    final_exit_security_strategy: moduleInstance.data.final_exit_security_strategy || '',
    notes: moduleInstance.data.notes || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const getSuggestedOutcome = (): { outcome: string; reason: string } | null => {
    const unknowns = [
      formData.travel_distance_basis === 'unknown',
      formData.exit_capacity_calculation_done === 'unknown' || formData.exit_capacity_calculation_done === 'no',
      formData.stairs_strategy === 'unknown',
      !formData.disabled_evacuation_assumptions || formData.disabled_evacuation_assumptions.trim().length < 20,
    ].filter(Boolean).length;

    if (formData.exit_capacity_calculation_done === 'no' || formData.exit_capacity_calculation_done === 'unknown') {
      return {
        outcome: 'material_def',
        reason: 'Exit capacity calculations not completed - critical for design basis',
      };
    }

    if (unknowns >= 3) {
      return {
        outcome: 'info_gap',
        reason: `${unknowns} key escape design parameters unknown`,
      };
    }

    if (!formData.disabled_evacuation_assumptions || formData.disabled_evacuation_assumptions.trim().length < 20) {
      return {
        outcome: 'material_def',
        reason: 'Assisted evacuation assumptions not defined',
      };
    }

    if (unknowns >= 1) {
      return {
        outcome: 'minor_def',
        reason: 'Some escape design details require clarification',
      };
    }

    return {
      outcome: 'compliant',
      reason: 'Escape design adequately documented',
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
      console.error('Error saving FSD-3 module:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAction = (template: QuickActionTemplate) => {
    setQuickActionTemplate(template);
    setShowActionModal(true);
  };

  const exitCalcNotDone = formData.exit_capacity_calculation_done === 'no' || formData.exit_capacity_calculation_done === 'unknown';
  const singleStair = formData.stairs_strategy.toLowerCase().includes('single');
  const disabledAssumptionsWeak = !formData.disabled_evacuation_assumptions || formData.disabled_evacuation_assumptions.trim().length < 20;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <DoorOpen className="w-6 h-6 text-neutral-700" />
          <h2 className="text-2xl font-bold text-neutral-900">
            FSD-3 - Means of Escape (Design)
          </h2>
        </div>
        <p className="text-neutral-600">
          Define escape design basis including travel distances, exit capacity, and stairs strategy
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
        {/* Travel Distances */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Travel Distance Design
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Travel Distance Basis
              </label>
              <select
                value={formData.travel_distance_basis}
                onChange={(e) => setFormData({ ...formData, travel_distance_basis: e.target.value })}
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
                Travel Distance Limits Summary
              </label>
              <textarea
                value={formData.travel_distance_limits_summary}
                onChange={(e) => setFormData({ ...formData, travel_distance_limits_summary: e.target.value })}
                placeholder="Summarize maximum travel distances for the building (e.g., single direction 18m, multiple directions 45m, etc.)"
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>
          </div>
        </div>

        {/* Exit Capacity */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Exit Capacity & Width
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Exit Capacity Calculation Completed?
              </label>
              <select
                value={formData.exit_capacity_calculation_done}
                onChange={(e) => setFormData({ ...formData, exit_capacity_calculation_done: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - calculations complete</option>
                <option value="no">No - not yet calculated</option>
              </select>
            </div>

            {exitCalcNotDone && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Complete exit capacity and width calculations and record results (design basis).',
                    likelihood: 4,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Complete exit capacity calculations (Critical)
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Exit Widths Summary
              </label>
              <textarea
                value={formData.exit_widths_summary}
                onChange={(e) => setFormData({ ...formData, exit_widths_summary: e.target.value })}
                placeholder="Summarize exit widths and capacity (e.g., minimum 1050mm doors, stairs 1200mm effective width, etc.)"
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Number of Exits per Storey
              </label>
              <input
                type="text"
                value={formData.number_of_exits_per_storey}
                onChange={(e) => setFormData({ ...formData, number_of_exits_per_storey: e.target.value })}
                placeholder="e.g., 2 exits per floor, 3 exits at ground floor"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Stairs Strategy */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Escape Stairs Strategy
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Stairs Strategy
              </label>
              <select
                value={formData.stairs_strategy}
                onChange={(e) => setFormData({ ...formData, stairs_strategy: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="single_stair">Single Stair</option>
                <option value="multiple_stairs">Multiple Stairs</option>
                <option value="protected_lobbies">Protected Lobbies</option>
                <option value="mixed">Mixed Strategy</option>
              </select>
            </div>

            {singleStair && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Review escape stair strategy against current requirements and document compliance approach.',
                    likelihood: 4,
                    impact: 5,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Review single stair strategy (Critical)
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Stairs Strategy Notes
              </label>
              <textarea
                value={formData.stairs_strategy_notes}
                onChange={(e) => setFormData({ ...formData, stairs_strategy_notes: e.target.value })}
                placeholder="Provide details about stair protection, separation, lobbies, and any special provisions"
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>
          </div>
        </div>

        {/* Disabled Evacuation */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Assisted Evacuation Design
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Assisted Evacuation Design Assumptions
              </label>
              <textarea
                value={formData.disabled_evacuation_assumptions}
                onChange={(e) => setFormData({ ...formData, disabled_evacuation_assumptions: e.target.value })}
                placeholder="Define design assumptions for assisted evacuation (refuges, evacuation lifts, management procedures, PEEP dependencies, etc.)"
                rows={4}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>

            {disabledAssumptionsWeak && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Define assisted evacuation assumptions (refuges/evac lifts/management) and align to A3.',
                    likelihood: 4,
                    impact: 5,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Define assisted evacuation assumptions (Critical)
              </button>
            )}
          </div>
        </div>

        {/* Final Exit Strategy */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Final Exit & Security
          </h3>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Final Exit & Security Strategy
            </label>
            <textarea
              value={formData.final_exit_security_strategy}
              onChange={(e) => setFormData({ ...formData, final_exit_security_strategy: e.target.value })}
              placeholder="Describe final exit arrangements, security interfaces, fail-safe provisions, and assembly points"
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
            placeholder="Add any additional observations about escape design, calculations, or special considerations..."
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
