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

interface FRA2MeansOfEscapeFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface QuickActionTemplate {
  action: string;
  likelihood: number;
  impact: number;
}

export default function FRA2MeansOfEscapeForm({
  moduleInstance,
  document,
  onSaved,
}: FRA2MeansOfEscapeFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [quickActionTemplate, setQuickActionTemplate] = useState<QuickActionTemplate | null>(null);

  const [formData, setFormData] = useState({
    escape_strategy_current: moduleInstance.data.escape_strategy_current || 'unknown',
    escape_routes_description: moduleInstance.data.escape_routes_description || '',
    travel_distances_compliant: moduleInstance.data.travel_distances_compliant || 'unknown',
    final_exits_adequate: moduleInstance.data.final_exits_adequate || 'unknown',
    escape_route_obstructions: moduleInstance.data.escape_route_obstructions || 'unknown',
    stair_protection_status: moduleInstance.data.stair_protection_status || 'unknown',
    inner_rooms_present: moduleInstance.data.inner_rooms_present || 'unknown',
    basement_present: moduleInstance.data.basement_present || 'unknown',
    exit_signage_adequacy: moduleInstance.data.exit_signage_adequacy || 'unknown',
    emergency_lighting_dependency: moduleInstance.data.emergency_lighting_dependency || 'unknown',
    disabled_egress_arrangements: moduleInstance.data.disabled_egress_arrangements || 'unknown',
    notes: moduleInstance.data.notes || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const getSuggestedOutcome = (): { outcome: string; reason: string } | null => {
    const unknowns = Object.entries(formData).filter(
      ([key, value]) => value === 'unknown' && !key.includes('notes') && !key.includes('description')
    ).length;

    if (unknowns >= 4) {
      return {
        outcome: 'info_gap',
        reason: `${unknowns} items marked as unknown - significant information gaps`,
      };
    }

    const criticalIssues = [];

    if (formData.stair_protection_status === 'inadequate') {
      criticalIssues.push('Inadequate stair protection');
    }
    if (formData.final_exits_adequate === 'no') {
      criticalIssues.push('Inadequate final exits');
    }
    if (formData.travel_distances_compliant === 'no') {
      criticalIssues.push('Non-compliant travel distances');
    }

    if (criticalIssues.length > 0) {
      return {
        outcome: 'material_def',
        reason: `Material deficiencies identified: ${criticalIssues.join(', ')}`,
      };
    }

    const minorIssues = [
      formData.escape_route_obstructions === 'yes' && 'Escape route obstructions',
      formData.exit_signage_adequacy === 'inadequate' && 'Inadequate signage',
      formData.disabled_egress_arrangements === 'inadequate' && 'Inadequate disabled egress',
    ].filter(Boolean);

    if (minorIssues.length > 0 || unknowns >= 2) {
      return {
        outcome: 'minor_def',
        reason: minorIssues.length > 0 ? minorIssues.join(', ') : 'Some information gaps remain',
      };
    }

    return null;
  };

  const suggestedOutcome = getSuggestedOutcome();

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

      setLastSaved(new Date().toLocaleTimeString());
      onSaved();
    } catch (error) {
      console.error('Error saving module:', error);
      alert('Failed to save module. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAction = (template: QuickActionTemplate) => {
    setQuickActionTemplate(template);
    setShowActionModal(true);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <DoorOpen className="w-6 h-6 text-neutral-700" />
          <h2 className="text-2xl font-bold text-neutral-900">
            FRA-2 - Means of Escape
          </h2>
        </div>
        <p className="text-neutral-600">
          Assess adequacy of escape routes, travel distances, and egress arrangements
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
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Escape Strategy & Routes
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Current escape strategy
              </label>
              <select
                value={formData.escape_strategy_current}
                onChange={(e) =>
                  setFormData({ ...formData, escape_strategy_current: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="simultaneous">Simultaneous evacuation</option>
                <option value="phased">Phased evacuation</option>
                <option value="stay_put">Stay put (defend in place)</option>
                <option value="progressive_horizontal">Progressive horizontal evacuation</option>
                <option value="other">Other (specify in notes)</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Strategy determines acceptable travel distances and protection standards
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Escape routes description
              </label>
              <textarea
                value={formData.escape_routes_description}
                onChange={(e) =>
                  setFormData({ ...formData, escape_routes_description: e.target.value })
                }
                placeholder="Describe the escape route configuration (e.g., 'Two protected staircases serving all floors, corridors provide alternative escape directions...')"
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Travel Distances & Compliance
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Travel distances compliant with standards?
              </label>
              <select
                value={formData.travel_distances_compliant}
                onChange={(e) =>
                  setFormData({ ...formData, travel_distances_compliant: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown - not verified</option>
                <option value="yes">Yes - compliant</option>
                <option value="no">No - excessive travel distances</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Typically 18m (one direction) or 45m (alternative directions) for normal risk
              </p>
            </div>

            {(formData.travel_distances_compliant === 'unknown' ||
              formData.travel_distances_compliant === 'no') && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Verify travel distances against appropriate standards (BS 9999, Approved Document B, HTM, or sector-specific guidance) and identify any remedial measures required for non-compliant routes',
                    likelihood: 4,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Verify/remediate travel distances
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Final Exits & Obstructions
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Final exits adequate?
              </label>
              <select
                value={formData.final_exits_adequate}
                onChange={(e) =>
                  setFormData({ ...formData, final_exits_adequate: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - adequate provision and width</option>
                <option value="no">No - insufficient provision</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Consider number, location, width, security releases, and signage
              </p>
            </div>

            {formData.final_exits_adequate === 'no' && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Increase final exit provision or improve existing exits (widen, add security releases/panic hardware, improve signage). Consider creating additional storey exits where practicable.',
                    likelihood: 4,
                    impact: 5,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Increase final exit provision
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Escape route obstructions present?
              </label>
              <select
                value={formData.escape_route_obstructions}
                onChange={(e) =>
                  setFormData({ ...formData, escape_route_obstructions: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - obstructions present</option>
                <option value="no">No - clear routes</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Storage, equipment, furniture, wedged doors, etc.
              </p>
            </div>

            {formData.escape_route_obstructions === 'yes' && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Remove all obstructions from escape routes and implement weekly inspection regime to ensure routes remain clear. Brief all occupants on importance of maintaining clear escape routes.',
                    likelihood: 4,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Remove obstructions & implement checks
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Stair Protection & Special Considerations
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Stair protection status
              </label>
              <select
                value={formData.stair_protection_status}
                onChange={(e) =>
                  setFormData({ ...formData, stair_protection_status: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="adequate">Adequate - protected stairs/lobbies</option>
                <option value="inadequate">Inadequate - unprotected or compromised</option>
                <option value="na">N/A - single storey</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Consider fire doors, lobbies, ventilation, and structural protection
              </p>
            </div>

            {formData.stair_protection_status === 'inadequate' && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Upgrade stair/lobby protection: install or repair fire doors with closers, ensure lobbies are provided where required, verify smoke ventilation, and seal any breaches in stair enclosures',
                    likelihood: 4,
                    impact: 5,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Upgrade stair/lobby protection
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Inner rooms present?
              </label>
              <select
                value={formData.inner_rooms_present}
                onChange={(e) =>
                  setFormData({ ...formData, inner_rooms_present: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - inner rooms present</option>
                <option value="no">No</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Rooms accessed only via other rooms (higher risk)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Basement present?
              </label>
              <select
                value={formData.basement_present}
                onChange={(e) =>
                  setFormData({ ...formData, basement_present: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - basement present</option>
                <option value="no">No</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Basements require enhanced protection and may need dedicated escape routes
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Signage & Wayfinding
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Exit signage adequacy
              </label>
              <select
                value={formData.exit_signage_adequacy}
                onChange={(e) =>
                  setFormData({ ...formData, exit_signage_adequacy: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="adequate">Adequate - BS 5499 compliant</option>
                <option value="inadequate">Inadequate - missing or poor signage</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Consider quantity, visibility, consistency, and illumination
              </p>
            </div>

            {formData.exit_signage_adequacy === 'inadequate' && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Upgrade escape signage to BS 5499 standard: install additional signs at decision points, ensure consistent direction, provide illuminated or photoluminescent signs where required',
                    likelihood: 3,
                    impact: 3,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Upgrade escape signage
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Emergency lighting dependency
              </label>
              <select
                value={formData.emergency_lighting_dependency}
                onChange={(e) =>
                  setFormData({ ...formData, emergency_lighting_dependency: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - emergency lighting required</option>
                <option value="no">No - adequate borrowed light</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Links to FRA-3 emergency lighting assessment
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Disabled Egress Arrangements
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Disabled egress arrangements
              </label>
              <select
                value={formData.disabled_egress_arrangements}
                onChange={(e) =>
                  setFormData({ ...formData, disabled_egress_arrangements: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="adequate">Adequate - refuges/evacuation lifts/assistance</option>
                <option value="inadequate">Inadequate - no provision</option>
                <option value="na">N/A - ground floor only / no vulnerable occupants</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Consider refuges, evacuation lifts, PEEPs, and assistance arrangements
              </p>
            </div>

            {(formData.disabled_egress_arrangements === 'inadequate' ||
              formData.disabled_egress_arrangements === 'unknown') && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Confirm evacuation assistance arrangements for persons requiring assistance: identify refuge locations, implement PEEP process, provide evacuation chairs/devices, train staff in assistance procedures',
                    likelihood: 4,
                    impact: 5,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Confirm evacuation assistance arrangements
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Additional Means of Escape Notes
          </h3>
          <textarea
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            placeholder="Add any additional observations about means of escape, specific routes, travel distance calculations, or other relevant details..."
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
