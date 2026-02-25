import { useState } from 'react';
import { Flame, CheckCircle, Plus, Zap } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import AddActionModal from '../../actions/AddActionModal';
import InfoGapQuickActions from '../InfoGapQuickActions';
import { detectInfoGaps } from '../../../utils/infoGapQuickActions';
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

interface FRA1FireHazardsFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface QuickActionTemplate {
  action: string;
  likelihood: number;
  impact: number;
  source?: 'manual' | 'info_gap' | 'recommendation' | 'system';
}

const IGNITION_OPTIONS = [
  'smoking',
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
  const actionsRefreshKey = getActionsRefreshKey(document.id, moduleInstance.id);

  const [formData, setFormData] = useState({
    ignition_sources: (moduleInstance.data.ignition_sources || []).filter((x: string) => x !== 'hot_work'),
    ignition_other: moduleInstance.data.ignition_other || '',
    fuel_sources: moduleInstance.data.fuel_sources || [],
    fuel_other: moduleInstance.data.fuel_other || '',
    oxygen_enrichment: moduleInstance.data.oxygen_enrichment || 'none',
    oxygen_sources_notes: moduleInstance.data.oxygen_sources_notes || '',
    high_risk_activities: (moduleInstance.data.high_risk_activities || []).filter((x: string) => x !== 'hot_work'),
    high_risk_other: moduleInstance.data.high_risk_other || '',
    arson_risk: moduleInstance.data.arson_risk || 'unknown',
    housekeeping_fire_load: moduleInstance.data.housekeeping_fire_load || 'unknown',
    notes: moduleInstance.data.notes || '',
    electrical_safety: moduleInstance.data.electrical_safety || {
      eicr_last_date: null,
      eicr_interval_years: '',
      eicr_satisfactory: 'unknown',
      eicr_evidence_seen: 'no',
      eicr_outstanding_c1_c2: 'unknown',
      eicr_notes: '',
      pat_in_place: 'unknown',
    },
    lightning: moduleInstance.data.lightning || {
      lightning_protection_present: null,
      lightning_risk_assessment_completed: null,
      assessment_date: null,
      notes: '',
    },
    duct_cleaning: moduleInstance.data.duct_cleaning || {
      ducts_present: null,
      dust_grease_risk: null,
      cleaning_frequency: null,
      last_cleaned: null,
      notes: '',
    },
    dsear_screen: moduleInstance.data.dsear_screen || {
      flammables_present: null,
      explosive_atmospheres_possible: null,
      dsear_assessment_status: null,
      assessor: null,
      notes: '',
    },
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');
  const [scoringData, setScoringData] = useState(moduleInstance.data.scoring || {});

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

  // Detect info gaps
  const infoGapDetection = detectInfoGaps(moduleInstance.module_key, formData, outcome);

  const handleCreateQuickAction = (actionText: string, priority: 'P2' | 'P3') => {
    setQuickActionTemplate({
      action: actionText,
      likelihood: priority === 'P2' ? 4 : 3,
      impact: priority === 'P2' ? 3 : 2,
      source: 'info_gap',
    });
    setShowActionModal(true);
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const completedAt = outcome ? new Date().toISOString() : null;

      const payload = sanitizeModuleInstancePayload({
        outcome,
        assessor_notes: assessorNotes,
        data: { ...formData, scoring: scoringData },
        completed_at: completedAt,
      }, moduleInstance.module_key);

      console.log('[FRA1 Save] Payload being sent to Supabase:', {
        moduleKey: moduleInstance.module_key,
        outcome: payload.outcome,
        originalOutcome: outcome,
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

      <div className="mb-6">
        <InfoGapQuickActions
          detection={infoGapDetection}
          moduleKey={moduleInstance.module_key}
          onCreateAction={handleCreateQuickAction}
          showCreateButtons={true}
        />
      </div>

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

          {formData.ignition_sources.includes('smoking') && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Strengthen smoking controls: designate smoking areas away from combustibles, provide cigarette bins, enforce no-smoking policy in high-risk areas, and ensure staff are briefed.',
                    likelihood: 4,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Strengthen smoking controls
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

          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-bold text-neutral-900">
              Electrical Installation Safety (Fixed Wiring / EICR)
            </h3>
          </div>
          <p className="text-sm text-neutral-600 mb-4">
            Assess electrical installation condition and compliance with BS 7671
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Date of Last EICR (Electrical Installation Condition Report)
              </label>
              <input
                type="date"
                value={formData.electrical_safety.eicr_last_date || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    electrical_safety: {
                      ...formData.electrical_safety,
                      eicr_last_date: e.target.value || null,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Recommended Test Interval
              </label>
              <select
                value={formData.electrical_safety.eicr_interval_years}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    electrical_safety: {
                      ...formData.electrical_safety,
                      eicr_interval_years: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="">Select interval</option>
                <option value="1">Annual</option>
                <option value="3">Every 3 Years</option>
                <option value="5">Every 5 Years</option>
                <option value="other">Other</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Typical intervals: HMOs/commercial 1-3 years, domestic letting 5 years
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                EICR Result (if available)
              </label>
              <select
                value={formData.electrical_safety.eicr_satisfactory}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    electrical_safety: {
                      ...formData.electrical_safety,
                      eicr_satisfactory: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="satisfactory">Satisfactory</option>
                <option value="unsatisfactory">Unsatisfactory</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                EICR Evidence Seen
              </label>
              <select
                value={formData.electrical_safety.eicr_evidence_seen}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    electrical_safety: {
                      ...formData.electrical_safety,
                      eicr_evidence_seen: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="no">No - Evidence not seen</option>
                <option value="yes">Yes - Evidence seen and reviewed</option>
              </select>
              {formData.electrical_safety.eicr_evidence_seen === 'no' && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>Information Gap:</strong> EICR evidence should be requested and reviewed.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Unresolved C1 or C2 Observations
              </label>
              <select
                value={formData.electrical_safety.eicr_outstanding_c1_c2}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    electrical_safety: {
                      ...formData.electrical_safety,
                      eicr_outstanding_c1_c2: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="no">No - All observations resolved</option>
                <option value="yes">Yes - Unresolved C1/C2 observations present</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                C1 = Danger present (immediate risk); C2 = Potentially dangerous (urgent remedial action required)
              </p>
              {formData.electrical_safety.eicr_outstanding_c1_c2 === 'yes' && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>Critical:</strong> Unresolved C1/C2 observations represent immediate or potential danger and must be addressed urgently.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Electrical Safety Notes
              </label>
              <textarea
                value={formData.electrical_safety.eicr_notes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    electrical_safety: {
                      ...formData.electrical_safety,
                      eicr_notes: e.target.value,
                    },
                  })
                }
                placeholder="Details of EICR findings, observations, electrical safety concerns, or remedial works..."
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                PAT Testing Regime (Optional)
              </label>
              <select
                value={formData.electrical_safety.pat_in_place}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    electrical_safety: {
                      ...formData.electrical_safety,
                      pat_in_place: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - PAT regime in place</option>
                <option value="no">No PAT regime</option>
                <option value="na">Not applicable</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                Portable Appliance Testing for user equipment (not part of fixed installation)
              </p>
            </div>

            {(formData.electrical_safety.eicr_evidence_seen === 'no' ||
              formData.electrical_safety.eicr_outstanding_c1_c2 === 'yes') && (
              <div className="pt-4 border-t border-neutral-200">
                <button
                  onClick={() =>
                    handleQuickAction({
                      action: formData.electrical_safety.eicr_outstanding_c1_c2 === 'yes'
                        ? 'Urgent: Rectify unresolved C1/C2 electrical observations identified in EICR. Engage competent electrical contractor to assess and remediate all immediate and potential dangers in accordance with BS 7671.'
                        : 'Obtain and review current EICR (Electrical Installation Condition Report) to verify electrical installation safety and compliance with BS 7671. Implement any required remedial works.',
                      likelihood: formData.electrical_safety.eicr_outstanding_c1_c2 === 'yes' ? 5 : 4,
                      impact: 4,
                    })
                  }
                  className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Quick Add: {formData.electrical_safety.eicr_outstanding_c1_c2 === 'yes' ? 'Rectify C1/C2 Observations' : 'Request EICR Evidence'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Lightning Protection
          </h3>
          <p className="text-sm text-neutral-600 mb-4">
            Lightning risk assessment and protection systems
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Lightning protection present?
              </label>
              <select
                value={formData.lightning.lightning_protection_present || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    lightning: {
                      ...formData.lightning,
                      lightning_protection_present: e.target.value || null,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="">Not stated</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Lightning risk assessment completed?
              </label>
              <select
                value={formData.lightning.lightning_risk_assessment_completed || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    lightning: {
                      ...formData.lightning,
                      lightning_risk_assessment_completed: e.target.value || null,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="">Not stated</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Assessment date (if known)
              </label>
              <input
                type="text"
                value={formData.lightning.assessment_date || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    lightning: {
                      ...formData.lightning,
                      assessment_date: e.target.value || null,
                    },
                  })
                }
                placeholder="e.g., March 2024"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Lightning protection notes
              </label>
              <textarea
                value={formData.lightning.notes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    lightning: {
                      ...formData.lightning,
                      notes: e.target.value,
                    },
                  })
                }
                placeholder="Details about lightning protection system, test records, risk assessment findings..."
                rows={2}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Duct & Extract Cleaning
          </h3>
          <p className="text-sm text-neutral-600 mb-4">
            Extract ventilation and cleaning regimes
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Extract ductwork present?
              </label>
              <select
                value={formData.duct_cleaning.ducts_present || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    duct_cleaning: {
                      ...formData.duct_cleaning,
                      ducts_present: e.target.value || null,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="">Not stated</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            {formData.duct_cleaning.ducts_present === 'yes' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Dust / grease accumulation risk
                  </label>
                  <select
                    value={formData.duct_cleaning.dust_grease_risk || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        duct_cleaning: {
                          ...formData.duct_cleaning,
                          dust_grease_risk: e.target.value || null,
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="">Not stated</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Cleaning frequency
                  </label>
                  <select
                    value={formData.duct_cleaning.cleaning_frequency || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        duct_cleaning: {
                          ...formData.duct_cleaning,
                          cleaning_frequency: e.target.value || null,
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="">Not stated</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                    <option value="ad-hoc">Ad-hoc</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Last cleaned (if known)
                  </label>
                  <input
                    type="text"
                    value={formData.duct_cleaning.last_cleaned || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        duct_cleaning: {
                          ...formData.duct_cleaning,
                          last_cleaned: e.target.value || null,
                        },
                      })
                    }
                    placeholder="e.g., January 2026"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Duct cleaning notes
              </label>
              <textarea
                value={formData.duct_cleaning.notes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    duct_cleaning: {
                      ...formData.duct_cleaning,
                      notes: e.target.value,
                    },
                  })
                }
                placeholder="Details about duct systems, kitchen extract, maintenance records..."
                rows={2}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            DSEAR Screening
          </h3>
          <p className="text-sm text-neutral-600 mb-4">
            Dangerous Substances and Explosive Atmospheres Regulations 2002
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Flammable substances present?
              </label>
              <select
                value={formData.dsear_screen.flammables_present || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dsear_screen: {
                      ...formData.dsear_screen,
                      flammables_present: e.target.value || null,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="">Not stated</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Explosive atmospheres possible?
              </label>
              <select
                value={formData.dsear_screen.explosive_atmospheres_possible || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dsear_screen: {
                      ...formData.dsear_screen,
                      explosive_atmospheres_possible: e.target.value || null,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="">Not stated</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            {(formData.dsear_screen.flammables_present === 'yes' || formData.dsear_screen.explosive_atmospheres_possible === 'yes') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    DSEAR assessment status
                  </label>
                  <select
                    value={formData.dsear_screen.dsear_assessment_status || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dsear_screen: {
                          ...formData.dsear_screen,
                          dsear_assessment_status: e.target.value || null,
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  >
                    <option value="">Not stated</option>
                    <option value="completed">Completed</option>
                    <option value="not completed">Not completed</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Assessor / responsible person
                  </label>
                  <input
                    type="text"
                    value={formData.dsear_screen.assessor || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dsear_screen: {
                          ...formData.dsear_screen,
                          assessor: e.target.value || null,
                        },
                      })
                    }
                    placeholder="Name or role"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                DSEAR screening notes
              </label>
              <textarea
                value={formData.dsear_screen.notes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dsear_screen: {
                      ...formData.dsear_screen,
                      notes: e.target.value,
                    },
                  })
                }
                placeholder="Details about dangerous substances, assessment findings, control measures..."
                rows={2}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
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
        moduleKey={moduleInstance.module_key}
        scoringData={scoringData}
        onScoringChange={setScoringData}
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
          source={quickActionTemplate?.source}
        />
      )}
    </div>
  );
}
