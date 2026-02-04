import { useState, useEffect } from 'react';
import { AlertTriangle, Flame, Bell, Shield, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import FloatingSaveBar from './FloatingSaveBar';
import SectionGrade from '../../SectionGrade';
import { updateSectionGrade } from '../../../utils/sectionGrades';

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

type WaterSupplyReliability = 'reliable' | 'unreliable' | 'unknown';
type CoverageAdequacy = 'poor' | 'adequate' | 'good' | 'unknown';
type MonitoringType = 'none' | 'keyholder' | 'arc' | 'unknown';
type LocalisedProtectionLevel = 'yes' | 'partial' | 'no' | 'unknown';

interface SprinklersData {
  provided_pct?: number | null;
  required_pct?: number | null;
  notes: string;
  rating: 1 | 2 | 3 | 4 | 5;
  system_standard?: string;
  system_type?: string;
  hazard_class?: string;
  last_service_date?: string | null;
  has_impairments?: string;
  impairments_notes?: string;
  valve_supervision?: string;
  heating_adequate?: string;
}

interface WaterMistData {
  provided_pct?: number | null;
  required_pct?: number | null;
  notes: string;
  rating: 1 | 2 | 3 | 4 | 5;
}

interface LocalisedProtectionSystem {
  protected: LocalisedProtectionLevel;
  notes: string;
}

interface BuildingSuppressionData {
  sprinklers?: SprinklersData;
  water_mist?: WaterMistData;
}

interface BuildingLocalisedProtection {
  foam?: LocalisedProtectionSystem;
  gaseous?: LocalisedProtectionSystem;
}

interface BuildingDetectionData {
  system_type?: string;
  coverage?: CoverageAdequacy;
  monitoring?: MonitoringType;
  notes: string;
  rating: 1 | 2 | 3 | 4 | 5;
}

interface BuildingFireProtection {
  suppression: BuildingSuppressionData;
  localised_protection: BuildingLocalisedProtection;
  detection_alarm: BuildingDetectionData;
  nle_reduction_applicable?: boolean | null;
  nle_reduction_notes?: string;
  notes: string;
}

interface OperationalReadiness {
  testing_rating: 1 | 2 | 3 | 4 | 5;
  impairment_management_rating: 1 | 2 | 3 | 4 | 5;
  emergency_response_rating: 1 | 2 | 3 | 4 | 5;
  notes: string;
}

interface SiteData {
  water_supply_reliability: WaterSupplyReliability;
  water_supply_notes: string;
  operational_readiness: OperationalReadiness;
}

interface FireProtectionModule {
  buildings: Record<string, BuildingFireProtection>;
  site: SiteData;
}

interface ConstructionBuilding {
  id: string;
  building_name: string;
}

const RATING_HELP = {
  1: 'Inadequate - materially below industry expectation',
  2: 'Weak / marginal - significant gaps or reliability concerns',
  3: 'Generally adequate - meets normal industry expectation',
  4: 'Good - above average, reliable, minor gaps only',
  5: 'Robust / best practice - strong, resilient, well maintained'
};

function getMonitoringButtonStyles(type: MonitoringType, isSelected: boolean): string {
  if (!isSelected) {
    return 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-2 border-transparent';
  }

  switch (type) {
    case 'none':
      return 'bg-red-50 text-red-900 border-2 border-red-600 font-semibold';
    case 'keyholder':
      return 'bg-amber-50 text-amber-900 border-2 border-amber-600 font-semibold';
    case 'arc':
      return 'bg-green-50 text-green-900 border-2 border-green-600 font-semibold';
    case 'unknown':
      return 'bg-slate-50 text-slate-900 border-2 border-slate-600 font-semibold';
    default:
      return 'bg-blue-50 text-blue-900 border-2 border-blue-600 font-semibold';
  }
}

function getCoverageButtonStyles(level: CoverageAdequacy, isSelected: boolean): string {
  if (!isSelected) {
    return 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-2 border-transparent';
  }

  switch (level) {
    case 'poor':
      return 'bg-red-50 text-red-900 border-2 border-red-600 font-semibold';
    case 'adequate':
      return 'bg-amber-50 text-amber-900 border-2 border-amber-600 font-semibold';
    case 'good':
      return 'bg-green-50 text-green-900 border-2 border-green-600 font-semibold';
    case 'unknown':
      return 'bg-slate-50 text-slate-900 border-2 border-slate-600 font-semibold';
    default:
      return 'bg-blue-50 text-blue-900 border-2 border-blue-600 font-semibold';
  }
}

function getProtectionButtonStyles(level: LocalisedProtectionLevel, isSelected: boolean): string {
  if (!isSelected) {
    return 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-2 border-transparent';
  }

  switch (level) {
    case 'no':
      return 'bg-red-50 text-red-900 border-2 border-red-600 font-semibold';
    case 'partial':
      return 'bg-amber-50 text-amber-900 border-2 border-amber-600 font-semibold';
    case 'yes':
      return 'bg-green-50 text-green-900 border-2 border-green-600 font-semibold';
    case 'unknown':
      return 'bg-slate-50 text-slate-900 border-2 border-slate-600 font-semibold';
    default:
      return 'bg-blue-50 text-blue-900 border-2 border-blue-600 font-semibold';
  }
}

function getWaterSupplyButtonStyles(level: WaterSupplyReliability, isSelected: boolean): string {
  if (!isSelected) {
    return 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-2 border-transparent';
  }

  switch (level) {
    case 'unreliable':
      return 'bg-red-50 text-red-900 border-2 border-red-600 font-semibold';
    case 'reliable':
      return 'bg-green-50 text-green-900 border-2 border-green-600 font-semibold';
    case 'unknown':
      return 'bg-slate-50 text-slate-900 border-2 border-slate-600 font-semibold';
    default:
      return 'bg-blue-50 text-blue-900 border-2 border-blue-600 font-semibold';
  }
}

function createDefaultBuildingProtection(): BuildingFireProtection {
  return {
    suppression: {},
    localised_protection: {},
    detection_alarm: {
      system_type: '',
      coverage: 'unknown',
      monitoring: 'unknown',
      notes: '',
      rating: 3
    },
    nle_reduction_applicable: null,
    nle_reduction_notes: '',
    notes: ''
  };
}

function createDefaultSiteData(): SiteData {
  return {
    water_supply_reliability: 'unknown',
    water_supply_notes: '',
    operational_readiness: {
      testing_rating: 3,
      impairment_management_rating: 3,
      emergency_response_rating: 3,
      notes: ''
    }
  };
}

function migrateMonitoringValues(fireProtection: FireProtectionModule): FireProtectionModule {
  const migratedBuildings = { ...fireProtection.buildings };

  Object.keys(migratedBuildings).forEach((buildingId) => {
    const building = migratedBuildings[buildingId];
    if (building.detection_alarm) {
      const currentMonitoring = building.detection_alarm.monitoring as any;
      if (currentMonitoring === 'inherit' || !currentMonitoring) {
        migratedBuildings[buildingId] = {
          ...building,
          detection_alarm: {
            ...building.detection_alarm,
            monitoring: 'unknown'
          }
        };
      }
    }
  });

  return {
    ...fireProtection,
    buildings: migratedBuildings
  };
}

export default function RE06FireProtectionForm({
  moduleInstance,
  document,
  onSaved
}: RE06FireProtectionFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [constructionBuildings, setConstructionBuildings] = useState<ConstructionBuilding[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [siteExpanded, setSiteExpanded] = useState(true);
  const [sectionGrade, setSectionGrade] = useState<number>(3);

  const d = moduleInstance.data || {};
  const rawFireProtection: FireProtectionModule = {
    buildings: d.fire_protection?.buildings || {},
    site: d.fire_protection?.site || createDefaultSiteData()
  };

  const safeFireProtection = migrateMonitoringValues(rawFireProtection);

  const [formData, setFormData] = useState<{ fire_protection: FireProtectionModule }>({
    fire_protection: safeFireProtection
  });

  useEffect(() => {
    async function loadConstructionBuildings() {
      try {
        const { data: constructionInstance, error } = await supabase
          .from('module_instances')
          .select('data')
          .eq('document_id', moduleInstance.document_id)
          .eq('module_key', 'RE_02_CONSTRUCTION')
          .maybeSingle();

        if (error) throw error;

        const buildings = Array.isArray(constructionInstance?.data?.construction?.buildings)
          ? constructionInstance.data.construction.buildings
          : [];

        setConstructionBuildings(buildings);

        if (buildings.length > 0 && !selectedBuildingId) {
          setSelectedBuildingId(buildings[0].id);
        }

        setFormData((prev) => {
          const updatedBuildings = { ...prev.fire_protection.buildings };
          buildings.forEach((b: ConstructionBuilding) => {
            if (!updatedBuildings[b.id]) {
              updatedBuildings[b.id] = createDefaultBuildingProtection();
            }
          });

          return {
            ...prev,
            fire_protection: {
              ...prev.fire_protection,
              buildings: updatedBuildings
            }
          };
        });
      } catch (err) {
        console.error('Error loading construction buildings:', err);
        setConstructionBuildings([]);
      }
    }

    loadConstructionBuildings();
  }, [moduleInstance.document_id]);

  // Load section grade from document
  useEffect(() => {
    async function loadSectionGrade() {
      try {
        const { data: doc, error } = await supabase
          .from('documents')
          .select('section_grades')
          .eq('id', document.id)
          .maybeSingle();

        if (error) {
          console.error('[RE06] Error loading section grade:', error);
          return;
        }

        const grade = doc?.section_grades?.fire_protection;
        if (grade !== undefined) {
          setSectionGrade(grade);
        }
      } catch (error) {
        console.error('[RE06] Exception loading section grade:', error);
      }
    }

    loadSectionGrade();
  }, [document.id]);

  const handleSectionGradeChange = async (value: number) => {
    setSectionGrade(value);
    // Persist to canonical documents.section_grades
    const { error } = await updateSectionGrade(document.id, 'fire_protection', value);
    if (error) {
      console.error('[RE06] Failed to update section grade:', error);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('module_instances')
        .update({
          data: formData
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

  const updateBuildingField = (buildingId: string, path: string[], value: any) => {
    setFormData((prev) => {
      const building = { ...prev.fire_protection.buildings[buildingId] };
      let current: any = building;

      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) {
          current[path[i]] = {};
        }
        current[path[i]] = { ...current[path[i]] };
        current = current[path[i]];
      }

      current[path[path.length - 1]] = value;

      return {
        ...prev,
        fire_protection: {
          ...prev.fire_protection,
          buildings: {
            ...prev.fire_protection.buildings,
            [buildingId]: building
          }
        }
      };
    });
  };

  const updateSiteField = (path: string[], value: any) => {
    setFormData((prev) => {
      const site = { ...prev.fire_protection.site };
      let current: any = site;

      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) {
          current[path[i]] = {};
        }
        current[path[i]] = { ...current[path[i]] };
        current = current[path[i]];
      }

      current[path[path.length - 1]] = value;

      return {
        ...prev,
        fire_protection: {
          ...prev.fire_protection,
          site
        }
      };
    });
  };

  const selectedBuilding = selectedBuildingId
    ? constructionBuildings.find(b => b.id === selectedBuildingId)
    : null;

  const selectedBuildingData = selectedBuildingId
    ? formData.fire_protection.buildings[selectedBuildingId] || createDefaultBuildingProtection()
    : null;

  const waterSupplyUnreliable = formData.fire_protection.site.water_supply_reliability === 'unreliable';
  const hasSprinklersOrMist = selectedBuildingData &&
    (selectedBuildingData.suppression.sprinklers || selectedBuildingData.suppression.water_mist);

  const RatingSelector = ({
    value,
    onChange,
    label
  }: {
    value: number;
    onChange: (v: number) => void;
    label: string;
  }) => (
    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
      <label className="block text-sm font-semibold text-slate-900 mb-3">{label}</label>
      <div className="flex items-center gap-2 mb-3">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            className={`flex-1 py-3 text-lg font-bold rounded-lg transition-colors ${
              value === rating
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-300 hover:border-blue-400'
            }`}
          >
            {rating}
          </button>
        ))}
      </div>
      <div className="text-xs text-slate-600 space-y-1 bg-white rounded p-3">
        <div><strong>1:</strong> {RATING_HELP[1]}</div>
        <div><strong>3:</strong> {RATING_HELP[3]}</div>
        <div><strong>5:</strong> {RATING_HELP[5]}</div>
      </div>
    </div>
  );

  if (constructionBuildings.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-04 - Fire Protection</h2>
          <p className="text-slate-600">Active fire protection effectiveness assessment</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">No Buildings Found</h3>
            <p className="text-sm text-blue-800">
              Complete RE-02 Construction module first to define buildings before assessing fire protection.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 md:p-6 max-w-5xl mx-auto pb-24">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-04 - Fire Protection</h2>
          <p className="text-slate-600">Active fire protection effectiveness assessment</p>
        </div>

        {/* No Buildings Message */}
        {constructionBuildings.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-900 mb-1">No Buildings Configured</h4>
                <p className="text-sm text-amber-800 mb-2">
                  Please complete the RE-02 Construction module first to define your buildings before assessing fire protection.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Horizontal Building Tabs (Mobile-First) */}
        {constructionBuildings.length > 0 && (
          <div className="mb-6 -mx-4 md:mx-0">
            <div className="overflow-x-auto px-4 md:px-0">
              <div className="flex gap-2 pb-2 min-w-max md:min-w-0">
                {constructionBuildings.map((building) => (
                  <button
                    key={building.id}
                    onClick={() => setSelectedBuildingId(building.id)}
                    className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-colors ${
                      selectedBuildingId === building.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {building.building_name || 'Unnamed Building'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Per-Building Content */}
        {selectedBuilding && selectedBuildingData && (
          <div className="space-y-6">
            {/* Water Supply Warning */}
            {waterSupplyUnreliable && hasSprinklersOrMist && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-900 mb-1">Water Supply Concern</h4>
                  <p className="text-sm text-amber-800">
                    Site water supply is marked as unreliable, which may affect water-based suppression effectiveness.
                  </p>
                </div>
              </div>
            )}

            {/* Suppression - Whole-building / Area Protection */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                Suppression - Whole-building / Area Protection
              </h3>

              {/* Sprinklers */}
              <div className="mb-6 pb-6 border-b border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-slate-900">Sprinklers</h4>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedBuildingData.suppression.sprinklers) {
                        updateBuildingField(selectedBuildingId, ['suppression', 'sprinklers'], undefined);
                      } else {
                        updateBuildingField(selectedBuildingId, ['suppression', 'sprinklers'], {
                          provided_pct: null,
                          required_pct: null,
                          notes: '',
                          rating: 3,
                          system_standard: '',
                          system_type: '',
                          hazard_class: '',
                          last_service_date: null,
                          has_impairments: '',
                          impairments_notes: '',
                          valve_supervision: '',
                          heating_adequate: ''
                        });
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      selectedBuildingData.suppression.sprinklers
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {selectedBuildingData.suppression.sprinklers ? 'Enabled' : 'Enable'}
                  </button>
                </div>

                {selectedBuildingData.suppression.sprinklers && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          % Floor Area Protected
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={selectedBuildingData.suppression.sprinklers.provided_pct ?? ''}
                          onChange={(e) => updateBuildingField(
                            selectedBuildingId,
                            ['suppression', 'sprinklers', 'provided_pct'],
                            e.target.value ? parseFloat(e.target.value) : null
                          )}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          placeholder="0-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          % Floor Area Required
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={selectedBuildingData.suppression.sprinklers.required_pct ?? ''}
                          onChange={(e) => updateBuildingField(
                            selectedBuildingId,
                            ['suppression', 'sprinklers', 'required_pct'],
                            e.target.value ? parseFloat(e.target.value) : null
                          )}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          placeholder="0-100"
                        />
                      </div>
                    </div>

                    {selectedBuildingData.suppression.sprinklers.provided_pct != null &&
                     selectedBuildingData.suppression.sprinklers.required_pct != null &&
                     selectedBuildingData.suppression.sprinklers.provided_pct < selectedBuildingData.suppression.sprinklers.required_pct && (
                      <div className="bg-amber-50 border border-amber-200 rounded p-3 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800">
                          Coverage gap: {selectedBuildingData.suppression.sprinklers.required_pct - selectedBuildingData.suppression.sprinklers.provided_pct}% shortfall
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Notes
                        <span className="text-xs text-slate-500 ml-2 font-normal">
                          (design basis, condition, defects, maintenance, constraints)
                        </span>
                      </label>
                      <textarea
                        value={selectedBuildingData.suppression.sprinklers.notes}
                        onChange={(e) => updateBuildingField(
                          selectedBuildingId,
                          ['suppression', 'sprinklers', 'notes'],
                          e.target.value
                        )}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="Design basis, system condition, known defects, maintenance regime..."
                      />
                    </div>

                    <RatingSelector
                      value={selectedBuildingData.suppression.sprinklers.rating}
                      onChange={(v) => updateBuildingField(selectedBuildingId, ['suppression', 'sprinklers', 'rating'], v)}
                      label="Sprinkler System Rating (1-5)"
                    />

                    {/* Sprinkler System Details */}
                    <div className="border-t border-slate-200 pt-6 mt-6">
                      <h5 className="text-sm font-semibold text-slate-900 mb-4">Sprinkler System Details</h5>
                      <p className="text-xs text-slate-600 mb-4">
                        These details support professional judgment of coverage, reliability, and rating effectiveness.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {/* System Standard */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            System Standard <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={selectedBuildingData.suppression.sprinklers.system_standard || ''}
                            onChange={(e) => updateBuildingField(
                              selectedBuildingId,
                              ['suppression', 'sprinklers', 'system_standard'],
                              e.target.value
                            )}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          >
                            <option value="">Select...</option>
                            <option value="EN12845">EN 12845</option>
                            <option value="NFPA13">NFPA 13</option>
                            <option value="FM">FM</option>
                            <option value="LPC">LPC</option>
                            <option value="Other">Other</option>
                            <option value="Unknown">Unknown</option>
                          </select>
                        </div>

                        {/* System Type */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            System Type <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={selectedBuildingData.suppression.sprinklers.system_type || ''}
                            onChange={(e) => updateBuildingField(
                              selectedBuildingId,
                              ['suppression', 'sprinklers', 'system_type'],
                              e.target.value
                            )}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          >
                            <option value="">Select...</option>
                            <option value="Wet">Wet</option>
                            <option value="Dry">Dry</option>
                            <option value="Pre-action">Pre-action</option>
                            <option value="Deluge">Deluge</option>
                            <option value="Unknown">Unknown</option>
                          </select>
                        </div>

                        {/* Hazard Class */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Hazard Class (as designed) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={selectedBuildingData.suppression.sprinklers.hazard_class || ''}
                            onChange={(e) => updateBuildingField(
                              selectedBuildingId,
                              ['suppression', 'sprinklers', 'hazard_class'],
                              e.target.value
                            )}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                            placeholder="e.g., OH2, LH, HHP"
                          />
                        </div>

                        {/* Last Service Date */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Last Full Service/Inspection <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={selectedBuildingData.suppression.sprinklers.last_service_date || ''}
                            onChange={(e) => updateBuildingField(
                              selectedBuildingId,
                              ['suppression', 'sprinklers', 'last_service_date'],
                              e.target.value || null
                            )}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          />
                        </div>

                        {/* Known Impairments */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Known Impairments or Defects <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={selectedBuildingData.suppression.sprinklers.has_impairments || ''}
                            onChange={(e) => updateBuildingField(
                              selectedBuildingId,
                              ['suppression', 'sprinklers', 'has_impairments'],
                              e.target.value
                            )}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          >
                            <option value="">Select...</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                            <option value="Unknown">Unknown</option>
                          </select>
                        </div>

                        {/* Valve Supervision */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Valve Supervision
                          </label>
                          <select
                            value={selectedBuildingData.suppression.sprinklers.valve_supervision || ''}
                            onChange={(e) => updateBuildingField(
                              selectedBuildingId,
                              ['suppression', 'sprinklers', 'valve_supervision'],
                              e.target.value
                            )}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          >
                            <option value="">Select...</option>
                            <option value="Yes">Yes</option>
                            <option value="Partial">Partial</option>
                            <option value="No">No</option>
                            <option value="Unknown">Unknown</option>
                          </select>
                        </div>

                        {/* Heating Adequate (only for Wet systems) */}
                        {selectedBuildingData.suppression.sprinklers.system_type === 'Wet' && (
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Heating Adequate (if wet)
                            </label>
                            <select
                              value={selectedBuildingData.suppression.sprinklers.heating_adequate || ''}
                              onChange={(e) => updateBuildingField(
                                selectedBuildingId,
                                ['suppression', 'sprinklers', 'heating_adequate'],
                                e.target.value
                              )}
                              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                            >
                              <option value="">Select...</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                              <option value="Unknown">Unknown</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Impairments Notes (conditional) */}
                      {selectedBuildingData.suppression.sprinklers.has_impairments === 'Yes' && (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Impairments/Defects Details
                          </label>
                          <textarea
                            value={selectedBuildingData.suppression.sprinklers.impairments_notes || ''}
                            onChange={(e) => updateBuildingField(
                              selectedBuildingId,
                              ['suppression', 'sprinklers', 'impairments_notes'],
                              e.target.value
                            )}
                            rows={3}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                            placeholder="Describe known impairments, defects, or concerns..."
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Water Mist */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-slate-900">Water Mist</h4>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedBuildingData.suppression.water_mist) {
                        updateBuildingField(selectedBuildingId, ['suppression', 'water_mist'], undefined);
                      } else {
                        updateBuildingField(selectedBuildingId, ['suppression', 'water_mist'], {
                          provided_pct: null,
                          required_pct: null,
                          notes: '',
                          rating: 3
                        });
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      selectedBuildingData.suppression.water_mist
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {selectedBuildingData.suppression.water_mist ? 'Enabled' : 'Enable'}
                  </button>
                </div>

                {selectedBuildingData.suppression.water_mist && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          % Floor Area Protected
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={selectedBuildingData.suppression.water_mist.provided_pct ?? ''}
                          onChange={(e) => updateBuildingField(
                            selectedBuildingId,
                            ['suppression', 'water_mist', 'provided_pct'],
                            e.target.value ? parseFloat(e.target.value) : null
                          )}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          placeholder="0-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          % Floor Area Required
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={selectedBuildingData.suppression.water_mist.required_pct ?? ''}
                          onChange={(e) => updateBuildingField(
                            selectedBuildingId,
                            ['suppression', 'water_mist', 'required_pct'],
                            e.target.value ? parseFloat(e.target.value) : null
                          )}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          placeholder="0-100"
                        />
                      </div>
                    </div>

                    {selectedBuildingData.suppression.water_mist.provided_pct != null &&
                     selectedBuildingData.suppression.water_mist.required_pct != null &&
                     selectedBuildingData.suppression.water_mist.provided_pct < selectedBuildingData.suppression.water_mist.required_pct && (
                      <div className="bg-amber-50 border border-amber-200 rounded p-3 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800">
                          Coverage gap: {selectedBuildingData.suppression.water_mist.required_pct - selectedBuildingData.suppression.water_mist.provided_pct}% shortfall
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Notes
                      </label>
                      <textarea
                        value={selectedBuildingData.suppression.water_mist.notes}
                        onChange={(e) => updateBuildingField(
                          selectedBuildingId,
                          ['suppression', 'water_mist', 'notes'],
                          e.target.value
                        )}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="System details, design basis, condition..."
                      />
                    </div>

                    <RatingSelector
                      value={selectedBuildingData.suppression.water_mist.rating}
                      onChange={(v) => updateBuildingField(selectedBuildingId, ['suppression', 'water_mist', 'rating'], v)}
                      label="Water Mist System Rating (1-5)"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Localised Fire Protection / Special Hazards */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-500" />
                Localised Fire Protection / Special Hazards
              </h3>

              {/* Foam */}
              <div className="mb-6 pb-6 border-b border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-slate-900">Foam</h4>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedBuildingData.localised_protection.foam) {
                        updateBuildingField(selectedBuildingId, ['localised_protection', 'foam'], undefined);
                      } else {
                        updateBuildingField(selectedBuildingId, ['localised_protection', 'foam'], {
                          protected: 'unknown',
                          notes: ''
                        });
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      selectedBuildingData.localised_protection.foam
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {selectedBuildingData.localised_protection.foam ? 'Enabled' : 'Enable'}
                  </button>
                </div>

                {selectedBuildingData.localised_protection.foam && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Hazard Protected?
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['yes', 'partial', 'no', 'unknown'] as LocalisedProtectionLevel[]).map((level) => {
                          const isSelected = selectedBuildingData.localised_protection.foam?.protected === level;
                          return (
                            <button
                              key={level}
                              type="button"
                              onClick={() => updateBuildingField(selectedBuildingId, ['localised_protection', 'foam', 'protected'], level)}
                              className={`px-3 py-2 rounded-lg text-sm transition-colors capitalize ${
                                getProtectionButtonStyles(level, isSelected)
                              }`}
                            >
                              {level}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Notes
                        <span className="text-xs text-slate-500 ml-2 font-normal">
                          (what is protected, release logic, maintenance, constraints)
                        </span>
                      </label>
                      <textarea
                        value={selectedBuildingData.localised_protection.foam.notes}
                        onChange={(e) => updateBuildingField(selectedBuildingId, ['localised_protection', 'foam', 'notes'], e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="Describe hazards protected, release logic, maintenance regime..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Gaseous */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-slate-900">Gaseous</h4>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedBuildingData.localised_protection.gaseous) {
                        updateBuildingField(selectedBuildingId, ['localised_protection', 'gaseous'], undefined);
                      } else {
                        updateBuildingField(selectedBuildingId, ['localised_protection', 'gaseous'], {
                          protected: 'unknown',
                          notes: ''
                        });
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      selectedBuildingData.localised_protection.gaseous
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {selectedBuildingData.localised_protection.gaseous ? 'Enabled' : 'Enable'}
                  </button>
                </div>

                {selectedBuildingData.localised_protection.gaseous && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Hazard Protected?
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['yes', 'partial', 'no', 'unknown'] as LocalisedProtectionLevel[]).map((level) => {
                          const isSelected = selectedBuildingData.localised_protection.gaseous?.protected === level;
                          return (
                            <button
                              key={level}
                              type="button"
                              onClick={() => updateBuildingField(selectedBuildingId, ['localised_protection', 'gaseous', 'protected'], level)}
                              className={`px-3 py-2 rounded-lg text-sm transition-colors capitalize ${
                                getProtectionButtonStyles(level, isSelected)
                              }`}
                            >
                              {level}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Notes
                      </label>
                      <textarea
                        value={selectedBuildingData.localised_protection.gaseous.notes}
                        onChange={(e) => updateBuildingField(selectedBuildingId, ['localised_protection', 'gaseous', 'notes'], e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="Describe hazards protected, agent type, release logic..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Detection & Alarm */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-500" />
                Detection & Alarm
              </h3>

              {/* DEBUG BANNER */}
              <div className="w-full bg-pink-200 border-2 border-pink-600 rounded-lg p-4 mb-6">
                <p className="font-bold text-slate-900 text-center text-lg">
                  RE-04 DETECTION & ALARM RENDER CHECK — BUILD: 2026-02-04 — NO INHERIT SHOULD EXIST
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    System Type
                  </label>
                  <input
                    type="text"
                    value={selectedBuildingData.detection_alarm.system_type || ''}
                    onChange={(e) => updateBuildingField(selectedBuildingId, ['detection_alarm', 'system_type'], e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="e.g., Addressable, Conventional, Analogue..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Coverage Adequacy
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['poor', 'adequate', 'good', 'unknown'] as CoverageAdequacy[]).map((level) => {
                      const isSelected = selectedBuildingData.detection_alarm.coverage === level;
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => updateBuildingField(selectedBuildingId, ['detection_alarm', 'coverage'], level)}
                          className={`px-3 py-2 rounded-lg text-sm transition-colors capitalize ${
                            getCoverageButtonStyles(level, isSelected)
                          }`}
                        >
                          {level}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Monitoring
                  </label>
                  {/* DEBUG: Show monitoring options array */}
                  <div className="mb-2 p-2 bg-yellow-100 border border-yellow-400 rounded text-xs font-mono">
                    <strong>DEBUG - Monitoring options:</strong> {(['none', 'keyholder', 'arc', 'unknown'] as MonitoringType[]).join(', ')}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {(['none', 'keyholder', 'arc', 'unknown'] as MonitoringType[]).map((type) => {
                      const currentMonitoring = selectedBuildingData.detection_alarm.monitoring as any;
                      const normalizedMonitoring = (currentMonitoring === 'inherit' || !currentMonitoring) ? 'unknown' : currentMonitoring;
                      const isSelected = normalizedMonitoring === type;

                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => updateBuildingField(selectedBuildingId, ['detection_alarm', 'monitoring'], type)}
                          className={`px-3 py-2 rounded-lg text-sm transition-colors capitalize ${
                            getMonitoringButtonStyles(type, isSelected)
                          }`}
                        >
                          {type === 'arc' ? 'ARC' : type}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={selectedBuildingData.detection_alarm.notes}
                    onChange={(e) => updateBuildingField(selectedBuildingId, ['detection_alarm', 'notes'], e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="Coverage details, zones, testing regime..."
                  />
                </div>

                <RatingSelector
                  value={selectedBuildingData.detection_alarm.rating}
                  onChange={(v) => updateBuildingField(selectedBuildingId, ['detection_alarm', 'rating'], v)}
                  label="Detection & Alarm Rating (1-5)"
                />
              </div>
            </div>

            {/* Building Summary - NLE Influence */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Building Summary - NLE Influence
              </h3>

              <div className="space-y-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedBuildingData.nle_reduction_applicable === true}
                    onChange={(e) => updateBuildingField(
                      selectedBuildingId,
                      ['nle_reduction_applicable'],
                      e.target.checked ? true : null
                    )}
                    className="mt-1"
                  />
                  <span className="text-sm text-slate-700">
                    <strong>Installed protection materially reduces site-wide NLE for this building</strong>
                  </span>
                </label>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Rationale (optional)
                  </label>
                  <textarea
                    value={selectedBuildingData.nle_reduction_notes || ''}
                    onChange={(e) => updateBuildingField(selectedBuildingId, ['nle_reduction_notes'], e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="Brief rationale for NLE reduction..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Site-Wide Content (Collapsible) */}
        <div className="mt-8 bg-white rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setSiteExpanded(!siteExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
          >
            <h3 className="text-lg font-semibold text-slate-900">Site-Wide Fire Protection</h3>
            {siteExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {siteExpanded && (
            <div className="px-6 pb-6 space-y-6">
              {/* Water Supply Reliability */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  Water Supply Reliability
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Assessment
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['reliable', 'unreliable', 'unknown'] as WaterSupplyReliability[]).map((level) => {
                        const isSelected = formData.fire_protection.site.water_supply_reliability === level;
                        return (
                          <button
                            key={level}
                            type="button"
                            onClick={() => updateSiteField(['water_supply_reliability'], level)}
                            className={`px-4 py-2 rounded-lg transition-colors capitalize ${
                              getWaterSupplyButtonStyles(level, isSelected)
                            }`}
                          >
                            {level}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Notes / Rationale
                      <span className="text-xs text-slate-500 ml-2 font-normal">
                        (source, constraints, testing, resilience)
                      </span>
                    </label>
                    <textarea
                      value={formData.fire_protection.site.water_supply_notes}
                      onChange={(e) => updateSiteField(['water_supply_notes'], e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      placeholder="Describe sources, capacity, constraints, testing history, resilience..."
                    />
                  </div>
                </div>
              </div>

              {/* Operational Readiness */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Operational Readiness (Site-Wide)
                </h4>

                <div className="space-y-6">
                  <RatingSelector
                    value={formData.fire_protection.site.operational_readiness.testing_rating}
                    onChange={(v) => updateSiteField(['operational_readiness', 'testing_rating'], v)}
                    label="Testing & Inspection Adequacy"
                  />

                  <RatingSelector
                    value={formData.fire_protection.site.operational_readiness.impairment_management_rating}
                    onChange={(v) => updateSiteField(['operational_readiness', 'impairment_management_rating'], v)}
                    label="Impairment Management Effectiveness"
                  />

                  <RatingSelector
                    value={formData.fire_protection.site.operational_readiness.emergency_response_rating}
                    onChange={(v) => updateSiteField(['operational_readiness', 'emergency_response_rating'], v)}
                    label="Emergency Response / Fire Brigade Interface Readiness"
                  />

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={formData.fire_protection.site.operational_readiness.notes}
                      onChange={(e) => updateSiteField(['operational_readiness', 'notes'], e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      placeholder="Overall operational readiness observations..."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section Grade */}
      <div className="max-w-5xl mx-auto px-6 pb-6">
        <SectionGrade
          sectionKey="fire_protection"
          sectionTitle="Fire Protection"
          value={sectionGrade}
          onChange={handleSectionGradeChange}
        />
      </div>

      <FloatingSaveBar onSave={handleSave} isSaving={isSaving} />
    </>
  );
}
