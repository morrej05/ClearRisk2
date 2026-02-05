export interface BuildingInput {
  id?: string;
  document_id: string;

  ref: string;
  description?: string | null;

  footprint_m2?: number | null;
  height_m?: number | null;
  storeys?: number | null;

  roof_type: string;
  roof_covering?: string | null;
  roof_insulation?: string | null;

  frame_type: string;
  frame_fire_protection: string;

  wall_type: string;
  wall_insulation?: string | null;

  cladding_present: boolean;
  cladding_combustible?: boolean | null;
  cladding_system?: string | null;

  rooflights_present: boolean;
  rooflights_material?: string | null;
  rooflights_percent_of_roof?: number | null;

  smoke_venting_type: string;
  smoke_venting_coverage: string;

  sprinklers_present: boolean;
  sprinkler_standard: string;
  sprinkler_coverage: string;
  sprinkler_water_supply: string;
  sprinkler_pump_electric?: boolean | null;
  sprinkler_pump_diesel?: boolean | null;
  sprinkler_pump_n_plus_1?: boolean | null;
  sprinkler_monitoring: string;
  sprinkler_last_test_date?: string | null;

  detection_present: boolean;
  detection_type: string;
  detection_remote_monitoring: string;

  hydrants_on_site: boolean;
  hydrants_public_nearby: string;

  extinguishers_present: boolean;
  extinguishers_maintenance_current: string;
}

export function createEmptyBuilding(documentId: string, ref = 'B1'): BuildingInput {
  return {
    document_id: documentId,
    ref,
    description: null,

    footprint_m2: null,
    height_m: null,
    storeys: null,

    roof_area_m2: null,
    mezzanine_area_m2: null,


    roof_area_m2?: number | null;
    mezzanine_area_m2?: number | null;


    roof_type: 'unknown',
    roof_covering: null,
    roof_insulation: null,

    frame_type: 'unknown',
    frame_fire_protection: 'unknown',

    wall_type: 'unknown',
    wall_insulation: null,

    cladding_present: false,
    cladding_combustible: null,
    cladding_system: null,

    rooflights_present: false,
    rooflights_material: null,
    rooflights_percent_of_roof: null,

    smoke_venting_type: 'unknown',
    smoke_venting_coverage: 'unknown',

    sprinklers_present: false,
    sprinkler_standard: 'unknown',
    sprinkler_coverage: 'none',
    sprinkler_water_supply: 'unknown',
    sprinkler_pump_electric: null,
    sprinkler_pump_diesel: null,
    sprinkler_pump_n_plus_1: null,
    sprinkler_monitoring: 'unknown',
    sprinkler_last_test_date: null,

    detection_present: false,
    detection_type: 'unknown',
    detection_remote_monitoring: 'unknown',

    hydrants_on_site: false,
    hydrants_public_nearby: 'unknown',

    extinguishers_present: false,
    extinguishers_maintenance_current: 'unknown',
  };
}
