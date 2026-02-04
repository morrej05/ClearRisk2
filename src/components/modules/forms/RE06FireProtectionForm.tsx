import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import FloatingSaveBar from './FloatingSaveBar';

type ConstructionBuilding = { id: string; building_name?: string };

export default function RE06FireProtectionForm() {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>('idle');
  const [buildings, setBuildings] = useState<ConstructionBuilding[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadConstructionBuildings() {
      try {
        setStatus('loading');

        // Use the module_instances row for RE_02_CONSTRUCTION on the SAME document
        const { data: mi, error } = await supabase
          .from('module_instances')
          .select('id, document_id, module_key, updated_at, data')
          .eq('module_key', 'RE_02_CONSTRUCTION')
          .order('updated_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        // NOTE:
        // In the real app we filter by document_id. In this step we first prove we can read ANY rows,
        // then we’ll tighten the filter once you confirm a row exists for your document.
        const row = mi?.[0] ?? null;

        const loaded: ConstructionBuilding[] =
          Array.isArray((row as any)?.data?.construction?.buildings)
            ? (row as any).data.construction.buildings
            : Array.isArray((row as any)?.data?.buildings)
            ? (row as any).data.buildings
            : [];

        if (cancelled) return;

        setBuildings(loaded);
        setSelectedBuildingId(loaded[0]?.id ?? null);
        setStatus(`ok (row=${row?.id ?? 'none'} buildings=${loaded.length})`);

        console.log('[RE06 step5] picked row:', row?.id, 'doc:', row?.document_id, 'updated_at:', row?.updated_at);
        console.log('[RE06 step5] buildings:', loaded);
      } catch (e: any) {
        console.error('[RE06 step5] loadConstructionBuildings failed:', e);
        if (!cancelled) setStatus(`error: ${e?.message ?? String(e)}`);
        if (!cancelled) setBuildings([]);
      }
    }

    loadConstructionBuildings();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div style={{ padding: 24 }}>
        <h2>RE06 Step 5 — Fetch RE02 buildings</h2>
        <div style={{ marginTop: 8 }}>
          <strong>Status:</strong> {status}
        </div>

        <div style={{ marginTop: 16 }}>
          <strong>Buildings found:</strong> {buildings.length}
          <ul style={{ marginTop: 8 }}>
            {buildings.map((b) => (
              <li key={b.id}>
                {b.building_name || '(Unnamed)'} — <code>{b.id}</code>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: 16 }}>
          <strong>Selected building:</strong> {selectedBuildingId ?? '(none)'}
        </div>

        <div style={{ marginTop: 16 }}>
          <button onClick={() => setSaving((s) => !s)}>Toggle Saving</button>
        </div>
      </div>

      <FloatingSaveBar onSave={() => alert('save')} isSaving={saving} />
    </>
  );
}
