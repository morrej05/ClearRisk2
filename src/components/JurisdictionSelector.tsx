import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Jurisdiction, getAvailableJurisdictions, normalizeJurisdiction } from '../lib/jurisdictions';

interface JurisdictionSelectorProps {
  documentId: string;
  currentJurisdiction: Jurisdiction | string;
  status: 'draft' | 'in_review' | 'approved' | 'issued';
  onUpdate?: (jurisdiction: Jurisdiction) => void;
  className?: string;
}

export function JurisdictionSelector({
  documentId,
  currentJurisdiction,
  status,
  onUpdate,
  className = '',
}: JurisdictionSelectorProps) {
  const { userProfile } = useAuth();
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>(normalizeJurisdiction(currentJurisdiction));
  const [saving, setSaving] = useState(false);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'org_admin';

  const isDisabled =
    status === 'issued' ||
    (status === 'in_review' && !isAdmin) ||
    (status === 'approved' && !isAdmin);

  const tooltipText = status === 'issued'
    ? 'This document is issued. Create a revision to change jurisdiction.'
    : (status === 'in_review' || status === 'approved')
    ? 'Only admins can change jurisdiction for documents in review or approved status.'
    : '';

  const handleChange = async (newJurisdiction: Jurisdiction) => {
    if (isDisabled || newJurisdiction === jurisdiction) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('documents')
        .update({ jurisdiction: newJurisdiction })
        .eq('id', documentId);

      if (error) throw error;

      setJurisdiction(newJurisdiction);
      if (onUpdate) onUpdate(newJurisdiction);
    } catch (error) {
      console.error('Failed to update jurisdiction:', error);
      alert('Failed to update jurisdiction. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const availableJurisdictions = getAvailableJurisdictions();

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-sm font-medium text-gray-700">
        Jurisdiction
      </label>
      <div className="relative inline-block">
        <select
          value={jurisdiction}
          onChange={(e) => handleChange(e.target.value as Jurisdiction)}
          disabled={isDisabled || saving}
          title={tooltipText}
          className={`
            px-3 py-2 border rounded-lg text-sm font-medium
            ${isDisabled
              ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
              : 'bg-white text-gray-900 hover:border-gray-400 cursor-pointer'
            }
            ${saving ? 'opacity-50' : ''}
            border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500
          `}
        >
          {availableJurisdictions.map(j => (
            <option key={j.value} value={j.value}>
              {j.label}
            </option>
          ))}
        </select>
        {tooltipText && isDisabled && (
          <div className="mt-1 text-xs text-gray-500">
            {tooltipText}
          </div>
        )}
      </div>
    </div>
  );
}
