import { useState } from 'react';
import { Flame, CheckCircle, Plus } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import AddActionModal from '../../actions/AddActionModal';

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

interface FRA1FireHazardsFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface QuickActionTemplate {
  action: string;
  likelihood: number;
  impact: number;
}

const IGNITION_OPTIONS = [
  'smoking',
  'hot_work',
  'electrical_equipment',
  'cooking',
  'portable_heaters',
  'plant_rooms',
  'arson_ignition_points',
  'other',
];

const FUEL_OPTIONS = [
  'waste_storage',
  'packaging_materials',
  'upholstered_furniture',
  'storage_racking',
  'flammable_liquids',
  'lpg_cylinders',
  'plant_rooms',
  'other',
];

const HIGH_RISK_ACTIVITIES = [
  'hot_work',
  'lithium_ion_charging',
  'commercial_kitchens',
  'laundry_operations',
  'contractor_works',
  'maintenance_activities',
  'other',
];

export default function FRA1FireHazardsForm({
  moduleInstance,
  document,
  onSaved,
}: FRA1FireHazardsFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [quickActionTemplate, setQuickActionTemplate] = useState<QuickActionTemplate | null>(null);

  const [formData, setFormData] = useState({
    ignition_sources: moduleInstance.data.ignition_sources || [],
    ignition_other: moduleInstance.data.ignition_other || '',
    fuel_sources: moduleInstance.data.fuel_sources || [],
    fuel_other: moduleInstance.data.fuel_other || '',
    oxygen_enrichment: moduleInstance.data.oxygen_enrichment || 'none',
    oxygen_sources_notes: moduleInstance.data.oxygen_sources_notes || '',
    high_risk_activities: moduleInstance.data.high_risk_activities || [],
    high_risk_other: moduleInstance.data.high_risk_other || '',
    arson_risk: moduleInstance.data.arson_risk || 'unknown',
    housekeeping_fire_load: moduleInstance.data.housekeeping_fire_load || 'unknown',
    lone_working: moduleInstance.data.lone_working || 'unknown',
    notes: moduleInstance.data.notes || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const toggleMultiSelect = (field: 'ignition_sources' | 'fuel_sources' | 'high_risk_activities', value: string) => {
    const current = formData[field] as string[];
    const updated = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    setFormData({ ...formData, [field]: updated });
  };

  const getSuggestedOutcome = (): { outcome: string; reason: string } | null => {
    const unknowns = [
      formData.arson_risk === 'unknown' && 'arson_risk',
      formData.housekeeping_fire_load === 'unknown' && 'housekeeping_fire_load',
      formData.lone_working === 'unknown' && 'lone_working',
      formData.oxygen_enrichment === 'unknown' && 'oxygen_enrichment',
    ].filter(Boolean).length;

    if (formData.oxygen_enrichment === 'known' &&
        (formData.ignition_sources.length > 2 || formData.fuel_sources.length > 2)) {
      return {
        outcome: 'material_def',
        reason: 'Known oxygen enrichment combined with significant ignition and fuel sources presents elevated fire risk',
      };
    }

    if (formData.arson_risk === 'high') {
      return {
        outcome: 'material_def',
        reason: 'High arson risk requires immediate security and preventative measures',
      };
    }

    if (unknowns >= 4) {
      return {
        outcome: 'info_gap',
        reason: `${unknowns} key factors marked as unknown - significant information gaps`,
      };
    }

    const issues = [
      formData.ignition_sources.includes('smoking') && 'Smoking controls needed',
      formData.ignition_sources.includes('hot_work') && 'Hot work controls needed',
      formData.housekeeping_fire_load === 'high' && 'High fire load',
      formData.arson_risk === 'medium' && 'Moderate arson risk',
    ].filter(Boolean);

    if (issues.length > 0 || unknowns >= 2) {
      return {
        outcome: 'minor_def',
        reason: issues.length > 0 ? issues.join(', ') : 'Some information gaps remain',
      };
    }

    return null;
  };

  const suggestedOutcome = getSuggestedOutcome();

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const completedAt = outcome ? new Date().toISOString() : null;

      const { error } = await supabase
        .from('module_instances')
        .update({
          outcome: outcome || null,
          assessor_notes: assessorNotes,
          data: formData,
          completed_at: completedAt,
        })
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

  const formatLabel = (value: string) => {
    return value
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Flame className="w-6 h-6 text-neutral-700" />
          <h2 className="text-2xl font-bold text-neutral-900">
            FRA-1 - Fire Hazards & Ignition Sources
          </h2>
        </div>
        <p className="text-neutral-600">
          Assess the fire triangle: ignition sources, fuel loads, and oxygen enrichment plus arson risk
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
            Ignition Sources
          </h3>
          <p className="text-sm text-neutral-600 mb-4">
            Select all ignition sources present or reasonably foreseeable
          </p>
          <div className="space-y-2">
            {IGNITION_OPTIONS.map((option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.ignition_sources.includes(option)}
                  onChange={() => toggleMultiSelect('ignition_sources', option)}
                  className="w-4 h-4 text-neutral-900 border-neutral-300 rounded focus:ring-2 focus:ring-neutral-900"
                />
                <span className="text-sm text-neutral-700">{formatLabel(option)}</span>
              </label>
            ))}
          </div>
          {formData.ignition_sources.includes('other') && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Specify other ignition sources
              </label>
              <input
                type="text"
                value={formData.ignition_other}
                onChange={(e) => setFormData({ ...formData, ignition_other: e.target.value })}
                placeholder="Describe other ignition sources..."
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>
          )}

          {(formData.ignition_sources.includes('smoking') ||
            formData.ignition_sources.includes('hot_work')) && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <button
                onClick={() =>
                  handleQuickAction({
                    action: formData.ignition_sources.includes('hot_work')
                      ? 'Strengthen ignition controls: implement hot work permit-to-work system with fire watch requirements, clearances, and extinguisher provision. Review smoking controls and ensure designated areas are away from combustibles.'
                      : 'Strengthen smoking controls: designate smoking areas away from combustibles, provide cigarette bins, enforce no-smoking policy in high-risk areas, and ensure staff are briefed.',
                    likelihood: formData.ignition_sources.includes('hot_work') ? 5 : 4,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Strengthen ignition controls
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Fuel Sources
          </h3>
          <p className="text-sm text-neutral-600 mb-4">
            Select all significant fuel sources present
          </p>
          <div className="space-y-2">
            {FUEL_OPTIONS.map((option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.fuel_sources.includes(option)}
                  onChange={() => toggleMultiSelect('fuel_sources', option)}
                  className="w-4 h-4 text-neutral-900 border-neutral-300 rounded focus:ring-2 focus:ring-neutral-900"
                />
                <span className="text-sm text-neutral-700">{formatLabel(option)}</span>
              </label>
            ))}
          </div>
          {formData.fuel_sources.includes('other') && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Specify other fuel sources
              </label>
              <input
                type="text"
                value={formData.fuel_other}
                onChange={(e) => setFormData({ ...formData, fuel_other: e.target.value })}
                placeholder="Describe other fuel sources..."
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>
          )}

          {(formData.fuel_sources.includes('flammable_liquids') ||
            formData.fuel_sources.includes('lpg_cylinders')) && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Control storage and segregation of flammable liquids and LPG: provide dedicated storage areas away from ignition sources, ensure adequate ventilation, implement quantity limits, provide appropriate signage, and maintain segregation from oxidisers.',
                    likelihood: 4,
                    impact: 5,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Control flammable storage
              </button>
            </div>
          )}

          <div className="mt-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              General housekeeping and fire load assessment
            </label>
            <select
              value={formData.housekeeping_fire_load}
              onChange={(e) =>
                setFormData({ ...formData, housekeeping_fire_load: e.target.value })
              }
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            >
              <option value="unknown">Unknown</option>
              <option value="low">Low - Good housekeeping, minimal fire load</option>
              <option value="medium">Medium - Moderate fire load, acceptable housekeeping</option>
              <option value="high">High - Poor housekeeping, excessive fire load</option>
            </select>
          </div>

          {formData.housekeeping_fire_load === 'high' && (
            <div className="mt-4">
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Improve waste management and fire load controls: implement regular waste removal regime, reduce storage of combustibles in escape routes and common areas, enforce clear desk policy where appropriate, and conduct regular housekeeping inspections.',
                    likelihood: 4,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Improve fire load controls
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Oxygen Enrichment
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Oxygen enrichment status
              </label>
              <select
                value={formData.oxygen_enrichment}
                onChange={(e) =>
                  setFormData({ ...formData, oxygen_enrichment: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="none">None - no oxygen enrichment</option>
                <option value="possible">Possible - requires verification</option>
                <option value="known">Known - oxygen enrichment present</option>
                <option value="unknown">Unknown</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Medical gases, industrial oxidisers, oxygen therapy, compressed air systems
              </p>
            </div>

            {(formData.oxygen_enrichment === 'known' || formData.oxygen_enrichment === 'possible') && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Oxygen sources and control measures
                </label>
                <textarea
                  value={formData.oxygen_sources_notes}
                  onChange={(e) =>
                    setFormData({ ...formData, oxygen_sources_notes: e.target.value })
                  }
                  placeholder="Describe oxygen sources, storage locations, piped systems, and control measures in place..."
                  rows={3}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            High-Risk Activities
          </h3>
          <p className="text-sm text-neutral-600 mb-4">
            Select all high-risk fire activities undertaken
          </p>
          <div className="space-y-2">
            {HIGH_RISK_ACTIVITIES.map((option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.high_risk_activities.includes(option)}
                  onChange={() => toggleMultiSelect('high_risk_activities', option)}
                  className="w-4 h-4 text-neutral-900 border-neutral-300 rounded focus:ring-2 focus:ring-neutral-900"
                />
                <span className="text-sm text-neutral-700">{formatLabel(option)}</span>
              </label>
            ))}
          </div>
          {formData.high_risk_activities.includes('other') && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Specify other high-risk activities
              </label>
              <input
                type="text"
                value={formData.high_risk_other}
                onChange={(e) => setFormData({ ...formData, high_risk_other: e.target.value })}
                placeholder="Describe other activities..."
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>
          )}

          {formData.high_risk_activities.includes('lithium_ion_charging') && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Implement safe lithium-ion charging controls: provide dedicated charging areas away from escape routes and sleeping areas, ensure adequate separation and ventilation, use manufacturer-approved chargers only, implement supervision during charging, and provide fire detection in charging areas.',
                    likelihood: 4,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Implement Li-ion charging controls
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Arson Risk & Lone Working
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Arson risk assessment
              </label>
              <select
                value={formData.arson_risk}
                onChange={(e) =>
                  setFormData({ ...formData, arson_risk: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="low">Low - Good security, no history</option>
                <option value="medium">Medium - Some vulnerabilities</option>
                <option value="high">High - Poor security or history of incidents</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Consider security, access control, history, location, and vulnerable areas
              </p>
            </div>

            {(formData.arson_risk === 'medium' || formData.arson_risk === 'high') && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Improve security and arson prevention measures: enhance perimeter security, implement access control, remove external combustibles from building perimeter, secure bins away from building, install CCTV in vulnerable areas, improve lighting, and consider security patrols.',
                    likelihood: 4,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Improve arson prevention
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Lone working arrangements
              </label>
              <select
                value={formData.lone_working}
                onChange={(e) =>
                  setFormData({ ...formData, lone_working: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - lone working occurs</option>
                <option value="no">No - always multiple occupants</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Consider implications for emergency response and detection requirements
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Additional Hazard Notes
          </h3>
          <textarea
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            placeholder="Add any additional observations about fire hazards, ignition sources, or risk factors..."
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
