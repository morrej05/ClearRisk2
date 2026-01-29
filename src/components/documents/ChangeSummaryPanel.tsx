import { useEffect, useMemo, useState } from 'react';
import {
  getChangeSummary,
  formatChangeSummaryText,
  updateChangeSummaryText,
  setChangeSummaryClientVisibility,
  type ChangeSummaryViewRow,
} from '../../utils/changeSummary';

interface ChangeSummaryPanelProps {
  documentId: string;
  canEdit?: boolean; // pass true for admins
}

export default function ChangeSummaryPanel({
  documentId,
  canEdit = false,
}: ChangeSummaryPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<ChangeSummaryViewRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [draftText, setDraftText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const computedMarkdown = useMemo(() => {
    if (!summary) return '';
    return summary.summary_text?.trim()
      ? summary.summary_text
      : formatChangeSummaryText(summary);
  }, [summary]);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const s = await getChangeSummary(documentId);

      // Important: handle "no rows" cleanly
      if (!s) {
        setSummary(null);
        setDraftText('');
        return;
      }

      setSummary(s);
      setDraftText(s.summary_text ?? s.summary_markdown ?? '');
    } catch (e: any) {
      setError(e?.message || 'Failed to load change summary');
      setSummary(null);
      setDraftText('');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!documentId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const handleSave = async () => {
    if (!summary?.id) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await updateChangeSummaryText(summary.id, draftText);
      if (!res.success) throw new Error(res.error || 'Save failed');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleVisible = async () => {
    if (!summary?.id) return;
    setIsToggling(true);
    setError(null);
    try {
      const res = await setChangeSummaryClientVisibility(
        summary.id,
        !summary.visible_to_client
      );
      if (!res.success) throw new Error(res.error || 'Update failed');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to update visibility');
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
      <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-neutral-900">Change Summary</h3>
          <p className="text-xs text-neutral-500">
            Latest summary for this document
          </p>
        </div>

        {summary && (
          <div className="text-xs text-neutral-500">
            {summary.created_at
              ? new Date(summary.created_at).toLocaleString()
              : ''}
          </div>
        )}
      </div>

      <div className="p-4">
        {isLoading && (
          <div className="text-sm text-neutral-600">Loading…</div>
        )}

        {!isLoading && error && (
          <div className="text-sm text-red-600">{error}</div>
        )}

        {!isLoading && !error && !summary && (
          <div className="text-sm text-neutral-600">
            No change summary found yet. (It’s created when a document is issued.)
          </div>
        )}

        {!isLoading && !error && summary && (
          <>
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-neutral-100 text-neutral-700">
                New: {summary.new_actions_count}
              </span>
              <span className="px-2 py-1 rounded bg-neutral-100 text-neutral-700">
                Closed: {summary.closed_actions_count}
              </span>
              <span className="px-2 py-1 rounded bg-neutral-100 text-neutral-700">
                Outstanding: {summary.outstanding_actions_count}
              </span>
              <span className="px-2 py-1 rounded bg-neutral-100 text-neutral-700">
                Material: {summary.has_material_changes ? 'Yes' : 'No'}
              </span>
            </div>

            {canEdit ? (
              <>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Summary text (shown instead of auto-generated markdown)
                </label>
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  className="w-full min-h-[140px] rounded border border-neutral-300 p-2 text-sm"
                  placeholder="Optional: write a custom summary for this issue…"
                />

                <div className="mt-3 flex items-center justify-between gap-3">
                  <button
                    onClick={handleToggleVisible}
                    disabled={isToggling}
                    className="px-3 py-2 rounded border border-neutral-300 text-sm hover:bg-neutral-50 disabled:opacity-50"
                  >
                    {summary.visible_to_client
                      ? 'Visible to client'
                      : 'Hidden from client'}
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={load}
                      disabled={isSaving || isToggling}
                      className="px-3 py-2 rounded border border-neutral-300 text-sm hover:bg-neutral-50 disabled:opacity-50"
                    >
                      Refresh
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving || isToggling}
                      className="px-3 py-2 rounded bg-neutral-900 text-white text-sm hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {isSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs font-medium text-neutral-700 mb-1">
                    Preview (what users will read)
                  </div>
                  <pre className="whitespace-pre-wrap text-sm bg-neutral-50 border border-neutral-200 rounded p-3">
                    {draftText?.trim() ? draftText : computedMarkdown}
                  </pre>
                </div>
              </>
            ) : (
              <pre className="whitespace-pre-wrap text-sm bg-neutral-50 border border-neutral-200 rounded p-3">
                {computedMarkdown}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  );
}
