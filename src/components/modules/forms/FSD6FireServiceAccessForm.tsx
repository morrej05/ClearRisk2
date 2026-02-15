import { useState } from 'react';
import { Truck, CheckCircle, Plus } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import AddActionModal from '../../actions/AddActionModal';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import { getActionsRefreshKey } from '../../../utils/actionsRefreshKey';

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

interface FSD6FireServiceAccessFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface QuickActionTemplate {
  action: string;
  likelihood: number;
  impact: number;
}

export default function FSD6FireServiceAccessForm({
  moduleInstance,
  document,
  onSaved,
}: FSD6FireServiceAccessFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const actionsRefreshKey = getActionsRefreshKey(document.id, moduleInstance.id);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [quickActionTemplate, setQuickActionTemplate] = useState<QuickActionTemplate | null>(null);

  const [formData, setFormData] = useState({
    appliance_access_routes_summary: moduleInstance.data.appliance_access_routes_summary || '',
    water_supplies_hydrants: moduleInstance.data.water_supplies_hydrants || 'unknown',
    water_supplies_notes: moduleInstance.data.water_supplies_notes || '',
    dry_riser: moduleInstance.data.dry_riser || 'unknown',
    dry_riser_notes: moduleInstance.data.dry_riser_notes || '',
    wet_riser: moduleInstance.data.wet_riser || 'unknown',
    wet_riser_notes: moduleInstance.data.wet_riser_notes || '',
    firefighting_shaft: moduleInstance.data.firefighting_shaft || 'unknown',
    firefighting_shaft_notes: moduleInstance.data.firefighting_shaft_notes || '',
    fire_service_lift: moduleInstance.data.fire_service_lift || 'unknown',
    fire_service_lift_notes: moduleInstance.data.fire_service_lift_notes || '',
    fire_control_point_location: moduleInstance.data.fire_control_point_location || '',
    signage_and_info_pack: moduleInstance.data.signage_and_info_pack || 'unknown',
    notes: moduleInstance.data.notes || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const getSuggestedOutcome = (): { outcome: string; reason: string } | null => {
    const unknowns = [
      !formData.appliance_access_routes_summary || formData.appliance_access_routes_summary.trim().length < 20,
      formData.water_supplies_hydrants === 'unknown',
      formData.dry_riser === 'unknown' || formData.wet_riser === 'unknown',
      !formData.fire_control_point_location || formData.fire_control_point_location.trim().length < 10,
    ].filter(Boolean).length;

    if (unknowns >= 3) {
      return {
        outcome: 'info_gap',
        reason: `${unknowns} key fire service provisions unknown`,
      };
    }

    if (unknowns >= 1) {
      return {
        outcome: 'minor_def',
        reason: 'Some fire service access details require clarification',
      };
    }

    return {
      outcome: 'compliant',
      reason: 'Fire service facilities adequately specified',
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
      console.error('Error saving FSD-6 module:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAction = (template: QuickActionTemplate) => {
    setQuickActionTemplate(template);
    setShowActionModal(true);
  };

  const accessUnknown = !formData.appliance_access_routes_summary || formData.appliance_access_routes_summary.trim().length < 20;
  const riserUnknown = formData.dry_riser === 'unknown' || formData.wet_riser === 'unknown';
  const fireControlUnknown = !formData.fire_control_point_location || formData.fire_control_point_location.trim().length < 10;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Truck className="w-6 h-6 text-neutral-700" />
          <h2 className="text-2xl font-bold text-neutral-900">
            FSD-6 - Fire Service Facilities & Access
          </h2>
        </div>
        <p className="text-neutral-600">
          Define fire service access, facilities, and firefighting provisions
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
        {/* Appliance Access */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Appliance Access
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Appliance Access Routes Summary
              </label>
              <textarea
                value={formData.appliance_access_routes_summary}
                onChange={(e) => setFormData({ ...formData, appliance_access_routes_summary: e.target.value })}
                placeholder="Describe fire appliance access routes, turning provisions, hardstanding, and any constraints or special arrangements"
                rows={4}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>

            {accessUnknown && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Confirm fire service appliance access/turning provisions and document constraints.',
                    likelihood: 3,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Confirm appliance access
              </button>
            )}
          </div>
        </div>

        {/* Water Supplies */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Water Supplies & Hydrants
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Water Supplies & Hydrants Provision
              </label>
              <select
                value={formData.water_supplies_hydrants}
                onChange={(e) => setFormData({ ...formData, water_supplies_hydrants: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent mb-2"
              >
                <option value="unknown">Unknown</option>
                <option value="adequate">Adequate provision</option>
                <option value="inadequate">Inadequate - requires improvement</option>
                <option value="na">Not Applicable</option>
              </select>
              <textarea
                value={formData.water_supplies_notes}
                onChange={(e) => setFormData({ ...formData, water_supplies_notes: e.target.value })}
                placeholder="Provide details about hydrant locations, flow rates, and mains supply"
                rows={2}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>
          </div>
        </div>

        {/* Risers */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Risers & Firefighting Shafts
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Dry Riser Provision
              </label>
              <select
                value={formData.dry_riser}
                onChange={(e) => setFormData({ ...formData, dry_riser: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent mb-2"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - dry riser provided</option>
                <option value="no">No - not provided</option>
                <option value="na">Not Applicable</option>
              </select>
              {formData.dry_riser === 'yes' && (
                <textarea
                  value={formData.dry_riser_notes}
                  onChange={(e) => setFormData({ ...formData, dry_riser_notes: e.target.value })}
                  placeholder="Describe dry riser locations, inlet positions, and coverage"
                  rows={2}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Wet Riser Provision
              </label>
              <select
                value={formData.wet_riser}
                onChange={(e) => setFormData({ ...formData, wet_riser: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent mb-2"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - wet riser provided</option>
                <option value="no">No - not provided</option>
                <option value="na">Not Applicable</option>
              </select>
              {formData.wet_riser === 'yes' && (
                <textarea
                  value={formData.wet_riser_notes}
                  onChange={(e) => setFormData({ ...formData, wet_riser_notes: e.target.value })}
                  placeholder="Describe wet riser locations, pumps, and coverage"
                  rows={2}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                />
              )}
            </div>

            {riserUnknown && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Confirm riser requirements/provision and document design basis.',
                    likelihood: 4,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Confirm riser provision
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Firefighting Shaft Provision
              </label>
              <select
                value={formData.firefighting_shaft}
                onChange={(e) => setFormData({ ...formData, firefighting_shaft: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent mb-2"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - firefighting shaft provided</option>
                <option value="no">No - not provided</option>
                <option value="na">Not Applicable</option>
              </select>
              {formData.firefighting_shaft === 'yes' && (
                <textarea
                  value={formData.firefighting_shaft_notes}
                  onChange={(e) => setFormData({ ...formData, firefighting_shaft_notes: e.target.value })}
                  placeholder="Describe firefighting shaft provisions (lobby, ventilation, fire service lift, communications, etc.)"
                  rows={2}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                />
              )}
            </div>
          </div>
        </div>

        {/* Fire Service Lift */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Fire Service Lift
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Fire Service Lift Provision
              </label>
              <select
                value={formData.fire_service_lift}
                onChange={(e) => setFormData({ ...formData, fire_service_lift: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent mb-2"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - fire service lift provided</option>
                <option value="no">No - not provided</option>
                <option value="na">Not Applicable</option>
              </select>
              {formData.fire_service_lift === 'yes' && (
                <textarea
                  value={formData.fire_service_lift_notes}
                  onChange={(e) => setFormData({ ...formData, fire_service_lift_notes: e.target.value })}
                  placeholder="Describe fire service lift provisions (number, capacity, controls, power supply, etc.)"
                  rows={2}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                />
              )}
            </div>
          </div>
        </div>

        {/* Fire Control Point */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Fire Control Point & Information
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Fire Control Point Location
              </label>
              <input
                type="text"
                value={formData.fire_control_point_location}
                onChange={(e) => setFormData({ ...formData, fire_control_point_location: e.target.value })}
                placeholder="e.g., Main entrance lobby, Ground floor fire service access"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>

            {fireControlUnknown && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Define fire control point location and information arrangements for FRS.',
                    likelihood: 3,
                    impact: 3,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Define fire control point
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Signage & Information Pack Provided?
              </label>
              <select
                value={formData.signage_and_info_pack}
                onChange={(e) => setFormData({ ...formData, signage_and_info_pack: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - signage and info pack provided</option>
                <option value="no">No - not yet provided</option>
              </select>
            </div>
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
            placeholder="Add any additional observations about fire service access, facilities, or special considerations..."
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
