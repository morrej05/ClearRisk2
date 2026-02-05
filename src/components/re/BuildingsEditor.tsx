// src/components/re/BuildingsEditor.tsx
import { useEffect, useMemo, useState } from 'react';
import type { BuildingInput } from '../../lib/re/buildingsModel';
import { createEmptyBuilding } from '../../lib/re/buildingsModel';
import { listBuildings, upsertBuilding, deleteBuilding } from '../../lib/re/buildingsRepo';
import { computeBuilding } from '../../lib/re/buildingsCompute';

type Props = {
  documentId: string;
  onAfterSave?: () => Promise<void> | void;
};

export default function BuildingsEditor({ documentId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [buildings, setBuildings] = useState<BuildingInput[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BuildingInput | null>(null);

  const selected = useMemo(() => {
    if (draft) return draft;
    if (!selectedId) return null;
    return buildings.find(b => b.id === selectedId) ?? null;
  }, [buildings, selectedId, draft]);

  const computed = useMemo(() => {
    return selected ? computeBuilding(selected) : null;
  }, [selected]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const rows = await listBuildings(documentId);
      setBuildings(rows);
      // auto-select first building if none selected
      if (!selectedId && rows.length > 0) setSelectedId(rows[0].id ?? null);
      if (rows.length === 0) setSelectedId(null);
      setDraft(null);
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

  function startNew() {
    const ref = `B${buildings.length + 1}`;
    setDraft(createEmptyBuilding(documentId, ref));
    setSelectedId(null);
  }

  function selectExisting(id: string) {
    setSelectedId(id);
    setDraft(null);
  }

  function updateField<K extends keyof BuildingInput>(key: K, value: BuildingInput[K]) {
    if (!selected) return;
    const next = { ...selected, [key]: value };
    setDraft(next);
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      // basic guard
      if (!selected.ref?.trim()) throw new Error('Building ref is required (e.g. B1)');

      const saved = await upsertBuilding(selected);
      await refresh();
      if (saved.id) setSelectedId(saved.id);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selected?.id) return;
    if (!confirm('Delete this building?')) return;

    setSaving(true);
    setError(null);
    try {
      await deleteBuilding(selected.id);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to delete');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-4">Loading buildings…</div>;

  return (
    <div className="p-4 grid grid-cols-12 gap-4">
      {/* Left: list */}
      <div className="col-span-4 border rounded-lg p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Buildings</div>
          <button className="px-2 py-1 border rounded" onClick={startNew}>
            + Add
          </button>
        </div>

        {buildings.length === 0 && <div className="text-sm opacity-70">No buildings yet.</div>}

        <div className="flex flex-col gap-2">
          {buildings.map(b => (
            <button
              key={b.id}
              className={`text-left p-2 rounded border ${
                b.id === selectedId ? 'bg-slate-50' : ''
              }`}
              onClick={() => b.id && selectExisting(b.id)}
            >
              <div className="font-medium">{b.ref}</div>
              <div className="text-xs opacity-70">{b.description ?? ''}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: editor */}
      <div className="col-span-8 border rounded-lg p-3">
        {!selected && (
          <div className="text-sm opacity-70">
            Select a building on the left, or click “Add”.
          </div>
        )}

        {error && (
          <div className="mb-3 p-2 border rounded bg-red-50 text-red-800 text-sm">{error}</div>
        )}

        {selected && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Edit Building</div>
              <div className="flex gap-2">
                {selected.id && (
                  <button className="px-2 py-1 border rounded" onClick={remove} disabled={saving}>
                    Delete
                  </button>
                )}
                <button className="px-2 py-1 border rounded" onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            {/* Minimal fields for now (we’ll expand in RE-02 / RE-06 views) */}
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                Ref
                <input
                  className="mt-1 w-full border rounded p-2"
                  value={selected.ref}
                  onChange={e => updateField('ref', e.target.value)}
                />
              </label>

              <label className="text-sm">
                Description
                <input
                  className="mt-1 w-full border rounded p-2"
                  value={selected.description ?? ''}
                  onChange={e => updateField('description', e.target.value)}
                />
              </label>

              <label className="text-sm">
                Footprint (m²)
                <input
                  type="number"
                  className="mt-1 w-full border rounded p-2"
                  value={selected.footprint_m2 ?? ''}
                  onChange={e => updateField('footprint_m2', e.target.value === '' ? null : Number(e.target.value))}
                />
              </label>

              <label className="text-sm">
                Storeys
                <input
                  type="number"
                  className="mt-1 w-full border rounded p-2"
                  value={selected.storeys ?? ''}
                  onChange={e => updateField('storeys', e.target.value === '' ? null : Number(e.target.value))}
                />
              </label>

              <label className="text-sm">
                Roof type
                <select
                  className="mt-1 w-full border rounded p-2"
                  value={selected.roof_type}
                  onChange={e => updateField('roof_type', e.target.value)}
                >
                  <option value="unknown">Unknown</option>
                  <option value="flat">Flat</option>
                  <option value="pitched">Pitched</option>
                  <option value="sawtooth">Sawtooth</option>
                </select>
              </label>

              <label className="text-sm">
                Frame type
                <select
                  className="mt-1 w-full border rounded p-2"
                  value={selected.frame_type}
                  onChange={e => updateField('frame_type', e.target.value)}
                >
                  <option value="unknown">Unknown</option>
                  <option value="steel">Steel</option>
                  <option value="reinforced_concrete">Reinforced concrete</option>
                  <option value="timber">Timber</option>
                  <option value="masonry">Masonry</option>
                  <option value="mixed">Mixed</option>
                </select>
              </label>

              <label className="text-sm">
                Sprinklers present
                <select
                  className="mt-1 w-full border rounded p-2"
                  value={selected.sprinklers_present ? 'yes' : 'no'}
                  onChange={e => updateField('sprinklers_present', e.target.value === 'yes')}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>

              <label className="text-sm">
                Detection present
                <select
                  className="mt-1 w-full border rounded p-2"
                  value={selected.detection_present ? 'yes' : 'no'}
                  onChange={e => updateField('detection_present', e.target.value === 'yes')}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>
            </div>

            {/* Computed */}
            <div className="mt-4 border rounded-lg p-3 bg-slate-50">
              <div className="font-semibold mb-2">Computed (not saved)</div>
              {computed && (
                <div className="text-sm grid grid-cols-2 gap-3">
                  <div>
                    <div className="font-medium">RE-02 score</div>
                    <div>{computed.re02_construction_score}</div>
                  </div>
                  <div>
                    <div className="font-medium">RE-06 score</div>
                    <div>{computed.re06_protection_score}</div>
                  </div>

                  <div>
                    <div className="font-medium">Construction flags</div>
                    <ul className="list-disc ml-5">
                      {computed.construction_flags.length === 0 ? (
                        <li className="opacity-70">None</li>
                      ) : (
                        computed.construction_flags.map((f, i) => <li key={i}>{f}</li>)
                      )}
                    </ul>
                  </div>

                  <div>
                    <div className="font-medium">Protection flags</div>
                    <ul className="list-disc ml-5">
                      {computed.protection_flags.length === 0 ? (
                        <li className="opacity-70">None</li>
                      ) : (
                        computed.protection_flags.map((f, i) => <li key={i}>{f}</li>)
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
