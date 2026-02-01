export interface HrgIndustryConfig {
  label: string;
  module_keys: string[];
  weights: Record<string, number>;
}

export interface HrgMasterMap {
  meta: {
    version: string;
    canonical_keys: string[];
    default_weight: number;
  };
  industries: Record<string, HrgIndustryConfig>;
}

export const HRG_MASTER_MAP: HrgMasterMap = {
  meta: {
    version: '1.0',
    canonical_keys: [
      'process_control_and_stability',
      'safety_and_control_systems',
      'natural_hazard_exposure_and_controls',
      'electrical_and_utilities_reliability',
      'process_safety_management',
      'flammable_liquids_and_fire_risk',
      'critical_equipment_reliability',
      'high_energy_materials_control',
      'high_energy_process_equipment',
      'emergency_response_and_bcp',
    ],
    default_weight: 1.0,
  },
  industries: {
    manufacturing_general: {
      label: 'Manufacturing - General',
      module_keys: [
        'process_control_and_stability',
        'safety_and_control_systems',
        'natural_hazard_exposure_and_controls',
        'electrical_and_utilities_reliability',
        'process_safety_management',
        'flammable_liquids_and_fire_risk',
        'critical_equipment_reliability',
        'high_energy_materials_control',
        'high_energy_process_equipment',
        'emergency_response_and_bcp',
      ],
      weights: {
        process_control_and_stability: 0.8,
        safety_and_control_systems: 1.2,
        natural_hazard_exposure_and_controls: 0.9,
        electrical_and_utilities_reliability: 1.1,
        process_safety_management: 1.0,
        flammable_liquids_and_fire_risk: 1.0,
        critical_equipment_reliability: 1.2,
        high_energy_materials_control: 0.7,
        high_energy_process_equipment: 0.8,
        emergency_response_and_bcp: 0.9,
      },
    },
    chemical_processing: {
      label: 'Chemical Processing',
      module_keys: [
        'process_control_and_stability',
        'safety_and_control_systems',
        'natural_hazard_exposure_and_controls',
        'electrical_and_utilities_reliability',
        'process_safety_management',
        'flammable_liquids_and_fire_risk',
        'critical_equipment_reliability',
        'high_energy_materials_control',
        'high_energy_process_equipment',
        'emergency_response_and_bcp',
      ],
      weights: {
        process_control_and_stability: 1.5,
        safety_and_control_systems: 1.6,
        natural_hazard_exposure_and_controls: 0.8,
        electrical_and_utilities_reliability: 1.3,
        process_safety_management: 1.5,
        flammable_liquids_and_fire_risk: 1.4,
        critical_equipment_reliability: 1.3,
        high_energy_materials_control: 1.6,
        high_energy_process_equipment: 1.5,
        emergency_response_and_bcp: 1.2,
      },
    },
    oil_gas_refining: {
      label: 'Oil & Gas / Refining',
      module_keys: [
        'process_control_and_stability',
        'safety_and_control_systems',
        'natural_hazard_exposure_and_controls',
        'electrical_and_utilities_reliability',
        'process_safety_management',
        'flammable_liquids_and_fire_risk',
        'critical_equipment_reliability',
        'high_energy_materials_control',
        'high_energy_process_equipment',
        'emergency_response_and_bcp',
      ],
      weights: {
        process_control_and_stability: 1.6,
        safety_and_control_systems: 1.7,
        natural_hazard_exposure_and_controls: 1.0,
        electrical_and_utilities_reliability: 1.4,
        process_safety_management: 1.6,
        flammable_liquids_and_fire_risk: 1.8,
        critical_equipment_reliability: 1.5,
        high_energy_materials_control: 1.5,
        high_energy_process_equipment: 1.7,
        emergency_response_and_bcp: 1.3,
      },
    },
    power_generation: {
      label: 'Power Generation',
      module_keys: [
        'process_control_and_stability',
        'safety_and_control_systems',
        'natural_hazard_exposure_and_controls',
        'electrical_and_utilities_reliability',
        'process_safety_management',
        'flammable_liquids_and_fire_risk',
        'critical_equipment_reliability',
        'high_energy_materials_control',
        'high_energy_process_equipment',
        'emergency_response_and_bcp',
      ],
      weights: {
        process_control_and_stability: 1.3,
        safety_and_control_systems: 1.5,
        natural_hazard_exposure_and_controls: 1.2,
        electrical_and_utilities_reliability: 1.8,
        process_safety_management: 1.2,
        flammable_liquids_and_fire_risk: 1.1,
        critical_equipment_reliability: 1.7,
        high_energy_materials_control: 0.8,
        high_energy_process_equipment: 1.6,
        emergency_response_and_bcp: 1.4,
      },
    },
    food_beverage: {
      label: 'Food & Beverage',
      module_keys: [
        'process_control_and_stability',
        'safety_and_control_systems',
        'natural_hazard_exposure_and_controls',
        'electrical_and_utilities_reliability',
        'process_safety_management',
        'flammable_liquids_and_fire_risk',
        'critical_equipment_reliability',
        'high_energy_materials_control',
        'high_energy_process_equipment',
        'emergency_response_and_bcp',
      ],
      weights: {
        process_control_and_stability: 0.9,
        safety_and_control_systems: 1.1,
        natural_hazard_exposure_and_controls: 0.9,
        electrical_and_utilities_reliability: 1.3,
        process_safety_management: 1.0,
        flammable_liquids_and_fire_risk: 0.7,
        critical_equipment_reliability: 1.4,
        high_energy_materials_control: 0.5,
        high_energy_process_equipment: 0.9,
        emergency_response_and_bcp: 1.2,
      },
    },
    warehousing_logistics: {
      label: 'Warehousing & Logistics',
      module_keys: [
        'process_control_and_stability',
        'safety_and_control_systems',
        'natural_hazard_exposure_and_controls',
        'electrical_and_utilities_reliability',
        'process_safety_management',
        'flammable_liquids_and_fire_risk',
        'critical_equipment_reliability',
        'high_energy_materials_control',
        'high_energy_process_equipment',
        'emergency_response_and_bcp',
      ],
      weights: {
        process_control_and_stability: 0.6,
        safety_and_control_systems: 1.0,
        natural_hazard_exposure_and_controls: 1.1,
        electrical_and_utilities_reliability: 1.0,
        process_safety_management: 0.8,
        flammable_liquids_and_fire_risk: 0.9,
        critical_equipment_reliability: 0.9,
        high_energy_materials_control: 0.6,
        high_energy_process_equipment: 0.5,
        emergency_response_and_bcp: 1.3,
      },
    },
  },
};

export const HRG_CANONICAL_KEYS = HRG_MASTER_MAP.meta.canonical_keys;

export interface HrgConfig {
  weight: number;
  helpText: string;
}

const HELP_TEXT_MAP: Record<string, string> = {
  process_control_and_stability: 'Assess the robustness of process controls, instrumentation, and operational stability. Consider process hazards, deviation risks, and control system reliability.',
  safety_and_control_systems: 'Evaluate fire protection systems, detection, suppression, and emergency systems. Consider system design, maintenance, and coverage adequacy.',
  natural_hazard_exposure_and_controls: 'Review exposure to natural perils (flood, earthquake, windstorm) and effectiveness of mitigation measures in place.',
  electrical_and_utilities_reliability: 'Assess reliability of power supply, backup systems, and critical utilities. Consider impact of utility failure on operations.',
  process_safety_management: 'Evaluate management systems for process safety including procedures, training, maintenance programs, and safety culture.',
  flammable_liquids_and_fire_risk: 'Assess storage, handling, and control of flammable liquids and materials. Consider fire loading, separation, and containment.',
  critical_equipment_reliability: 'Review maintenance programs, equipment condition, and reliability of critical machinery essential to operations.',
  high_energy_materials_control: 'Evaluate control measures for reactive chemicals, explosives, or other high-energy materials if present.',
  high_energy_process_equipment: 'Assess risks from high-pressure vessels, reactors, furnaces, or other energetic process equipment.',
  emergency_response_and_bcp: 'Review emergency response capabilities, business continuity planning, and organizational resilience.',
};

export function getHrgConfig(
  industryKey: string | null,
  canonicalKey: string
): HrgConfig {
  const defaultWeight = HRG_MASTER_MAP.meta.default_weight;
  const helpText = HELP_TEXT_MAP[canonicalKey] || 'No guidance available for this factor.';

  if (!industryKey || !HRG_MASTER_MAP.industries[industryKey]) {
    return { weight: defaultWeight, helpText };
  }

  const industry = HRG_MASTER_MAP.industries[industryKey];
  const weight = industry.weights[canonicalKey] ?? defaultWeight;

  return { weight, helpText };
}

export function humanizeCanonicalKey(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
