import { useEffect, useMemo, useState } from 'react';
import type { BuildingInput } from '../../lib/re/buildingsModel';
import { createEmptyBuilding } from '../../lib/re/buildingsModel';
import {
  listBuildings,
  upsertBuilding,
  deleteBuilding,
  getBuildingExtra,
  upsertBuildingExtra,
} from '../../lib/re/buildingsRepo';

type GridMode = 'all' | 'construction' | 'fire_protection';

type Props = {
  documentId: string;
  mode?: GridMode;
  onAfterSave?: () => Promise<void> | void;
};

type WallRow = { material: string; percent: number };

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
    { material: 'masonry', percent: 100 },
  ]);
  const [wallsError, setWallsError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await listBuildings(documentId);
      setRows(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load buildings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
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
          : [{ material: 'masonry', percent: 100 }];

      setWallsDraft(existing);
    } catch (e: any) {
      setWallsError(e?.message ?? 'Failed to load wall %');
      setWallsDraft([{ material: 'masonry', percent: 100 }]);
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
      setWallsOpenForId(null);
    } catch (e: any) {
      setWallsError(e?.message ?? 'Failed to save wall %');
    }
  }

  const totals = useMemo(() => {
    return {
      roof: sum(rows.map(r => r.roof_area_m2)),
      mezz: sum(rows.map(r => r.mezzanine_area_m2)),
    };
  }, [rows]);

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
              <th className="text-left p-2 border-b">Roof (m²)</th>
              <th className="text-left p-2 border-b">Upper floors / mezz (m²)</th>
              <th className="text-left p-2 border-b">Walls (%)</th>
              <th className="text-left p-2 border-b">Storeys</th>
              <th className="text-left p-2 border-b">Comb. cladding</th>
              <th className="text-left p-2 border-b">Frame</th>
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

                <td className="p-2">
                  <input
                    type="number"
                    className="w-32 border rounded p-2"
                    value={b.roof_area_m2 ?? ''}
                    onChange={e =>
                      updateRow(idx, { roof_area_m2: e.target.value === '' ? null : Number(e.target.value) })
                    }
                    placeholder="m²"
                  />
                </td>

                <td className="p-2">
                  <input
                    type="number"
                    className="w-40 border rounded p-2"
                    value={b.mezzanine_area_m2 ?? ''}
                    onChange={e =>
                      updateRow(idx, { mezzanine_area_m2: e.target.value === '' ? null : Number(e.target.value) })
                    }
                    placeholder="m²"
                  />
                </td>

                <td className="p-2">
                  {b.id ? (
                    <button className="px-2 py-1 border rounded" onClick={() => openWalls(b.id!)}>
                      Edit
                    </button>
                  ) : (
                    <div className="text-xs opacity-70">Save building first</div>
                  )}
                </td>

                <td className="p-2">
                  <input
                    type="number"
                    className="w-24 border rounded p-2"
                    value={b.storeys ?? ''}
                    onChange={e => updateRow(idx, { storeys: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                </td>

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

                <td className="p-2">
                  <select
                    className="border rounded p-2"
                    value={b.frame_type}
                    onChange={e => updateRow(idx, { frame_type: e.target.value })}
                  >
                    <option value="unknown">Unknown</option>
                    <option value="steel">Steel</option>
                    <option value="reinforced_concrete">Reinforced concrete</option>
                    <option value="timber">Timber</option>
                    <option value="masonry">Masonry</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </td>

                <td className="p-2">
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-2 border rounded"
                      onClick={() => saveRow(idx)}
                      disabled={savingId !== null}
                    >
                      {savingId && (savingId === b.id || savingId === `new-${idx}`) ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      className="px-3 py-2 border rounded"
                      onClick={() => removeRow(idx)}
                      disabled={savingId !== null}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {/* Totals row */}
            <tr className="bg-slate-50 font-medium">
              <td className="p-2">Totals</td>
              <td className="p-2">Roof: {totals.roof.toLocaleString()} m²</td>
              <td className="p-2">Mezz: {totals.mezz.toLocaleString()} m²</td>
              <td className="p-2" colSpan={5}>
                Known total (roof + mezz): {(totals.roof + totals.mezz).toLocaleString()} m²
              </td>
            </tr>
          </tbody>
        </table>
      </div>

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
                  <input
                    className="col-span-8 border rounded p-2"
                    value={r.material}
                    onChange={e => {
                      const v = e.target.value;
                      setWallsDraft(prev => prev.map((x, idx) => (idx === i ? { ...x, material: v } : x)));
                    }}
                  />
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
                onClick={() => setWallsDraft(prev => [...prev, { material: 'metal_clad', percent: 0 }])}
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
    </div>
  );
}
