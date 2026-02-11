import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Info, Droplet, Building, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { listBuildings } from '../../lib/re/buildingsRepo';
import type { BuildingInput } from '../../lib/re/buildingsModel';
import {
  getSiteWater,
  upsertSiteWater,
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

import FireProtectionRecommendations from '../../components/re/FireProtectionRecommendations';
import { deriveFireProtectionRecommendations } from '../../lib/modules/re04FireProtectionRecommendations';

export default function FireProtectionPage() {
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
      setLoading(true);
      try {
        const { data: doc } = await supabase
          .from('documents')
          .select('*')
          .eq('id', documentId)
          .maybeSingle();
        setDocument(doc);

        const buildingsData = await listBuildings(documentId);
        setBuildings(buildingsData);

        let siteWaterRec = await getSiteWater(documentId);
        if (!siteWaterRec) {
          const defaultRec = createDefaultSiteWater(documentId);
          siteWaterRec = await upsertSiteWater(defaultRec);
        }
        setSiteWater(siteWaterRec);
        setSiteWaterData(siteWaterRec.data || {});
        setSiteWaterComments(siteWaterRec.comments || '');

        const buildingIds = buildingsData.map(b => b.id!).filter(Boolean);
        const sprinklersData = await ensureBuildingSprinklersForAllBuildings(documentId, buildingIds);
        setBuildingSprinklers(sprinklersData);

        if (buildingsData.length > 0 && sprinklersData.length > 0) {
          const firstId = buildingsData[0].id!;
          setSelectedBuildingId(firstId);
          const firstSprinkler = sprinklersData.find(s => s.building_id === firstId);
          if (firstSprinkler) {
            setSelectedSprinkler(firstSprinkler);
            setSelectedSprinklerData(firstSprinkler.data || {});
            setSelectedComments(firstSprinkler.comments || '');
          }
        }
      } catch (error) {
        console.error('Failed to load fire protection data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [documentId]);

  const siteWaterScore = useMemo(() => calculateWaterScore(siteWaterData), [siteWaterData]);

  const rawSprinklerScore = useMemo(() => {
    if (!selectedSprinkler) return null;
    return calculateSprinklerScore(selectedSprinklerData);
  }, [selectedSprinkler, selectedSprinklerData]);

  const selectedSprinklerScore = rawSprinklerScore ?? 3;

  const selectedFinalScore = useMemo(() => {
    return calculateFinalActiveScore(rawSprinklerScore, siteWaterScore);
  }, [rawSprinklerScore, siteWaterScore]);

  // Derived site score (Phase 2)
  const derivedSiteScore = useMemo(() => {
    const buildingsForScoring: Record<string, any> = {};
    buildingSprinklers.forEach(spr => {
      buildingsForScoring[spr.building_id] = {
        suppression: { sprinklers: { rating: spr.sprinkler_score_1_5 ?? null } },
      };
    });

    const siteDataForScoring = {
      water_supply_reliability: (siteWaterData.water_reliability?.toLowerCase?.() as any) ?? undefined,
    };

    const buildingsMeta = buildings
      .filter(b => Boolean(b.id))
      .map(b => ({
        id: b.id!,
        floor_area_sqm: (b as any).floor_area_sqm,
        footprint_m2: (b as any).footprint_m2,
      }));

    return computeSiteFireProtectionScore(buildingsForScoring, siteDataForScoring, buildingsMeta);
  }, [buildingSprinklers, siteWaterData.water_reliability, buildings]);

  // Save site water (persist score only; recs are in-memory)
  const saveSiteWater = useCallback(async () => {
    if (!siteWater || !documentId) return;
    setSaving(true);
    try {
      const updatedData = {
        ...siteWaterData,
        derived: {
          site_fire_protection_score: derivedSiteScore,
        },
      };

      const updated = await upsertSiteWater({
        id: siteWater.id,
        document_id: documentId,
        data: updatedData,
        water_score_1_5: siteWaterScore,
        comments: siteWaterComments,
      });

      setSiteWater(updated);
    } catch (error) {
      console.error('Failed to save site water:', error);
    } finally {
      setSaving(false);
    }
  }, [siteWater, documentId, siteWaterData, siteWaterScore, siteWaterComments, derivedSiteScore]);

  // Debounced save for site water
  useEffect(() => {
    if (!siteWater) return;
    const timer = setTimeout(() => {
      saveSiteWater();
    }, 1000);
    return () => clearTimeout(timer);
  }, [siteWater, siteWaterData, siteWaterScore, siteWaterComments, saveSiteWater]);

  // Derived building score (Phase 2)
  const derivedBuildingScore = useMemo(() => {
    if (!selectedSprinkler) return null;
    const buildingData = { suppression: { sprinklers: { rating: selectedSprinklerScore ?? null } } };
    return computeBuildingFireProtectionScore(buildingData);
  }, [selectedSprinkler, selectedSprinklerScore]);

  // Recommendations (Phase 3) — in-memory only
  const derivedRecommendations = useMemo(() => {
    // Map to what the rec engine expects: required_pct/provided_pct
    const mappedSprinklers = buildingSprinklers.map(s => ({
      ...s,
      data: {
        ...(s.data || {}),
        // Your UI fields are sprinkler_coverage_required_pct / sprinkler_coverage_installed_pct
        required_pct: (s.data as any)?.sprinkler_coverage_required_pct,
        provided_pct: (s.data as any)?.sprinkler_coverage_installed_pct,
      },
    }));

    return deriveFireProtectionRecommendations({
      siteWater,
      buildingSprinklers: mappedSprinklers as any,
      buildings,
      selectedBuildingId,
    });
  }, [siteWater, buildingSprinklers, buildings, selectedBuildingId]);

  // Save building sprinkler
  const saveBuildingSprinkler = useCallback(async () => {
    if (!selectedSprinkler || !documentId) return;
    setSaving(true);
    try {
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

      setBuildingSprinklers(prev => prev.map(s => (s.id === updated.id ? updated : s)));
    } catch (error) {
      console.error('Failed to save building sprinkler:', error);
    } finally {
      setSaving(false);
    }
  }, [
    selectedSprinkler,
    documentId,
    selectedSprinklerData,
    selectedSprinklerScore,
    selectedFinalScore,
    selectedComments,
    derivedBuildingScore,
  ]);

  // Debounced save for building sprinkler
  useEffect(() => {
    if (!selectedSprinkler) return;
    const timer = setTimeout(() => {
      saveBuildingSprinkler();
    }, 1000);
    return () => clearTimeout(timer);
  }, [selectedSprinkler, selectedSprinklerData, selectedSprinklerScore, selectedFinalScore, selectedComments, saveBuildingSprinkler]);

  const handleBuildingSelect = (buildingId: string) => {
    setSelectedBuildingId(buildingId);
    const sprinkler = buildingSprinklers.find(s => s.building_id === buildingId);
    if (sprinkler) {
      setSelectedSprinkler(sprinkler);
      setSelectedSprinklerData(sprinkler.data || {});
      setSelectedComments(sprinkler.comments || '');
    }
  };

  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);

  const autoFlags = selectedSprinkler
    ? generateAutoFlags(selectedSprinklerData, rawSprinklerScore, siteWaterScore)
    : [];

  const rollupBuildings = useMemo(
    () => buildings.filter((b): b is BuildingInput & { id: string } => Boolean(b.id)),
    [buildings]
  );
  const siteRollup = calculateSiteRollup(buildingSprinklers, rollupBuildings);

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
                  <div key={i} className={`w-6 h-6 rounded ${i <= siteWaterScore ? 'bg-blue-600' : 'bg-slate-200'}`} />
                ))}
              </div>
              <span className="text-sm font-medium text-slate-900">{siteWaterScore}/5</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Water Reliability</label>
              <select
                value={siteWaterData.water_reliability || 'Unknown'}
                onChange={e => setSiteWaterData({ ...siteWaterData, water_reliability: e.target.value as WaterReliability })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Unknown">Unknown</option>
                <option value="Reliable">Reliable</option>
                <option value="Unreliable">Unreliable</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Supply Type</label>
              <input
                type="text"
                value={(siteWaterData as any).supply_type || ''}
                onChange={e => setSiteWaterData({ ...siteWaterData, supply_type: e.target.value } as any)}
                placeholder="e.g., town main / tank / reservoir"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Pumps Present</label>
              <select
                value={(siteWaterData as any).pumps_present ? 'true' : 'false'}
                onChange={e => setSiteWaterData({ ...siteWaterData, pumps_present: e.target.value === 'true' } as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Pump Arrangement</label>
              <select
                value={(siteWaterData as any).pump_arrangement || 'Unknown'}
                onChange={e => setSiteWaterData({ ...siteWaterData, pump_arrangement: e.target.value as PumpArrangement } as any)}
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
                value={(siteWaterData as any).power_resilience || 'Unknown'}
                onChange={e => setSiteWaterData({ ...siteWaterData, power_resilience: e.target.value as PowerResilience } as any)}
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
                value={(siteWaterData as any).testing_regime || 'Unknown'}
                onChange={e => setSiteWaterData({ ...siteWaterData, testing_regime: e.target.value as TestingRegime } as any)}
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
                value={(siteWaterData as any).key_weaknesses || ''}
                onChange={e => setSiteWaterData({ ...siteWaterData, key_weaknesses: e.target.value } as any)}
                placeholder="Describe any key vulnerabilities or concerns..."
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Comments</label>
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

          {/* Site-level Recommendations */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <FireProtectionRecommendations
              title="Site recommendations"
              recommendations={derivedRecommendations}
              context="site"
            />
          </div>
        </div> {/* ✅ CLOSE Site Water card */}

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
                        <div className="font-medium text-slate-900 truncate">{building.ref || 'Building'}</div>
                        {building.description && <div className="text-xs text-slate-600 truncate">{building.description}</div>}
                        {(building as any).footprint_m2 && (
                          <div className="text-xs text-slate-500 mt-1">
                            {(building as any).footprint_m2.toLocaleString()} m²
                          </div>
                        )}
                      </div>
                      {sprinkler?.final_active_score_1_5 && (
                        <div className="ml-2">
                          <div className="text-xs text-slate-600">Final</div>
                          <div className="text-sm font-bold text-slate-900">{sprinkler.final_active_score_1_5}/5</div>
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
                    {(selectedBuilding as any).footprint_m2 && (
                      <p className="text-xs text-slate-500 mt-1">
                        Area: {(selectedBuilding as any).footprint_m2.toLocaleString()} m²
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
                        <p className={`text-sm ${flag.severity === 'warning' ? 'text-amber-900' : 'text-blue-900'}`}>
                          {flag.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Keep your existing sprinkler fields below (unchanged) */}
                <div className="space-y-4">
                  {/* ... your existing inputs ... */}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Comments</label>
                    <textarea
                      value={selectedComments}
                      onChange={e => setSelectedComments(e.target.value)}
                      placeholder="Additional notes on sprinkler system..."
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  {/* Building-specific Recommendations */}
                  <div className="pt-6 border-t border-slate-200">
                    <FireProtectionRecommendations
                      title="Building recommendations"
                      recommendations={derivedRecommendations}
                      context="building"
                    />
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
              <p className="text-sm text-slate-600">Area-weighted average across buildings where sprinklers are required</p>
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
                  No buildings with required sprinklers found. Mark buildings with required_pct {'>'} 0 to include in roll-up.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
