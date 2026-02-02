import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import FloatingSaveBar from './FloatingSaveBar';
import ReRatingPanel from '../../re/ReRatingPanel';
import { HRG_MASTER_MAP } from '../../../lib/re/reference/hrgMasterMap';
import { getRating, setRating } from '../../../lib/re/scoring/riskEngineeringHelpers';

interface Document {
  id: string;
  title: string;
  document_type: string;
}

interface ModuleInstance {
  id: string;
  document_id: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
}

interface RE06FireProtectionFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface BuildingFireProtection {
  building_id: string;
  building_name: string;
  percent_area_protected: number;
  percent_area_recommended: number;
  assessment: string;
  notes: string;
}

function createEmptyBuildingProtection(buildingId: string, buildingName: string): BuildingFireProtection {
  return {
    building_id: buildingId,
    building_name: buildingName,
    percent_area_protected: 0,
    percent_area_recommended: 0,
    assessment: '',
    notes: '',
  };
}

export default function RE06FireProtectionForm({
  moduleInstance,
  document,
  onSaved,
}: RE06FireProtectionFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [constructionBuildings, setConstructionBuildings] = useState<any[]>([]);
  const d = moduleInstance.data || {};

  const safeBuildings = Array.isArray(d.fire_protection?.buildings)
    ? d.fire_protection.buildings
    : [];

  const safeSystems = d.fire_protection?.systems || {
    sprinklers: { present: false, type: '', design_basis: '', itm_notes: '', impairment_notes: '' },
    water_supply: { reliability: '', primary_source: '', redundancy: '', test_history_notes: '' },
    detection_alarm: { present: false, coverage_notes: '', monitoring_to_arc: false },
    hydrants: { on_site: false, coverage_notes: '', maintenance_notes: '' },
    passive_protection: { notes: '' },
    smoke_control: { present: false, notes: '' },
  };

  const safeNLE = d.fire_protection?.credible_to_reduce_nle || {
    credible: false,
    basis: '',
  };

  const [formData, setFormData] = useState({
    fire_protection: {
      buildings: safeBuildings,
      systems: safeSystems,
      credible_to_reduce_nle: safeNLE,
      site_rating_1_to_5: typeof d.fire_protection?.site_rating_1_to_5 === 'number' ? d.fire_protection.site_rating_1_to_5 : 3,
    },
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const [riskEngInstanceId, setRiskEngInstanceId] = useState<string | null>(null);
  const [riskEngData, setRiskEngData] = useState<Record<string, any>>({});
  const [industryKey, setIndustryKey] = useState<string | null>(null);

  useEffect(() => {
async function loadConstructionBuildings() {
  try {
    const { data: constructionInstance, error } = await supabase
      .from('module_instances')
      .select('data')
      .eq('document_id', moduleInstance.document_id)
      .eq('module_key', 'RE02_CONSTRUCTION')
      .maybeSingle(); // ✅ no 406 if 0 rows

    if (error) throw error;

    // If Construction hasn't been saved yet, treat as no buildings
    const buildings = Array.isArray(constructionInstance?.data?.construction?.buildings)
      ? constructionInstance!.data.construction.buildings
      : [];

    setConstructionBuildings(buildings);

    if (buildings.length === 0) return;

    // Merge any new Construction buildings into Fire Protection (by id)
    setFormData((prev) => {
      const prevBuildings = Array.isArray(prev.fire_protection?.buildings)
        ? prev.fire_protection.buildings
        : [];

      const existingBuildingIds = prevBuildings
        .map((b: any) => b?.building_id)
        .filter(Boolean);

      const newBuildings = buildings
        .filter((b: any) => b?.id && !existingBuildingIds.includes(b.id))
        .map((b: any) => createEmptyBuildingProtection(b.id, b.building_name));

      if (newBuildings.length === 0) return prev;

      return {
        ...prev,
        fire_protection: {
          ...prev.fire_protection,
          buildings: [...prevBuildings, ...newBuildings],
        },
      };
    });
  } catch (err) {
    console.error('Error loading construction buildings:', err);
    setConstructionBuildings([]);
    // Don’t mutate formData on error; just render without linked rows
  }
}

    loadConstructionBuildings();
  }, [moduleInstance.document_id]);

  useEffect(() => {
    async function loadRiskEngModule() {
      try {
        const { data: instances, error } = await supabase
          .from('module_instances')
          .select('id, data')
          .eq('document_id', moduleInstance.document_id)
          .eq('module_key', 'RISK_ENGINEERING')
          .single();

        if (error) throw error;

        if (instances) {
          setRiskEngInstanceId(instances.id);
          setRiskEngData(instances.data || {});
          setIndustryKey(instances.data?.industry_key || null);
        }
      } catch (err) {
        console.error('Error loading RISK_ENGINEERING module:', err);
      }
    }

    loadRiskEngModule();
  }, [moduleInstance.document_id]);

  const canonicalKey = 'safety_and_control_systems';
  const rating = getRating(riskEngData, canonicalKey);

  const getHelpText = (): string => {
    if (!industryKey) return 'Rate the overall fire protection and safety control systems for this facility.';
    const industryConfig = HRG_MASTER_MAP.industries[industryKey];
    return industryConfig?.modules?.[canonicalKey]?.help_text || 'Rate the overall fire protection and safety control systems.';
  };

  const getWeight = (): number => {
    if (!industryKey) return HRG_MASTER_MAP.meta.default_weight;
    const industryConfig = HRG_MASTER_MAP.industries[industryKey];
    return industryConfig?.modules?.[canonicalKey]?.weight || HRG_MASTER_MAP.meta.default_weight;
  };

  const handleRatingChange = async (newRating: number) => {
    if (!riskEngInstanceId) return;

    try {
      const updatedData = setRating(riskEngData, canonicalKey, newRating);
      const sanitized = sanitizeModuleInstancePayload({ data: updatedData });

      const { error } = await supabase
        .from('module_instances')
        .update({ data: sanitized.data })
        .eq('id', riskEngInstanceId);

      if (error) throw error;

      setRiskEngData(updatedData);
    } catch (err) {
      console.error('Error updating rating:', err);
      alert('Failed to update rating');
    }
  };

  const updateBuilding = (buildingId: string, field: string, value: any) => {
    setFormData({
      ...formData,
      fire_protection: {
        ...formData.fire_protection,
        buildings: formData.fire_protection.buildings.map((b: any) =>
          b.building_id === buildingId ? { ...b, [field]: value } : b
        ),
      },
    });
  };

  const updateSystems = (system: string, field: string, value: any) => {
    setFormData({
      ...formData,
      fire_protection: {
        ...formData.fire_protection,
        systems: {
          ...formData.fire_protection.systems,
          [system]: {
            ...formData.fire_protection.systems[system],
            [field]: value,
          },
        },
      },
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const completedAt = outcome ? new Date().toISOString() : null;
      const sanitized = sanitizeModuleInstancePayload({ data: formData });

      const { error } = await supabase
        .from('module_instances')
        .update({
          data: sanitized.data,
          outcome: outcome || null,
          assessor_notes: assessorNotes,
          completed_at: completedAt,
        })
        .eq('id', moduleInstance.id);

      if (error) throw error;
      onSaved();
    } catch (error) {
      console.error('Error saving module:', error);
      alert('Failed to save module. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
    <div className="p-6 max-w-7xl mx-auto pb-24">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-06 - Fire Protection</h2>
        <p className="text-slate-600">Active and passive fire protection systems aligned to construction</p>
      </div>

      <div className="mb-6">
        <ReRatingPanel
          canonicalKey={canonicalKey}
          industryKey={industryKey}
          rating={rating}
          onChangeRating={handleRatingChange}
          helpText={getHelpText()}
          weight={getWeight()}
        />
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Building-Level Protection</h3>
          <p className="text-sm text-slate-600 mb-4">
            One row per building from RE-02 Construction. Protection coverage automatically syncs.
          </p>
          {formData.fire_protection.buildings.length === 0 ? (
            <div className="text-slate-500 text-sm py-4">
              No buildings found. Please complete RE-02 Construction module first.
            </div>
          ) : (
            <div className="space-y-4">
              {formData.fire_protection.buildings.map((building: any) => (
                <div key={building.building_id} className="border border-slate-200 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 mb-3">{building.building_name || 'Unnamed Building'}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        % Area Protected (0-100)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={building.percent_area_protected}
                        onChange={(e) => updateBuilding(building.building_id, 'percent_area_protected', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        % Area Recommended (0-100)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={building.percent_area_recommended}
                        onChange={(e) => updateBuilding(building.building_id, 'percent_area_recommended', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Assessment
                      </label>
                      <select
                        value={building.assessment}
                        onChange={(e) => updateBuilding(building.building_id, 'assessment', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      >
                        <option value="">Select...</option>
                        <option value="adequate">Adequate</option>
                        <option value="partial">Partial</option>
                        <option value="inadequate">Inadequate</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                      <textarea
                        value={building.notes}
                        onChange={(e) => updateBuilding(building.building_id, 'notes', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="Observations on this building's fire protection"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Site-Level Systems</h3>

          <div className="space-y-6">
            <div className="border-t border-slate-200 pt-4">
              <h4 className="font-semibold text-slate-900 mb-3">Sprinklers</h4>
              <div className="space-y-4">
                <div>
                  <label className="flex items-center text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.fire_protection.systems.sprinklers.present}
                      onChange={(e) => updateSystems('sprinklers', 'present', e.target.checked)}
                      className="mr-2"
                    />
                    Sprinkler System Present
                  </label>
                </div>
                {formData.fire_protection.systems.sprinklers.present && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                        <input
                          type="text"
                          value={formData.fire_protection.systems.sprinklers.type}
                          onChange={(e) => updateSystems('sprinklers', 'type', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          placeholder="e.g., Wet pipe, ESFR, Deluge"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Design Basis</label>
                        <input
                          type="text"
                          value={formData.fire_protection.systems.sprinklers.design_basis}
                          onChange={(e) => updateSystems('sprinklers', 'design_basis', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          placeholder="e.g., NFPA 13, BS EN 12845"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">ITM Notes</label>
                      <textarea
                        value={formData.fire_protection.systems.sprinklers.itm_notes}
                        onChange={(e) => updateSystems('sprinklers', 'itm_notes', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="Inspection, testing, and maintenance program details"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Impairment Notes</label>
                      <textarea
                        value={formData.fire_protection.systems.sprinklers.impairment_notes}
                        onChange={(e) => updateSystems('sprinklers', 'impairment_notes', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="Impairment management procedures and current status"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h4 className="font-semibold text-slate-900 mb-3">Water Supply</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reliability</label>
                  <select
                    value={formData.fire_protection.systems.water_supply.reliability}
                    onChange={(e) => updateSystems('water_supply', 'reliability', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  >
                    <option value="">Select...</option>
                    <option value="reliable">Reliable</option>
                    <option value="unreliable">Unreliable</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Primary Source</label>
                  <input
                    type="text"
                    value={formData.fire_protection.systems.water_supply.primary_source}
                    onChange={(e) => updateSystems('water_supply', 'primary_source', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="e.g., Municipal mains, on-site tanks, river/lake"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Redundancy</label>
                  <textarea
                    value={formData.fire_protection.systems.water_supply.redundancy}
                    onChange={(e) => updateSystems('water_supply', 'redundancy', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="Describe backup water supplies or redundancy measures"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Test History Notes</label>
                  <textarea
                    value={formData.fire_protection.systems.water_supply.test_history_notes}
                    onChange={(e) => updateSystems('water_supply', 'test_history_notes', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="Flow testing history and results"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h4 className="font-semibold text-slate-900 mb-3">Detection & Alarm</h4>
              <div className="space-y-4">
                <div>
                  <label className="flex items-center text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.fire_protection.systems.detection_alarm.present}
                      onChange={(e) => updateSystems('detection_alarm', 'present', e.target.checked)}
                      className="mr-2"
                    />
                    Detection System Present
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Coverage Notes</label>
                  <textarea
                    value={formData.fire_protection.systems.detection_alarm.coverage_notes}
                    onChange={(e) => updateSystems('detection_alarm', 'coverage_notes', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="Describe detection coverage and types (smoke, heat, flame, etc.)"
                  />
                </div>
                <div>
                  <label className="flex items-center text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.fire_protection.systems.detection_alarm.monitoring_to_arc}
                      onChange={(e) => updateSystems('detection_alarm', 'monitoring_to_arc', e.target.checked)}
                      className="mr-2"
                    />
                    Monitored to Alarm Receiving Centre (ARC)
                  </label>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h4 className="font-semibold text-slate-900 mb-3">Hydrants</h4>
              <div className="space-y-4">
                <div>
                  <label className="flex items-center text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.fire_protection.systems.hydrants.on_site}
                      onChange={(e) => updateSystems('hydrants', 'on_site', e.target.checked)}
                      className="mr-2"
                    />
                    On-Site Hydrants Present
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Coverage Notes</label>
                  <textarea
                    value={formData.fire_protection.systems.hydrants.coverage_notes}
                    onChange={(e) => updateSystems('hydrants', 'coverage_notes', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="Location, spacing, and adequacy of hydrant coverage"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Maintenance Notes</label>
                  <textarea
                    value={formData.fire_protection.systems.hydrants.maintenance_notes}
                    onChange={(e) => updateSystems('hydrants', 'maintenance_notes', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="Maintenance program and condition"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h4 className="font-semibold text-slate-900 mb-3">Passive Protection</h4>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={formData.fire_protection.systems.passive_protection.notes}
                  onChange={(e) => updateSystems('passive_protection', 'notes', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="Fire walls, barriers, compartmentation, fire-rated doors, penetration sealing, intumescent coatings"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h4 className="font-semibold text-slate-900 mb-3">Smoke Control</h4>
              <div className="space-y-4">
                <div>
                  <label className="flex items-center text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.fire_protection.systems.smoke_control.present}
                      onChange={(e) => updateSystems('smoke_control', 'present', e.target.checked)}
                      className="mr-2"
                    />
                    Smoke Control System Present
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea
                    value={formData.fire_protection.systems.smoke_control.notes}
                    onChange={(e) => updateSystems('smoke_control', 'notes', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="Natural vents, mechanical extraction, pressurization systems"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">NLE Linkage</h3>
          <p className="text-sm text-slate-600 mb-4">
            Determine whether fire protection systems are adequate to materially reduce Normal Loss Expectancy (NLE).
          </p>
          <div className="space-y-4">
            <div>
              <label className="flex items-center text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.fire_protection.credible_to_reduce_nle.credible}
                  onChange={(e) => setFormData({
                    ...formData,
                    fire_protection: {
                      ...formData.fire_protection,
                      credible_to_reduce_nle: {
                        ...formData.fire_protection.credible_to_reduce_nle,
                        credible: e.target.checked,
                      },
                    },
                  })}
                  className="mr-2"
                />
                Credible to Reduce NLE
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Basis</label>
              <textarea
                value={formData.fire_protection.credible_to_reduce_nle.basis}
                onChange={(e) => setFormData({
                  ...formData,
                  fire_protection: {
                    ...formData.fire_protection,
                    credible_to_reduce_nle: {
                      ...formData.fire_protection.credible_to_reduce_nle,
                      basis: e.target.value,
                    },
                  },
                })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Explain the rationale for crediting (or not crediting) fire protection in NLE calculations"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Site Fire Protection Rating</h3>
          <p className="text-sm text-slate-600 mb-4">
            Overall site fire protection quality considering building-level protection and site-level systems.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="1"
              max="5"
              value={formData.fire_protection.site_rating_1_to_5}
              onChange={(e) => setFormData({
                ...formData,
                fire_protection: { ...formData.fire_protection, site_rating_1_to_5: parseInt(e.target.value) }
              })}
              className="flex-1"
            />
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 font-bold text-blue-900 text-xl">
              {formData.fire_protection.site_rating_1_to_5}
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            1 = Poor/Inadequate, 3 = Average, 5 = Excellent
          </div>
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
        <ModuleActions documentId={document.id} moduleInstanceId={moduleInstance.id} />
      )}
    </div>

      <FloatingSaveBar onSave={handleSave} isSaving={isSaving} />
    </>
  );
}
