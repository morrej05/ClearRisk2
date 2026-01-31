import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import AutoExpandTextarea from '../../AutoExpandTextarea';
import SectionGrade from '../../SectionGrade';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';

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

interface SumsInsuredRow {
  id: string;
  item: string;
  pd_value: string;
}

interface WorstCasePDRow {
  id: string;
  item: string;
  percent: string;
  subtotal: number;
}

interface WorstCaseBIRow {
  id: string;
  item: string;
  months: string;
  percent: string;
  subtotal: number;
}

export default function RiskEngineeringForm({
  moduleInstance,
  document,
  onSaved,
}: RiskEngineeringFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

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

      // Section Grades (1-5 ratings)
      sectionGrades: d.sectionGrades ?? {
        occupancy: 3,
        construction: 3,
        management: 3,
        fireProtection: 3,
        businessContinuity: 3,
        naturalHazards: 3,
      },

      // Loss Expectancy
      sumsInsured: d.sumsInsured ?? [
        { id: crypto.randomUUID(), item: 'Buildings + Improvements', pd_value: '' },
        { id: crypto.randomUUID(), item: 'Plant & Machinery + Contents', pd_value: '' },
        { id: crypto.randomUUID(), item: 'Stock & WIP', pd_value: '' },
      ],
      businessInterruptionValue: d.businessInterruptionValue ?? '',
      indemnityPeriod: d.indemnityPeriod ?? '',
      selectedCurrency: d.selectedCurrency ?? 'GBP',
      lossExpectancyComments: d.lossExpectancyComments ?? '',
      worstCasePD: d.worstCasePD ?? [
        { id: crypto.randomUUID(), item: 'Buildings + Improvements', percent: '', subtotal: 0 },
        { id: crypto.randomUUID(), item: 'Plant & Machinery + Contents', percent: '', subtotal: 0 },
        { id: crypto.randomUUID(), item: 'Stock & WIP', percent: '', subtotal: 0 },
      ],
      worstCaseBI: d.worstCaseBI ?? [
        { id: crypto.randomUUID(), item: 'Initial Outage Period', months: '', percent: '', subtotal: 0 },
        { id: crypto.randomUUID(), item: '1st Recovery Phase', months: '', percent: '', subtotal: 0 },
      ],
    };
  }, [moduleInstance.data]);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    occupancy: true,
    construction: false,
    management: false,
    fireProtection: false,
    businessContinuity: false,
    naturalHazards: false,
    lossExpectancy: false,
  });

  // Form field state
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

  // Section grades (1-5 ratings)
  const [sectionGrades, setSectionGrades] = useState(initial.sectionGrades);

  // Loss Expectancy
  const [sumsInsured, setSumsInsured] = useState<SumsInsuredRow[]>(initial.sumsInsured);
  const [businessInterruptionValue, setBusinessInterruptionValue] = useState<string>(initial.businessInterruptionValue);
  const [indemnityPeriod, setIndemnityPeriod] = useState<string>(initial.indemnityPeriod);
  const [selectedCurrency, setSelectedCurrency] = useState<string>(initial.selectedCurrency);
  const [lossExpectancyComments, setLossExpectancyComments] = useState<string>(initial.lossExpectancyComments);
  const [worstCasePD, setWorstCasePD] = useState<WorstCasePDRow[]>(initial.worstCasePD);
  const [worstCaseBI, setWorstCaseBI] = useState<WorstCaseBIRow[]>(initial.worstCaseBI);

  // Module outcome and notes
  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSectionGradeChange = (section: string, value: number) => {
    setSectionGrades(prev => ({ ...prev, [section]: value }));
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

  const addSumsInsuredRow = () => {
    setSumsInsured(prev => [...prev, { id: crypto.randomUUID(), item: '', pd_value: '' }]);
  };

  const removeSumsInsuredRow = (id: string) => {
    setSumsInsured(prev => prev.filter(row => row.id !== id));
  };

  const updateSumsInsured = (id: string, field: keyof SumsInsuredRow, value: string) => {
    setSumsInsured(prev => prev.map(row => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const addWorstCasePDRow = () => {
    setWorstCasePD(prev => [...prev, { id: crypto.randomUUID(), item: '', percent: '', subtotal: 0 }]);
  };

  const removeWorstCasePDRow = (id: string) => {
    setWorstCasePD(prev => prev.filter(row => row.id !== id));
  };

  const updateWorstCasePD = (id: string, field: string, value: string) => {
    setWorstCasePD(prev => prev.map(row => {
      if (row.id === id) {
        const updated = { ...row, [field]: value };
        if (field === 'percent') {
          const totalPD = sumsInsured.reduce((sum, row) => {
            const val = parseFloat(row.pd_value.replace(/,/g, ''));
            return sum + (isNaN(val) ? 0 : val);
          }, 0);
          const percent = parseFloat(value);
          updated.subtotal = isNaN(percent) ? 0 : (totalPD * percent) / 100;
        }
        return updated;
      }
      return row;
    }));
  };

  const addWorstCaseBIRow = () => {
    setWorstCaseBI(prev => [...prev, { id: crypto.randomUUID(), item: '', months: '', percent: '', subtotal: 0 }]);
  };

  const removeWorstCaseBIRow = (id: string) => {
    setWorstCaseBI(prev => prev.filter(row => row.id !== id));
  };

  const updateWorstCaseBI = (id: string, field: string, value: string) => {
    setWorstCaseBI(prev => prev.map(row => {
      if (row.id === id) {
        const updated = { ...row, [field]: value };
        if (field === 'percent' || field === 'months') {
          const biValue = parseFloat(businessInterruptionValue.replace(/,/g, ''));
          const percent = parseFloat(field === 'percent' ? value : row.percent);
          updated.subtotal = isNaN(biValue) || isNaN(percent) ? 0 : (biValue * percent) / 100;
        }
        return updated;
      }
      return row;
    }));
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
        sectionGrades,
        sumsInsured,
        businessInterruptionValue,
        indemnityPeriod,
        selectedCurrency,
        lossExpectancyComments,
        worstCasePD,
        worstCaseBI,
      };

      const sanitized = sanitizeModuleInstancePayload(nextData);
      const completedAt = outcome ? new Date().toISOString() : null;

      const { error } = await supabase
        .from('module_instances')
        .update({
          data: sanitized,
          outcome: outcome || null,
          assessor_notes: assessorNotes,
          completed_at: completedAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', moduleInstance.id);

      if (error) throw error;

      setLastSaved(new Date().toLocaleTimeString());
      onSaved();
    } catch (err) {
      console.error('Error saving Risk Engineering module:', err);
      alert('Failed to save Risk Engineering. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: string) => {
    const num = parseFloat(value.replace(/,/g, ''));
    if (isNaN(num)) return '';
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
    <div className="pb-6">
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4 sticky top-0 bg-white py-4 z-10 border-b border-neutral-200">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Risk Engineering Assessment</h2>
            <p className="text-sm text-neutral-600">
              Property risk survey - comprehensive assessment with ratings and loss analysis
            </p>
            {lastSaved && (
              <p className="text-xs text-neutral-500 mt-1">Last saved: {lastSaved}</p>
            )}
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

                <SectionGrade
                  sectionKey="occupancy"
                  sectionTitle="Occupancy"
                  value={sectionGrades.occupancy}
                  onChange={(value) => handleSectionGradeChange('occupancy', value)}
                />
              </div>
            )}
          </div>

          {/* Construction Section */}
          <div className="bg-white rounded-lg border border-neutral-200">
            <SectionHeader title="Construction" sectionKey="construction" />
            {expandedSections.construction && (
              <div className="p-6 space-y-4 border-t border-neutral-200">
                <div className="overflow-x-auto">
                  <table className="w-full border border-neutral-300 text-sm">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="border border-neutral-300 px-3 py-2 text-left font-semibold">Element</th>
                        <th className="border border-neutral-300 px-3 py-2 text-left font-semibold">Type/Material</th>
                        <th className="border border-neutral-300 px-3 py-2 text-left font-semibold">Fire Resistance</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-neutral-300 px-3 py-2 font-medium bg-neutral-50">Frame</td>
                        <td className="border border-neutral-300 px-3 py-2">
                          <input
                            type="text"
                            placeholder="e.g., Steel, Concrete, Timber"
                            className="w-full px-2 py-1 border border-neutral-200 rounded"
                          />
                        </td>
                        <td className="border border-neutral-300 px-3 py-2">
                          <input
                            type="text"
                            placeholder="e.g., 60 min, 120 min"
                            className="w-full px-2 py-1 border border-neutral-200 rounded"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-neutral-300 px-3 py-2 font-medium bg-neutral-50">Walls</td>
                        <td className="border border-neutral-300 px-3 py-2">
                          <input
                            type="text"
                            placeholder="e.g., Brick cavity, Concrete block"
                            className="w-full px-2 py-1 border border-neutral-200 rounded"
                          />
                        </td>
                        <td className="border border-neutral-300 px-3 py-2">
                          <input
                            type="text"
                            placeholder="e.g., 60 min, 120 min"
                            className="w-full px-2 py-1 border border-neutral-200 rounded"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-neutral-300 px-3 py-2 font-medium bg-neutral-50">Roof</td>
                        <td className="border border-neutral-300 px-3 py-2">
                          <input
                            type="text"
                            placeholder="e.g., Profiled metal, Concrete slab"
                            className="w-full px-2 py-1 border border-neutral-200 rounded"
                          />
                        </td>
                        <td className="border border-neutral-300 px-3 py-2">
                          <input
                            type="text"
                            placeholder="e.g., 30 min, 60 min"
                            className="w-full px-2 py-1 border border-neutral-200 rounded"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-neutral-300 px-3 py-2 font-medium bg-neutral-50">Floors</td>
                        <td className="border border-neutral-300 px-3 py-2">
                          <input
                            type="text"
                            placeholder="e.g., Concrete slab, Composite deck"
                            className="w-full px-2 py-1 border border-neutral-200 rounded"
                          />
                        </td>
                        <td className="border border-neutral-300 px-3 py-2">
                          <input
                            type="text"
                            placeholder="e.g., 60 min, 90 min"
                            className="w-full px-2 py-1 border border-neutral-200 rounded"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <label className="block">
                  <div className="text-sm font-medium text-neutral-700 mb-1">Construction Details</div>
                  <AutoExpandTextarea
                    value={construction}
                    onChange={(e) => setConstruction(e.target.value)}
                    placeholder="Describe the building construction: frame type, walls, roof, floors, fire-resistance ratings"
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[100px]"
                  />
                </label>

                <SectionGrade
                  sectionKey="construction"
                  sectionTitle="Construction"
                  value={sectionGrades.construction}
                  onChange={(value) => handleSectionGradeChange('construction', value)}
                />
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

                <SectionGrade
                  sectionKey="management"
                  sectionTitle="Management Systems"
                  value={sectionGrades.management}
                  onChange={(value) => handleSectionGradeChange('management', value)}
                />
              </div>
            )}
          </div>

          {/* Fire Protection Section */}
          <div className="bg-white rounded-lg border border-neutral-200">
            <SectionHeader title="Fire Protection Systems" sectionKey="fireProtection" />
            {expandedSections.fireProtection && (
              <div className="p-6 space-y-4 border-t border-neutral-200">
                <div className="overflow-x-auto">
                  <table className="w-full border border-neutral-300 text-sm">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="border border-neutral-300 px-3 py-2 text-left font-semibold">System Type</th>
                        <th className="border border-neutral-300 px-3 py-2 text-left font-semibold">Coverage</th>
                        <th className="border border-neutral-300 px-3 py-2 text-left font-semibold">Standard/Specification</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-neutral-300 px-3 py-2 font-medium bg-neutral-50">Sprinklers</td>
                        <td className="border border-neutral-300 px-3 py-2">
                          <input
                            type="text"
                            placeholder="e.g., Full, Partial (70%), None"
                            className="w-full px-2 py-1 border border-neutral-200 rounded"
                          />
                        </td>
                        <td className="border border-neutral-300 px-3 py-2">
                          <input
                            type="text"
                            placeholder="e.g., BS EN 12845 OH1"
                            className="w-full px-2 py-1 border border-neutral-200 rounded"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-neutral-300 px-3 py-2 font-medium bg-neutral-50">Detection</td>
                        <td className="border border-neutral-300 px-3 py-2">
                          <input
                            type="text"
                            placeholder="e.g., Full, Partial, None"
                            className="w-full px-2 py-1 border border-neutral-200 rounded"
                          />
                        </td>
                        <td className="border border-neutral-300 px-3 py-2">
                          <input
                            type="text"
                            placeholder="e.g., BS 5839-1 Category L1"
                            className="w-full px-2 py-1 border border-neutral-200 rounded"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-neutral-300 px-3 py-2 font-medium bg-neutral-50">Suppression</td>
                        <td className="border border-neutral-300 px-3 py-2">
                          <input
                            type="text"
                            placeholder="e.g., Kitchen areas, Server room"
                            className="w-full px-2 py-1 border border-neutral-200 rounded"
                          />
                        </td>
                        <td className="border border-neutral-300 px-3 py-2">
                          <input
                            type="text"
                            placeholder="e.g., FM-200, CO2, Ansul"
                            className="w-full px-2 py-1 border border-neutral-200 rounded"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-neutral-300 px-3 py-2 font-medium bg-neutral-50">Hydrants</td>
                        <td className="border border-neutral-300 px-3 py-2">
                          <input
                            type="text"
                            placeholder="e.g., 4 external, 8 internal"
                            className="w-full px-2 py-1 border border-neutral-200 rounded"
                          />
                        </td>
                        <td className="border border-neutral-300 px-3 py-2">
                          <input
                            type="text"
                            placeholder="e.g., BS 5306-1"
                            className="w-full px-2 py-1 border border-neutral-200 rounded"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

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

                <SectionGrade
                  sectionKey="fireProtection"
                  sectionTitle="Fire Protection"
                  value={sectionGrades.fireProtection}
                  onChange={(value) => handleSectionGradeChange('fireProtection', value)}
                />
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

                <SectionGrade
                  sectionKey="businessContinuity"
                  sectionTitle="Business Continuity"
                  value={sectionGrades.businessContinuity}
                  onChange={(value) => handleSectionGradeChange('businessContinuity', value)}
                />
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

                <SectionGrade
                  sectionKey="naturalHazards"
                  sectionTitle="Natural Hazards"
                  value={sectionGrades.naturalHazards}
                  onChange={(value) => handleSectionGradeChange('naturalHazards', value)}
                />
              </div>
            )}
          </div>

          {/* Loss Expectancy Section */}
          <div className="bg-white rounded-lg border border-neutral-200">
            <SectionHeader title="Loss Expectancy" sectionKey="lossExpectancy" />
            {expandedSections.lossExpectancy && (
              <div className="p-6 space-y-8 border-t border-neutral-200">
                <div>
                  <h3 className="text-xl font-semibold text-neutral-900 mb-4">Table 1: Sums Insured</h3>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Currency</label>
                    <select
                      value={selectedCurrency}
                      onChange={(e) => setSelectedCurrency(e.target.value)}
                      className="border border-neutral-300 rounded-lg px-3 py-2"
                    >
                      <option value="GBP">GBP (£)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-neutral-100">
                          <th className="border border-neutral-300 px-4 py-2 text-left text-sm font-semibold text-neutral-700">Property Damage</th>
                          <th className="border border-neutral-300 px-4 py-2 text-left text-sm font-semibold text-neutral-700">Value ({selectedCurrency})</th>
                          <th className="border border-neutral-300 px-4 py-2 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {sumsInsured.map((row) => (
                          <tr key={row.id}>
                            <td className="border border-neutral-300 px-4 py-2">
                              <input
                                className="w-full border-0 focus:outline-none"
                                value={row.item}
                                onChange={(e) => updateSumsInsured(row.id, 'item', e.target.value)}
                                placeholder="Item description"
                              />
                            </td>
                            <td className="border border-neutral-300 px-4 py-2">
                              <input
                                className="w-full border-0 focus:outline-none"
                                value={row.pd_value}
                                onChange={(e) => updateSumsInsured(row.id, 'pd_value', e.target.value)}
                                placeholder="0"
                              />
                            </td>
                            <td className="border border-neutral-300 px-2 py-2 text-center">
                              <button
                                onClick={() => removeSumsInsuredRow(row.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    onClick={addSumsInsuredRow}
                    className="mt-2 flex items-center gap-2 px-3 py-1 text-sm bg-neutral-100 hover:bg-neutral-200 text-neutral-900 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Row
                  </button>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Business Interruption Value</label>
                    <input
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2"
                      value={businessInterruptionValue}
                      onChange={(e) => setBusinessInterruptionValue(e.target.value)}
                      placeholder="Annual turnover or BI sum insured"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Indemnity Period (months)</label>
                    <input
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2"
                      value={indemnityPeriod}
                      onChange={(e) => setIndemnityPeriod(e.target.value)}
                      placeholder="e.g. 12, 18, 24"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Additional Comments</label>
                    <AutoExpandTextarea
                      value={lossExpectancyComments}
                      onChange={(e) => setLossExpectancyComments(e.target.value)}
                      placeholder="Enter additional comments about sums insured"
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 min-h-[60px]"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-neutral-900 mb-2">Table 2: Worst Case Loss Expectancy (WCL)</h3>
                  <p className="text-sm text-neutral-600 mb-4">
                    An estimation of the maximum loss potential derived from the property and business interruption coverage that could be sustained assuming failure of installed fire protection and ineffective emergency response.
                  </p>

                  <div>
                    <h4 className="text-lg font-medium text-neutral-900 mb-3">Property Damage</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-neutral-100">
                            <th className="border border-neutral-300 px-4 py-2 text-left text-sm font-semibold">Item</th>
                            <th className="border border-neutral-300 px-4 py-2 text-left text-sm font-semibold">% Damaged</th>
                            <th className="border border-neutral-300 px-4 py-2 text-left text-sm font-semibold">Subtotal ({selectedCurrency})</th>
                            <th className="border border-neutral-300 px-4 py-2 w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {worstCasePD.map((row) => (
                            <tr key={row.id}>
                              <td className="border border-neutral-300 px-4 py-2">
                                <input
                                  className="w-full border-0 focus:outline-none"
                                  value={row.item}
                                  onChange={(e) => updateWorstCasePD(row.id, 'item', e.target.value)}
                                  placeholder="Item"
                                />
                              </td>
                              <td className="border border-neutral-300 px-4 py-2">
                                <input
                                  className="w-full border-0 focus:outline-none"
                                  value={row.percent}
                                  onChange={(e) => updateWorstCasePD(row.id, 'percent', e.target.value)}
                                  placeholder="0"
                                />
                              </td>
                              <td className="border border-neutral-300 px-4 py-2 text-neutral-600">
                                {formatCurrency(row.subtotal.toString())}
                              </td>
                              <td className="border border-neutral-300 px-2 py-2 text-center">
                                <button
                                  onClick={() => removeWorstCasePDRow(row.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      onClick={addWorstCasePDRow}
                      className="mt-2 flex items-center gap-2 px-3 py-1 text-sm bg-neutral-100 hover:bg-neutral-200 text-neutral-900 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Row
                    </button>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-lg font-medium text-neutral-900 mb-3">Business Interruption</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-neutral-100">
                            <th className="border border-neutral-300 px-4 py-2 text-left text-sm font-semibold">Period</th>
                            <th className="border border-neutral-300 px-4 py-2 text-left text-sm font-semibold">Months</th>
                            <th className="border border-neutral-300 px-4 py-2 text-left text-sm font-semibold">% Loss</th>
                            <th className="border border-neutral-300 px-4 py-2 text-left text-sm font-semibold">Subtotal ({selectedCurrency})</th>
                            <th className="border border-neutral-300 px-4 py-2 w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {worstCaseBI.map((row) => (
                            <tr key={row.id}>
                              <td className="border border-neutral-300 px-4 py-2">
                                <input
                                  className="w-full border-0 focus:outline-none"
                                  value={row.item}
                                  onChange={(e) => updateWorstCaseBI(row.id, 'item', e.target.value)}
                                  placeholder="Period description"
                                />
                              </td>
                              <td className="border border-neutral-300 px-4 py-2">
                                <input
                                  className="w-full border-0 focus:outline-none"
                                  value={row.months}
                                  onChange={(e) => updateWorstCaseBI(row.id, 'months', e.target.value)}
                                  placeholder="0"
                                />
                              </td>
                              <td className="border border-neutral-300 px-4 py-2">
                                <input
                                  className="w-full border-0 focus:outline-none"
                                  value={row.percent}
                                  onChange={(e) => updateWorstCaseBI(row.id, 'percent', e.target.value)}
                                  placeholder="0"
                                />
                              </td>
                              <td className="border border-neutral-300 px-4 py-2 text-neutral-600">
                                {formatCurrency(row.subtotal.toString())}
                              </td>
                              <td className="border border-neutral-300 px-2 py-2 text-center">
                                <button
                                  onClick={() => removeWorstCaseBIRow(row.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      onClick={addWorstCaseBIRow}
                      className="mt-2 flex items-center gap-2 px-3 py-1 text-sm bg-neutral-100 hover:bg-neutral-200 text-neutral-900 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Row
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Outcome Panel and Actions */}
      <div className="px-6 max-w-5xl mx-auto mt-6">
        <OutcomePanel
          outcome={outcome}
          assessorNotes={assessorNotes}
          onOutcomeChange={setOutcome}
          onNotesChange={setAssessorNotes}
          onSave={handleSave}
          isSaving={isSaving}
        />

        <ModuleActions
          documentId={document.id}
          moduleInstanceId={moduleInstance.id}
        />
      </div>
    </div>
  );
}
