import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, AlertTriangle, Info, Droplet, Building, TrendingUp, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { listBuildings } from '../../lib/re/buildingsRepo';
import type { BuildingInput } from '../../lib/re/buildingsModel';
import {
  getSiteWater,
  upsertSiteWater,
  getBuildingSprinklers,
  upsertBuildingSprinkler,
  ensureBuildingSprinklersForAllBuildings,
} from '../../lib/re/fireProtectionRepo';
import type {
  SiteWaterRecord,
  BuildingSprinklerRecord,
  SiteWaterData,
  BuildingSprinklerData,
  WaterReliability,
  PumpArrangement,
  PowerResilience,
  TestingRegime,
  MaintenanceStatus,
  SprinklerAdequacy,
} from '../../lib/re/fireProtectionModel';
import {
  calculateWaterScore,
  calculateSprinklerScore,
  calculateFinalActiveScore,
  generateAutoFlags,
  calculateSiteRollup,
  createDefaultSiteWater,
} from '../../lib/re/fireProtectionModel';
import {
  computeBuildingFireProtectionScore,
  computeSiteFireProtectionScore,
} from '../../lib/modules/re04FireProtectionScoring';
import {
  generateFireProtectionRecommendations,
  type FireProtectionRecommendation,
} from '../../lib/modules/re04FireProtectionRecommendations';

export default function FireProtectionPage() {
  console.count('FireProtectionPage render');
  const { id: documentId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [document, setDocument] = useState<any>(null);

  // Buildings
  const [buildings, setBuildings] = useState<BuildingInput[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);

  // Site water
  const [siteWater, setSiteWater] = useState<SiteWaterRecord | null>(null);
  const [siteWaterData, setSiteWaterData] = useState<SiteWaterData>({});
  const [siteWaterComments, setSiteWaterComments] = useState('');

  // Building sprinklers
  const [buildingSprinklers, setBuildingSprinklers] = useState<BuildingSprinklerRecord[]>([]);
  const [selectedSprinkler, setSelectedSprinkler] = useState<BuildingSprinklerRecord | null>(null);
  const [selectedSprinklerData, setSelectedSprinklerData] = useState<BuildingSprinklerData>({});
  const [selectedComments, setSelectedComments] = useState('');

  // Load data
  useEffect(() => {
    if (!documentId) return;

    async function loadData() {
      console.log('[RE06] loading true');
      setLoading(true);
      try {
        // Load document
        const { data: doc } = await supabase
          .from('documents')
          .select('*')
          .eq('id', documentId)
          .maybeSingle();
        setDocument(doc);

        // Load buildings
        const buildingsData = await listBuildings(documentId);
        setBuildings(buildingsData);

        // Load or create site water
        let siteWaterRec = await getSiteWater(documentId);
        if (!siteWaterRec) {
          const defaultRec = createDefaultSiteWater(documentId);
          siteWaterRec = await upsertSiteWater(defaultRec);
        }
        setSiteWater(siteWaterRec);
        setSiteWaterData(siteWaterRec.data || {});
        setSiteWaterComments(siteWaterRec.comments || '');

        // Ensure sprinkler records exist for all buildings
        const buildingIds = buildingsData.map(b => b.id!);
        const sprinklersData = await ensureBuildingSprinklersForAllBuildings(documentId, buildingIds);
        setBuildingSprinklers(sprinklersData);

        // Auto-select first building
        if (buildingsData.length > 0 && sprinklersData.length > 0) {
          setSelectedBuildingId(buildingsData[0].id!);
          const firstSprinkler = sprinklersData.find(s => s.building_id === buildingsData[0].id);
          if (firstSprinkler) {
            setSelectedSprinkler(firstSprinkler);
            setSelectedSprinklerData(firstSprinkler.data || {});
            setSelectedComments(firstSprinkler.comments || '');
          }
        }
      } catch (error) {
        console.error('Failed to load fire protection data:', error);
      } finally {
        console.log('[RE06] loading false');
        setLoading(false);
      }
    }

    loadData();
  }, [documentId]);

  const siteWaterScore = useMemo(() => {
    console.log('[RE06] siteWaterScore recalculated');
    return calculateWaterScore(siteWaterData);
  }, [siteWaterData]);

  const rawSprinklerScore = useMemo(() => {
    if (!selectedSprinkler) return null;
    console.log('[RE06] sprinklerScore recalculated');
    return calculateSprinklerScore(selectedSprinklerData);
  }, [selectedSprinkler, selectedSprinklerData]);

  const selectedSprinklerScore = rawSprinklerScore ?? 3;

  const selectedFinalScore = useMemo(() => {
    console.log('[RE06] finalActiveScore recalculated');
    return calculateFinalActiveScore(rawSprinklerScore, siteWaterScore);
  }, [rawSprinklerScore, siteWaterScore]);

  useEffect(() => {
    console.log('[RE06] loading state changed:', loading);
  }, [loading]);

  // Compute derived site score (Phase 2)
  const derivedSiteScore = useMemo(() => {
    // Map database structure to scoring function format
    const buildingsForScoring: Record<string, any> = {};

    buildingSprinklers.forEach(sprinkler => {
      buildingsForScoring[sprinkler.building_id] = {
        suppression: {
          sprinklers: {
            rating: sprinkler.sprinkler_score_1_5 || 3,
          },
        },
        // Note: detection data not in current database schema, would need separate table
        // For now, suppression-only scoring
      };
    });

    const siteDataForScoring = {
      water_supply_reliability:
        siteWaterData.water_reliability?.toLowerCase() as any || 'unknown',
    };

    const buildingsMeta = buildings.map(b => ({
      id: b.id!,
      floor_area_sqm: b.floor_area_sqm,
      footprint_m2: b.footprint_m2,
    }));

    return computeSiteFireProtectionScore(
      buildingsForScoring,
      siteDataForScoring,
      buildingsMeta
    );
  }, [buildingSprinklers, siteWaterData.water_reliability, buildings]);

  // Save site water
  const saveSiteWater = useCallback(async () => {
    if (!siteWater || !documentId) return;

    setSaving(true);
    try {
      // Add derived score and recommendations to data (Phase 2 + Phase 3)
      const updatedData = {
        ...siteWaterData,
        derived: {
          site_fire_protection_score: derivedSiteScore,
          recommendations: derivedRecommendations,
        },
      };

      await upsertSiteWater({
        id: siteWater.id,
        document_id: documentId,
        data: updatedData,
        water_score_1_5: siteWaterScore,
        comments: siteWaterComments,
      });
    } catch (error) {
      console.error('Failed to save site water:', error);
    } finally {
      setSaving(false);
    }
  }, [siteWater, documentId, siteWaterData, siteWaterScore, siteWaterComments, derivedSiteScore, derivedRecommendations]);

  // Debounced save for site water
  useEffect(() => {
    if (!siteWater) return;

    const timer = setTimeout(() => {
      saveSiteWater();
    }, 1000);

    return () => clearTimeout(timer);
  }, [siteWaterData, siteWaterScore, siteWaterComments, saveSiteWater]);

  // Compute derived building score (Phase 2)
  const derivedBuildingScore = useMemo(() => {
    if (!selectedSprinkler) return null;

    // Map database structure to scoring function format
    const buildingData = {
      suppression: {
        sprinklers: {
          rating: selectedSprinklerScore || 3,
        },
      },
      // Note: detection data not in current database schema
      // For now, suppression-only scoring
    };

    return computeBuildingFireProtectionScore(buildingData);
  }, [selectedSprinkler, selectedSprinklerScore]);

  // Generate recommendations (Phase 3)
  const derivedRecommendations = useMemo(() => {
    // Build complete fire protection module structure from database records
    const buildingsForRecs: Record<string, any> = {};

    buildingSprinklers.forEach(sprinkler => {
      buildingsForRecs[sprinkler.building_id] = {
        suppression: {
          sprinklers: {
            rating: sprinkler.sprinkler_score_1_5 || 3,
            coverage_percent: sprinkler.data?.coverage_percent,
            adequacy: sprinkler.data?.sprinkler_adequacy,
          },
        },
        // Note: detection data not in current database schema
        // Future: add detection_alarm data from separate table
      };
    });

    const fpModule = {
      buildings: buildingsForRecs,
      site: {
        water_supply_reliability: siteWaterData.water_reliability?.toLowerCase() as any || 'unknown',
      },
    };

    return generateFireProtectionRecommendations(fpModule);
  }, [buildingSprinklers, siteWaterData.water_reliability]);

  // Save building sprinkler
  const saveBuildingSprinkler = useCallback(async () => {
    if (!selectedSprinkler || !documentId) return;

    setSaving(true);
    try {
      // Add derived score to data
      const updatedData = {
        ...selectedSprinklerData,
        derived: {
          building_fire_protection_score: derivedBuildingScore,
        },
      };

      const updated = await upsertBuildingSprinkler({
        id: selectedSprinkler.id,
        document_id: documentId,
        building_id: selectedSprinkler.building_id,
        data: updatedData,
        sprinkler_score_1_5: selectedSprinklerScore,
        final_active_score_1_5: selectedFinalScore,
        comments: selectedComments,
      });

      // Update in state
      setBuildingSprinklers(prev =>
        prev.map(s => (s.id === updated.id ? updated : s))
      );
    } catch (error) {
      console.error('Failed to save building sprinkler:', error);
    } finally {
      setSaving(false);
    }
  }, [selectedSprinkler, documentId, selectedSprinklerData, selectedSprinklerScore, selectedFinalScore, selectedComments, derivedBuildingScore]);

  // Debounced save for building sprinkler
  useEffect(() => {
    if (!selectedSprinkler) return;

    const timer = setTimeout(() => {
      saveBuildingSprinkler();
    }, 1000);

    return () => clearTimeout(timer);
  }, [selectedSprinklerData, selectedSprinklerScore, selectedFinalScore, selectedComments, saveBuildingSprinkler]);

  // Handle building selection
  const handleBuildingSelect = (buildingId: string) => {
    setSelectedBuildingId(buildingId);
    const sprinkler = buildingSprinklers.find(s => s.building_id === buildingId);
    if (sprinkler) {
      setSelectedSprinkler(sprinkler);
      setSelectedSprinklerData(sprinkler.data || {});
      setSelectedComments(sprinkler.comments || '');
    }
  };

  // Get selected building details
  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);

  // Calculate site rollup
  const siteRollup = calculateSiteRollup(buildingSprinklers, buildings);

  // Generate auto-flags for selected building
  const autoFlags = selectedSprinkler
    ? generateAutoFlags(selectedSprinklerData, rawSprinklerScore, siteWaterScore)
    : [];

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center">
          <div className="text-slate-600">Loading fire protection data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/documents/${documentId}`)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-slate-900">RE-06: Fire Protection</h1>
              <p className="text-sm text-slate-600 mt-1">{document?.title || 'Risk Engineering Assessment'}</p>
            </div>
            {saving && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                Saving...
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Site Water & Fire Pumps Section */}
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
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div
                    key={i}
                    className={`w-6 h-6 rounded ${
                      i <= siteWaterScore ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm font-medium text-slate-900">{siteWaterScore}/5</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Water Reliability
              </label>
              <select
                value={siteWaterData.water_reliability || 'Unknown'}
                onChange={e =>
                  setSiteWaterData({ ...siteWaterData, water_reliability: e.target.value as WaterReliability })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Unknown">Unknown</option>
                <option value="Reliable">Reliable</option>
                <option value="Unreliable">Unreliable</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Supply Type
              </label>
              <input
                type="text"
                value={siteWaterData.supply_type || ''}
                onChange={e => setSiteWaterData({ ...siteWaterData, supply_type: e.target.value })}
                placeholder="e.g., town main / tank / reservoir"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Pumps Present
              </label>
              <select
                value={siteWaterData.pumps_present ? 'true' : 'false'}
                onChange={e =>
                  setSiteWaterData({ ...siteWaterData, pumps_present: e.target.value === 'true' })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Pump Arrangement
              </label>
              <select
                value={siteWaterData.pump_arrangement || 'Unknown'}
                onChange={e =>
                  setSiteWaterData({ ...siteWaterData, pump_arrangement: e.target.value as PumpArrangement })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Unknown">Unknown</option>
                <option value="None">None</option>
                <option value="Single">Single</option>
                <option value="Duty+Standby">Duty + Standby</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Power Resilience
              </label>
              <select
                value={siteWaterData.power_resilience || 'Unknown'}
                onChange={e =>
                  setSiteWaterData({ ...siteWaterData, power_resilience: e.target.value as PowerResilience })
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
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Testing Regime
              </label>
              <select
                value={siteWaterData.testing_regime || 'Unknown'}
                onChange={e =>
                  setSiteWaterData({ ...siteWaterData, testing_regime: e.target.value as TestingRegime })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Unknown">Unknown</option>
                <option value="Documented">Documented</option>
                <option value="Some evidence">Some evidence</option>
                <option value="None">None</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Key Weaknesses
              </label>
              <textarea
                value={siteWaterData.key_weaknesses || ''}
                onChange={e => setSiteWaterData({ ...siteWaterData, key_weaknesses: e.target.value })}
                placeholder="Describe any key vulnerabilities or concerns..."
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Comments
              </label>
              <textarea
                value={siteWaterComments}
                onChange={e => setSiteWaterComments(e.target.value)}
                placeholder="Additional notes on water supply and pumps..."
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Guidance:</strong> This structures your judgement; it doesn't replace it. A score of 3 is
              explicitly acceptable when evidence is limited.
            </p>
          </div>
        </div>

        {/* Buildings & Sprinklers Section */}
        <div className="grid grid-cols-3 gap-6">
          {/* Building List */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Building className="w-5 h-5 text-slate-600" />
              <h3 className="font-semibold text-slate-900">Buildings</h3>
            </div>

            <div className="space-y-2">
              {buildings.length === 0 && (
                <p className="text-sm text-slate-600 py-4 text-center">
                  No buildings found. Add buildings in RE-02 first.
                </p>
              )}
              {buildings.map(building => {
                const sprinkler = buildingSprinklers.find(s => s.building_id === building.id);
                const isSelected = selectedBuildingId === building.id;

                return (
                  <button
                    key={building.id}
                    onClick={() => handleBuildingSelect(building.id!)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 truncate">
                          {building.ref || 'Building'}
                        </div>
                        {building.description && (
                          <div className="text-xs text-slate-600 truncate">{building.description}</div>
                        )}
                        {building.footprint_m2 && (
                          <div className="text-xs text-slate-500 mt-1">
                            {building.footprint_m2.toLocaleString()} m²
                          </div>
                        )}
                      </div>
                      {sprinkler?.final_active_score_1_5 && (
                        <div className="ml-2">
                          <div className="text-xs text-slate-600">Final</div>
                          <div className="text-sm font-bold text-slate-900">
                            {sprinkler.final_active_score_1_5}/5
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Building Sprinkler Panel */}
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
                    <div className="text-sm text-slate-600">Final Active Score</div>
                    <div className="text-3xl font-bold text-slate-900">{selectedFinalScore}/5</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Sprinkler: {selectedSprinklerScore}/5 • Water: {siteWaterScore}/5
                    </div>
                  </div>
                </div>

                {/* Auto-flags */}
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Coverage Required (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={selectedSprinklerData.sprinkler_coverage_required_pct || 0}
                        onChange={e =>
                          setSelectedSprinklerData({
                            ...selectedSprinklerData,
                            sprinkler_coverage_required_pct: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Coverage Installed (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={selectedSprinklerData.sprinkler_coverage_installed_pct || 0}
                        onChange={e =>
                          setSelectedSprinklerData({
                            ...selectedSprinklerData,
                            sprinkler_coverage_installed_pct: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Sprinkler Standard
                      </label>
                      <input
                        type="text"
                        value={selectedSprinklerData.sprinkler_standard || ''}
                        onChange={e =>
                          setSelectedSprinklerData({ ...selectedSprinklerData, sprinkler_standard: e.target.value })
                        }
                        placeholder="e.g., BS EN 12845, NFPA 13"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Hazard Class
                      </label>
                      <input
                        type="text"
                        value={selectedSprinklerData.hazard_class || ''}
                        onChange={e =>
                          setSelectedSprinklerData({ ...selectedSprinklerData, hazard_class: e.target.value })
                        }
                        placeholder="e.g., OH1, OH2, OH3"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Maintenance Status
                      </label>
                      <select
                        value={selectedSprinklerData.maintenance_status || 'Unknown'}
                        onChange={e =>
                          setSelectedSprinklerData({
                            ...selectedSprinklerData,
                            maintenance_status: e.target.value as MaintenanceStatus,
                          })
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
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Sprinkler Adequacy
                      </label>
                      <select
                        value={selectedSprinklerData.sprinkler_adequacy || 'Unknown'}
                        onChange={e =>
                          setSelectedSprinklerData({
                            ...selectedSprinklerData,
                            sprinkler_adequacy: e.target.value as SprinklerAdequacy,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Unknown">Unknown</option>
                        <option value="Adequate">Adequate</option>
                        <option value="Inadequate">Inadequate</option>
                      </select>
                    </div>
                  </div>

                  {selectedSprinklerData.sprinkler_coverage_required_pct !== undefined &&
                    selectedSprinklerData.sprinkler_coverage_required_pct < 100 &&
                    selectedSprinklerData.sprinkler_coverage_required_pct > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Justification for {'<'}100% Required Coverage
                        </label>
                        <textarea
                          value={selectedSprinklerData.justification_if_required_lt_100 || ''}
                          onChange={e =>
                            setSelectedSprinklerData({
                              ...selectedSprinklerData,
                              justification_if_required_lt_100: e.target.value,
                            })
                          }
                          placeholder="Explain why full coverage is not required..."
                          rows={2}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                      </div>
                    )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Comments
                    </label>
                    <textarea
                      value={selectedComments}
                      onChange={e => setSelectedComments(e.target.value)}
                      placeholder="Additional notes on sprinkler system..."
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-700">
                      <strong>Note:</strong> Final grade reflects water supply reliability (min of sprinkler score and
                      water score). Buildings where sprinklers are not required (0%) are excluded from site roll-up.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Site Roll-up */}
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
              <div className="text-3xl font-bold text-slate-900">
                {siteRollup.totalArea.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">Square meters</div>
            </div>
          </div>

          {siteRollup.buildingsAssessed === 0 && (
            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                <p className="text-sm text-amber-900">
                  No buildings with required sprinklers found. Mark buildings with required_pct {'>'} 0 to include in
                  roll-up.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
 