import { useEffect, useMemo, useState } from 'react';
import type { BuildingInput } from '../../lib/re/buildingsModel';
import { createEmptyBuilding } from '../../lib/re/buildingsModel';
import { Save, Trash2, Pencil } from 'lucide-react';
import {
  listBuildings,
  upsertBuilding,
  deleteBuilding,
  getBuildingExtra,
  upsertBuildingExtra,
} from '../../lib/re/buildingsRepo';
import { supabase } from '../../lib/supabase';

type GridMode = 'all' | 'construction' | 'fire_protection';

type Props = {
  documentId: string;
  mode?: GridMode;
  onAfterSave?: () => Promise<void> | void;
};

type WallRow = { material: string; percent: number };

// Material options for dropdowns
const ROOF_MATERIAL_OPTIONS = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'heavy_noncombustible_concrete', label: 'Heavy non-combustible / concrete' },
  { value: 'metal_deck_noncomb_insul', label: 'Metal deck + non-combustible insulation' },
  { value: 'metal_deck_comb_insul', label: 'Metal deck + combustible insulation' },
  { value: 'sandwich_phenolic', label: 'Composite sandwich panel — Phenolic' },
  { value: 'sandwich_pir', label: 'Composite sandwich panel — PIR' },
  { value: 'sandwich_pur', label: 'Composite sandwich panel — PUR' },
  { value: 'sandwich_eps', label: 'Composite sandwich panel — EPS / polystyrene' },
  { value: 'built_up_felt', label: 'Built-up bitumen/felt' },
  { value: 'single_ply', label: 'Single-ply membrane' },
  { value: 'fibre_cement', label: 'Fibre cement sheets' },
  { value: 'timber_deck', label: 'Timber deck / combustible' },
];

const MEZZ_MATERIAL_OPTIONS = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'reinforced_concrete', label: 'Reinforced concrete' },
  { value: 'precast_concrete', label: 'Precast concrete' },
  { value: 'steel_concrete_deck', label: 'Steel + concrete deck' },
  { value: 'steel_timber_deck', label: 'Steel + timber deck' },
  { value: 'timber_joists_deck', label: 'Timber joists / timber deck' },
  { value: 'grp_composite_deck', label: 'Composite / GRP deck' },
];

const WALL_MATERIAL_OPTIONS = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'masonry', label: 'Masonry' },
  { value: 'precast_concrete', label: 'Precast concrete' },
  { value: 'metal_cladding_noncomb', label: 'Metal cladding (non-combustible)' },
  { value: 'metal_cladding_comb_core', label: 'Metal cladding (combustible core)' },
  { value: 'composite_panels_comb', label: 'Composite panels (combustible)' },
  { value: 'timber_cladding', label: 'Timber cladding' },
  { value: 'curtain_wall_glazing', label: 'Curtain wall / glazing' },
];

function sum(nums: Array<number | null | undefined>) {
  return nums.reduce((acc, n) => acc + (typeof n === 'number' ? n : 0), 0);
}

export default function BuildingsGrid({
  documentId,
  mode = 'all',
  onAfterSave,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BuildingInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Walls modal state
  const [wallsOpenForId, setWallsOpenForId] = useState<string | null>(null);
  const [wallsDraft, setWallsDraft] = useState<WallRow[]>([
    { material: 'unknown', percent: 100 },
  ]);
  const [wallsError, setWallsError] = useState<string | null>(null);
  const [roofOpenForId, setRoofOpenForId] = useState<string | null>(null);
  const [roofDraft, setRoofDraft] = useState<WallRow[]>([{ material: 'unknown', percent: 100 }]);
  const [roofError, setRoofError] = useState<string | null>(null);

  const [mezzOpenForId, setMezzOpenForId] = useState<string | null>(null);
  const [mezzDraft, setMezzDraft] = useState<WallRow[]>([{ material: 'unknown', percent: 100 }]);
  const [mezzError, setMezzError] = useState<string | null>(null);

  // Completion indicators - store extra data per building
  const [buildingExtras, setBuildingExtras] = useState<Record<string, any>>({});

  // Site notes state
  const [constructionNotes, setConstructionNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await listBuildings(documentId);
      setRows(data);
      // Load extras for completion indicators
      await loadAllExtras(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load buildings');
    } finally {
      setLoading(false);
    }
  }

  async function loadAllExtras(buildings: BuildingInput[]) {
    const extras: Record<string, any> = {};
    for (const b of buildings) {
      if (b.id) {
        try {
          const extra = await getBuildingExtra(b.id);
          if (extra) {
            extras[b.id] = extra;
          }
        } catch (e) {
          console.error(`Failed to load extra for building ${b.id}:`, e);
        }
      }
    }
    setBuildingExtras(extras);
  }

  function getCompletionStatus(buildingId: string, key: 'roof_construction_percent' | 'wall_construction_percent' | 'mezzanine_construction_percent'): 'missing' | 'complete' | 'incomplete' {
    const extra = buildingExtras[buildingId];
    if (!extra || !extra[key]) return 'missing';

    const data = extra[key];
    if (typeof data !== 'object') return 'missing';

    const entries = Object.entries(data);
    if (entries.length === 0) return 'missing';

    const total = entries.reduce((sum, [, percent]) => sum + Number(percent), 0);
    return total === 100 ? 'complete' : 'incomplete';
  }

  async function loadSiteNotes() {
    try {
      const { data, error } = await supabase
        .from('re_site_notes')
        .select('construction_notes')
        .eq('document_id', documentId)
        .maybeSingle();

      if (error) throw error;
      setConstructionNotes(data?.construction_notes || '');
    } catch (e: any) {
      console.error('Failed to load site notes:', e);
    }
  }

  async function saveSiteNotes() {
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('re_site_notes')
        .upsert({
          document_id: documentId,
          construction_notes: constructionNotes,
        }, {
          onConflict: 'document_id'
        });

      if (error) throw error;
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save site notes');
    } finally {
      setSavingNotes(false);
    }
  }

  useEffect(() => {
    refresh();
    loadSiteNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  function updateRow(idx: number, patch: Partial<BuildingInput>) {
    setRows(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  async function addBuilding() {
    // Create locally then save to get an id
    const ref = `B${rows.length + 1}`;
    const draft = createEmptyBuilding(documentId, ref);
    setRows(prev => [...prev, draft]);
  }

  async function saveRow(idx: number) {
    const b = rows[idx];
    setError(null);

    if (!b.ref?.trim()) {
      setError('Building ref is required (e.g. B1)');
      return;
    }

    setSavingId(b.id ?? `new-${idx}`);
    try {
      const saved = await upsertBuilding(b);
      // replace row with saved (ensures id present)
      setRows(prev => {
        const next = [...prev];
        next[idx] = saved;
        return next;
      });
      if (onAfterSave) await onAfterSave();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save building');
    } finally {
      setSavingId(null);
    }
  }

  async function removeRow(idx: number) {
    const b = rows[idx];
    setError(null);

    // If not saved yet, just remove from UI
    if (!b.id) {
      setRows(prev => prev.filter((_, i) => i !== idx));
      return;
    }

    if (!confirm(`Delete ${b.ref}?`)) return;

    setSavingId(b.id);
    try {
      await deleteBuilding(b.id);
      setRows(prev => prev.filter((_, i) => i !== idx));
      if (onAfterSave) await onAfterSave();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to delete building');
    } finally {
      setSavingId(null);
    }
  }

  // ---- Walls % modal helpers (stored in re_building_extra.data) ----
  async function openWalls(buildingId: string) {
    setWallsError(null);
    setWallsOpenForId(buildingId);

    try {
      const extra = await getBuildingExtra(buildingId);
      const existing: WallRow[] =
        extra?.wall_construction_percent && typeof extra.wall_construction_percent === 'object'
          ? Object.entries(extra.wall_construction_percent).map(([material, percent]) => ({
              material,
              percent: Number(percent),
            }))
          : [{ material: 'unknown', percent: 100 }];

      setWallsDraft(existing);
    } catch (e: any) {
      setWallsError(e?.message ?? 'Failed to load wall %');
      setWallsDraft([{ material: 'unknown', percent: 100 }]);
    }
  }

  function wallsTotal() {
    return wallsDraft.reduce((acc, r) => acc + (Number.isFinite(r.percent) ? r.percent : 0), 0);
  }

  async function saveWalls() {
    if (!wallsOpenForId) return;

    setWallsError(null);

    const total = wallsTotal();
    if (total !== 100) {
      setWallsError(`Wall % must total 100. Current total: ${total}`);
      return;
    }

    // Must already have building saved (has id)
    const buildingId = wallsOpenForId;

    try {
      const extra = await getBuildingExtra(buildingId);
      const nextExtra = {
        ...(extra ?? {}),
        wall_construction_percent: wallsDraft.reduce<Record<string, number>>((acc, r) => {
          const key = (r.material || '').trim();
          if (key) acc[key] = Number(r.percent);
          return acc;
        }, {}),
      };

      await upsertBuildingExtra(buildingId, nextExtra);
      // Update extras for completion indicator
      setBuildingExtras(prev => ({ ...prev, [buildingId]: nextExtra }));
      setWallsOpenForId(null);
    } catch (e: any) {
      setWallsError(e?.message ?? 'Failed to save wall %');
    }
  }

  function rowsTotal(r: WallRow[]) {
  return r.reduce((acc, x) => acc + (Number.isFinite(x.percent) ? x.percent : 0), 0);
}

async function openRoof(buildingId: string) {
  setRoofError(null);
  setRoofOpenForId(buildingId);
  const extra = await getBuildingExtra(buildingId);
  const existing: WallRow[] =
    extra?.roof_construction_percent && typeof extra.roof_construction_percent === 'object'
      ? Object.entries(extra.roof_construction_percent).map(([material, percent]) => ({
          material,
          percent: Number(percent),
        }))
      : [{ material: 'unknown', percent: 100 }];
  setRoofDraft(existing);
}

async function saveRoof() {
  if (!roofOpenForId) return;
  const total = rowsTotal(roofDraft);
  if (total !== 100) {
    setRoofError(`Roof % must total 100. Current total: ${total}`);
    return;
  }
  const buildingId = roofOpenForId;
  const extra = await getBuildingExtra(buildingId);
  const nextExtra = {
    ...(extra ?? {}),
    roof_construction_percent: roofDraft.reduce<Record<string, number>>((acc, r) => {
      const key = (r.material || '').trim();
      if (key) acc[key] = Number(r.percent);
      return acc;
    }, {}),
  };
  await upsertBuildingExtra(buildingId, nextExtra);
  // Update extras for completion indicator
  setBuildingExtras(prev => ({ ...prev, [buildingId]: nextExtra }));
  setRoofOpenForId(null);
}

async function openMezz(buildingId: string) {
  setMezzError(null);
  setMezzOpenForId(buildingId);
  const extra = await getBuildingExtra(buildingId);
  const existing: WallRow[] =
    extra?.mezzanine_construction_percent && typeof extra.mezzanine_construction_percent === 'object'
      ? Object.entries(extra.mezzanine_construction_percent).map(([material, percent]) => ({
          material,
          percent: Number(percent),
        }))
      : [{ material: 'unknown', percent: 100 }];
  setMezzDraft(existing);
}

async function saveMezz() {
  if (!mezzOpenForId) return;
  const total = rowsTotal(mezzDraft);
  if (total !== 100) {
    setMezzError(`Mezzanine/floors % must total 100. Current total: ${total}`);
    return;
  }
  const buildingId = mezzOpenForId;
  const extra = await getBuildingExtra(buildingId);
  const nextExtra = {
    ...(extra ?? {}),
    mezzanine_construction_percent: mezzDraft.reduce<Record<string, number>>((acc, r) => {
      const key = (r.material || '').trim();
      if (key) acc[key] = Number(r.percent);
      return acc;
    }, {}),
  };
  await upsertBuildingExtra(buildingId, nextExtra);
  // Update extras for completion indicator
  setBuildingExtras(prev => ({ ...prev, [buildingId]: nextExtra }));
  setMezzOpenForId(null);
}

  const totals = useMemo(() => {
    return {
      roof: sum(rows.map(r => r.roof_area_m2)),
      mezz: sum(rows.map(r => r.mezzanine_area_m2)),
    };
  }, [rows]);

  // Helper component for completion status with icons
  const CompletionBadge = ({ status }: { status: 'missing' | 'complete' | 'incomplete' }) => {
    if (status === 'missing') {
      return (
        <span className="text-neutral-400" title="Missing composition data">
          ⚪
        </span>
      );
    }
    if (status === 'complete') {
      return (
        <span className="text-green-600 font-bold" title="Complete (100%)">
          ✓
        </span>
      );
    }
    return (
      <span className="text-amber-600 font-bold" title="Incomplete (does not total 100%)">
        ⚠
      </span>
    );
  };

  if (loading) return <div className="p-4">Loading…</div>;

  return (
    <div className="p-4">
      {error && <div className="mb-3 p-2 border rounded bg-red-50 text-red-800 text-sm">{error}</div>}

      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Buildings</div>
        <button className="px-3 py-2 border rounded" onClick={addBuilding}>
          + Add Building
        </button>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-2 border-b">Ref / Name</th>
          
              {mode !== 'fire_protection' && (
                <th className="text-left p-2 border-b">Roof (m²)</th>
              )}
          
              {mode !== 'fire_protection' && (
                <th className="text-left p-2 border-b">Upper floors / mezz (m²)</th>
              )}
          
              {mode !== 'fire_protection' && (
                <th className="text-left p-2 border-b">Walls (%)</th>
              )}
          
              <th className="text-left p-2 border-b">Storeys</th>

              {mode !== 'fire_protection' && (
  <th className="text-left p-2 border-b">Basements</th>
)}
          
              {mode !== 'construction' && (
                <th className="text-left p-2 border-b">Sprinklers</th>
              )}
          
              {mode !== 'construction' && (
                <th className="text-left p-2 border-b">Detection</th>
              )}
          
              {mode !== 'fire_protection' && (
                <th className="text-left p-2 border-b">Comb. cladding</th>
              )}
          
              {mode !== 'fire_protection' && (
                <th className="text-left p-2 border-b">Frame</th>
              )}

              {mode !== 'fire_protection' && (
                <th className="text-left p-2 border-b">Compartmentation</th>
              )}

              <th className="text-left p-2 border-b">Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((b, idx) => (
              <tr key={b.id ?? `tmp-${idx}`} className="border-b">
                <td className="p-2">
                  <input
                    className="w-full border rounded p-2"
                    value={b.ref ?? ''}
                    onChange={e => updateRow(idx, { ref: e.target.value })}
                    placeholder="B1"
                  />
                </td>

                {mode !== 'fire_protection' && (
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="w-24 border rounded p-2"
                        value={b.roof_area_m2 ?? ''}
                        onChange={e =>
                          updateRow(idx, { roof_area_m2: e.target.value === '' ? null : Number(e.target.value) })
                        }
                        placeholder="m²"
                      />
                  
                      {b.id ? (
                        <>
                          <button
                            className="p-2 border rounded"
                            onClick={() => openRoof(b.id!)}
                            aria-label="Edit roof composition"
                            title="Edit roof composition (%)"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <CompletionBadge status={getCompletionStatus(b.id, 'roof_construction_percent')} />
                        </>
                      ) : (
                        <span className="text-xs opacity-70">Save first</span>
                      )}
                    </div>
                  </td>
                )}
                
                {mode !== 'fire_protection' && (
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="w-28 border rounded p-2"
                        value={b.mezzanine_area_m2 ?? ''}
                        onChange={e =>
                          updateRow(idx, { mezzanine_area_m2: e.target.value === '' ? null : Number(e.target.value) })
                        }
                        placeholder="m²"
                      />

                      {b.id ? (
                        <>
                          <button
                            className="p-2 border rounded"
                            onClick={() => openMezz(b.id!)}
                            aria-label="Edit mezzanine/floors composition"
                            title="Edit mezzanine/floors composition (%)"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          <CompletionBadge status={getCompletionStatus(b.id, 'mezzanine_construction_percent')} />
                        </>
                      ) : (
                        <span className="text-xs opacity-70">Save first</span>
                      )}
                    </div>
                  </td>
                )}

                {mode !== 'fire_protection' && (
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {b.id ? (
                        <>
                          <button
                            className="p-2 border rounded"
                            onClick={() => openWalls(b.id!)}
                            aria-label="Edit walls composition"
                            title="Edit walls composition (%)"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <CompletionBadge status={getCompletionStatus(b.id, 'wall_construction_percent')} />
                        </>
                      ) : (
                        <span className="text-xs opacity-70">Save first</span>
                      )}
                    </div>
                  </td>
                )}

                <td className="p-2">
                  <input
                    type="number"
                    className="w-24 border rounded p-2"
                    value={b.storeys ?? ''}
                    onChange={e => updateRow(idx, { storeys: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                </td>

                {mode !== 'fire_protection' && (
                  <td className="p-2">
                    <input
                      type="number"
                      className="w-24 border rounded p-2"
                      value={b.basements ?? ''}
                      onChange={e => updateRow(idx, { basements: e.target.value === '' ? null : Number(e.target.value) })}
                      placeholder="0"
                      max={0}
                      title="Basements (0 or negative)"
                    />
                  </td>
                )}

                {mode !== 'construction' && (
                  <td className="p-2">
                    <select
                      className="border rounded p-2"
                      value={b.sprinklers_present ? 'yes' : 'no'}
                      onChange={e => updateRow(idx, { sprinklers_present: e.target.value === 'yes' })}
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </td>
                )}
                
                {mode !== 'construction' && (
                  <td className="p-2">
                    <select
                      className="border rounded p-2"
                      value={b.detection_present ? 'yes' : 'no'}
                      onChange={e => updateRow(idx, { detection_present: e.target.value === 'yes' })}
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </td>
                )}

                {mode !== 'fire_protection' && (
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={b.cladding_present === true && b.cladding_combustible === true}
                      onChange={e =>
                        updateRow(idx, {
                          cladding_present: e.target.checked,
                          cladding_combustible: e.target.checked ? true : null,
                        })
                      }
                    />
                  </td>
                )}

                {mode !== 'fire_protection' && (
                  <td className="p-2">
                    <select
                      className="border rounded p-2"
                      value={b.frame_type}
                      onChange={e => updateRow(idx, { frame_type: e.target.value })}
                    >
                      <option value="unknown">Unknown</option>
                      <option value="steel">Steel</option>
                      <option value="protected_steel">Protected steel</option>
                      <option value="reinforced_concrete">Reinforced concrete</option>
                      <option value="timber">Timber</option>
                      <option value="masonry">Masonry</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </td>
                )}

                {mode !== 'fire_protection' && (
                  <td className="p-2">
                    <select
                      className="border rounded p-2 w-full"
                      value={b.compartmentation_minutes ?? ''}
                      onChange={e => updateRow(idx, { compartmentation_minutes: e.target.value === '' ? null : Number(e.target.value) })}
                    >
                      <option value="">Unknown</option>
                      <option value="0">None / open plan</option>
                      <option value="60">Basic (≤60 min)</option>
                      <option value="120">Standard (90–120 min)</option>
                      <option value="180">Enhanced (180 min)</option>
                      <option value="240">High (240 min / 4 hours)</option>
                    </select>
                  </td>
                )}

                <td className="p-2">
                  <div className="flex gap-2">
                    <button
                      className="p-2 border rounded"
                      onClick={() => saveRow(idx)}
                      disabled={savingId === (b.id ?? `new-${idx}`)}
                      aria-label="Save building"
                      title="Save"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                
                    <button
                      className="p-2 border rounded"
                      onClick={() => removeRow(idx)}
                      disabled={savingId === (b.id ?? `new-${idx}`)}
                      aria-label="Delete building"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {/* Totals row – construction / all only */}
              {mode !== 'fire_protection' && (
                <tr className="bg-slate-50 font-medium">
                  <td className="p-2">Totals</td>

                  <td className="p-2">
                    Roof: {totals.roof.toLocaleString()} m²
                  </td>

                  <td className="p-2">
                    Mezz: {totals.mezz.toLocaleString()} m²
                  </td>

                  <td
                    className="p-2"
                    colSpan={mode === 'all' ? 8 : 4}
                  >
                    Known total (roof + mezz): {(totals.roof + totals.mezz).toLocaleString()} m²
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>

      {/* Site-level construction notes */}
      {mode !== 'fire_protection' && (
        <div className="mt-6 border rounded p-4">
          <label className="block font-semibold mb-2">Site-level construction notes</label>
          <textarea
            className="w-full border rounded p-2 min-h-[100px]"
            value={constructionNotes}
            onChange={e => setConstructionNotes(e.target.value)}
            placeholder="Enter general construction observations that apply across the site..."
          />
          <div className="flex justify-end mt-2">
            <button
              className="px-3 py-2 border rounded bg-white hover:bg-slate-50"
              onClick={saveSiteNotes}
              disabled={savingNotes}
            >
              {savingNotes ? 'Saving...' : 'Save notes'}
            </button>
          </div>
        </div>
      )}

      {/* Walls modal */}
      {wallsOpenForId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border rounded-lg w-full max-w-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Walls construction (%)</div>
              <button className="px-2 py-1 border rounded" onClick={() => setWallsOpenForId(null)}>
                Close
              </button>
            </div>

            {wallsError && <div className="mb-3 p-2 border rounded bg-red-50 text-red-800 text-sm">{wallsError}</div>}

            <div className="grid grid-cols-12 gap-2 text-xs font-medium mb-2">
              <div className="col-span-8">Material</div>
              <div className="col-span-3">Percent</div>
              <div className="col-span-1"></div>
            </div>

            <div className="flex flex-col gap-2">
              {wallsDraft.map((r, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <select
                    className="col-span-8 border rounded p-2"
                    value={r.material}
                    onChange={e => {
                      const v = e.target.value;
                      setWallsDraft(prev => prev.map((x, idx) => (idx === i ? { ...x, material: v } : x)));
                    }}
                  >
                    {WALL_MATERIAL_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="col-span-3 border rounded p-2"
                    value={r.percent}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setWallsDraft(prev => prev.map((x, idx) => (idx === i ? { ...x, percent: v } : x)));
                    }}
                  />
                  <button
                    className="col-span-1 border rounded"
                    onClick={() => setWallsDraft(prev => prev.filter((_, idx) => idx !== i))}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-3">
              <button
                className="px-3 py-2 border rounded"
                onClick={() => setWallsDraft(prev => [...prev, { material: 'unknown', percent: 0 }])}
              >
                + Add row
              </button>
              <div className="text-sm">
                Total: <span className={wallsTotal() === 100 ? '' : 'text-red-700'}>{wallsTotal()}%</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button className="px-3 py-2 border rounded" onClick={() => setWallsOpenForId(null)}>
                Cancel
              </button>
              <button className="px-3 py-2 border rounded" onClick={saveWalls}>
                Save walls %
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roof modal */}
      {roofOpenForId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border rounded-lg w-full max-w-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Roof construction (%)</div>
              <button className="px-2 py-1 border rounded" onClick={() => setRoofOpenForId(null)}>
                Close
              </button>
            </div>

            {roofError && <div className="mb-3 p-2 border rounded bg-red-50 text-red-800 text-sm">{roofError}</div>}

            <div className="grid grid-cols-12 gap-2 text-xs font-medium mb-2">
              <div className="col-span-8">Material</div>
              <div className="col-span-3">Percent</div>
              <div className="col-span-1"></div>
            </div>

            <div className="flex flex-col gap-2">
              {roofDraft.map((r, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <select
                    className="col-span-8 border rounded p-2"
                    value={r.material}
                    onChange={e => {
                      const v = e.target.value;
                      setRoofDraft(prev => prev.map((x, idx) => (idx === i ? { ...x, material: v } : x)));
                    }}
                  >
                    {ROOF_MATERIAL_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="col-span-3 border rounded p-2"
                    value={r.percent}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setRoofDraft(prev => prev.map((x, idx) => (idx === i ? { ...x, percent: v } : x)));
                    }}
                  />
                  <button
                    className="col-span-1 border rounded"
                    onClick={() => setRoofDraft(prev => prev.filter((_, idx) => idx !== i))}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-3">
              <button
                className="px-3 py-2 border rounded"
                onClick={() => setRoofDraft(prev => [...prev, { material: 'unknown', percent: 0 }])}
              >
                + Add row
              </button>
              <div className="text-sm">
                Total: <span className={rowsTotal(roofDraft) === 100 ? '' : 'text-red-700'}>{rowsTotal(roofDraft)}%</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button className="px-3 py-2 border rounded" onClick={() => setRoofOpenForId(null)}>
                Cancel
              </button>
              <button className="px-3 py-2 border rounded" onClick={saveRoof}>
                Save roof %
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mezzanine modal */}
      {mezzOpenForId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border rounded-lg w-full max-w-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Upper floors / Mezzanine construction (%)</div>
              <button className="px-2 py-1 border rounded" onClick={() => setMezzOpenForId(null)}>
                Close
              </button>
            </div>

            {mezzError && <div className="mb-3 p-2 border rounded bg-red-50 text-red-800 text-sm">{mezzError}</div>}

            <div className="grid grid-cols-12 gap-2 text-xs font-medium mb-2">
              <div className="col-span-8">Material</div>
              <div className="col-span-3">Percent</div>
              <div className="col-span-1"></div>
            </div>

            <div className="flex flex-col gap-2">
              {mezzDraft.map((r, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <select
                    className="col-span-8 border rounded p-2"
                    value={r.material}
                    onChange={e => {
                      const v = e.target.value;
                      setMezzDraft(prev => prev.map((x, idx) => (idx === i ? { ...x, material: v } : x)));
                    }}
                  >
                    {MEZZ_MATERIAL_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="col-span-3 border rounded p-2"
                    value={r.percent}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setMezzDraft(prev => prev.map((x, idx) => (idx === i ? { ...x, percent: v } : x)));
                    }}
                  />
                  <button
                    className="col-span-1 border rounded"
                    onClick={() => setMezzDraft(prev => prev.filter((_, idx) => idx !== i))}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-3">
              <button
                className="px-3 py-2 border rounded"
                onClick={() => setMezzDraft(prev => [...prev, { material: 'unknown', percent: 0 }])}
              >
                + Add row
              </button>
              <div className="text-sm">
                Total: <span className={rowsTotal(mezzDraft) === 100 ? '' : 'text-red-700'}>{rowsTotal(mezzDraft)}%</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button className="px-3 py-2 border rounded" onClick={() => setMezzOpenForId(null)}>
                Cancel
              </button>
              <button className="px-3 py-2 border rounded" onClick={saveMezz}>
                Save mezzanine %
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
