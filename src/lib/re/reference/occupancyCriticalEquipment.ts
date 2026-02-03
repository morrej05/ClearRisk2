/**
 * Occupancy-based critical equipment suggestions for RE-06 Utilities & Critical Services
 */

export const HEAVY_OCCUPANCIES = new Set([
  'aircraft_painting_unfueled',
  'aluminium_manufacturing',
  'automotive_press_plant',
  'automotive_body_plant',
  'automotive_assembly_plant',
  'chemical_manufacturing',
  'expanded_plastics_and_rubber',
  'food_and_beverage_processing',
  'foundries_and_forges',
  'glass_manufacturing',
  'mining_coal_preparation',
  'mining_metallurgical_refining',
  'mining_mineral_processing',
  'paper_mill_recovery_boilers',
  'paper_mill_power_generation',
  'pulp_and_paper_making',
  'pharmaceutical_manufacturing',
  'power_generation',
  'printing_operations',
  'semiconductor_manufacturing',
  'steel_mills',
  'textile_manufacturing',
  'unexpanded_plastics',
  'woodworking',
]);

/**
 * Maps occupancy keys to suggested critical equipment types
 */
export const occupancyCriticalEquipmentMap: Record<string, string[]> = {
  // Power & Energy
  power_generation: [
    'Turbine',
    'Generator',
    'Boiler',
    'Cooling tower',
    'Chiller',
    'Process control system',
    'Compressor',
  ],

  // Chemical & Pharmaceutical
  chemical_manufacturing: [
    'Reactor / Vessel',
    'Process control system',
    'Compressor',
    'Cooling tower',
    'Chiller',
    'Boiler',
  ],
  pharmaceutical_manufacturing: [
    'Reactor / Vessel',
    'Process control system',
    'Chiller',
    'HVAC system',
    'Clean room equipment',
  ],

  // Metals & Manufacturing
  aluminium_manufacturing: [
    'Kiln / Furnace',
    'Reactor / Vessel',
    'Process control system',
    'Cooling tower',
    'Compressor',
  ],
  steel_mills: [
    'Kiln / Furnace',
    'Process control system',
    'Cooling tower',
    'Compressor',
    'Boiler',
  ],
  foundries_and_forges: [
    'Kiln / Furnace',
    'Process control system',
    'Cooling tower',
    'Compressor',
  ],

  // Automotive
  automotive_press_plant: [
    'Process control system',
    'Compressor',
    'Cooling tower',
    'Hydraulic system',
  ],
  automotive_body_plant: [
    'Process control system',
    'Compressor',
    'Paint booth system',
    'HVAC system',
  ],
  automotive_assembly_plant: [
    'Process control system',
    'Compressor',
    'Cooling tower',
    'Material handling system',
  ],

  // Aircraft
  aircraft_painting_unfueled: [
    'Process control system',
    'HVAC system',
    'Paint booth system',
    'Ventilation / extraction',
  ],

  // Plastics & Rubber
  expanded_plastics_and_rubber: [
    'Extruder / Mill',
    'Process control system',
    'Cooling tower',
    'Chiller',
    'Boiler',
  ],
  unexpanded_plastics: [
    'Extruder / Mill',
    'Process control system',
    'Cooling tower',
    'Chiller',
  ],

  // Food & Beverage
  food_and_beverage_processing: [
    'Process control system',
    'Chiller',
    'Boiler',
    'Compressor',
    'Cooling tower',
  ],

  // Glass
  glass_manufacturing: [
    'Kiln / Furnace',
    'Process control system',
    'Cooling tower',
    'Compressor',
  ],

  // Mining
  mining_coal_preparation: [
    'Process control system',
    'Compressor',
    'Conveyor system',
    'Dust collection',
  ],
  mining_metallurgical_refining: [
    'Kiln / Furnace',
    'Reactor / Vessel',
    'Process control system',
    'Cooling tower',
  ],
  mining_mineral_processing: [
    'Process control system',
    'Compressor',
    'Cooling tower',
    'Material handling system',
  ],

  // Paper & Pulp
  paper_mill_recovery_boilers: [
    'Boiler',
    'Turbine',
    'Generator',
    'Process control system',
    'Cooling tower',
  ],
  paper_mill_power_generation: [
    'Turbine',
    'Generator',
    'Boiler',
    'Process control system',
    'Cooling tower',
  ],
  pulp_and_paper_making: [
    'Process control system',
    'Boiler',
    'Cooling tower',
    'Compressor',
  ],

  // Printing
  printing_operations: [
    'Process control system',
    'HVAC system',
    'Compressor',
    'Chiller',
  ],

  // Semiconductor
  semiconductor_manufacturing: [
    'Process control system',
    'Chiller',
    'HVAC system',
    'Clean room equipment',
    'Gas handling system',
  ],

  // Textiles
  textile_manufacturing: [
    'Process control system',
    'Boiler',
    'Compressor',
    'HVAC system',
  ],

  // Woodworking
  woodworking: [
    'Process control system',
    'Kiln / Furnace',
    'Dust collection',
    'Material handling system',
  ],
};

/**
 * Standard equipment options for non-heavy occupancies
 */
export const STANDARD_EQUIPMENT_OPTIONS = [
  'Boiler',
  'Turbine',
  'Generator',
  'HVAC system',
  'Cooling tower',
  'Chiller',
  'Fire pump',
  'Sprinkler system',
  'Building management system',
  'Custom…',
];

/**
 * Get suggested equipment for an occupancy
 */
export function getSuggestedEquipment(occupancyKey: string | null): string[] {
  if (!occupancyKey || !HEAVY_OCCUPANCIES.has(occupancyKey)) {
    return [];
  }
  return occupancyCriticalEquipmentMap[occupancyKey] || [];
}

/**
 * Check if an occupancy is considered heavy industry
 */
export function isHeavyOccupancy(occupancyKey: string | null): boolean {
  return occupancyKey ? HEAVY_OCCUPANCIES.has(occupancyKey) : false;
}

/**
 * Get all equipment options including suggestions
 */
export function getEquipmentOptions(occupancyKey: string | null): string[] {
  const suggested = getSuggestedEquipment(occupancyKey);

  if (suggested.length > 0) {
    // Return suggested options plus Custom
    return [...suggested, 'Custom…'];
  }

  return STANDARD_EQUIPMENT_OPTIONS;
}
