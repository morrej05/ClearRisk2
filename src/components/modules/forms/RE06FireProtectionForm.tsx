import { useState, useEffect } from 'react';
import { AlertTriangle, Building, Flame, Bell, CheckCircle2, ChevronRight } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import FloatingSaveBar from './FloatingSaveBar';

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
type AdequacyLevel = 'adequate' | 'marginal' | 'inadequate' | 'unknown';
type CoverageLevel = 'none' | 'partial' | 'full' | 'unknown';
type CoverageAdequacy = 'poor' | 'adequate' | 'good' | 'unknown';
type MonitoringType = 'none' | 'keyholder' | 'arc' | 'unknown';

interface SiteData {
  water_supply_reliability: WaterSupplyReliability;
  water_supply_notes: string;
  passive_fire_protection_adequacy: AdequacyLevel;
  passive_fire_protection_notes: string;
  fire_control_systems_adequacy: AdequacyLevel;
  fire_control_systems_notes: string;
  site_infrastructure?: {
    water_supplies?: any[];
    pump_sets?: any[];
    distribution?: any[];
  };
}

interface BuildingSuppressionData {
  systems_present: string[];
  coverage: CoverageLevel;
  notes: string;
  rating: 1 | 2 | 3 | 4 | 5;
}

interface BuildingDetectionData {
  system_type: string;
  coverage_adequacy: CoverageAdequacy;
  monitoring: MonitoringType;
  notes: string;
  rating: 1 | 2 | 3 | 4 | 5;
}

interface BuildingReadinessData {
  testing_inspection_notes: string;
  impairment_management_notes: string;
  general_notes: string;
  rating: 1 | 2 | 3 | 4 | 5;
}

interface BuildingFireProtection {
  suppression: BuildingSuppressionData;
  detection_alarm: BuildingDetectionData;
  readiness: BuildingReadinessData;
  notes: string;
}

interface FireProtectionModule {
  site: SiteData;
  buildings: Record<string, BuildingFireProtection>;
}

interface ConstructionBuilding {
  id: string;
  building_name: string;
}

const RATING_HELP = {
  1: 'Inadequate - materially below what this occupancy requires',
  2: 'Marginal / weak - significant gaps or reliability concerns',
  3: 'Generally adequate - meets normal industry expectation',
  4: 'Good - above average; reliable with minor gaps only',
  5: 'Robust / best practice - strong, resilient, well maintained'
};

function createDefaultBuildingProtection(): BuildingFireProtection {
  return {
    suppression: {
      systems_present: [],
      coverage: 'unknown',
      notes: '',
      rating: 3
    },
    detection_alarm: {
      system_type: '',
      coverage_adequacy: 'unknown',
      monitoring: 'unknown',
      notes: '',
      rating: 3
    },
    readiness: {
      testing_inspection_notes: '',
      impairment_management_notes: '',
      general_notes: '',
      rating: 3
    },
    notes: ''
  };
}

function createDefaultSiteData(): SiteData {
  return {
    water_supply_reliability: 'unknown',
    water_supply_notes: '',
    passive_fire_protection_adequacy: 'unknown',
    passive_fire_protection_notes: '',
    fire_control_systems_adequacy: 'unknown',
    fire_control_systems_notes: ''
  };
}

export default function RE06FireProtectionForm({
  moduleInstance,
  document,
  onSaved
}: RE06FireProtectionFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [constructionBuildings, setConstructionBuildings] = useState<ConstructionBuilding[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'site' | 'buildings'>('site');

  const d = moduleInstance.data || {};
  const safeFireProtection: FireProtectionModule = {
    site: d.fire_protection?.site || createDefaultSiteData(),
    buildings: d.fire_protection?.buildings || {}
  };

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

        // Initialize any missing buildings
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
  }, [moduleInstance.document_id, selectedBuildingId]);

  const handleSave = async () => {
    if (isSaving) return;
    setSaveError(null);
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
      const errorMsg = 'Failed to save module. Please try again.';
      setSaveError(errorMsg);
      alert(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSiteField = <K extends keyof SiteData>(field: K, value: SiteData[K]) => {
    setFormData({
      ...formData,
      fire_protection: {
        ...formData.fire_protection,
        site: {
          ...formData.fire_protection.site,
          [field]: value
        }
      }
    });
  };

  const updateBuildingField = (
    buildingId: string,
    section: 'suppression' | 'detection_alarm' | 'readiness',
    field: string,
    value: any
  ) => {
    setFormData({
      ...formData,
      fire_protection: {
        ...formData.fire_protection,
        buildings: {
          ...formData.fire_protection.buildings,
          [buildingId]: {
            ...formData.fire_protection.buildings[buildingId],
            [section]: {
              ...formData.fire_protection.buildings[buildingId]?.[section],
              [field]: value
            }
          }
        }
      }
    });
  };

  const toggleSuppressionSystem = (buildingId: string, system: string) => {
    const building = formData.fire_protection.buildings[buildingId];
    const currentSystems = building?.suppression?.systems_present || [];
    const newSystems = currentSystems.includes(system)
      ? currentSystems.filter(s => s !== system)
      : [...currentSystems, system];

    updateBuildingField(buildingId, 'suppression', 'systems_present', newSystems);
  };

  const selectedBuilding = selectedBuildingId
    ? constructionBuildings.find(b => b.id === selectedBuildingId)
    : null;

  const selectedBuildingData = selectedBuildingId
    ? formData.fire_protection.buildings[selectedBuildingId] || createDefaultBuildingProtection()
    : null;

  const waterSupplyUnreliable = formData.fire_protection.site.water_supply_reliability === 'unreliable';
  const hasWaterBasedSuppression = selectedBuildingData?.suppression.systems_present.some(
    s => ['sprinklers', 'water_mist', 'foam'].includes(s.toLowerCase())
  );

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

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto pb-24">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-04 - Fire Protection</h2>
          <p className="text-slate-600">
            Site-wide fire protection infrastructure and per-building fire protection systems assessment
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('site')}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === 'site'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Site-Wide Systems
          </button>
          <button
            onClick={() => {
              setActiveTab('buildings');
              if (constructionBuildings.length > 0 && !selectedBuildingId) {
                setSelectedBuildingId(constructionBuildings[0].id);
              }
            }}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === 'buildings'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Buildings ({constructionBuildings.length})
          </button>
        </div>

        {/* Site-Wide Systems Tab */}
        {activeTab === 'site' && (
          <div className="space-y-6">
            {/* Water Supply Reliability */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                Water Supply Reliability
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Reliability Assessment
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['reliable', 'unreliable', 'unknown'] as WaterSupplyReliability[]).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => updateSiteField('water_supply_reliability', level)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${
                          formData.fire_protection.site.water_supply_reliability === level
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Notes
                    <span className="text-xs text-slate-500 ml-2 font-normal">
                      (source, capacity, constraints, testing, resilience)
                    </span>
                  </label>
                  <textarea
                    value={formData.fire_protection.site.water_supply_notes}
                    onChange={(e) => updateSiteField('water_supply_notes', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="Describe water supply sources, capacity, redundancy, testing history, and any reliability concerns..."
                  />
                </div>
              </div>
            </div>

            {/* Passive Fire Protection */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Building className="w-5 h-5 text-slate-500" />
                Passive Fire Protection
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Adequacy Assessment
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['adequate', 'marginal', 'inadequate', 'unknown'] as AdequacyLevel[]).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => updateSiteField('passive_fire_protection_adequacy', level)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${
                          formData.fire_protection.site.passive_fire_protection_adequacy === level
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Notes
                    <span className="text-xs text-slate-500 ml-2 font-normal">
                      (compartmentation, fire stopping, doors, penetrations, management of change)
                    </span>
                  </label>
                  <textarea
                    value={formData.fire_protection.site.passive_fire_protection_notes}
                    onChange={(e) => updateSiteField('passive_fire_protection_notes', e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="Assess compartmentation strategy, fire stopping quality, fire doors and penetrations control, management of change processes..."
                  />
                </div>
              </div>
            </div>

            {/* Fire Control Systems */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-500" />
                Fire Control Systems
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Adequacy Assessment
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['adequate', 'marginal', 'inadequate', 'unknown'] as AdequacyLevel[]).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => updateSiteField('fire_control_systems_adequacy', level)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${
                          formData.fire_protection.site.fire_control_systems_adequacy === level
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Notes
                    <span className="text-xs text-slate-500 ml-2 font-normal">
                      (cause & effect, control panels, interfaces, testing & management)
                    </span>
                  </label>
                  <textarea
                    value={formData.fire_protection.site.fire_control_systems_notes}
                    onChange={(e) => updateSiteField('fire_control_systems_notes', e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="Describe cause & effect strategy, control panels/fire control room, system interfaces (smoke control, suppression release, shutdowns), testing & management..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Buildings Tab */}
        {activeTab === 'buildings' && (
          <div className="flex gap-6">
            {/* Building List Sidebar */}
            <div className="w-64 flex-shrink-0">
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Buildings</h3>
                {constructionBuildings.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No buildings found. Complete RE-02 Construction first.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {constructionBuildings.map((building) => (
                      <button
                        key={building.id}
                        onClick={() => setSelectedBuildingId(building.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                          selectedBuildingId === building.id
                            ? 'bg-blue-50 text-blue-900 font-medium'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">{building.building_name || 'Unnamed Building'}</span>
                        {selectedBuildingId === building.id && (
                          <ChevronRight className="w-4 h-4 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Building Details */}
            {selectedBuilding && selectedBuildingData && (
              <div className="flex-1 space-y-6">
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <h3 className="text-xl font-bold text-slate-900">
                    {selectedBuilding.building_name || 'Unnamed Building'}
                  </h3>
                </div>

                {/* Warning if water unreliable */}
                {waterSupplyUnreliable && hasWaterBasedSuppression && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-amber-900 mb-1">Water Supply Concern</h4>
                      <p className="text-sm text-amber-800">
                        Site water supply is marked as unreliable, which may affect the effectiveness of water-based suppression systems in this building.
                      </p>
                    </div>
                  </div>
                )}

                {/* Suppression Section */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-500" />
                    Automatic Suppression
                  </h4>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Systems Present
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {['Sprinklers', 'Water Mist', 'Gaseous', 'Foam'].map((system) => (
                          <button
                            key={system}
                            type="button"
                            onClick={() => toggleSuppressionSystem(selectedBuildingId, system)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              selectedBuildingData.suppression.systems_present.includes(system)
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {system}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Coverage
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['none', 'partial', 'full', 'unknown'] as CoverageLevel[]).map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => updateBuildingField(selectedBuildingId, 'suppression', 'coverage', level)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                              selectedBuildingData.suppression.coverage === level
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Notes
                        <span className="text-xs text-slate-500 ml-2 font-normal">
                          (system details, condition, defects, comments)
                        </span>
                      </label>
                      <textarea
                        value={selectedBuildingData.suppression.notes}
                        onChange={(e) => updateBuildingField(selectedBuildingId, 'suppression', 'notes', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="Describe system details, design basis, condition, defects, maintenance..."
                      />
                    </div>

                    <RatingSelector
                      value={selectedBuildingData.suppression.rating}
                      onChange={(v) => updateBuildingField(selectedBuildingId, 'suppression', 'rating', v)}
                      label="Suppression System Rating (1-5)"
                    />
                  </div>
                </div>

                {/* Detection & Alarm Section */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-blue-500" />
                    Detection & Alarm
                  </h4>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        System Type
                      </label>
                      <input
                        type="text"
                        value={selectedBuildingData.detection_alarm.system_type}
                        onChange={(e) => updateBuildingField(selectedBuildingId, 'detection_alarm', 'system_type', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="e.g., Addressable, Conventional, Analogue..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Coverage Adequacy
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['poor', 'adequate', 'good', 'unknown'] as CoverageAdequacy[]).map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => updateBuildingField(selectedBuildingId, 'detection_alarm', 'coverage_adequacy', level)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                              selectedBuildingData.detection_alarm.coverage_adequacy === level
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Monitoring
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['none', 'keyholder', 'arc', 'unknown'] as MonitoringType[]).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => updateBuildingField(selectedBuildingId, 'detection_alarm', 'monitoring', type)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                              selectedBuildingData.detection_alarm.monitoring === type
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {type === 'arc' ? 'ARC' : type}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Notes
                        <span className="text-xs text-slate-500 ml-2 font-normal">
                          (coverage details, testing regime)
                        </span>
                      </label>
                      <textarea
                        value={selectedBuildingData.detection_alarm.notes}
                        onChange={(e) => updateBuildingField(selectedBuildingId, 'detection_alarm', 'notes', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="Describe detection coverage, zones, testing regime, maintenance..."
                      />
                    </div>

                    <RatingSelector
                      value={selectedBuildingData.detection_alarm.rating}
                      onChange={(v) => updateBuildingField(selectedBuildingId, 'detection_alarm', 'rating', v)}
                      label="Detection & Alarm Rating (1-5)"
                    />
                  </div>
                </div>

                {/* Operational Readiness Section */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    Operational Readiness
                  </h4>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Testing & Inspection
                      </label>
                      <textarea
                        value={selectedBuildingData.readiness.testing_inspection_notes}
                        onChange={(e) => updateBuildingField(selectedBuildingId, 'readiness', 'testing_inspection_notes', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="Describe testing and inspection adequacy, frequency, compliance..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Impairment Management
                      </label>
                      <textarea
                        value={selectedBuildingData.readiness.impairment_management_notes}
                        onChange={(e) => updateBuildingField(selectedBuildingId, 'readiness', 'impairment_management_notes', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="Assess impairment management effectiveness, procedures, communication..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Day-to-Day Reliability
                      </label>
                      <textarea
                        value={selectedBuildingData.readiness.general_notes}
                        onChange={(e) => updateBuildingField(selectedBuildingId, 'readiness', 'general_notes', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="General reliability, housekeeping interactions, operational concerns..."
                      />
                    </div>

                    <RatingSelector
                      value={selectedBuildingData.readiness.rating}
                      onChange={(v) => updateBuildingField(selectedBuildingId, 'readiness', 'rating', v)}
                      label="Operational Readiness Rating (1-5)"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <FloatingSaveBar onSave={handleSave} isSaving={isSaving} />
    </>
  );
}
