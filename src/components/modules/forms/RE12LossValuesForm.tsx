import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import ModuleActions from '../ModuleActions';
import FloatingSaveBar from './FloatingSaveBar';
import { AlertCircle } from 'lucide-react';

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

export default function RE12LossValuesForm({
  moduleInstance,
  document,
  onSaved,
}: RE12LossValuesFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [fireProtectionCredible, setFireProtectionCredible] = useState(false);
  const [fireProtectionBasis, setFireProtectionBasis] = useState('');

  const d = moduleInstance.data || {};

  const safePropertyBreakdown = Array.isArray(d.loss_values?.property_sums_insured?.breakdown)
    ? d.loss_values.property_sums_insured.breakdown
    : [];

  const safeDependencies = Array.isArray(d.loss_values?.business_interruption?.dependencies)
    ? d.loss_values.business_interruption.dependencies
    : [];

  const safeWLECalc = Array.isArray(d.loss_values?.wle?.calc_table)
    ? d.loss_values.wle.calc_table
    : [];

  const safeNLECalc = Array.isArray(d.loss_values?.nle?.calc_table)
    ? d.loss_values.nle.calc_table
    : [];

  const [formData, setFormData] = useState({
    loss_values: {
      currency: d.loss_values?.currency || 'GBP',
      property_sums_insured: {
        breakdown: safePropertyBreakdown,
        total: d.loss_values?.property_sums_insured?.total || null,
      },
      business_interruption: {
        gross_profit: d.loss_values?.business_interruption?.gross_profit || null,
        indemnity_period_months: d.loss_values?.business_interruption?.indemnity_period_months || null,
        dependencies: safeDependencies,
      },
      wle: {
        scenario_description: d.loss_values?.wle?.scenario_description || '',
        calc_table: safeWLECalc,
        property_loss: d.loss_values?.wle?.property_loss || null,
        bi_loss: d.loss_values?.wle?.bi_loss || null,
        total_wle: d.loss_values?.wle?.total_wle || null,
      },
      nle: {
        scenario_description: d.loss_values?.nle?.scenario_description || '',
        calc_table: safeNLECalc,
        property_loss: d.loss_values?.nle?.property_loss || null,
        bi_loss: d.loss_values?.nle?.bi_loss || null,
        total_nle: d.loss_values?.nle?.total_nle || null,
        fire_protection_credited: d.loss_values?.nle?.fire_protection_credited || false,
      },
    },
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  useEffect(() => {
    let isMounted = true;

    async function loadFireProtectionData() {
      try {
        const { data: fireProtectionInstance, error } = await supabase
          .from('module_instances')
          .select('data')
          .eq('document_id', moduleInstance.document_id)
          .eq('module_key', 'RE06_FIRE_PROTECTION')
          .maybeSingle(); // ✅ prevents 406 when 0 rows

        if (error) throw error;

        // Default when module instance not created yet
        if (!fireProtectionInstance?.data) {
          if (!isMounted) return;
          setFireProtectionCredible(false);
          setFireProtectionBasis('');
          return;
        }

        // Expected shape per handover:
        // fire_protection.credible_to_reduce_nle = { value: boolean, basis: string }
        // Back-compat accepted:
        // fire_protection.credible_to_reduce_nle = { credible: boolean, basis: string }
        const credibleBlock = fireProtectionInstance.data?.fire_protection?.credible_to_reduce_nle;

        if (!isMounted) return;

        if (credibleBlock && typeof credibleBlock === 'object') {
          const credible =
            typeof credibleBlock.value === 'boolean'
              ? credibleBlock.value
              : typeof credibleBlock.credible === 'boolean'
              ? credibleBlock.credible
              : false;

          const basis = typeof credibleBlock.basis === 'string' ? credibleBlock.basis : '';

          setFireProtectionCredible(credible);
          setFireProtectionBasis(basis);
        } else {
          setFireProtectionCredible(false);
          setFireProtectionBasis('');
        }
      } catch (err) {
        console.error('Error loading fire protection data:', err);
        // Don’t crash the form if Fire Protection can’t load
        if (!isMounted) return;
        setFireProtectionCredible(false);
        setFireProtectionBasis('');
      }
    }

    loadFireProtectionData();

    return () => {
      isMounted = false;
    };
  }, [moduleInstance.document_id]);

  useEffect(() => {
    const wleTotal =
      (formData.loss_values.wle.property_loss || 0) + (formData.loss_values.wle.bi_loss || 0);
    const nleTotal =
      (formData.loss_values.nle.property_loss || 0) + (formData.loss_values.nle.bi_loss || 0);

    setFormData((prev) => ({
      ...prev,
      loss_values: {
        ...prev.loss_values,
        wle: { ...prev.loss_values.wle, total_wle: wleTotal },
        nle: { ...prev.loss_values.nle, total_nle: nleTotal },
      },
    }));
  }, [
    formData.loss_values.wle.property_loss,
    formData.loss_values.wle.bi_loss,
    formData.loss_values.nle.property_loss,
    formData.loss_values.nle.bi_loss,
  ]);

  const handleSave = async () => {
    if (formData.loss_values.nle.fire_protection_credited && !fireProtectionCredible) {
      alert(
        'Fire protection cannot be credited in NLE: Fire Protection module indicates it is not credible to reduce NLE.'
      );
      return;
    }

    setIsSaving(true);
    try {
      const completedAt = outcome ? new Date().toISOString() : null;
      const sanitized = sanitizeModuleInstancePayload({ data: formData });

      const { error } = await supabase
        .from('module_instances')
        .update({
          data: sanitized.data,
          outcome: outcome || null,
          assessor_notes: assessorNotes,
          completed_at: completedAt,
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

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', AUD: 'A$', CAD: 'C$' };
    const symbol = symbols[formData.loss_values.currency] || '';
    return `${symbol}${value.toLocaleString()}`;
  };

  return (
    <>
    <div className="p-6 max-w-5xl mx-auto pb-24">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-12 - Loss & Values</h2>
        <p className="text-slate-600">Loss expectancy calculations and valuation data</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Currency</h3>
          <div className="max-w-xs">
            <select
              value={formData.loss_values.currency}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  loss_values: { ...formData.loss_values, currency: e.target.value },
                })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="GBP">GBP (£)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="AUD">AUD (A$)</option>
              <option value="CAD">CAD (C$)</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Property Sums Insured</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Building & Contents
              </label>
              <input
                type="number"
                value={formData.loss_values.property_sums_insured.total || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    loss_values: {
                      ...formData.loss_values,
                      property_sums_insured: {
                        ...formData.loss_values.property_sums_insured,
                        total: e.target.value ? parseFloat(e.target.value) : null,
                      },
                    },
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Total property value"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Business Interruption</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Gross Profit (Annual)
              </label>
              <input
                type="number"
                value={formData.loss_values.business_interruption.gross_profit || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    loss_values: {
                      ...formData.loss_values,
                      business_interruption: {
                        ...formData.loss_values.business_interruption,
                        gross_profit: e.target.value ? parseFloat(e.target.value) : null,
                      },
                    },
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Indemnity Period (Months)
              </label>
              <input
                type="number"
                value={formData.loss_values.business_interruption.indemnity_period_months || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    loss_values: {
                      ...formData.loss_values,
                      business_interruption: {
                        ...formData.loss_values.business_interruption,
                        indemnity_period_months: e.target.value ? parseInt(e.target.value) : null,
                      },
                    },
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Worst-Case Loss Expectancy (WLE)
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Maximum reasonably foreseeable loss scenario without crediting fire protection systems.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Scenario Description
              </label>
              <textarea
                value={formData.loss_values.wle.scenario_description}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    loss_values: {
                      ...formData.loss_values,
                      wle: { ...formData.loss_values.wle, scenario_description: e.target.value },
                    },
                  })
                }
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Describe the worst-case loss scenario: ignition source, fire spread, extent of damage, assumptions"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Property Loss
                </label>
                <input
                  type="number"
                  value={formData.loss_values.wle.property_loss || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      loss_values: {
                        ...formData.loss_values,
                        wle: {
                          ...formData.loss_values.wle,
                          property_loss: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="Property damage value"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">BI Loss</label>
                <input
                  type="number"
                  value={formData.loss_values.wle.bi_loss || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      loss_values: {
                        ...formData.loss_values,
                        wle: {
                          ...formData.loss_values.wle,
                          bi_loss: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="Business interruption loss"
                />
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-900">Total WLE:</span>
                <span className="text-xl font-bold text-slate-900">
                  {formatCurrency(formData.loss_values.wle.total_wle)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Normal Loss Expectancy (NLE)
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Expected loss scenario with fire protection credited (if credible per Fire Protection module).
          </p>

          {!fireProtectionCredible && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  Fire Protection Not Credible for NLE Reduction
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Fire Protection indicates fire protection is not credible to materially reduce NLE.
                  {fireProtectionBasis && ` Basis: ${fireProtectionBasis}`}
                </p>
              </div>
            </div>
          )}

          {fireProtectionCredible && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Fire Protection Credible for NLE Reduction
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  Fire Protection indicates fire protection is credible to materially reduce NLE.
                  {fireProtectionBasis && ` Basis: ${fireProtectionBasis}`}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="flex items-center text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.loss_values.nle.fire_protection_credited}
                  onChange={(e) => {
                    if (e.target.checked && !fireProtectionCredible) {
                      alert(
                        'Cannot credit fire protection: Fire Protection indicates it is not credible to reduce NLE.'
                      );
                      return;
                    }
                    setFormData({
                      ...formData,
                      loss_values: {
                        ...formData.loss_values,
                        nle: {
                          ...formData.loss_values.nle,
                          fire_protection_credited: e.target.checked,
                        },
                      },
                    });
                  }}
                  disabled={!fireProtectionCredible}
                  className="mr-2"
                />
                Fire Protection Credited in NLE
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Scenario Description
              </label>
              <textarea
                value={formData.loss_values.nle.scenario_description}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    loss_values: {
                      ...formData.loss_values,
                      nle: { ...formData.loss_values.nle, scenario_description: e.target.value },
                    },
                  })
                }
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Describe the normal/expected loss scenario with fire protection credited (if applicable): detection, suppression, compartmentation, expected fire size"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Property Loss
                </label>
                <input
                  type="number"
                  value={formData.loss_values.nle.property_loss || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      loss_values: {
                        ...formData.loss_values,
                        nle: {
                          ...formData.loss_values.nle,
                          property_loss: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="Property damage value"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">BI Loss</label>
                <input
                  type="number"
                  value={formData.loss_values.nle.bi_loss || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      loss_values: {
                        ...formData.loss_values,
                        nle: {
                          ...formData.loss_values.nle,
                          bi_loss: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="Business interruption loss"
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-900">Total NLE:</span>
                <span className="text-xl font-bold text-slate-900">
                  {formatCurrency(formData.loss_values.nle.total_nle)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Loss Expectancy Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-200">
              <span className="text-slate-700">Worst-Case Loss Expectancy (WLE):</span>
              <span className="font-bold text-lg text-slate-900">
                {formatCurrency(formData.loss_values.wle.total_wle)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-700">Normal Loss Expectancy (NLE):</span>
              <span className="font-bold text-lg text-slate-900">
                {formatCurrency(formData.loss_values.nle.total_nle)}
              </span>
            </div>
            {formData.loss_values.wle.total_wle &&
              formData.loss_values.nle.total_nle &&
              formData.loss_values.wle.total_wle > 0 && (
                <div className="flex justify-between items-center py-2 bg-blue-50 px-4 rounded-lg">
                  <span className="text-blue-900 font-medium">NLE as % of WLE:</span>
                  <span className="font-bold text-lg text-blue-900">
                    {Math.round(
                      (formData.loss_values.nle.total_nle / formData.loss_values.wle.total_wle) * 100
                    )}
                    %
                  </span>
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
