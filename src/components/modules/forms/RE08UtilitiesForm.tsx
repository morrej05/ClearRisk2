import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import ModuleActions from '../ModuleActions';
import FloatingSaveBar from './FloatingSaveBar';
import ReRatingPanel from '../../re/ReRatingPanel';
import { getHrgConfig } from '../../../lib/re/reference/hrgMasterMap';
import { getRating, setRating } from '../../../lib/re/scoring/riskEngineeringHelpers';
import { ensureAutoRecommendation } from '../../../lib/re/recommendations/autoRecommendations';
import { Plus, X, Trash2 } from 'lucide-react';
import {
  isHeavyOccupancy,
  getSuggestedEquipment,
  getEquipmentOptions,
  STANDARD_EQUIPMENT_OPTIONS,
} from '../../../lib/re/reference/occupancyCriticalEquipment';

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

interface RE08UtilitiesFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface CriticalService {
  id: string;
  service_type: string;
  custom_label?: string;
  present: boolean | null;
  criticality: 'low' | 'medium' | 'high' | null;
  notes: string;
  backup_available: boolean | null;
}

interface CriticalEquipment {
  id: string;
  equipment_type: string;
  custom_label?: string;
  tag_or_name: string;
  criticality: 'low' | 'medium' | 'high' | null;
  redundancy: 'N+0' | 'N+1' | 'N+2' | 'unknown' | null;
  spares_strategy: 'none' | 'on-site' | 'vendor' | 'unknown' | null;
  condition_notes: string;
  maintenance_adequacy_rating: number | null;
  notes: string;
  oem?: string;
  configuration?: 'single' | 'multiple' | 'unknown';
  major_overhaul_interval?: string;
  known_issues?: string;
}

const ELECTRICAL_KEY = 'electrical_and_utilities_reliability';
const EQUIPMENT_KEY = 'critical_equipment_reliability';

const SERVICE_TYPE_OPTIONS = [
  'Fuel gas',
  'Refrigeration',
  'Compressed air / steam',
  'Cooling systems',
  'Ventilation / extraction',
  'Nitrogen / inerting',
  'IT – Business systems / ERP / network',
  'OT – SCADA / PLC / process control',
  'Telecoms / connectivity',
  'Custom…',
];

export default function RE08UtilitiesForm({
  moduleInstance,
  document,
  onSaved,
}: RE08UtilitiesFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const d = moduleInstance.data || {};

  const safeCriticalServices: CriticalService[] = Array.isArray(d.critical_services)
    ? d.critical_services.map((s: any) => ({
        id: s.id ?? crypto.randomUUID(),
        service_type: s.service_type ?? '',
        custom_label: s.custom_label,
        present: s.present ?? null,
        criticality: s.criticality ?? null,
        notes: s.notes ?? '',
        backup_available: s.backup_available ?? null,
      }))
    : [];

  const safeCriticalEquipment: CriticalEquipment[] = Array.isArray(d.critical_equipment)
    ? d.critical_equipment.map((e: any) => ({
        id: e.id ?? crypto.randomUUID(),
        equipment_type: e.equipment_type ?? '',
        custom_label: e.custom_label,
        tag_or_name: e.tag_or_name ?? '',
        criticality: e.criticality ?? null,
        redundancy: e.redundancy ?? null,
        spares_strategy: e.spares_strategy ?? null,
        condition_notes: e.condition_notes ?? '',
        maintenance_adequacy_rating: e.maintenance_adequacy_rating ?? null,
        notes: e.notes ?? '',
        oem: e.oem,
        configuration: e.configuration,
        major_overhaul_interval: e.major_overhaul_interval,
        known_issues: e.known_issues,
      }))
    : [];

  const [formData, setFormData] = useState({
    power_resilience: d.power_resilience || {
      notes: '',
      backup_power_present: null,
      generator_capacity_notes: '',
    },
    shutdown_strategy: d.shutdown_strategy || { notes: '' },
    critical_services: safeCriticalServices,
    critical_equipment: safeCriticalEquipment,
  });

  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [showEquipmentPicker, setShowEquipmentPicker] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState('');
  const [customServiceLabel, setCustomServiceLabel] = useState('');
  const [selectedEquipmentType, setSelectedEquipmentType] = useState('');
  const [customEquipmentLabel, setCustomEquipmentLabel] = useState('');

  const [riskEngData, setRiskEngData] = useState<any>({});
  const [riskEngInstanceId, setRiskEngInstanceId] = useState<string | null>(null);
  const [industryKey, setIndustryKey] = useState<string | null>(null);

  useEffect(() => {
    async function loadRiskEngModule() {
      try {
        const { data: instance, error } = await supabase
          .from('module_instances')
          .select('id, data')
          .eq('document_id', moduleInstance.document_id)
          .eq('module_key', 'RISK_ENGINEERING')
          .single();

        if (error) throw error;

        if (instance) {
          setRiskEngInstanceId(instance.id);
          setRiskEngData(instance.data || {});
          setIndustryKey(instance.data?.industry_key || null);
        }
      } catch (err) {
        console.error('Error loading RISK_ENGINEERING module:', err);
      }
    }

    loadRiskEngModule();
  }, [moduleInstance.document_id]);

  const electricalRating = getRating(riskEngData, ELECTRICAL_KEY);
  const equipmentRating = getRating(riskEngData, EQUIPMENT_KEY);
  const electricalHrgConfig = getHrgConfig(industryKey, ELECTRICAL_KEY);
  const equipmentHrgConfig = getHrgConfig(industryKey, EQUIPMENT_KEY);

  const isHeavy = isHeavyOccupancy(industryKey);
  const suggestedEquipment = getSuggestedEquipment(industryKey);
  const equipmentOptions = getEquipmentOptions(industryKey);

  const handleRatingChange = async (canonicalKey: string, newRating: number) => {
    if (!riskEngInstanceId) return;

    try {
      const updatedRiskEngData = setRating(riskEngData, canonicalKey, newRating);

      const { error } = await supabase
        .from('module_instances')
        .update({ data: updatedRiskEngData })
        .eq('id', riskEngInstanceId);

      if (error) throw error;

      setRiskEngData(updatedRiskEngData);

      const updatedFormData = ensureAutoRecommendation(formData, canonicalKey, newRating, industryKey);
      if (updatedFormData !== formData) {
        setFormData(updatedFormData);
        const sanitized = sanitizeModuleInstancePayload({ data: updatedFormData });
        await supabase
          .from('module_instances')
          .update({ data: sanitized.data })
          .eq('id', moduleInstance.id);
      }
    } catch (err) {
      console.error('Error updating rating:', err);
      alert('Failed to update rating');
    }
  };

  const addCriticalService = () => {
    if (!selectedServiceType) return;

    const isCustom = selectedServiceType === 'Custom…';
    const newService: CriticalService = {
      id: crypto.randomUUID(),
      service_type: isCustom ? 'custom' : selectedServiceType,
      custom_label: isCustom ? customServiceLabel : undefined,
      present: null,
      criticality: null,
      notes: '',
      backup_available: null,
    };

    setFormData({
      ...formData,
      critical_services: [...formData.critical_services, newService],
    });

    setShowServicePicker(false);
    setSelectedServiceType('');
    setCustomServiceLabel('');
  };

  const removeCriticalService = (id: string) => {
    setFormData({
      ...formData,
      critical_services: formData.critical_services.filter((s) => s.id !== id),
    });
  };

  const updateCriticalService = (id: string, updates: Partial<CriticalService>) => {
    setFormData({
      ...formData,
      critical_services: formData.critical_services.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    });
  };

  const addCriticalEquipment = () => {
    if (!selectedEquipmentType) return;

    const isCustom = selectedEquipmentType === 'Custom…';
    const newEquipment: CriticalEquipment = {
      id: crypto.randomUUID(),
      equipment_type: isCustom ? 'custom' : selectedEquipmentType,
      custom_label: isCustom ? customEquipmentLabel : undefined,
      tag_or_name: '',
      criticality: isHeavy ? 'high' : null,
      redundancy: null,
      spares_strategy: null,
      condition_notes: '',
      maintenance_adequacy_rating: null,
      notes: '',
    };

    setFormData({
      ...formData,
      critical_equipment: [...formData.critical_equipment, newEquipment],
    });

    setShowEquipmentPicker(false);
    setSelectedEquipmentType('');
    setCustomEquipmentLabel('');
  };

  const removeCriticalEquipment = (id: string) => {
    setFormData({
      ...formData,
      critical_equipment: formData.critical_equipment.filter((e) => e.id !== id),
    });
  };

  const updateCriticalEquipment = (id: string, updates: Partial<CriticalEquipment>) => {
    setFormData({
      ...formData,
      critical_equipment: formData.critical_equipment.map((e) =>
        e.id === id ? { ...e, ...updates } : e
      ),
    });
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

  const getServiceLabel = (service: CriticalService) => {
    if (service.service_type === 'custom' && service.custom_label) {
      return service.custom_label;
    }
    return service.service_type;
  };

  const getEquipmentLabel = (equipment: CriticalEquipment) => {
    if (equipment.equipment_type === 'custom' && equipment.custom_label) {
      return equipment.custom_label;
    }
    return equipment.equipment_type;
  };

  const isTurbineOrGenerator = (equipmentType: string) => {
    return equipmentType.toLowerCase() === 'turbine' || equipmentType.toLowerCase() === 'generator';
  };

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto pb-24">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-6 - Utilities & Critical Services</h2>
          <p className="text-slate-600">Assessment of power, utilities, critical services, and equipment dependencies</p>
        </div>

        <div className="mb-6">
          <ReRatingPanel
            canonicalKey={ELECTRICAL_KEY}
            industryKey={industryKey}
            rating={electricalRating}
            onChangeRating={(r) => handleRatingChange(ELECTRICAL_KEY, r)}
            helpText={electricalHrgConfig.helpText}
            weight={electricalHrgConfig.weight}
          />
        </div>

        <div className="mb-6">
          <ReRatingPanel
            canonicalKey={EQUIPMENT_KEY}
            industryKey={industryKey}
            rating={equipmentRating}
            onChangeRating={(r) => handleRatingChange(EQUIPMENT_KEY, r)}
            helpText={equipmentHrgConfig.helpText}
            weight={equipmentHrgConfig.weight}
          />
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Power Resilience</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Backup Power Present</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={formData.power_resilience.backup_power_present === true}
                      onChange={() =>
                        setFormData({
                          ...formData,
                          power_resilience: { ...formData.power_resilience, backup_power_present: true },
                        })
                      }
                      className="mr-2"
                    />
                    Yes
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={formData.power_resilience.backup_power_present === false}
                      onChange={() =>
                        setFormData({
                          ...formData,
                          power_resilience: { ...formData.power_resilience, backup_power_present: false },
                        })
                      }
                      className="mr-2"
                    />
                    No
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Power Resilience Notes</label>
                <textarea
                  value={formData.power_resilience.notes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      power_resilience: { ...formData.power_resilience, notes: e.target.value },
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="Describe power supply arrangements, redundancy, and backup systems"
                />
              </div>
              {formData.power_resilience.backup_power_present && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Generator Capacity Notes</label>
                  <textarea
                    value={formData.power_resilience.generator_capacity_notes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        power_resilience: { ...formData.power_resilience, generator_capacity_notes: e.target.value },
                      })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    placeholder="Generator capacity, fuel supply, and load coverage"
                  />
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Critical Services</h3>
              <button
                onClick={() => setShowServicePicker(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
              >
                <Plus className="w-4 h-4" />
                Add Critical Service
              </button>
            </div>

            {showServicePicker && (
              <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Service Type</label>
                <select
                  value={selectedServiceType}
                  onChange={(e) => setSelectedServiceType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm mb-2"
                >
                  <option value="">Choose service type...</option>
                  {SERVICE_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {selectedServiceType === 'Custom…' && (
                  <input
                    type="text"
                    value={customServiceLabel}
                    onChange={(e) => setCustomServiceLabel(e.target.value)}
                    placeholder="Enter custom service name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm mb-2"
                  />
                )}
                <div className="flex gap-2">
                  <button
                    onClick={addCriticalService}
                    disabled={!selectedServiceType || (selectedServiceType === 'Custom…' && !customServiceLabel)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Service
                  </button>
                  <button
                    onClick={() => {
                      setShowServicePicker(false);
                      setSelectedServiceType('');
                      setCustomServiceLabel('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {formData.critical_services.map((service) => (
                <div key={service.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-slate-900">{getServiceLabel(service)}</h4>
                    <button
                      onClick={() => removeCriticalService(service.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Present</label>
                      <div className="flex gap-4">
                        {['yes', 'no', 'unknown'].map((option) => (
                          <label key={option} className="flex items-center">
                            <input
                              type="radio"
                              checked={
                                (option === 'yes' && service.present === true) ||
                                (option === 'no' && service.present === false) ||
                                (option === 'unknown' && service.present === null)
                              }
                              onChange={() =>
                                updateCriticalService(service.id, {
                                  present: option === 'yes' ? true : option === 'no' ? false : null,
                                })
                              }
                              className="mr-2"
                            />
                            <span className="capitalize text-sm">{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Criticality</label>
                      <div className="flex gap-4">
                        {['low', 'medium', 'high'].map((level) => (
                          <label key={level} className="flex items-center">
                            <input
                              type="radio"
                              checked={service.criticality === level}
                              onChange={() => updateCriticalService(service.id, { criticality: level as any })}
                              className="mr-2"
                            />
                            <span className="capitalize text-sm">{level}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {service.criticality === 'high' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Backup Available</label>
                        <div className="flex gap-4">
                          {['yes', 'no', 'unknown'].map((option) => (
                            <label key={option} className="flex items-center">
                              <input
                                type="radio"
                                checked={
                                  (option === 'yes' && service.backup_available === true) ||
                                  (option === 'no' && service.backup_available === false) ||
                                  (option === 'unknown' && service.backup_available === null)
                                }
                                onChange={() =>
                                  updateCriticalService(service.id, {
                                    backup_available: option === 'yes' ? true : option === 'no' ? false : null,
                                  })
                                }
                                className="mr-2"
                              />
                              <span className="capitalize text-sm">{option}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                      <textarea
                        value={service.notes}
                        onChange={(e) => updateCriticalService(service.id, { notes: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Critical Equipment Register</h3>
              <button
                onClick={() => setShowEquipmentPicker(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
              >
                <Plus className="w-4 h-4" />
                Add Equipment
              </button>
            </div>

            {showEquipmentPicker && (
              <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Equipment Type</label>
                {isHeavy && suggestedEquipment.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-slate-600 mb-2">Suggested for this occupancy:</p>
                    <select
                      value={selectedEquipmentType}
                      onChange={(e) => setSelectedEquipmentType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm mb-2"
                    >
                      <option value="">Choose equipment...</option>
                      {equipmentOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {(!isHeavy || suggestedEquipment.length === 0) && (
                  <select
                    value={selectedEquipmentType}
                    onChange={(e) => setSelectedEquipmentType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm mb-2"
                  >
                    <option value="">Choose equipment type...</option>
                    {STANDARD_EQUIPMENT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}
                {selectedEquipmentType === 'Custom…' && (
                  <input
                    type="text"
                    value={customEquipmentLabel}
                    onChange={(e) => setCustomEquipmentLabel(e.target.value)}
                    placeholder="Enter custom equipment name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm mb-2"
                  />
                )}
                <div className="flex gap-2">
                  <button
                    onClick={addCriticalEquipment}
                    disabled={!selectedEquipmentType || (selectedEquipmentType === 'Custom…' && !customEquipmentLabel)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Equipment
                  </button>
                  <button
                    onClick={() => {
                      setShowEquipmentPicker(false);
                      setSelectedEquipmentType('');
                      setCustomEquipmentLabel('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {formData.critical_equipment.map((equipment) => (
                <div key={equipment.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-slate-900">{getEquipmentLabel(equipment)}</h4>
                    <button
                      onClick={() => removeCriticalEquipment(equipment.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tag / Name</label>
                      <input
                        type="text"
                        value={equipment.tag_or_name}
                        onChange={(e) => updateCriticalEquipment(equipment.id, { tag_or_name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="Equipment tag or identifier"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Criticality</label>
                      <select
                        value={equipment.criticality || ''}
                        onChange={(e) =>
                          updateCriticalEquipment(equipment.id, { criticality: e.target.value as any || null })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      >
                        <option value="">Select...</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Redundancy</label>
                      <select
                        value={equipment.redundancy || ''}
                        onChange={(e) =>
                          updateCriticalEquipment(equipment.id, { redundancy: e.target.value as any || null })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      >
                        <option value="">Select...</option>
                        <option value="N+0">N+0 (No redundancy)</option>
                        <option value="N+1">N+1 (One backup)</option>
                        <option value="N+2">N+2 (Two backups)</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Spares Strategy</label>
                      <select
                        value={equipment.spares_strategy || ''}
                        onChange={(e) =>
                          updateCriticalEquipment(equipment.id, { spares_strategy: e.target.value as any || null })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      >
                        <option value="">Select...</option>
                        <option value="none">None</option>
                        <option value="on-site">On-site spares</option>
                        <option value="vendor">Vendor maintained</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Maintenance Adequacy (1-5)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={equipment.maintenance_adequacy_rating || ''}
                        onChange={(e) =>
                          updateCriticalEquipment(equipment.id, {
                            maintenance_adequacy_rating: e.target.value ? parseInt(e.target.value) : null,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="1 = Poor, 5 = Excellent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Condition Notes</label>
                      <input
                        type="text"
                        value={equipment.condition_notes}
                        onChange={(e) => updateCriticalEquipment(equipment.id, { condition_notes: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="Physical condition, age, issues"
                      />
                    </div>
                    {isTurbineOrGenerator(equipment.equipment_type) && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">OEM</label>
                          <input
                            type="text"
                            value={equipment.oem || ''}
                            onChange={(e) => updateCriticalEquipment(equipment.id, { oem: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                            placeholder="Original Equipment Manufacturer"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Configuration</label>
                          <select
                            value={equipment.configuration || ''}
                            onChange={(e) =>
                              updateCriticalEquipment(equipment.id, { configuration: e.target.value as any })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          >
                            <option value="">Select...</option>
                            <option value="single">Single</option>
                            <option value="multiple">Multiple</option>
                            <option value="unknown">Unknown</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Major Overhaul Interval
                          </label>
                          <input
                            type="text"
                            value={equipment.major_overhaul_interval || ''}
                            onChange={(e) =>
                              updateCriticalEquipment(equipment.id, { major_overhaul_interval: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                            placeholder="e.g., 5 years, 10000 hours"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Known Issues</label>
                          <input
                            type="text"
                            value={equipment.known_issues || ''}
                            onChange={(e) => updateCriticalEquipment(equipment.id, { known_issues: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                            placeholder="Any known reliability problems"
                          />
                        </div>
                      </>
                    )}
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                      <textarea
                        value={equipment.notes}
                        onChange={(e) => updateCriticalEquipment(equipment.id, { notes: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Shutdown Strategy</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Emergency Shutdown Notes</label>
              <textarea
                value={formData.shutdown_strategy.notes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    shutdown_strategy: { ...formData.shutdown_strategy, notes: e.target.value },
                  })
                }
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Describe emergency shutdown procedures and critical process isolation"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Assessor Notes</h3>
          <textarea
            value={assessorNotes}
            onChange={(e) => setAssessorNotes(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            placeholder="Internal notes and observations"
          />
        </div>

        {document?.id && moduleInstance?.id && (
          <ModuleActions documentId={document.id} moduleInstanceId={moduleInstance.id} />
        )}
      </div>

      <FloatingSaveBar onSave={handleSave} isSaving={isSaving} />
    </>
  );
}
