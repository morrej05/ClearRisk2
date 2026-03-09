import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Jurisdiction,
  getAvailableJurisdictions,
  getDsearJurisdictionOptions,
  normalizeJurisdiction,
} from '../lib/jurisdictions';

interface JurisdictionSelectorProps {
  documentId: string;
  currentJurisdiction: Jurisdiction | string;
  product?: string;
  status: 'draft' | 'in_review' | 'approved' | 'issued';
  onUpdate?: (jurisdiction: Jurisdiction | string) => void;
  className?: string;
}

export function JurisdictionSelector({
  documentId,
  currentJurisdiction,
  product,
  status,
  onUpdate,
  className = '',
}: JurisdictionSelectorProps) {
  const { userProfile } = useAuth();
  const isDsearContext = product === 'DSEAR';

  const [jurisdiction, setJurisdiction] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'org_admin';

  const isDisabled =
    status === 'issued' ||
    (status === 'in_review' && !isAdmin) ||
    (status === 'approved' && !isAdmin);

  const tooltipText =
    status === 'issued'
      ? 'This document is issued. Create a revision to change jurisdiction.'
      : status === 'in_review' || status === 'approved'
      ? 'Only admins can change jurisdiction for documents in review or approved status.'
      : '';

  const availableJurisdictions = useMemo(
    () => (isDsearContext ? getDsearJurisdictionOptions() : getAvailableJurisdictions()),
    [isDsearContext]
  );

  const normalizeForContext = (value: Jurisdiction | string) => String(normalizeJurisdiction(value));

  // Keep local state aligned with props + ensure the selected value always exists in options
  useEffect(() => {
    if (saving) return;

    const normalized = normalizeForContext(currentJurisdiction);
    const exists = availableJurisdictions.some((o) => o.value === normalized);

    setJurisdiction(exists ? normalized : (availableJurisdictions[0]?.value ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentJurisdiction, isDsearContext, saving, availableJurisdictions]);

  const handleChange = async (rawValue: string) => {
    if (isDisabled) return;

    const newJurisdiction = normalizeForContext(rawValue);
    if (newJurisdiction === jurisdiction) return;

    // ✅ Immediate UI update (so it "selects" instantly)
    setJurisdiction(newJurisdiction);

    setSaving(true);
    try {
      const { data, error } = await supabase
  .from('documents')
  .update({ jurisdiction: newJurisdiction })
  .eq('id', documentId)
  .select('id, jurisdiction')
  .single();

if (error) throw error;

      onUpdate?.(newJurisdiction);
    } catch (error) {
      console.error('Failed to update jurisdiction:', error);
      alert(
  `Failed to update jurisdiction: ${
    error instanceof Error ? error.message : JSON.stringify(error)
  }`
);

      // Revert UI to current persisted value from props
      const normalized = normalizeForContext(currentJurisdiction);
      const exists = availableJurisdictions.some((o) => o.value === normalized);
      setJurisdiction(exists ? normalized : (availableJurisdictions[0]?.value ?? ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-sm font-medium text-gray-700">Jurisdiction</label>

      <div className="relative inline-block">
        <select
          value={jurisdiction}
          onChange={(e) => handleChange(e.target.value)}
          disabled={isDisabled || saving}
          title={tooltipText}
          className={`
            px-3 py-2 border rounded-lg text-sm font-medium
            ${
              isDisabled
                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                : 'bg-white text-gray-900 hover:border-gray-400 cursor-pointer'
            }
            ${saving ? 'opacity-50' : ''}
            border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500
          `}
        >
          {availableJurisdictions.map((j) => (
            <option key={j.value} value={j.value}>
              {j.label}
            </option>
          ))}
        </select>

        {tooltipText && isDisabled && <div className="mt-1 text-xs text-gray-500">{tooltipText}</div>}
      </div>
    </div>
  );
}