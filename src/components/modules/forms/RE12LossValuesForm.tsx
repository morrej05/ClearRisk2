import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import ModuleActions from '../ModuleActions';
import FloatingSaveBar from './FloatingSaveBar';

interface Document {
  id: string;
  title: string;
}

interface ModuleInstance {
  id: string;
  document_id: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
}

interface RE12LossValuesFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

const CURRENCIES = [
  { code: 'GBP', label: 'GBP — British Pound', symbol: '£' },
  { code: 'USD', label: 'USD — US Dollar', symbol: '$' },
  { code: 'EUR', label: 'EUR — Euro', symbol: '€' },
  { code: 'CAD', label: 'CAD — Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', label: 'AUD — Australian Dollar', symbol: 'A$' },
  { code: 'NZD', label: 'NZD — New Zealand Dollar', symbol: 'NZ$' },
  { code: 'CHF', label: 'CHF — Swiss Franc', symbol: 'CHF ' },
  { code: 'NOK', label: 'NOK — Norwegian Krone', symbol: 'kr ' },
  { code: 'SEK', label: 'SEK — Swedish Krona', symbol: 'kr ' },
  { code: 'DKK', label: 'DKK — Danish Krone', symbol: 'kr ' },
  { code: 'CNY', label: 'CNY — Chinese Yuan', symbol: '¥' },
  { code: 'INR', label: 'INR — Indian Rupee', symbol: '₹' },
];

export default function RE12LossValuesForm({
  moduleInstance,
  document,
  onSaved,
}: RE12LossValuesFormProps) {
  const [isSaving, setIsSaving] = useState(false);

  const d = moduleInstance.data || {};

  const [formData, setFormData] = useState({
    currency: d.currency || 'GBP',

    // RE-12.1 Sums Insured
    sums_insured: {
      property_damage: {
        buildings_improvements: d.sums_insured?.property_damage?.buildings_improvements || null,
        plant_machinery_contents: d.sums_insured?.property_damage?.plant_machinery_contents || null,
        stock_wip: d.sums_insured?.property_damage?.stock_wip || null,
        computers: d.sums_insured?.property_damage?.computers || null,
        other_label: d.sums_insured?.property_damage?.other_label || 'Other',
        other: d.sums_insured?.property_damage?.other || null,
      },
      business_interruption: {
        gross_profit_annual: d.sums_insured?.business_interruption?.gross_profit_annual || null,
        aicow: d.sums_insured?.business_interruption?.aicow || null,
        loss_of_rent: d.sums_insured?.business_interruption?.loss_of_rent || null,
        other_label: d.sums_insured?.business_interruption?.other_label || 'Other',
        other: d.sums_insured?.business_interruption?.other || null,
        indemnity_period_months: d.sums_insured?.business_interruption?.indemnity_period_months || null,
        operating_days_per_year: d.sums_insured?.business_interruption?.operating_days_per_year || null,
      },
      additional_comments: d.sums_insured?.additional_comments || '',
    },

    // RE-12.2 WLE
    wle: {
      scenario_summary: d.wle?.scenario_summary || '',
      scenario_description: d.wle?.scenario_description || '',
      property_damage: {
        buildings_improvements_pct: d.wle?.property_damage?.buildings_improvements_pct || null,
        plant_machinery_contents_pct: d.wle?.property_damage?.plant_machinery_contents_pct || null,
        stock_wip_pct: d.wle?.property_damage?.stock_wip_pct || null,
        computers_pct: d.wle?.property_damage?.computers_pct || null,
        other_pct: d.wle?.property_damage?.other_pct || null,
      },
      business_interruption: {
        outage_duration_months: d.wle?.business_interruption?.outage_duration_months || null,
        gross_profit_pct: d.wle?.business_interruption?.gross_profit_pct || null,
      },
    },

    // RE-12.3 NLE
    nle: {
      scenario_summary: d.nle?.scenario_summary || '',
      scenario_description: d.nle?.scenario_description || '',
      property_damage: {
        buildings_improvements_pct: d.nle?.property_damage?.buildings_improvements_pct || null,
        plant_machinery_contents_pct: d.nle?.property_damage?.plant_machinery_contents_pct || null,
        stock_wip_pct: d.nle?.property_damage?.stock_wip_pct || null,
        computers_pct: d.nle?.property_damage?.computers_pct || null,
        other_pct: d.nle?.property_damage?.other_pct || null,
      },
      business_interruption: {
        outage_duration_months: d.nle?.business_interruption?.outage_duration_months || null,
        gross_profit_pct: d.nle?.business_interruption?.gross_profit_pct || null,
      },
    },
  });

  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  // Calculation helpers
  const calcTotalPD = () => {
    const pd = formData.sums_insured.property_damage;
    return (pd.buildings_improvements || 0) +
           (pd.plant_machinery_contents || 0) +
           (pd.stock_wip || 0) +
           (pd.computers || 0) +
           (pd.other || 0);
  };

  const calcTotalBI = () => {
    const bi = formData.sums_insured.business_interruption;
    return (bi.gross_profit_annual || 0) +
           (bi.aicow || 0) +
           (bi.loss_of_rent || 0) +
           (bi.other || 0);
  };

  const calcMonthlyBI = () => {
    const totalBI = calcTotalBI();
    return totalBI / 12;
  };

  const calcDailyBI = () => {
    const bi = formData.sums_insured.business_interruption;
    const totalBI = calcTotalBI();
    const operatingDays = bi.operating_days_per_year || 365;
    return totalBI / operatingDays;
  };

  const calcTotalSumsInsured = () => {
    return calcTotalPD() + calcTotalBI();
  };

  // WLE calculations
  const calcWLEPDSubtotal = (category: keyof typeof formData.sums_insured.property_damage, pct: number | null) => {
    if (!pct) return 0;
    const value = formData.sums_insured.property_damage[category];
    return ((value || 0) * pct) / 100;
  };

  const calcWLEPDTotal = () => {
    const pd = formData.wle.property_damage;
    return calcWLEPDSubtotal('buildings_improvements', pd.buildings_improvements_pct) +
           calcWLEPDSubtotal('plant_machinery_contents', pd.plant_machinery_contents_pct) +
           calcWLEPDSubtotal('stock_wip', pd.stock_wip_pct) +
           calcWLEPDSubtotal('computers', pd.computers_pct) +
           calcWLEPDSubtotal('other', pd.other_pct);
  };

  const calcWLEBITotal = () => {
    const bi = formData.wle.business_interruption;
    const grossProfit = formData.sums_insured.business_interruption.gross_profit_annual || 0;
    const months = bi.outage_duration_months || 0;
    const pct = bi.gross_profit_pct || 0;
    return (grossProfit * (pct / 100) * months) / 12;
  };

  const calcWLETotal = () => {
    return calcWLEPDTotal() + calcWLEBITotal();
  };

  const calcWLEPDPctOfTotal = () => {
    const totalPD = calcTotalPD();
    if (!totalPD) return 0;
    return (calcWLEPDTotal() / totalPD) * 100;
  };

  const calcWLEBIPctOfTotal = () => {
    const totalBI = calcTotalBI();
    if (!totalBI) return 0;
    return (calcWLEBITotal() / totalBI) * 100;
  };

  const calcWLETotalPctOfTotal = () => {
    const totalSums = calcTotalSumsInsured();
    if (!totalSums) return 0;
    return (calcWLETotal() / totalSums) * 100;
  };

  // NLE calculations
  const calcNLEPDSubtotal = (category: keyof typeof formData.sums_insured.property_damage, pct: number | null) => {
    if (!pct) return 0;
    const value = formData.sums_insured.property_damage[category];
    return ((value || 0) * pct) / 100;
  };

  const calcNLEPDTotal = () => {
    const pd = formData.nle.property_damage;
    return calcNLEPDSubtotal('buildings_improvements', pd.buildings_improvements_pct) +
           calcNLEPDSubtotal('plant_machinery_contents', pd.plant_machinery_contents_pct) +
           calcNLEPDSubtotal('stock_wip', pd.stock_wip_pct) +
           calcNLEPDSubtotal('computers', pd.computers_pct) +
           calcNLEPDSubtotal('other', pd.other_pct);
  };

  const calcNLEBITotal = () => {
    const bi = formData.nle.business_interruption;
    const grossProfit = formData.sums_insured.business_interruption.gross_profit_annual || 0;
    const months = bi.outage_duration_months || 0;
    const pct = bi.gross_profit_pct || 0;
    return (grossProfit * (pct / 100) * months) / 12;
  };

  const calcNLETotal = () => {
    return calcNLEPDTotal() + calcNLEBITotal();
  };

  const calcNLEPDPctOfTotal = () => {
    const totalPD = calcTotalPD();
    if (!totalPD) return 0;
    return (calcNLEPDTotal() / totalPD) * 100;
  };

  const calcNLEBIPctOfTotal = () => {
    const totalBI = calcTotalBI();
    if (!totalBI) return 0;
    return (calcNLEBITotal() / totalBI) * 100;
  };

  const calcNLETotalPctOfTotal = () => {
    const totalSums = calcTotalSumsInsured();
    if (!totalSums) return 0;
    return (calcNLETotal() / totalSums) * 100;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const sanitized = sanitizeModuleInstancePayload({ data: formData });

      const { error } = await supabase
        .from('module_instances')
        .update({
          data: sanitized.data,
          assessor_notes: assessorNotes,
        })
        .eq('id', moduleInstance.id);

      if (error) throw error;
      onSaved();
    } catch (error) {
      console.error('Error saving module:', error);
      alert('Failed to save module. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    const currency = CURRENCIES.find(c => c.code === formData.currency);
    const symbol = currency?.symbol || '';
    return `${symbol}${value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatPct = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <>
    <div className="p-6 max-w-6xl mx-auto pb-24">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-12 — Loss & Values</h2>
        <p className="text-slate-600">Sums insured, worst-case loss expectancy, and normal loss expectancy</p>
      </div>

      <div className="space-y-6">
        {/* Currency Selector */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Currency</h3>
          <div className="max-w-sm">
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.label} ({c.symbol})</option>
              ))}
            </select>
          </div>
        </div>

        {/* RE-12.1 Sums Insured */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-1">RE-12.1 — Sums Insured</h3>
          <p className="text-sm text-slate-600 mb-6">Enter the total insured values for property damage and business interruption</p>

          {/* Property Damage */}
          <div className="mb-6">
            <h4 className="text-base font-semibold text-slate-800 mb-3 border-b pb-2">Property Damage</h4>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium text-slate-700">Buildings & Improvements</label>
                <input
                  type="number"
                  value={formData.sums_insured.property_damage.buildings_improvements || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    sums_insured: {
                      ...formData.sums_insured,
                      property_damage: {
                        ...formData.sums_insured.property_damage,
                        buildings_improvements: e.target.value ? parseFloat(e.target.value) : null,
                      },
                    },
                  })}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium text-slate-700">Plant & Machinery + Contents</label>
                <input
                  type="number"
                  value={formData.sums_insured.property_damage.plant_machinery_contents || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    sums_insured: {
                      ...formData.sums_insured,
                      property_damage: {
                        ...formData.sums_insured.property_damage,
                        plant_machinery_contents: e.target.value ? parseFloat(e.target.value) : null,
                      },
                    },
                  })}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium text-slate-700">Stock & WIP</label>
                <input
                  type="number"
                  value={formData.sums_insured.property_damage.stock_wip || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    sums_insured: {
                      ...formData.sums_insured,
                      property_damage: {
                        ...formData.sums_insured.property_damage,
                        stock_wip: e.target.value ? parseFloat(e.target.value) : null,
                      },
                    },
                  })}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium text-slate-700">Computers</label>
                <input
                  type="number"
                  value={formData.sums_insured.property_damage.computers || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    sums_insured: {
                      ...formData.sums_insured,
                      property_damage: {
                        ...formData.sums_insured.property_damage,
                        computers: e.target.value ? parseFloat(e.target.value) : null,
                      },
                    },
                  })}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.sums_insured.property_damage.other_label}
                    onChange={(e) => setFormData({
                      ...formData,
                      sums_insured: {
                        ...formData.sums_insured,
                        property_damage: {
                          ...formData.sums_insured.property_damage,
                          other_label: e.target.value,
                        },
                      },
                    })}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="Other (editable)"
                  />
                </div>
                <input
                  type="number"
                  value={formData.sums_insured.property_damage.other || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    sums_insured: {
                      ...formData.sums_insured,
                      property_damage: {
                        ...formData.sums_insured.property_damage,
                        other: e.target.value ? parseFloat(e.target.value) : null,
                      },
                    },
                  })}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-sm font-bold text-slate-900">Total PD</span>
                <span className="text-sm font-bold text-slate-900">{formatCurrency(calcTotalPD())}</span>
              </div>
            </div>
          </div>

          {/* Business Interruption */}
          <div className="mb-6">
            <h4 className="text-base font-semibold text-slate-800 mb-3 border-b pb-2">Business Interruption</h4>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium text-slate-700">Gross Profit (Annual)</label>
                <input
                  type="number"
                  value={formData.sums_insured.business_interruption.gross_profit_annual || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    sums_insured: {
                      ...formData.sums_insured,
                      business_interruption: {
                        ...formData.sums_insured.business_interruption,
                        gross_profit_annual: e.target.value ? parseFloat(e.target.value) : null,
                      },
                    },
                  })}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium text-slate-700">AICOW</label>
                <input
                  type="number"
                  value={formData.sums_insured.business_interruption.aicow || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    sums_insured: {
                      ...formData.sums_insured,
                      business_interruption: {
                        ...formData.sums_insured.business_interruption,
                        aicow: e.target.value ? parseFloat(e.target.value) : null,
                      },
                    },
                  })}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium text-slate-700">Loss of Rent</label>
                <input
                  type="number"
                  value={formData.sums_insured.business_interruption.loss_of_rent || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    sums_insured: {
                      ...formData.sums_insured,
                      business_interruption: {
                        ...formData.sums_insured.business_interruption,
                        loss_of_rent: e.target.value ? parseFloat(e.target.value) : null,
                      },
                    },
                  })}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.sums_insured.business_interruption.other_label}
                    onChange={(e) => setFormData({
                      ...formData,
                      sums_insured: {
                        ...formData.sums_insured,
                        business_interruption: {
                          ...formData.sums_insured.business_interruption,
                          other_label: e.target.value,
                        },
                      },
                    })}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="Other (editable)"
                  />
                </div>
                <input
                  type="number"
                  value={formData.sums_insured.business_interruption.other || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    sums_insured: {
                      ...formData.sums_insured,
                      business_interruption: {
                        ...formData.sums_insured.business_interruption,
                        other: e.target.value ? parseFloat(e.target.value) : null,
                      },
                    },
                  })}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium text-slate-700">Indemnity Period (months)</label>
                <input
                  type="number"
                  value={formData.sums_insured.business_interruption.indemnity_period_months || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    sums_insured: {
                      ...formData.sums_insured,
                      business_interruption: {
                        ...formData.sums_insured.business_interruption,
                        indemnity_period_months: e.target.value ? parseInt(e.target.value) : null,
                      },
                    },
                  })}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium text-slate-700">Operating days per year</label>
                <input
                  type="number"
                  value={formData.sums_insured.business_interruption.operating_days_per_year || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    sums_insured: {
                      ...formData.sums_insured,
                      business_interruption: {
                        ...formData.sums_insured.business_interruption,
                        operating_days_per_year: e.target.value ? parseInt(e.target.value) : null,
                      },
                    },
                  })}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="365"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-sm font-medium text-slate-700">Monthly BI value</span>
                <span className="text-sm font-medium text-slate-900">{formatCurrency(calcMonthlyBI())}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-sm font-medium text-slate-700">Daily BI value</span>
                <span className="text-sm font-medium text-slate-900">{formatCurrency(calcDailyBI())}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-sm font-bold text-slate-900">Total BI</span>
                <span className="text-sm font-bold text-slate-900">{formatCurrency(calcTotalBI())}</span>
              </div>
            </div>
          </div>

          {/* Total Sums Insured */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="grid grid-cols-2 gap-3">
              <span className="text-base font-bold text-blue-900">Total Sum Insured (PD + BI)</span>
              <span className="text-base font-bold text-blue-900">{formatCurrency(calcTotalSumsInsured())}</span>
            </div>
          </div>

          {/* Additional Comments */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">Additional Comments</label>
            <textarea
              value={formData.sums_insured.additional_comments}
              onChange={(e) => setFormData({
                ...formData,
                sums_insured: {
                  ...formData.sums_insured,
                  additional_comments: e.target.value,
                },
              })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              placeholder="Any additional notes on sums insured, basis of valuation, or assumptions"
            />
          </div>
        </div>

        {/* RE-12.2 WLE */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-1">RE-12.2 — Worst Case Loss Estimate (WLE)</h3>
          <p className="text-sm text-slate-600 mb-6">Maximum reasonably foreseeable loss without crediting fire protection systems</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Scenario Summary (short text)</label>
              <input
                type="text"
                value={formData.wle.scenario_summary}
                onChange={(e) => setFormData({
                  ...formData,
                  wle: { ...formData.wle, scenario_summary: e.target.value },
                })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="e.g., 'Fire in main production hall spreads throughout building'"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Scenario Description (detailed)</label>
              <textarea
                value={formData.wle.scenario_description}
                onChange={(e) => setFormData({
                  ...formData,
                  wle: { ...formData.wle, scenario_description: e.target.value },
                })}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Describe ignition source, fire spread path, extent of damage, key assumptions"
              />
            </div>

            {/* Property Damage Loss Table */}
            <div className="mt-6">
              <h4 className="text-base font-semibold text-slate-800 mb-3 border-b pb-2">Property Damage Loss</h4>
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-slate-600 pb-2 border-b">
                  <span>Category</span>
                  <span>% Loss</span>
                  <span>Sub-total</span>
                  <span>Sum Insured</span>
                </div>

                <div className="grid grid-cols-4 gap-2 items-center">
                  <span className="text-sm text-slate-700">Buildings & Improvements</span>
                  <input
                    type="number"
                    value={formData.wle.property_damage.buildings_improvements_pct || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      wle: {
                        ...formData.wle,
                        property_damage: {
                          ...formData.wle.property_damage,
                          buildings_improvements_pct: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      },
                    })}
                    className="px-2 py-1 border border-slate-300 rounded text-sm"
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                  <span className="text-sm text-slate-900">
                    {formatCurrency(calcWLEPDSubtotal('buildings_improvements', formData.wle.property_damage.buildings_improvements_pct))}
                  </span>
                  <span className="text-sm text-slate-500">
                    {formatCurrency(formData.sums_insured.property_damage.buildings_improvements || 0)}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 items-center">
                  <span className="text-sm text-slate-700">Plant & Machinery + Contents</span>
                  <input
                    type="number"
                    value={formData.wle.property_damage.plant_machinery_contents_pct || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      wle: {
                        ...formData.wle,
                        property_damage: {
                          ...formData.wle.property_damage,
                          plant_machinery_contents_pct: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      },
                    })}
                    className="px-2 py-1 border border-slate-300 rounded text-sm"
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                  <span className="text-sm text-slate-900">
                    {formatCurrency(calcWLEPDSubtotal('plant_machinery_contents', formData.wle.property_damage.plant_machinery_contents_pct))}
                  </span>
                  <span className="text-sm text-slate-500">
                    {formatCurrency(formData.sums_insured.property_damage.plant_machinery_contents || 0)}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 items-center">
                  <span className="text-sm text-slate-700">Stock & WIP</span>
                  <input
                    type="number"
                    value={formData.wle.property_damage.stock_wip_pct || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      wle: {
                        ...formData.wle,
                        property_damage: {
                          ...formData.wle.property_damage,
                          stock_wip_pct: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      },
                    })}
                    className="px-2 py-1 border border-slate-300 rounded text-sm"
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                  <span className="text-sm text-slate-900">
                    {formatCurrency(calcWLEPDSubtotal('stock_wip', formData.wle.property_damage.stock_wip_pct))}
                  </span>
                  <span className="text-sm text-slate-500">
                    {formatCurrency(formData.sums_insured.property_damage.stock_wip || 0)}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 items-center">
                  <span className="text-sm text-slate-700">Computers</span>
                  <input
                    type="number"
                    value={formData.wle.property_damage.computers_pct || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      wle: {
                        ...formData.wle,
                        property_damage: {
                          ...formData.wle.property_damage,
                          computers_pct: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      },
                    })}
                    className="px-2 py-1 border border-slate-300 rounded text-sm"
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                  <span className="text-sm text-slate-900">
                    {formatCurrency(calcWLEPDSubtotal('computers', formData.wle.property_damage.computers_pct))}
                  </span>
                  <span className="text-sm text-slate-500">
                    {formatCurrency(formData.sums_insured.property_damage.computers || 0)}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 items-center">
                  <span className="text-sm text-slate-700">{formData.sums_insured.property_damage.other_label}</span>
                  <input
                    type="number"
                    value={formData.wle.property_damage.other_pct || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      wle: {
                        ...formData.wle,
                        property_damage: {
                          ...formData.wle.property_damage,
                          other_pct: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      },
                    })}
                    className="px-2 py-1 border border-slate-300 rounded text-sm"
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                  <span className="text-sm text-slate-900">
                    {formatCurrency(calcWLEPDSubtotal('other', formData.wle.property_damage.other_pct))}
                  </span>
                  <span className="text-sm text-slate-500">
                    {formatCurrency(formData.sums_insured.property_damage.other || 0)}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 mt-3">
                  <span className="text-sm font-bold text-slate-900">WLE PD Total</span>
                  <span></span>
                  <span className="text-sm font-bold text-slate-900">{formatCurrency(calcWLEPDTotal())}</span>
                  <span className="text-sm font-medium text-slate-700">{formatPct(calcWLEPDPctOfTotal())} of Total PD</span>
                </div>
              </div>
            </div>

            {/* Business Interruption Loss */}
            <div className="mt-6">
              <h4 className="text-base font-semibold text-slate-800 mb-3 border-b pb-2">Business Interruption Loss</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium text-slate-700">Outage duration (months)</label>
                  <input
                    type="number"
                    value={formData.wle.business_interruption.outage_duration_months || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      wle: {
                        ...formData.wle,
                        business_interruption: {
                          ...formData.wle.business_interruption,
                          outage_duration_months: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      },
                    })}
                    className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="0"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium text-slate-700">% of Gross Profit</label>
                  <input
                    type="number"
                    value={formData.wle.business_interruption.gross_profit_pct || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      wle: {
                        ...formData.wle,
                        business_interruption: {
                          ...formData.wle.business_interruption,
                          gross_profit_pct: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      },
                    })}
                    className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-sm font-medium text-slate-700">BI loss</span>
                  <span className="text-sm font-medium text-slate-900">{formatCurrency(calcWLEBITotal())}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-sm font-bold text-slate-900">WLE BI Total</span>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900">{formatCurrency(calcWLEBITotal())}</div>
                    <div className="text-xs text-slate-600">{formatPct(calcWLEBIPctOfTotal())} of Total BI</div>
                  </div>
                </div>
              </div>
            </div>

            {/* WLE Total */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mt-6">
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <span className="text-base font-bold text-blue-900">WLE PD + BI Total</span>
                  <span className="text-base font-bold text-blue-900">{formatCurrency(calcWLETotal())}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <span className="text-sm text-blue-700">% of Total PD + BI</span>
                  <span className="text-sm font-semibold text-blue-700">{formatPct(calcWLETotalPctOfTotal())}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RE-12.3 NLE */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-1">RE-12.3 — NLE – Existing Conditions</h3>
          <p className="text-sm text-slate-600 mb-6">Expected loss with fire protection credited (if credible)</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Scenario Summary (short text)</label>
              <input
                type="text"
                value={formData.nle.scenario_summary}
                onChange={(e) => setFormData({
                  ...formData,
                  nle: { ...formData.nle, scenario_summary: e.target.value },
                })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="e.g., 'Small fire detected and controlled by sprinklers'"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Scenario Description (detailed)</label>
              <textarea
                value={formData.nle.scenario_description}
                onChange={(e) => setFormData({
                  ...formData,
                  nle: { ...formData.nle, scenario_description: e.target.value },
                })}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Describe expected scenario with fire protection operating: detection, suppression, compartmentation, expected fire size and impact"
              />
            </div>

            {/* Property Damage Loss Table */}
            <div className="mt-6">
              <h4 className="text-base font-semibold text-slate-800 mb-3 border-b pb-2">Property Damage Loss</h4>
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-slate-600 pb-2 border-b">
                  <span>Category</span>
                  <span>% Loss</span>
                  <span>Sub-total</span>
                  <span>Sum Insured</span>
                </div>

                <div className="grid grid-cols-4 gap-2 items-center">
                  <span className="text-sm text-slate-700">Buildings & Improvements</span>
                  <input
                    type="number"
                    value={formData.nle.property_damage.buildings_improvements_pct || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      nle: {
                        ...formData.nle,
                        property_damage: {
                          ...formData.nle.property_damage,
                          buildings_improvements_pct: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      },
                    })}
                    className="px-2 py-1 border border-slate-300 rounded text-sm"
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                  <span className="text-sm text-slate-900">
                    {formatCurrency(calcNLEPDSubtotal('buildings_improvements', formData.nle.property_damage.buildings_improvements_pct))}
                  </span>
                  <span className="text-sm text-slate-500">
                    {formatCurrency(formData.sums_insured.property_damage.buildings_improvements || 0)}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 items-center">
                  <span className="text-sm text-slate-700">Plant & Machinery + Contents</span>
                  <input
                    type="number"
                    value={formData.nle.property_damage.plant_machinery_contents_pct || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      nle: {
                        ...formData.nle,
                        property_damage: {
                          ...formData.nle.property_damage,
                          plant_machinery_contents_pct: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      },
                    })}
                    className="px-2 py-1 border border-slate-300 rounded text-sm"
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                  <span className="text-sm text-slate-900">
                    {formatCurrency(calcNLEPDSubtotal('plant_machinery_contents', formData.nle.property_damage.plant_machinery_contents_pct))}
                  </span>
                  <span className="text-sm text-slate-500">
                    {formatCurrency(formData.sums_insured.property_damage.plant_machinery_contents || 0)}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 items-center">
                  <span className="text-sm text-slate-700">Stock & WIP</span>
                  <input
                    type="number"
                    value={formData.nle.property_damage.stock_wip_pct || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      nle: {
                        ...formData.nle,
                        property_damage: {
                          ...formData.nle.property_damage,
                          stock_wip_pct: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      },
                    })}
                    className="px-2 py-1 border border-slate-300 rounded text-sm"
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                  <span className="text-sm text-slate-900">
                    {formatCurrency(calcNLEPDSubtotal('stock_wip', formData.nle.property_damage.stock_wip_pct))}
                  </span>
                  <span className="text-sm text-slate-500">
                    {formatCurrency(formData.sums_insured.property_damage.stock_wip || 0)}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 items-center">
                  <span className="text-sm text-slate-700">Computers</span>
                  <input
                    type="number"
                    value={formData.nle.property_damage.computers_pct || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      nle: {
                        ...formData.nle,
                        property_damage: {
                          ...formData.nle.property_damage,
                          computers_pct: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      },
                    })}
                    className="px-2 py-1 border border-slate-300 rounded text-sm"
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                  <span className="text-sm text-slate-900">
                    {formatCurrency(calcNLEPDSubtotal('computers', formData.nle.property_damage.computers_pct))}
                  </span>
                  <span className="text-sm text-slate-500">
                    {formatCurrency(formData.sums_insured.property_damage.computers || 0)}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 items-center">
                  <span className="text-sm text-slate-700">{formData.sums_insured.property_damage.other_label}</span>
                  <input
                    type="number"
                    value={formData.nle.property_damage.other_pct || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      nle: {
                        ...formData.nle,
                        property_damage: {
                          ...formData.nle.property_damage,
                          other_pct: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      },
                    })}
                    className="px-2 py-1 border border-slate-300 rounded text-sm"
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                  <span className="text-sm text-slate-900">
                    {formatCurrency(calcNLEPDSubtotal('other', formData.nle.property_damage.other_pct))}
                  </span>
                  <span className="text-sm text-slate-500">
                    {formatCurrency(formData.sums_insured.property_damage.other || 0)}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 mt-3">
                  <span className="text-sm font-bold text-slate-900">NLE PD Total</span>
                  <span></span>
                  <span className="text-sm font-bold text-slate-900">{formatCurrency(calcNLEPDTotal())}</span>
                  <span className="text-sm font-medium text-slate-700">{formatPct(calcNLEPDPctOfTotal())} of Total PD</span>
                </div>
              </div>
            </div>

            {/* Business Interruption Loss */}
            <div className="mt-6">
              <h4 className="text-base font-semibold text-slate-800 mb-3 border-b pb-2">Business Interruption Loss</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium text-slate-700">Outage duration (months)</label>
                  <input
                    type="number"
                    value={formData.nle.business_interruption.outage_duration_months || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      nle: {
                        ...formData.nle,
                        business_interruption: {
                          ...formData.nle.business_interruption,
                          outage_duration_months: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      },
                    })}
                    className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="0"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium text-slate-700">% of Gross Profit</label>
                  <input
                    type="number"
                    value={formData.nle.business_interruption.gross_profit_pct || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      nle: {
                        ...formData.nle,
                        business_interruption: {
                          ...formData.nle.business_interruption,
                          gross_profit_pct: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      },
                    })}
                    className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-sm font-medium text-slate-700">BI loss</span>
                  <span className="text-sm font-medium text-slate-900">{formatCurrency(calcNLEBITotal())}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-sm font-bold text-slate-900">NLE BI Total</span>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900">{formatCurrency(calcNLEBITotal())}</div>
                    <div className="text-xs text-slate-600">{formatPct(calcNLEBIPctOfTotal())} of Total BI</div>
                  </div>
                </div>
              </div>
            </div>

            {/* NLE Total */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200 mt-6">
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <span className="text-base font-bold text-green-900">NLE PD + BI Total</span>
                  <span className="text-base font-bold text-green-900">{formatCurrency(calcNLETotal())}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <span className="text-sm text-green-700">% of Total PD + BI</span>
                  <span className="text-sm font-semibold text-green-700">{formatPct(calcNLETotalPctOfTotal())}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Comparison */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Loss Expectancy Summary</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4 text-sm font-semibold text-slate-600 pb-2 border-b">
              <span></span>
              <span>Value</span>
              <span>% of Sums Insured</span>
            </div>

            <div className="grid grid-cols-3 gap-4 py-2">
              <span className="text-slate-700">Worst-Case Loss Expectancy (WLE)</span>
              <span className="font-bold text-slate-900">{formatCurrency(calcWLETotal())}</span>
              <span className="font-semibold text-slate-700">{formatPct(calcWLETotalPctOfTotal())}</span>
            </div>

            <div className="grid grid-cols-3 gap-4 py-2">
              <span className="text-slate-700">Normal Loss Expectancy (NLE)</span>
              <span className="font-bold text-slate-900">{formatCurrency(calcNLETotal())}</span>
              <span className="font-semibold text-slate-700">{formatPct(calcNLETotalPctOfTotal())}</span>
            </div>

            {calcWLETotal() > 0 && (
              <div className="grid grid-cols-3 gap-4 py-2 bg-blue-50 px-4 rounded-lg">
                <span className="text-blue-900 font-medium">NLE as % of WLE</span>
                <span className="font-bold text-blue-900">
                  {formatPct((calcNLETotal() / calcWLETotal()) * 100)}
                </span>
                <span></span>
              </div>
            )}
          </div>
        </div>
      </div>

      {document?.id && moduleInstance?.id && (
        <ModuleActions documentId={document.id} moduleInstanceId={moduleInstance.id} />
      )}
    </div>

    <FloatingSaveBar onSave={handleSave} isSaving={isSaving} />
    </>
  );
}
