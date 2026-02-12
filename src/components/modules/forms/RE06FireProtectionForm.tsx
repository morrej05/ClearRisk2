import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, Info, Droplet, Building as BuildingIcon, TrendingUp } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import {
  generateFireProtectionRecommendations,
  getSiteRecommendations,
  getBuildingRecommendations,
} from '../../../lib/modules/re04FireProtectionRecommendations';
import FireProtectionRecommendations from '../../re/FireProtectionRecommendations';

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

type WaterReliability = 'Reliable' | 'Unreliable' | 'Unknown';
type PumpArrangement = 'None' | 'Single' | 'Duty+Standby' | 'Unknown';
type PowerResilience = 'Good' | 'Mixed' | 'Poor' | 'Unknown';
type TestingRegime = 'Documented' | 'Some evidence' | 'None' | 'Unknown';
type MaintenanceStatus = 'Good' | 'Mixed' | 'Poor' | 'Unknown';
type SprinklerAdequacy = 'Adequate' | 'Inadequate' | 'Unknown';
type SupplyType =
  | 'Town mains'
  | 'Single tank (on-site)'
  | 'Dual tank (on-site)'
  | 'Break tank + mains'
  | 'Open water (reservoir)'
  | 'River / canal / open source'
  | 'Private main / estate main'
  | 'Other';
type WaterSupports = 'Sprinklers' | 'Hydrants / fire main / hose reels' | 'Both' | 'Unknown';
type CoverageQuality = 'Good' | 'Partial' | 'Poor' | 'Unknown';
type ConditionQuality = 'Good' | 'Concerns' | 'Unknown';
type YesNoUnknown = 'Yes' | 'No' | 'Unknown';
type TestEvidence = 'Documented' | 'Not documented' | 'Unknown';

interface SiteWaterData {
  water_reliability?: WaterReliability;
  supply_type?: string; // Now stores SupplyType value or legacy string
  supply_type_other?: string;
  supports?: WaterSupports;
  pumps_present?: boolean;
  pump_arrangement?: PumpArrangement;
  power_resilience?: PowerResilience;
  testing_regime?: TestingRegime;
  key_weaknesses?: string;
  // New hydrant/hose fields (PASS 1 additive)
  hydrant_coverage?: CoverageQuality;
  fire_main_condition?: ConditionQuality;
  hose_reels_present?: YesNoUnknown;
  flow_test_evidence?: TestEvidence;
  flow_test_date?: string;
}

type SprinklersInstalled = 'Yes' | 'No' | 'Partial' | 'Unknown';
type SystemType = 'Wet pipe' | 'Dry pipe' | 'Pre-action' | 'Deluge' | 'Combination / Mixed' | 'Unknown';
type SprinklerStandard = 'EN 12845' | 'NFPA 13' | 'FM' | 'LPC Rules' | 'VdS' | 'AS 2118' | 'NZS 4541' | 'SANS 10287' | 'Other…';
type LocalisedPresent = 'No' | 'Yes' | 'Partial' | 'Unknown';

interface BuildingSprinklerData {
  // New fields
  sprinklers_installed?: SprinklersInstalled;
  system_type?: SystemType;
  standard?: SprinklerStandard;
  standard_other?: string;
  localised_present?: LocalisedPresent;
  localised_type?: string; // Predominant type for now (Gas suppression, Water mist, Foam, Other)
  localised_protected_asset?: string;
  localised_comments?: string;

  // Existing fields
  sprinkler_coverage_installed_pct?: number;
  sprinkler_coverage_required_pct?: number;
  sprinkler_standard?: string; // Legacy field - will migrate to 'standard'
  hazard_class?: string;
  maintenance_status?: MaintenanceStatus;
  sprinkler_adequacy?: SprinklerAdequacy;
  justification_if_required_lt_100?: string;
  sprinkler_score_1_5?: number | null;
  final_active_score_1_5?: number | null;
}

interface Building {
  id: string;
  ref?: string;
  description?: string;
  footprint_m2?: number;
  floor_area_sqm?: number;
}

interface BuildingFireProtection {
  sprinklerData?: BuildingSprinklerData;
  comments?: string;
}

interface FireProtectionModuleData {
  buildings: Record<string, BuildingFireProtection>;
  site: {
    water: SiteWaterData;
    water_score_1_5?: number | null; // null = not rated
    comments?: string;
  };
}

function calculateWaterScore(data: SiteWaterData): number {
  const { water_reliability, pump_arrangement, power_resilience, testing_regime } = data;

  if (water_reliability === 'Reliable') {
    if (testing_regime === 'Documented' && power_resilience === 'Good') {
      return 5;
    }
    if (testing_regime === 'Documented' || power_resilience === 'Good') {
      return 4;
    }
    return 4;
  }

  if (water_reliability === 'Unreliable') {
    return 1;
  }

  if (water_reliability === 'Unknown') {
    if (power_resilience === 'Poor' || testing_regime === 'None') {
      return 2;
    }
    if (pump_arrangement === 'Duty+Standby' && testing_regime !== 'None') {
      return 3;
    }
    return 3;
  }

  return 3;
}

function calculateSprinklerScore(data: BuildingSprinklerData): number | null {
  const {
    sprinklers_installed,
    sprinkler_coverage_installed_pct = 0,
    sprinkler_coverage_required_pct = 0,
    sprinkler_adequacy,
    maintenance_status,
  } = data;

  // If sprinklers not installed or unknown, return null (not rated)
  if (sprinklers_installed === 'No' || sprinklers_installed === 'Unknown') {
    return null;
  }

  // If required coverage is 0, sprinklers not required - return null
  if (sprinkler_coverage_required_pct === 0) {
    return null;
  }

  // If adequacy is unknown, return null (not enough data to rate)
  if (sprinkler_adequacy === 'Unknown') {
    return null;
  }

  const coverageRatio =
    sprinkler_coverage_required_pct > 0
      ? Math.min(1.0, sprinkler_coverage_installed_pct / sprinkler_coverage_required_pct)
      : 0;

  if (sprinkler_adequacy === 'Inadequate') {
    return coverageRatio < 0.3 ? 1 : 2;
  }

  if (sprinkler_adequacy === 'Adequate') {
    if (coverageRatio >= 0.95 && maintenance_status === 'Good') {
      return 5;
    }
    if (coverageRatio >= 0.95) {
      return 4;
    }
    if (coverageRatio >= 0.8) {
      return 4;
    }
    return 3;
  }

  // Default for partial data
  if (coverageRatio >= 0.95) {
    return maintenance_status === 'Good' ? 4 : 3;
  }
  if (coverageRatio >= 0.8) {
    return 3;
  }
  if (coverageRatio >= 0.6) {
    return 3;
  }
  if (coverageRatio >= 0.3) {
    return 2;
  }
  return 1;
}

function calculateFinalActiveScore(
  sprinklerScore: number | null,
  waterScore: number | null,
  suggestedWaterScore: number
): number | null {
  // If sprinkler score is null (not rated), final score is also null
  if (sprinklerScore === null) {
    return null;
  }

  // If water score is null, we can't compute a final score
  if (waterScore === null) {
    return null;
  }

  // Use assessor-set score if available, otherwise use suggested score for calculation
  const effectiveWaterScore = waterScore ?? suggestedWaterScore;
  return Math.min(sprinklerScore, effectiveWaterScore);
}

function generateAutoFlags(
  sprinklerData: BuildingSprinklerData,
  sprinklerScore: number | null,
  waterScore: number
): Array<{ severity: 'warning' | 'info'; message: string }> {
  const flags: Array<{ severity: 'warning' | 'info'; message: string }> = [];
  const {
    sprinklers_installed,
    sprinkler_coverage_installed_pct = 0,
    sprinkler_coverage_required_pct = 0,
  } = sprinklerData;

  // Skip coverage flags if sprinklers not installed
  if (sprinklers_installed !== 'No' && sprinklers_installed !== 'Unknown') {
    if (sprinkler_coverage_required_pct > sprinkler_coverage_installed_pct) {
      flags.push({
        severity: 'warning',
        message: `Coverage gap: ${sprinkler_coverage_required_pct}% required but only ${sprinkler_coverage_installed_pct}% installed`,
      });
    }

    if (sprinkler_coverage_required_pct === 0 && sprinkler_coverage_installed_pct > 0) {
      flags.push({
        severity: 'info',
        message: 'Sprinklers installed but marked as not required - verify rationale',
      });
    }
  }

  if (sprinklerScore !== null && sprinklerScore >= 4 && waterScore <= 2) {
    flags.push({
      severity: 'warning',
      message: `Sprinkler system rated highly (${sprinklerScore}/5) but water supply is unreliable (${waterScore}/5)`,
    });
  }

  return flags;
}

function calculateSiteRollup(
  fireProtectionData: FireProtectionModuleData,
  buildings: Building[]
): { averageScore: number; buildingsAssessed: number; totalArea: number } {
  let totalWeightedScore = 0;
  let totalArea = 0;
  let buildingsAssessed = 0;

  for (const building of buildings) {
    const buildingFP = fireProtectionData.buildings[building.id];
    if (!buildingFP?.sprinklerData) continue;

    // Exclude buildings with no sprinklers installed
    if (buildingFP.sprinklerData.sprinklers_installed === 'No') continue;

    const requiredPct = buildingFP.sprinklerData.sprinkler_coverage_required_pct || 0;
    if (requiredPct === 0) continue;

    const area = building.footprint_m2 || 0;
    const finalScore = buildingFP.sprinklerData.final_active_score_1_5;

    if (area > 0 && finalScore !== null && finalScore !== undefined) {
      totalWeightedScore += finalScore * area;
      totalArea += area;
      buildingsAssessed++;
    }
  }

  const averageScore = totalArea > 0 ? totalWeightedScore / totalArea : 0;

  return {
    averageScore: Math.round(averageScore * 10) / 10,
    buildingsAssessed,
    totalArea,
  };
}

function createDefaultSiteWater(): SiteWaterData {
  return {
    water_reliability: 'Unknown',
    supply_type: '',
    supply_type_other: '',
    supports: 'Unknown',
    pumps_present: false,
    pump_arrangement: 'Unknown',
    power_resilience: 'Unknown',
    testing_regime: 'Unknown',
    key_weaknesses: '',
    hydrant_coverage: 'Unknown',
    fire_main_condition: 'Unknown',
    hose_reels_present: 'Unknown',
    flow_test_evidence: 'Unknown',
    flow_test_date: '',
  };
}

function createDefaultBuildingSprinkler(): BuildingSprinklerData {
  return {
    sprinklers_installed: 'Unknown',
    system_type: 'Unknown',
    standard: undefined,
    standard_other: '',
    localised_present: 'No',
    localised_type: '',
    localised_protected_asset: '',
    localised_comments: '',
    sprinkler_coverage_installed_pct: 0,
    sprinkler_coverage_required_pct: 0,
    sprinkler_standard: '',
    hazard_class: '',
    maintenance_status: 'Unknown',
    sprinkler_adequacy: 'Unknown',
    justification_if_required_lt_100: '',
    sprinkler_score_1_5: null,
    final_active_score_1_5: null,
  };
}

export default function RE06FireProtectionForm({
  moduleInstance,
  document,
  onSaved,
}: RE06FireProtectionFormProps) {
  const [saving, setSaving] = useState(false);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);

  const initialData: FireProtectionModuleData = moduleInstance.data?.fire_protection || {
    buildings: {},
    site: {
      water: createDefaultSiteWater(),
      water_score_1_5: null, // Start as "Not rated"
      comments: '',
    },
  };

  // Data migration: Map sentinel value 0 or undefined to null for "Not rated"
  if (initialData.site.water_score_1_5 === 0 || initialData.site.water_score_1_5 === undefined) {
    initialData.site.water_score_1_5 = null;
  }

  const [fireProtectionData, setFireProtectionData] = useState<FireProtectionModuleData>(initialData);

  const siteWaterData = fireProtectionData.site.water;
  const siteWaterComments = fireProtectionData.site.comments || '';

  const selectedSprinklerData = selectedBuildingId
    ? fireProtectionData.buildings[selectedBuildingId]?.sprinklerData || createDefaultBuildingSprinkler()
    : createDefaultBuildingSprinkler();
  const selectedComments = selectedBuildingId
    ? fireProtectionData.buildings[selectedBuildingId]?.comments || ''
    : '';

  // Suggested score from inputs (always calculated, never null)
  const suggestedWaterScore = useMemo(() => {
    return calculateWaterScore(siteWaterData);
  }, [siteWaterData]);

  // Assessor-set score (can be null = "Not rated")
  const assessorWaterScore = fireProtectionData.site.water_score_1_5;

  const rawSprinklerScore = useMemo(() => {
    return calculateSprinklerScore(selectedSprinklerData);
  }, [selectedSprinklerData]);

  const selectedSprinklerScore = rawSprinklerScore; // Can be null

  const selectedFinalScore = useMemo(() => {
    return calculateFinalActiveScore(rawSprinklerScore, assessorWaterScore, suggestedWaterScore);
  }, [rawSprinklerScore, assessorWaterScore, suggestedWaterScore]);

  // Use assessor score if set, otherwise suggested for flags/rollup
  const effectiveWaterScore = assessorWaterScore ?? suggestedWaterScore;
  const autoFlags = generateAutoFlags(selectedSprinklerData, rawSprinklerScore, effectiveWaterScore);
  const siteRollup = calculateSiteRollup(fireProtectionData, buildings);

  const derivedRecommendations = useMemo(() => {
    const buildingsForRecs: Record<string, any> = {};

    Object.entries(fireProtectionData.buildings).forEach(([buildingId, buildingFP]) => {
      if (!buildingFP.sprinklerData) return;
      buildingsForRecs[buildingId] = {
        suppression: {
          sprinklers: {
            rating: buildingFP.sprinklerData.sprinkler_score_1_5,
            provided_pct: buildingFP.sprinklerData.sprinkler_coverage_installed_pct,
            required_pct: buildingFP.sprinklerData.sprinkler_coverage_required_pct,
          },
        },
      };
    });

    const fpModule = {
      buildings: buildingsForRecs,
      site: {
        water_supply_reliability: siteWaterData.water_reliability?.toLowerCase() as any,
      },
    };

    return generateFireProtectionRecommendations(fpModule);
  }, [fireProtectionData.buildings, siteWaterData.water_reliability]);

  useEffect(() => {
    async function loadBuildings() {
      try {
        const { data: buildingsData, error } = await supabase
          .from('re_buildings')
          .select('*')
          .eq('document_id', document.id)
          .order('created_at', { ascending: true });

        if (error) throw error;

        const loadedBuildings = (buildingsData || []) as Building[];
        setBuildings(loadedBuildings);

        if (loadedBuildings.length > 0 && !selectedBuildingId) {
          setSelectedBuildingId(loadedBuildings[0].id);
        }

        setFireProtectionData((prev) => {
          const updatedBuildings = { ...prev.buildings };
          for (const building of loadedBuildings) {
            if (!updatedBuildings[building.id]) {
              updatedBuildings[building.id] = {
                sprinklerData: createDefaultBuildingSprinkler(),
                comments: '',
              };
            }
          }
          return { ...prev, buildings: updatedBuildings };
        });
      } catch (error) {
        console.error('Failed to load buildings:', error);
      }
    }

    loadBuildings();
  }, [document.id]);

  const saveData = useCallback(async () => {
    if (saving) return;

    setSaving(true);
    try {
      await supabase
        .from('module_instances')
        .update({
          data: { fire_protection: fireProtectionData },
        })
        .eq('id', moduleInstance.id);

      // Autosave only - do not trigger parent refresh (onSaved)
      // Parent will be notified only on explicit manual save or module navigation
    } catch (error) {
      console.error('Failed to save fire protection data:', error);
    } finally {
      setSaving(false);
    }
  }, [saving, fireProtectionData, moduleInstance.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveData();
    }, 1000);

    return () => clearTimeout(timer);
  }, [siteWaterData, assessorWaterScore, siteWaterComments, selectedSprinklerData, selectedSprinklerScore, selectedFinalScore, selectedComments]);

  const updateSiteWater = (field: keyof SiteWaterData, value: any) => {
    setFireProtectionData((prev) => ({
      ...prev,
      site: {
        ...prev.site,
        water: {
          ...prev.site.water,
          [field]: value,
        },
        // Don't auto-calculate score anymore - assessor must explicitly set it
      },
    }));
  };

  const setAssessorWaterScore = (score: number | null) => {
    setFireProtectionData((prev) => ({
      ...prev,
      site: {
        ...prev.site,
        water_score_1_5: score,
      },
    }));
  };

  const applySuggestedScore = () => {
    setAssessorWaterScore(suggestedWaterScore);
  };

  const updateSiteComments = (comments: string) => {
    setFireProtectionData((prev) => ({
      ...prev,
      site: {
        ...prev.site,
        comments,
      },
    }));
  };

  const updateBuildingSprinkler = (field: keyof BuildingSprinklerData, value: any) => {
    if (!selectedBuildingId) return;

    setFireProtectionData((prev) => {
      const building = prev.buildings[selectedBuildingId] || {
        sprinklerData: createDefaultBuildingSprinkler(),
        comments: '',
      };

      const updatedData = {
        ...building.sprinklerData,
        [field]: value,
      };

      const sprinklerScore = calculateSprinklerScore(updatedData);
      const waterScore = prev.site.water_score_1_5;
      const suggestedWater = calculateWaterScore(prev.site.water);

      updatedData.sprinkler_score_1_5 = sprinklerScore; // Can be null
      updatedData.final_active_score_1_5 = calculateFinalActiveScore(sprinklerScore, waterScore, suggestedWater);

      return {
        ...prev,
        buildings: {
          ...prev.buildings,
          [selectedBuildingId]: {
            ...building,
            sprinklerData: updatedData,
          },
        },
      };
    });
  };

  const updateBuildingComments = (comments: string) => {
    if (!selectedBuildingId) return;

    setFireProtectionData((prev) => ({
      ...prev,
      buildings: {
        ...prev.buildings,
        [selectedBuildingId]: {
          ...(prev.buildings[selectedBuildingId] || {}),
          comments,
        },
      },
    }));
  };

  const handleBuildingSelect = (buildingId: string) => {
    setSelectedBuildingId(buildingId);
  };

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId);

  if (buildings.length === 0) {
    return (
      <div className="p-8">
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
    <div className="pb-24">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Droplet className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900">Site Water & Fire Pumps</h2>
            <p className="text-sm text-slate-600">Site-level water supply reliability assessment</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Water Score:</span>
            {assessorWaterScore !== null && assessorWaterScore !== undefined ? (
              <>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`w-6 h-6 rounded ${i <= assessorWaterScore ? 'bg-blue-600' : 'bg-slate-200'}`}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-slate-900">{assessorWaterScore}/5</span>
              </>
            ) : (
              <span className="text-sm font-medium text-slate-500">Not rated</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Water supply supports - New field at top */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Water supply supports</label>
            <select
              value={siteWaterData.supports || 'Unknown'}
              onChange={(e) => updateSiteWater('supports', e.target.value as WaterSupports)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Unknown">Unknown</option>
              <option value="Sprinklers">Sprinklers</option>
              <option value="Hydrants / fire main / hose reels">Hydrants / fire main / hose reels</option>
              <option value="Both">Both</option>
            </select>
          </div>

          {/* Supply Type - Now dropdown with Other option */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Supply Type</label>
            <select
              value={siteWaterData.supply_type || ''}
              onChange={(e) => updateSiteWater('supply_type', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select...</option>
              <option value="Town mains">Town mains</option>
              <option value="Single tank (on-site)">Single tank (on-site)</option>
              <option value="Dual tank (on-site)">Dual tank (on-site)</option>
              <option value="Break tank + mains">Break tank + mains</option>
              <option value="Open water (reservoir)">Open water (reservoir)</option>
              <option value="River / canal / open source">River / canal / open source</option>
              <option value="Private main / estate main">Private main / estate main</option>
              <option value="Other">Other...</option>
            </select>
          </div>

          {/* Supply Type Other - Conditional */}
          {siteWaterData.supply_type === 'Other' && (
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Supply Type Details (Other)
              </label>
              <input
                type="text"
                value={siteWaterData.supply_type_other || ''}
                onChange={(e) => updateSiteWater('supply_type_other', e.target.value)}
                placeholder="Describe the supply type..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Conditional hydrant/hose fields */}
          {(siteWaterData.supports === 'Hydrants / fire main / hose reels' || siteWaterData.supports === 'Both') && (
            <>
              <div className="col-span-2 pt-4 border-t border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-4">Hydrant / fire main / hose reels</h4>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">External hydrant coverage</label>
                <select
                  value={siteWaterData.hydrant_coverage || 'Unknown'}
                  onChange={(e) => updateSiteWater('hydrant_coverage', e.target.value as CoverageQuality)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Unknown">Unknown</option>
                  <option value="Good">Good</option>
                  <option value="Partial">Partial</option>
                  <option value="Poor">Poor</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Fire main / ring main condition</label>
                <select
                  value={siteWaterData.fire_main_condition || 'Unknown'}
                  onChange={(e) => updateSiteWater('fire_main_condition', e.target.value as ConditionQuality)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Unknown">Unknown</option>
                  <option value="Good">Good</option>
                  <option value="Concerns">Concerns</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Hose reels present</label>
                <select
                  value={siteWaterData.hose_reels_present || 'Unknown'}
                  onChange={(e) => updateSiteWater('hose_reels_present', e.target.value as YesNoUnknown)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Unknown">Unknown</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Flow/pressure test evidence</label>
                <select
                  value={siteWaterData.flow_test_evidence || 'Unknown'}
                  onChange={(e) => updateSiteWater('flow_test_evidence', e.target.value as TestEvidence)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Unknown">Unknown</option>
                  <option value="Documented">Documented</option>
                  <option value="Not documented">Not documented</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Last test date (optional)</label>
                <input
                  type="date"
                  value={siteWaterData.flow_test_date || ''}
                  onChange={(e) => updateSiteWater('flow_test_date', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-2 border-t border-slate-200 pt-4"></div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Pumps Present</label>
            <select
              value={siteWaterData.pumps_present ? 'true' : 'false'}
              onChange={(e) => updateSiteWater('pumps_present', e.target.value === 'true')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Pump Arrangement</label>
            <select
              value={siteWaterData.pump_arrangement || 'Unknown'}
              onChange={(e) => updateSiteWater('pump_arrangement', e.target.value as PumpArrangement)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Unknown">Unknown</option>
              <option value="None">None</option>
              <option value="Single">Single</option>
              <option value="Duty+Standby">Duty + Standby</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Power Resilience</label>
            <select
              value={siteWaterData.power_resilience || 'Unknown'}
              onChange={(e) => updateSiteWater('power_resilience', e.target.value as PowerResilience)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Unknown">Unknown</option>
              <option value="Good">Good</option>
              <option value="Mixed">Mixed</option>
              <option value="Poor">Poor</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Testing Regime</label>
            <select
              value={siteWaterData.testing_regime || 'Unknown'}
              onChange={(e) => updateSiteWater('testing_regime', e.target.value as TestingRegime)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Unknown">Unknown</option>
              <option value="Documented">Documented</option>
              <option value="Some evidence">Some evidence</option>
              <option value="None">None</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Key Weaknesses</label>
            <textarea
              value={siteWaterData.key_weaknesses || ''}
              onChange={(e) => updateSiteWater('key_weaknesses', e.target.value)}
              placeholder="Describe any key vulnerabilities or concerns..."
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Comments</label>
            <textarea
              value={siteWaterComments}
              onChange={(e) => updateSiteComments(e.target.value)}
              placeholder="Additional notes on water supply and pumps..."
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Site water score - Assessor judgment */}
          <div className="col-span-2 pt-4 border-t border-slate-200">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Site Water Score (assessor judgement)
                </label>
                <p className="text-xs text-slate-500">
                  Based on the inputs above, the suggested score is <strong>{suggestedWaterScore}/5</strong>
                </p>
              </div>
              <button
                onClick={applySuggestedScore}
                className="ml-3 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                Apply suggested score
              </button>
            </div>
            <select
              value={assessorWaterScore === null || assessorWaterScore === undefined ? '' : assessorWaterScore}
              onChange={(e) => setAssessorWaterScore(e.target.value === '' ? null : Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Not rated</option>
              <option value="1">1 – Very Poor (Highly unreliable)</option>
              <option value="2">2 – Poor (Unreliable)</option>
              <option value="3">3 – Fair (Limited reliability)</option>
              <option value="4">4 – Good (Generally reliable)</option>
              <option value="5">5 – Excellent (Highly reliable)</option>
            </select>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>Guidance:</strong> A rating of 3 may be acceptable when evidence is limited, but please select a rating explicitly. The suggested score is calculated from your inputs above.
          </p>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200">
          <FireProtectionRecommendations
            recommendations={getSiteRecommendations(derivedRecommendations)}
            title="Site Water Supply Recommendations"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <BuildingIcon className="w-5 h-5 text-slate-600" />
            <h3 className="font-semibold text-slate-900">Buildings</h3>
          </div>

          <div className="space-y-2">
            {buildings.map((building) => {
              const buildingFP = fireProtectionData.buildings[building.id];
              const isSelected = selectedBuildingId === building.id;

              return (
                <button
                  key={building.id}
                  onClick={() => handleBuildingSelect(building.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">{building.ref || 'Building'}</div>
                      {building.description && (
                        <div className="text-xs text-slate-600 truncate">{building.description}</div>
                      )}
                      {building.footprint_m2 && (
                        <div className="text-xs text-slate-500 mt-1">
                          {building.footprint_m2.toLocaleString()} m²
                        </div>
                      )}
                    </div>
                    {buildingFP?.sprinklerData && (
                      <div className="ml-2">
                        <div className="text-xs text-slate-600">Final</div>
                        <div className="text-sm font-bold text-slate-900">
                          {buildingFP.sprinklerData.final_active_score_1_5 !== null &&
                          buildingFP.sprinklerData.final_active_score_1_5 !== undefined
                            ? `${buildingFP.sprinklerData.final_active_score_1_5}/5`
                            : '—'}
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="col-span-2 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          {!selectedBuilding ? (
            <div className="flex items-center justify-center h-full text-slate-600">
              Select a building to view sprinkler details
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {selectedBuilding.ref || 'Building'} - Sprinklers
                  </h3>
                  {selectedBuilding.description && (
                    <p className="text-sm text-slate-600">{selectedBuilding.description}</p>
                  )}
                  {selectedBuilding.footprint_m2 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Area: {selectedBuilding.footprint_m2.toLocaleString()} m²
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-600 flex items-center gap-1 justify-end">
                    Final Active Score
                    {(assessorWaterScore === null || assessorWaterScore === undefined) && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">provisional</span>
                    )}
                  </div>
                  <div className="text-3xl font-bold text-slate-900">
                    {selectedFinalScore !== null && selectedFinalScore !== undefined ? `${selectedFinalScore}/5` : 'Not rated'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Sprinkler: {selectedSprinklerScore !== null && selectedSprinklerScore !== undefined ? `${selectedSprinklerScore}/5` : 'Not rated'} • Water:{' '}
                    {assessorWaterScore !== null && assessorWaterScore !== undefined ? (
                      `${assessorWaterScore}/5`
                    ) : (
                      <span className="text-amber-600">~{suggestedWaterScore}/5</span>
                    )}
                  </div>
                </div>
              </div>

              {autoFlags.length > 0 && (
                <div className="mb-4 space-y-2">
                  {autoFlags.map((flag, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 p-3 rounded-lg ${
                        flag.severity === 'warning'
                          ? 'bg-amber-50 border border-amber-200'
                          : 'bg-blue-50 border border-blue-200'
                      }`}
                    >
                      {flag.severity === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                      ) : (
                        <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                      )}
                      <p
                        className={`text-sm ${
                          flag.severity === 'warning' ? 'text-amber-900' : 'text-blue-900'
                        }`}
                      >
                        {flag.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-4">
                {/* Sprinklers Installed? - Primary gate */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Sprinklers installed?</label>
                  <select
                    value={selectedSprinklerData.sprinklers_installed || 'Unknown'}
                    onChange={(e) =>
                      updateBuildingSprinkler('sprinklers_installed', e.target.value as SprinklersInstalled)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Unknown">Unknown</option>
                    <option value="Yes">Yes</option>
                    <option value="Partial">Partial</option>
                    <option value="No">No</option>
                  </select>
                </div>

                {selectedSprinklerData.sprinklers_installed === 'No' ? (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-700">
                      <strong>No sprinklers installed.</strong> This building is excluded from sprinkler roll-up.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Coverage fields - Installed FIRST, Required SECOND, Gap auto */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Coverage Installed (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={selectedSprinklerData.sprinkler_coverage_installed_pct || 0}
                          onChange={(e) =>
                            updateBuildingSprinkler('sprinkler_coverage_installed_pct', Number(e.target.value))
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Coverage Required (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={selectedSprinklerData.sprinkler_coverage_required_pct || 0}
                          onChange={(e) =>
                            updateBuildingSprinkler('sprinkler_coverage_required_pct', Number(e.target.value))
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Gap (%)</label>
                        <input
                          type="text"
                          value={Math.max(
                            0,
                            (selectedSprinklerData.sprinkler_coverage_required_pct || 0) -
                              (selectedSprinklerData.sprinkler_coverage_installed_pct || 0)
                          )}
                          readOnly
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                        />
                      </div>
                    </div>

                    {/* System Type */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        System type (predominant)
                      </label>
                      <select
                        value={selectedSprinklerData.system_type || 'Unknown'}
                        onChange={(e) => updateBuildingSprinkler('system_type', e.target.value as SystemType)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Unknown">Unknown</option>
                        <option value="Wet pipe">Wet pipe</option>
                        <option value="Dry pipe">Dry pipe</option>
                        <option value="Pre-action">Pre-action</option>
                        <option value="Deluge">Deluge</option>
                        <option value="Combination / Mixed">Combination / Mixed</option>
                      </select>
                    </div>

                    {/* Sprinkler Standard (dropdown) and Hazard Class (free text) */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Sprinkler Standard</label>
                        <select
                          value={selectedSprinklerData.standard || ''}
                          onChange={(e) => updateBuildingSprinkler('standard', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select...</option>
                          <option value="EN 12845">EN 12845</option>
                          <option value="NFPA 13">NFPA 13</option>
                          <option value="FM">FM</option>
                          <option value="LPC Rules">LPC Rules</option>
                          <option value="VdS">VdS</option>
                          <option value="AS 2118">AS 2118</option>
                          <option value="NZS 4541">NZS 4541</option>
                          <option value="SANS 10287">SANS 10287</option>
                          <option value="Other…">Other…</option>
                        </select>
                      </div>

                      {selectedSprinklerData.standard === 'Other…' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Standard (Other)
                          </label>
                          <input
                            type="text"
                            value={selectedSprinklerData.standard_other || ''}
                            onChange={(e) => updateBuildingSprinkler('standard_other', e.target.value)}
                            placeholder="Specify standard..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}

                      <div className={selectedSprinklerData.standard === 'Other…' ? 'col-span-2' : ''}>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Hazard Class</label>
                        <input
                          type="text"
                          value={selectedSprinklerData.hazard_class || ''}
                          onChange={(e) => updateBuildingSprinkler('hazard_class', e.target.value)}
                          placeholder="e.g., OH1, OH2, OH3, LH, HHP"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Maintenance Status and Sprinkler Adequacy */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Maintenance Status</label>
                        <select
                          value={selectedSprinklerData.maintenance_status || 'Unknown'}
                          onChange={(e) =>
                            updateBuildingSprinkler('maintenance_status', e.target.value as MaintenanceStatus)
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="Unknown">Unknown</option>
                          <option value="Good">Good</option>
                          <option value="Mixed">Mixed</option>
                          <option value="Poor">Poor</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Sprinkler Adequacy</label>
                        <select
                          value={selectedSprinklerData.sprinkler_adequacy || 'Unknown'}
                          onChange={(e) =>
                            updateBuildingSprinkler('sprinkler_adequacy', e.target.value as SprinklerAdequacy)
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="Unknown">Unknown</option>
                          <option value="Adequate">Adequate</option>
                          <option value="Inadequate">Inadequate</option>
                        </select>
                      </div>
                    </div>

                    {/* Localised / Special Fire Protection */}
                    <div className="pt-4 border-t border-slate-200">
                      <h4 className="font-semibold text-slate-900 mb-3">Localised / Special fire protection</h4>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Localised protection installed?
                          </label>
                          <select
                            value={selectedSprinklerData.localised_present || 'No'}
                            onChange={(e) =>
                              updateBuildingSprinkler('localised_present', e.target.value as LocalisedPresent)
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                            <option value="Partial">Partial</option>
                            <option value="Unknown">Unknown</option>
                          </select>
                        </div>

                        {(selectedSprinklerData.localised_present === 'Yes' ||
                          selectedSprinklerData.localised_present === 'Partial') && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">
                                Protection type (predominant)
                              </label>
                              <select
                                value={selectedSprinklerData.localised_type || ''}
                                onChange={(e) => updateBuildingSprinkler('localised_type', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Select...</option>
                                <option value="Gas suppression">Gas suppression</option>
                                <option value="Water mist">Water mist</option>
                                <option value="Foam">Foam</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">
                                Protected asset / area
                              </label>
                              <input
                                type="text"
                                value={selectedSprinklerData.localised_protected_asset || ''}
                                onChange={(e) => updateBuildingSprinkler('localised_protected_asset', e.target.value)}
                                placeholder="e.g., Server room, Paint store, Battery room"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">Comments</label>
                              <textarea
                                value={selectedSprinklerData.localised_comments || ''}
                                onChange={(e) => updateBuildingSprinkler('localised_comments', e.target.value)}
                                placeholder="Additional details on localised protection..."
                                rows={2}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {selectedSprinklerData.sprinkler_coverage_required_pct !== undefined &&
                  selectedSprinklerData.sprinkler_coverage_required_pct < 100 &&
                  selectedSprinklerData.sprinkler_coverage_required_pct > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Justification for {'<'}100% Required Coverage
                      </label>
                      <textarea
                        value={selectedSprinklerData.justification_if_required_lt_100 || ''}
                        onChange={(e) =>
                          updateBuildingSprinkler('justification_if_required_lt_100', e.target.value)
                        }
                        placeholder="Explain why full coverage is not required..."
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                  )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Comments</label>
                  <textarea
                    value={selectedComments}
                    onChange={(e) => updateBuildingComments(e.target.value)}
                    placeholder="Additional notes on sprinkler system..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                {selectedBuilding && (
                  <div className="pt-6 border-t border-slate-200">
                    <FireProtectionRecommendations
                      recommendations={getBuildingRecommendations(derivedRecommendations, selectedBuilding.id)}
                      title="Building Fire Protection Recommendations"
                    />
                  </div>
                )}

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-700">
                    <strong>Note:</strong> Final grade reflects water supply reliability (min of sprinkler score
                    and water score). Buildings where sprinklers are not installed or not required (0%) are excluded from site
                    roll-up.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">Site Fire Protection Roll-up</h3>
            <p className="text-sm text-slate-600">
              Area-weighted average across buildings where sprinklers are required
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="text-sm text-slate-600 mb-1">Average Score</div>
            <div className="text-3xl font-bold text-slate-900">{siteRollup.averageScore.toFixed(1)}</div>
            <div className="text-xs text-slate-500 mt-1">Out of 5.0</div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="text-sm text-slate-600 mb-1">Buildings Assessed</div>
            <div className="text-3xl font-bold text-slate-900">{siteRollup.buildingsAssessed}</div>
            <div className="text-xs text-slate-500 mt-1">With required sprinklers</div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="text-sm text-slate-600 mb-1">Total Area</div>
            <div className="text-3xl font-bold text-slate-900">{siteRollup.totalArea.toLocaleString()}</div>
            <div className="text-xs text-slate-500 mt-1">Square meters</div>
          </div>
        </div>

        {siteRollup.buildingsAssessed === 0 && (
          <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
              <p className="text-sm text-amber-900">
                No buildings with required sprinklers found. Mark buildings with required_pct {'>'} 0 to include
                in roll-up.
              </p>
            </div>
          </div>
        )}
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 border border-slate-200">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            Saving...
          </div>
        </div>
      )}
    </div>
  );
}
