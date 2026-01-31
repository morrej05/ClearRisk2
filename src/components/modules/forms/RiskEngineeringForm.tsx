import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import AutoExpandTextarea from '../../AutoExpandTextarea';

interface Document {
  id: string;
  document_type: string;
  title: string;
  assessment_date: string;
  assessor_name: string | null;
  assessor_role: string | null;
  responsible_person: string | null;
  scope_description: string | null;
  limitations_assumptions: string | null;
  standards_selected: string[];
}

interface ModuleInstance {
  id: string;
  module_key: string;
  outcome: string | null;
  completed_at: string | null;
  assessor_notes: string;
  data: Record<string, any>;
  updated_at: string;
}

interface RiskEngineeringFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface NaturalHazard {
  id: string;
  type: string;
  description: string;
  mitigationMeasures: string;
}

export default function RiskEngineeringForm({
  moduleInstance,
  document,
  onSaved,
}: RiskEngineeringFormProps) {
  const [isSaving, setIsSaving] = useState(false);

  // Read initial values from the existing module JSON data
  const initial = useMemo(() => {
    const d = moduleInstance.data || {};
    return {
      // Occupancy
      primaryOccupancy: d.primaryOccupancy ?? '',
      companySiteBackground: d.companySiteBackground ?? '',
      occupancyProductsServices: d.occupancyProductsServices ?? '',
      employeesOperatingHours: d.employeesOperatingHours ?? '',

      // Construction
      construction: d.construction ?? '',

      // Management Systems
      commitmentLossPrevention: d.commitmentLossPrevention ?? '',
      fireEquipmentTesting: d.fireEquipmentTesting ?? '',
      controlHotWork: d.controlHotWork ?? '',
      electricalMaintenance: d.electricalMaintenance ?? '',
      generalMaintenance: d.generalMaintenance ?? '',
      selfInspections: d.selfInspections ?? '',
      changeManagement: d.changeManagement ?? '',
      contractorControls: d.contractorControls ?? '',
      impairmentHandling: d.impairmentHandling ?? '',
      smokingControls: d.smokingControls ?? '',
      fireSafetyHousekeeping: d.fireSafetyHousekeeping ?? '',
      emergencyResponse: d.emergencyResponse ?? '',

      // Fire Protection
      fixedFireProtectionSystems: d.fixedFireProtectionSystems ?? '',
      fireDetectionAlarmSystems: d.fireDetectionAlarmSystems ?? '',
      waterSupplies: d.waterSupplies ?? '',

      // Business Continuity
      businessInterruption: d.businessInterruption ?? '',
      profitGeneration: d.profitGeneration ?? '',
      interdependencies: d.interdependencies ?? '',
      bcp: d.bcp ?? '',

      // Natural Hazards
      naturalHazards: d.naturalHazards ?? [],
    };
  }, [moduleInstance.data]);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    occupancy: true,
    construction: false,
    management: false,
    fireProtection: false,
    businessContinuity: false,
    naturalHazards: false,
  });

  // State for all form fields
  const [primaryOccupancy, setPrimaryOccupancy] = useState<string>(initial.primaryOccupancy);
  const [companySiteBackground, setCompanySiteBackground] = useState<string>(initial.companySiteBackground);
  const [occupancyProductsServices, setOccupancyProductsServices] = useState<string>(initial.occupancyProductsServices);
  const [employeesOperatingHours, setEmployeesOperatingHours] = useState<string>(initial.employeesOperatingHours);

  const [construction, setConstruction] = useState<string>(initial.construction);

  const [commitmentLossPrevention, setCommitmentLossPrevention] = useState<string>(initial.commitmentLossPrevention);
  const [fireEquipmentTesting, setFireEquipmentTesting] = useState<string>(initial.fireEquipmentTesting);
  const [controlHotWork, setControlHotWork] = useState<string>(initial.controlHotWork);
  const [electricalMaintenance, setElectricalMaintenance] = useState<string>(initial.electricalMaintenance);
  const [generalMaintenance, setGeneralMaintenance] = useState<string>(initial.generalMaintenance);
  const [selfInspections, setSelfInspections] = useState<string>(initial.selfInspections);
  const [changeManagement, setChangeManagement] = useState<string>(initial.changeManagement);
  const [contractorControls, setContractorControls] = useState<string>(initial.contractorControls);
  const [impairmentHandling, setImpairmentHandling] = useState<string>(initial.impairmentHandling);
  const [smokingControls, setSmokingControls] = useState<string>(initial.smokingControls);
  const [fireSafetyHousekeeping, setFireSafetyHousekeeping] = useState<string>(initial.fireSafetyHousekeeping);
  const [emergencyResponse, setEmergencyResponse] = useState<string>(initial.emergencyResponse);

  const [fixedFireProtectionSystems, setFixedFireProtectionSystems] = useState<string>(initial.fixedFireProtectionSystems);
  const [fireDetectionAlarmSystems, setFireDetectionAlarmSystems] = useState<string>(initial.fireDetectionAlarmSystems);
  const [waterSupplies, setWaterSupplies] = useState<string>(initial.waterSupplies);

  const [businessInterruption, setBusinessInterruption] = useState<string>(initial.businessInterruption);
  const [profitGeneration, setProfitGeneration] = useState<string>(initial.profitGeneration);
  const [interdependencies, setInterdependencies] = useState<string>(initial.interdependencies);
  const [bcp, setBcp] = useState<string>(initial.bcp);

  const [naturalHazards, setNaturalHazards] = useState<NaturalHazard[]>(initial.naturalHazards);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const addNaturalHazard = () => {
    setNaturalHazards(prev => [
      ...prev,
      {
        id: `nh-${Date.now()}`,
        type: '',
        description: '',
        mitigationMeasures: '',
      },
    ]);
  };

  const removeNaturalHazard = (id: string) => {
    setNaturalHazards(prev => prev.filter(h => h.id !== id));
  };

  const updateNaturalHazard = (id: string, field: keyof NaturalHazard, value: string) => {
    setNaturalHazards(prev =>
      prev.map(h => (h.id === id ? { ...h, [field]: value } : h))
    );
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const nextData = {
        primaryOccupancy,
        companySiteBackground,
        occupancyProductsServices,
        employeesOperatingHours,
        construction,
        commitmentLossPrevention,
        fireEquipmentTesting,
        controlHotWork,
        electricalMaintenance,
        generalMaintenance,
        selfInspections,
        changeManagement,
        contractorControls,
        impairmentHandling,
        smokingControls,
        fireSafetyHousekeeping,
        emergencyResponse,
        fixedFireProtectionSystems,
        fireDetectionAlarmSystems,
        waterSupplies,
        businessInterruption,
        profitGeneration,
        interdependencies,
        bcp,
        naturalHazards,
      };

      const { error } = await supabase
        .from('module_instances')
        .update({
          data: nextData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', moduleInstance.id);

      if (error) throw error;

      onSaved();
    } catch (err) {
      console.error('Error saving Risk Engineering module:', err);
      alert('Failed to save Risk Engineering. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const SectionHeader = ({ title, sectionKey }: { title: string; sectionKey: string }) => {
    const isExpanded = expandedSections[sectionKey];
    return (
      <button
        onClick={() => toggleSection(sectionKey)}
        className="w-full flex items-center justify-between p-4 bg-neutral-50 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors"
      >
        <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-neutral-600" />
        ) : (
          <ChevronDown className="w-5 h-5 text-neutral-600" />
        )}
      </button>
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4 sticky top-0 bg-neutral-50 py-4 z-10">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Risk Engineering Assessment</h2>
          <p className="text-sm text-neutral-600">
            Property risk survey - comprehensive assessment
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition-colors"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="space-y-4">
        {/* Occupancy Section */}
        <div className="bg-white rounded-lg border border-neutral-200">
          <SectionHeader title="Occupancy Description" sectionKey="occupancy" />
          {expandedSections.occupancy && (
            <div className="p-6 space-y-4 border-t border-neutral-200">
              <label className="block">
                <div className="text-sm font-medium text-neutral-700 mb-1">Primary Occupancy / Use</div>
                <input
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2"
                  value={primaryOccupancy}
                  onChange={(e) => setPrimaryOccupancy(e.target.value)}
                  placeholder="e.g. Warehouse / Office / Manufacturing"
                />
              </label>

              <label className="block">
                <div className="text-sm font-medium text-neutral-700 mb-1">Company / Site Background</div>
                <AutoExpandTextarea
                  value={companySiteBackground}
                  onChange={(e) => setCompanySiteBackground(e.target.value)}
                  placeholder="Describe the company history, site background, and general overview"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[80px]"
                />
              </label>

              <label className="block">
                <div className="text-sm font-medium text-neutral-700 mb-1">Occupancy / Products / Services</div>
                <AutoExpandTextarea
                  value={occupancyProductsServices}
                  onChange={(e) => setOccupancyProductsServices(e.target.value)}
                  placeholder="Detail the products manufactured, services provided, or activities conducted"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[80px]"
                />
              </label>

              <label className="block">
                <div className="text-sm font-medium text-neutral-700 mb-1">Employees & Operating Hours</div>
                <AutoExpandTextarea
                  value={employeesOperatingHours}
                  onChange={(e) => setEmployeesOperatingHours(e.target.value)}
                  placeholder="Number of employees, shifts, operating hours, and occupancy patterns"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[60px]"
                />
              </label>
            </div>
          )}
        </div>

        {/* Construction Section */}
        <div className="bg-white rounded-lg border border-neutral-200">
          <SectionHeader title="Construction" sectionKey="construction" />
          {expandedSections.construction && (
            <div className="p-6 space-y-4 border-t border-neutral-200">
              <label className="block">
                <div className="text-sm font-medium text-neutral-700 mb-1">Construction Details</div>
                <AutoExpandTextarea
                  value={construction}
                  onChange={(e) => setConstruction(e.target.value)}
                  placeholder="Describe the building construction: frame type, walls, roof, floors, fire-resistance ratings"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[100px]"
                />
              </label>
            </div>
          )}
        </div>

        {/* Management Systems Section */}
        <div className="bg-white rounded-lg border border-neutral-200">
          <SectionHeader title="Management Systems" sectionKey="management" />
          {expandedSections.management && (
            <div className="p-6 space-y-6 border-t border-neutral-200">
              <div className="space-y-4">
                <h4 className="font-semibold text-neutral-900 pb-2 border-b border-neutral-300">Fire Safety & Housekeeping</h4>

                <label className="block">
                  <div className="text-sm font-medium text-neutral-700 mb-1">Commitment to Loss Prevention</div>
                  <AutoExpandTextarea
                    value={commitmentLossPrevention}
                    onChange={(e) => setCommitmentLossPrevention(e.target.value)}
                    placeholder="Describe management commitment, policies, and culture around loss prevention"
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[60px]"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-medium text-neutral-700 mb-1">Fire Equipment Testing & Maintenance</div>
                  <AutoExpandTextarea
                    value={fireEquipmentTesting}
                    onChange={(e) => setFireEquipmentTesting(e.target.value)}
                    placeholder="Testing schedules, maintenance records, and compliance for fire systems"
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[60px]"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-medium text-neutral-700 mb-1">Hot Work Controls</div>
                  <AutoExpandTextarea
                    value={controlHotWork}
                    onChange={(e) => setControlHotWork(e.target.value)}
                    placeholder="Permit systems, supervision, fire watches for welding, cutting, and other hot work"
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[60px]"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-medium text-neutral-700 mb-1">Electrical Maintenance</div>
                  <AutoExpandTextarea
                    value={electricalMaintenance}
                    onChange={(e) => setElectricalMaintenance(e.target.value)}
                    placeholder="Electrical testing, inspection programs, and maintenance schedules"
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[60px]"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-medium text-neutral-700 mb-1">General Maintenance</div>
                  <AutoExpandTextarea
                    value={generalMaintenance}
                    onChange={(e) => setGeneralMaintenance(e.target.value)}
                    placeholder="Overall building and equipment maintenance programs"
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[60px]"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-medium text-neutral-700 mb-1">Self-Inspections</div>
                  <AutoExpandTextarea
                    value={selfInspections}
                    onChange={(e) => setSelfInspections(e.target.value)}
                    placeholder="Internal inspection programs, checklists, and frequency"
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[60px]"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-medium text-neutral-700 mb-1">Change Management</div>
                  <AutoExpandTextarea
                    value={changeManagement}
                    onChange={(e) => setChangeManagement(e.target.value)}
                    placeholder="Processes for managing operational changes and their fire safety implications"
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[60px]"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-medium text-neutral-700 mb-1">Contractor Controls</div>
                  <AutoExpandTextarea
                    value={contractorControls}
                    onChange={(e) => setContractorControls(e.target.value)}
                    placeholder="Contractor management, permits, and safety requirements"
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[60px]"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-medium text-neutral-700 mb-1">Impairment Handling</div>
                  <AutoExpandTextarea
                    value={impairmentHandling}
                    onChange={(e) => setImpairmentHandling(e.target.value)}
                    placeholder="Procedures for managing fire protection system impairments"
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[60px]"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-medium text-neutral-700 mb-1">Smoking Controls</div>
                  <AutoExpandTextarea
                    value={smokingControls}
                    onChange={(e) => setSmokingControls(e.target.value)}
                    placeholder="Smoking policies, designated areas, and enforcement"
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[60px]"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-medium text-neutral-700 mb-1">Fire Safety & Housekeeping</div>
                  <AutoExpandTextarea
                    value={fireSafetyHousekeeping}
                    onChange={(e) => setFireSafetyHousekeeping(e.target.value)}
                    placeholder="General housekeeping standards, combustible storage, and waste management"
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[60px]"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-medium text-neutral-700 mb-1">Emergency Response</div>
                  <AutoExpandTextarea
                    value={emergencyResponse}
                    onChange={(e) => setEmergencyResponse(e.target.value)}
                    placeholder="Emergency procedures, evacuation plans, training, and drills"
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[60px]"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Fire Protection Section */}
        <div className="bg-white rounded-lg border border-neutral-200">
          <SectionHeader title="Fire Protection Systems" sectionKey="fireProtection" />
          {expandedSections.fireProtection && (
            <div className="p-6 space-y-4 border-t border-neutral-200">
              <label className="block">
                <div className="text-sm font-medium text-neutral-700 mb-1">Fixed Fire Protection Systems</div>
                <AutoExpandTextarea
                  value={fixedFireProtectionSystems}
                  onChange={(e) => setFixedFireProtectionSystems(e.target.value)}
                  placeholder="Sprinklers, suppression systems, coverage, design standards"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[80px]"
                />
              </label>

              <label className="block">
                <div className="text-sm font-medium text-neutral-700 mb-1">Fire Detection & Alarm Systems</div>
                <AutoExpandTextarea
                  value={fireDetectionAlarmSystems}
                  onChange={(e) => setFireDetectionAlarmSystems(e.target.value)}
                  placeholder="Detection types, coverage, monitoring, and alarm systems"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[80px]"
                />
              </label>

              <label className="block">
                <div className="text-sm font-medium text-neutral-700 mb-1">Water Supplies</div>
                <AutoExpandTextarea
                  value={waterSupplies}
                  onChange={(e) => setWaterSupplies(e.target.value)}
                  placeholder="Water sources, capacity, pressure, and reliability for firefighting"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[80px]"
                />
              </label>
            </div>
          )}
        </div>

        {/* Business Continuity Section */}
        <div className="bg-white rounded-lg border border-neutral-200">
          <SectionHeader title="Business Continuity" sectionKey="businessContinuity" />
          {expandedSections.businessContinuity && (
            <div className="p-6 space-y-4 border-t border-neutral-200">
              <label className="block">
                <div className="text-sm font-medium text-neutral-700 mb-1">Business Interruption Exposure</div>
                <AutoExpandTextarea
                  value={businessInterruption}
                  onChange={(e) => setBusinessInterruption(e.target.value)}
                  placeholder="Potential business interruption impacts, dependencies, and vulnerabilities"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[80px]"
                />
              </label>

              <label className="block">
                <div className="text-sm font-medium text-neutral-700 mb-1">Profit Generation</div>
                <AutoExpandTextarea
                  value={profitGeneration}
                  onChange={(e) => setProfitGeneration(e.target.value)}
                  placeholder="Key profit centers, revenue streams, and critical operations"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[80px]"
                />
              </label>

              <label className="block">
                <div className="text-sm font-medium text-neutral-700 mb-1">Interdependencies</div>
                <AutoExpandTextarea
                  value={interdependencies}
                  onChange={(e) => setInterdependencies(e.target.value)}
                  placeholder="Dependencies on utilities, suppliers, customers, and other facilities"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[80px]"
                />
              </label>

              <label className="block">
                <div className="text-sm font-medium text-neutral-700 mb-1">Business Continuity Plan</div>
                <AutoExpandTextarea
                  value={bcp}
                  onChange={(e) => setBcp(e.target.value)}
                  placeholder="BCP existence, testing, recovery strategies, and alternate sites"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[80px]"
                />
              </label>
            </div>
          )}
        </div>

        {/* Natural Hazards Section */}
        <div className="bg-white rounded-lg border border-neutral-200">
          <SectionHeader title="Natural Hazards" sectionKey="naturalHazards" />
          {expandedSections.naturalHazards && (
            <div className="p-6 space-y-4 border-t border-neutral-200">
              {naturalHazards.length === 0 ? (
                <p className="text-neutral-600 text-sm">No natural hazards recorded. Click the button below to add one.</p>
              ) : (
                <div className="space-y-4">
                  {naturalHazards.map((hazard, index) => (
                    <div key={hazard.id} className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                      <div className="flex items-start justify-between mb-4">
                        <h4 className="font-semibold text-neutral-900">Natural Hazard {index + 1}</h4>
                        <button
                          onClick={() => removeNaturalHazard(hazard.id)}
                          className="text-red-600 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <label className="block">
                          <div className="text-sm font-medium text-neutral-700 mb-1">Hazard Type</div>
                          <input
                            className="w-full border border-neutral-300 rounded-lg px-3 py-2"
                            value={hazard.type}
                            onChange={(e) => updateNaturalHazard(hazard.id, 'type', e.target.value)}
                            placeholder="e.g. Earthquake, Flood, Windstorm"
                          />
                        </label>

                        <label className="block">
                          <div className="text-sm font-medium text-neutral-700 mb-1">Description</div>
                          <AutoExpandTextarea
                            value={hazard.description}
                            onChange={(e) => updateNaturalHazard(hazard.id, 'description', e.target.value)}
                            placeholder="Describe the natural hazard exposure and potential impact"
                            className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[60px]"
                          />
                        </label>

                        <label className="block">
                          <div className="text-sm font-medium text-neutral-700 mb-1">Mitigation Measures</div>
                          <AutoExpandTextarea
                            value={hazard.mitigationMeasures}
                            onChange={(e) => updateNaturalHazard(hazard.id, 'mitigationMeasures', e.target.value)}
                            placeholder="Describe protective measures in place"
                            className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[60px]"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={addNaturalHazard}
                className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Natural Hazard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
