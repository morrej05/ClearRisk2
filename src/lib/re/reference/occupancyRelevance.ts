/**
 * Occupancy Relevance Configuration
 *
 * Defines which risk rating factors are relevant for each occupancy type.
 * Used to filter the Risk Ratings Summary table to show only applicable factors.
 */

export interface OccupancyRelevanceConfig {
  enabled_factors: string[];
  weight_overrides?: Record<string, number>;
}

/**
 * Map of occupancy keys to their relevant risk factors.
 *
 * Global pillars (construction, fire_protection, management) are ALWAYS included
 * and do not need to be listed here.
 */
export const OCCUPANCY_RELEVANCE_MAP: Record<string, OccupancyRelevanceConfig> = {
  chemical_batch_processing: {
    enabled_factors: [
      'process_control_and_stability',
      'safety_and_control_systems',
      'process_safety_management',
      'flammable_liquids_and_fire_risk',
      'high_energy_materials_control',
      'high_energy_process_equipment',
      'critical_equipment_reliability',
      'electrical_and_utilities_reliability',
      'natural_hazard_exposure_and_controls',
      'emergency_response_and_bcp',
    ],
  },
  chemical_continuous_processing: {
    enabled_factors: [
      'process_control_and_stability',
      'safety_and_control_systems',
      'process_safety_management',
      'flammable_liquids_and_fire_risk',
      'high_energy_materials_control',
      'high_energy_process_equipment',
      'critical_equipment_reliability',
      'electrical_and_utilities_reliability',
      'natural_hazard_exposure_and_controls',
      'emergency_response_and_bcp',
    ],
  },
  pharmaceutical_manufacturing: {
    enabled_factors: [
      'process_control_and_stability',
      'safety_and_control_systems',
      'process_safety_management',
      'flammable_liquids_and_fire_risk',
      'critical_equipment_reliability',
      'electrical_and_utilities_reliability',
      'natural_hazard_exposure_and_controls',
      'emergency_response_and_bcp',
    ],
  },
  food_beverage_processing: {
    enabled_factors: [
      'process_control_and_stability',
      'safety_and_control_systems',
      'critical_equipment_reliability',
      'electrical_and_utilities_reliability',
      'natural_hazard_exposure_and_controls',
      'emergency_response_and_bcp',
    ],
  },
  automotive_assembly: {
    enabled_factors: [
      'safety_and_control_systems',
      'flammable_liquids_and_fire_risk',
      'critical_equipment_reliability',
      'electrical_and_utilities_reliability',
      'natural_hazard_exposure_and_controls',
      'emergency_response_and_bcp',
    ],
  },
  electronics_manufacturing: {
    enabled_factors: [
      'process_control_and_stability',
      'safety_and_control_systems',
      'critical_equipment_reliability',
      'electrical_and_utilities_reliability',
      'natural_hazard_exposure_and_controls',
      'emergency_response_and_bcp',
    ],
  },
  warehouse_distribution: {
    enabled_factors: [
      'safety_and_control_systems',
      'flammable_liquids_and_fire_risk',
      'natural_hazard_exposure_and_controls',
      'emergency_response_and_bcp',
    ],
  },
  data_center: {
    enabled_factors: [
      'process_control_and_stability',
      'safety_and_control_systems',
      'critical_equipment_reliability',
      'electrical_and_utilities_reliability',
      'natural_hazard_exposure_and_controls',
      'emergency_response_and_bcp',
    ],
  },
  office_commercial: {
    enabled_factors: [
      'safety_and_control_systems',
      'electrical_and_utilities_reliability',
      'natural_hazard_exposure_and_controls',
      'emergency_response_and_bcp',
    ],
  },
  retail: {
    enabled_factors: [
      'safety_and_control_systems',
      'electrical_and_utilities_reliability',
      'natural_hazard_exposure_and_controls',
      'emergency_response_and_bcp',
    ],
  },
  hotel_hospitality: {
    enabled_factors: [
      'safety_and_control_systems',
      'electrical_and_utilities_reliability',
      'natural_hazard_exposure_and_controls',
      'emergency_response_and_bcp',
    ],
  },
  hospital_healthcare: {
    enabled_factors: [
      'safety_and_control_systems',
      'critical_equipment_reliability',
      'electrical_and_utilities_reliability',
      'natural_hazard_exposure_and_controls',
      'emergency_response_and_bcp',
    ],
  },
  mining_coal_preparation: {
    enabled_factors: [
      'process_control_and_stability',
      'critical_equipment_reliability',
      'electrical_and_utilities_reliability',
      'natural_hazard_exposure_and_controls',
      'emergency_response_and_bcp',
    ],
  },
  mining_metallurgical_refining: {
    enabled_factors: [
      'high_energy_materials_control',
      'process_safety_management',
      'critical_equipment_reliability',
      'electrical_and_utilities_reliability',
      'emergency_response_and_bcp',
    ],
  },
  mining_mineral_processing: {
    enabled_factors: [
      'process_control_and_stability',
      'critical_equipment_reliability',
      'electrical_and_utilities_reliability',
      'natural_hazard_exposure_and_controls',
      'emergency_response_and_bcp',
    ],
  },
  mining_ore_distribution: {
    enabled_factors: [
      'critical_equipment_reliability',
      'natural_hazard_exposure_and_controls',
      'electrical_and_utilities_reliability',
      'emergency_response_and_bcp',
    ],
  },
};

/**
 * Default/conservative factor set when occupancy is not specified.
 * Includes only the most universal risk factors.
 */
export const DEFAULT_ENABLED_FACTORS: string[] = [
  'safety_and_control_systems',
  'electrical_and_utilities_reliability',
  'natural_hazard_exposure_and_controls',
  'emergency_response_and_bcp',
];

/**
 * Get enabled risk factors for a given occupancy.
 * Returns default set if occupancy is not recognized.
 */
export function getEnabledFactors(industryKey: string | null): string[] {
  if (!industryKey || !OCCUPANCY_RELEVANCE_MAP[industryKey]) {
    return DEFAULT_ENABLED_FACTORS;
  }
  return OCCUPANCY_RELEVANCE_MAP[industryKey].enabled_factors;
}

/**
 * Get weight overrides for a given occupancy.
 * Returns empty object if no overrides defined.
 */
export function getWeightOverrides(industryKey: string | null): Record<string, number> {
  if (!industryKey || !OCCUPANCY_RELEVANCE_MAP[industryKey]) {
    return {};
  }
  return OCCUPANCY_RELEVANCE_MAP[industryKey].weight_overrides || {};
}

/**
 * Check if a factor is relevant for the given occupancy.
 */
export function isFactorRelevant(industryKey: string | null, factorKey: string): boolean {
  const enabledFactors = getEnabledFactors(industryKey);
  return enabledFactors.includes(factorKey);
}
