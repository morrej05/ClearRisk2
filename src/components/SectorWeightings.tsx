import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, RotateCcw, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SectorWeighting {
  id: string;
  sector_name: string;
  is_custom: boolean;
  construction: number;
  management: number;
  fire_protection: number;
  special_hazards: number;
  business_continuity: number;
  updated_at: string;
}

export default function SectorWeightings() {
  const [weightings, setWeightings] = useState<SectorWeighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadWeightings();
  }, []);

  const loadWeightings = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('sector_weightings')
        .select('*')
        .order('sector_name');

      if (fetchError) throw fetchError;
      setWeightings(data || []);
    } catch (err) {
      console.error('Error loading sector weightings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sector weightings');
    } finally {
      setLoading(false);
    }
  };

  const updateWeighting = async (
    id: string,
    field: keyof Omit<SectorWeighting, 'id' | 'sector_name' | 'updated_at'>,
    value: number | boolean
  ) => {
    setSaving(id);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from('sector_weightings')
        .update({
          [field]: value,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      setWeightings(prev =>
        prev.map(w => (w.id === id ? { ...w, [field]: value } : w))
      );

      setSuccess(`Updated ${field} successfully`);
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error('Error updating weighting:', err);
      setError(err instanceof Error ? err.message : 'Failed to update weighting');
    } finally {
      setSaving(null);
    }
  };

  const resetToDefault = async (id: string) => {
    setSaving(id);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from('sector_weightings')
        .update({
          construction: 3,
          management: 3,
          fire_protection: 3,
          special_hazards: 3,
          business_continuity: 3,
          is_custom: false,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      await loadWeightings();
      setSuccess('Reset to default values successfully');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error('Error resetting weighting:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset weighting');
    } finally {
      setSaving(null);
    }
  };

  const handleNumberInput = (
    id: string,
    field: 'construction' | 'management' | 'fire_protection' | 'special_hazards' | 'business_continuity',
    value: string
  ) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1 && num <= 5) {
      updateWeighting(id, field, num);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-slate-600">Loading sector weightings...</div>
      </div>
    );
  }

  const defaultWeighting = weightings.find(w => w.sector_name === 'Default');
  const sectorWeightings = weightings.filter(w => w.sector_name !== 'Default');

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Sector Weightings</h2>
          <p className="text-slate-600 text-sm">
            Configure how much each section influences the overall risk score for different industry sectors.
            Values range from 1 (lowest weight) to 5 (highest weight).
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
            <CheckCircle2 className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-800">{success}</div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start">
          <Info className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">How it works:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>Toggle "Use Default" OFF to customize weightings for a sector (marked with * in dropdown)</li>
              <li>When "Use Default" is ON, the sector uses Default row values</li>
              <li>Higher weights (4-5) emphasize that section more in risk scoring</li>
              <li>Lower weights (1-2) de-emphasize that section</li>
              <li>Changes take effect immediately for new surveys</li>
            </ul>
          </div>
        </div>

        {defaultWeighting && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <span className="bg-slate-900 text-white text-xs px-2 py-1 rounded mr-2">FALLBACK</span>
              Default Weightings
            </h3>
            <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                      Construction
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                      Management
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                      Fire Protection
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                      Special Hazards
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                      Business Continuity
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  <tr>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={defaultWeighting.construction}
                        onChange={(e) => handleNumberInput(defaultWeighting.id, 'construction', e.target.value)}
                        disabled={saving === defaultWeighting.id}
                        className="w-16 px-2 py-1 border border-slate-300 rounded text-center focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={defaultWeighting.management}
                        onChange={(e) => handleNumberInput(defaultWeighting.id, 'management', e.target.value)}
                        disabled={saving === defaultWeighting.id}
                        className="w-16 px-2 py-1 border border-slate-300 rounded text-center focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={defaultWeighting.fire_protection}
                        onChange={(e) => handleNumberInput(defaultWeighting.id, 'fire_protection', e.target.value)}
                        disabled={saving === defaultWeighting.id}
                        className="w-16 px-2 py-1 border border-slate-300 rounded text-center focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={defaultWeighting.special_hazards}
                        onChange={(e) => handleNumberInput(defaultWeighting.id, 'special_hazards', e.target.value)}
                        disabled={saving === defaultWeighting.id}
                        className="w-16 px-2 py-1 border border-slate-300 rounded text-center focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={defaultWeighting.business_continuity}
                        onChange={(e) => handleNumberInput(defaultWeighting.id, 'business_continuity', e.target.value)}
                        disabled={saving === defaultWeighting.id}
                        className="w-16 px-2 py-1 border border-slate-300 rounded text-center focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <h3 className="text-lg font-semibold text-slate-900 mb-4">Industry Sectors</h3>
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider w-48">
                  Sector Name
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider w-32">
                  Use Default
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Construction
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Management
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Fire Protection
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Special Hazards
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Business Continuity
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {sectorWeightings.map((weighting) => (
                <tr key={weighting.id} className={saving === weighting.id ? 'opacity-50' : ''}>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">
                    {weighting.sector_name}
                    {weighting.is_custom && (
                      <span className="ml-2 text-blue-600 font-bold" title="Custom weightings enabled">*</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!weighting.is_custom}
                        onChange={(e) => updateWeighting(weighting.id, 'is_custom', !e.target.checked)}
                        disabled={saving === weighting.id}
                        className="sr-only peer"
                      />
                      <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slate-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                    </label>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={weighting.construction}
                      onChange={(e) => handleNumberInput(weighting.id, 'construction', e.target.value)}
                      disabled={!weighting.is_custom || saving === weighting.id}
                      className={`w-16 px-2 py-1 border border-slate-300 rounded text-center focus:ring-2 focus:ring-slate-500 focus:border-transparent ${
                        !weighting.is_custom ? 'bg-slate-100 cursor-not-allowed' : ''
                      }`}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={weighting.management}
                      onChange={(e) => handleNumberInput(weighting.id, 'management', e.target.value)}
                      disabled={!weighting.is_custom || saving === weighting.id}
                      className={`w-16 px-2 py-1 border border-slate-300 rounded text-center focus:ring-2 focus:ring-slate-500 focus:border-transparent ${
                        !weighting.is_custom ? 'bg-slate-100 cursor-not-allowed' : ''
                      }`}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={weighting.fire_protection}
                      onChange={(e) => handleNumberInput(weighting.id, 'fire_protection', e.target.value)}
                      disabled={!weighting.is_custom || saving === weighting.id}
                      className={`w-16 px-2 py-1 border border-slate-300 rounded text-center focus:ring-2 focus:ring-slate-500 focus:border-transparent ${
                        !weighting.is_custom ? 'bg-slate-100 cursor-not-allowed' : ''
                      }`}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={weighting.special_hazards}
                      onChange={(e) => handleNumberInput(weighting.id, 'special_hazards', e.target.value)}
                      disabled={!weighting.is_custom || saving === weighting.id}
                      className={`w-16 px-2 py-1 border border-slate-300 rounded text-center focus:ring-2 focus:ring-slate-500 focus:border-transparent ${
                        !weighting.is_custom ? 'bg-slate-100 cursor-not-allowed' : ''
                      }`}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={weighting.business_continuity}
                      onChange={(e) => handleNumberInput(weighting.id, 'business_continuity', e.target.value)}
                      disabled={!weighting.is_custom || saving === weighting.id}
                      className={`w-16 px-2 py-1 border border-slate-300 rounded text-center focus:ring-2 focus:ring-slate-500 focus:border-transparent ${
                        !weighting.is_custom ? 'bg-slate-100 cursor-not-allowed' : ''
                      }`}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => resetToDefault(weighting.id)}
                      disabled={saving === weighting.id || !weighting.is_custom}
                      className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded transition-colors ${
                        !weighting.is_custom
                          ? 'text-slate-400 cursor-not-allowed'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                      title="Reset to default values"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
