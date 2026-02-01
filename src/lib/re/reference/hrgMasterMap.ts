import lockedData from './hrgMasterMap.locked.json';

export interface HrgModuleConfig {
  weight: number;
  help_text: string;
}

export interface HrgIndustryConfig {
  modules: Record<string, HrgModuleConfig>;
}

export interface HrgMasterMap {
  meta: {
    version?: string;
    dataset_name?: string;
    status?: string;
    module_keys: string[];
    default_weight: number;
    rating_scale?: string;
    calculation_note?: string;
  };
  industries: Record<string, HrgIndustryConfig>;
}

export const HRG_MASTER_MAP: HrgMasterMap = lockedData as HrgMasterMap;

const LEGACY_HARDCODED_MAP: HrgMasterMap = {
  meta: {
    version: '1.0',
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
    default_weight: 3,
  },
  industries: {
    chemical_batch_processing: {
      modules: {
        process_control_and_stability: {
          weight: 5,
          help_text: 'Batch chemical operations present high risk from process upsets, runaway reactions, and control failures. Assess process controls, instrumentation, batch sequences, and operator procedures.',
        },
        safety_and_control_systems: {
          weight: 5,
          help_text: 'Critical fire protection and safety interlocks required for batch chemical operations. Evaluate detection systems, suppression coverage, emergency isolation, and safety instrumented systems.',
        },
        natural_hazard_exposure_and_controls: {
          weight: 3,
          help_text: 'Standard natural hazard considerations for chemical facilities. Review site exposure to flood, wind, earthquake and adequacy of structural protection.',
        },
        electrical_and_utilities_reliability: {
          weight: 4,
          help_text: 'Reliable power and utilities essential for process control and safety systems. Evaluate backup power, UPS coverage, and utility redundancy.',
        },
        process_safety_management: {
          weight: 5,
          help_text: 'Comprehensive PSM critical for batch chemical operations. Assess management of change, operating procedures, training, process hazard analysis, and safety culture.',
        },
        flammable_liquids_and_fire_risk: {
          weight: 5,
          help_text: 'High fire risk from flammable solvents and intermediates in batch processing. Review storage arrangements, process containment, fire loading, and separation.',
        },
        critical_equipment_reliability: {
          weight: 4,
          help_text: 'Reactors, vessels, and process equipment must be reliable and well-maintained. Evaluate mechanical integrity program, inspection schedules, and equipment condition.',
        },
        high_energy_materials_control: {
          weight: 5,
          help_text: 'Reactive chemicals and intermediates present major hazard in batch operations. Assess compatibility reviews, inventory limits, segregation, and emergency response.',
        },
        high_energy_process_equipment: {
          weight: 5,
          help_text: 'Batch reactors under pressure/temperature present significant energy release potential. Review pressure relief, cooling systems, runaway protection, and emergency procedures.',
        },
        emergency_response_and_bcp: {
          weight: 4,
          help_text: 'Strong emergency response capability essential for chemical batch facilities. Evaluate emergency plans, response teams, drills, mutual aid, and business continuity strategies.',
        },
      },
    },
    chemical_continuous_processing: {
      label: 'Chemical - Continuous Processing',
      modules: {
        process_control_and_stability: {
          weight: 5,
          help_text: 'Continuous chemical processes require robust controls to maintain stability. Assess DCS systems, process instrumentation, alarm management, and control strategies.',
        },
        safety_and_control_systems: {
          weight: 5,
          help_text: 'Layered protection with SIS and fire protection essential. Review safety instrumented systems, fire detection/suppression, and emergency shutdown capabilities.',
        },
        natural_hazard_exposure_and_controls: {
          weight: 3,
          help_text: 'Standard natural hazard exposure for chemical facilities. Evaluate site vulnerability to flood, wind, seismic events and structural protection measures.',
        },
        electrical_and_utilities_reliability: {
          weight: 5,
          help_text: 'Continuous operations highly dependent on reliable utilities. Assess backup power, cooling water, steam, compressed air redundancy and failure mode analysis.',
        },
        process_safety_management: {
          weight: 5,
          help_text: 'Mature PSM program critical for continuous chemical operations. Review process safety culture, MOC procedures, PHA quality, mechanical integrity, and contractor management.',
        },
        flammable_liquids_and_fire_risk: {
          weight: 5,
          help_text: 'Large inventories of flammables in continuous processing increase fire risk. Evaluate storage tank protection, process area fire protection, drainage, and separation distances.',
        },
        critical_equipment_reliability: {
          weight: 5,
          help_text: 'Continuous operation depends on equipment reliability. Review preventive maintenance, predictive monitoring, spare equipment, and turnaround planning.',
        },
        high_energy_materials_control: {
          weight: 4,
          help_text: 'Reactive materials in continuous processes must be controlled. Assess process design for safety, inventory minimization, isolation capabilities, and hazard monitoring.',
        },
        high_energy_process_equipment: {
          weight: 5,
          help_text: 'High pressure/temperature continuous equipment presents major energy hazard. Review pressure relief design, emergency cooling, trip systems, and protective instrumentation.',
        },
        emergency_response_and_bcp: {
          weight: 4,
          help_text: 'Robust emergency response required for continuous chemical plants. Evaluate emergency preparedness, industrial fire brigade, community coordination, and recovery planning.',
        },
      },
    },
    oil_gas_refining: {
      label: 'Oil & Gas - Refining',
      modules: {
        process_control_and_stability: {
          weight: 5,
          help_text: 'Refinery process units operate continuously at high severity requiring excellent control. Assess advanced process control, instrumentation reliability, and operator decision support.',
        },
        safety_and_control_systems: {
          weight: 5,
          help_text: 'Multiple layers of protection required in refinery operations. Review SIS design, fire and gas detection, water deluge systems, foam systems, and emergency isolation.',
        },
        natural_hazard_exposure_and_controls: {
          weight: 3,
          help_text: 'Refineries typically well-protected against natural hazards. Evaluate wind resistance, flood protection, seismic bracing, and hazmat containment for external events.',
        },
        electrical_and_utilities_reliability: {
          weight: 5,
          help_text: 'Refineries depend on reliable electrical power and utilities. Assess backup generation, blackstart capability, cooling water systems, steam system reliability, and air supply.',
        },
        process_safety_management: {
          weight: 5,
          help_text: 'World-class PSM essential for refinery operations. Review implementation of API RP 754 metrics, process safety culture, management leadership, and continuous improvement.',
        },
        flammable_liquids_and_fire_risk: {
          weight: 5,
          help_text: 'Massive hydrocarbon inventory creates major fire risk in refineries. Evaluate tank farm protection, process unit fire systems, firewater capacity, foam stocks, and mutual aid.',
        },
        critical_equipment_reliability: {
          weight: 5,
          help_text: 'Refinery equipment must operate reliably at high temperatures/pressures. Review inspection programs, corrosion management, rotating equipment programs, and turnaround execution.',
        },
        high_energy_materials_control: {
          weight: 4,
          help_text: 'Reactive sulfur compounds, HF, and other hazards in refineries. Assess HF alkylation safeguards, amine system controls, sulfur recovery operations, and emergency procedures.',
        },
        high_energy_process_equipment: {
          weight: 5,
          help_text: 'Refinery units operate at extreme conditions with major energy release potential. Review pressure relief systems, fired heater safety, compressor protection, and emergency procedures.',
        },
        emergency_response_and_bcp: {
          weight: 4,
          help_text: 'Refineries maintain sophisticated emergency response capabilities. Evaluate industrial fire department, hazmat response, community relations, and business continuity planning.',
        },
      },
    },
    oil_gas_upstream: {
      label: 'Oil & Gas - Upstream Production',
      modules: {
        process_control_and_stability: {
          weight: 4,
          help_text: 'Production facilities require reliable process control for separation and treatment. Assess control systems for separators, dehydration, compression, and export systems.',
        },
        safety_and_control_systems: {
          weight: 5,
          help_text: 'Critical safety systems for wellhead control and process protection. Review ESD systems, fire and gas detection, blowdown systems, and platform safety systems.',
        },
        natural_hazard_exposure_and_controls: {
          weight: 4,
          help_text: 'Upstream facilities may face exposure to hurricanes, ice, earthquakes depending on location. Assess platform design standards, subsea protection, and weather preparedness.',
        },
        electrical_and_utilities_reliability: {
          weight: 4,
          help_text: 'Remote locations require reliable onsite power generation. Evaluate generator reliability, fuel supplies, battery backup, and utility failure procedures.',
        },
        process_safety_management: {
          weight: 4,
          help_text: 'Upstream PSM focuses on well control, SIMOPS, and facility integrity. Review drilling safety, completion procedures, simultaneous operations management, and asset integrity.',
        },
        flammable_liquids_and_fire_risk: {
          weight: 5,
          help_text: 'Wellhead and production facility fire risks from hydrocarbon releases. Evaluate well barriers, process containment, fire detection, deluge systems, and emergency response.',
        },
        critical_equipment_reliability: {
          weight: 4,
          help_text: 'Production equipment must operate reliably in remote locations. Review preventive maintenance, condition monitoring, spare parts management, and turnaround planning.',
        },
        high_energy_materials_control: {
          weight: 3,
          help_text: 'H2S may be present in sour production operations. Assess H2S detection, personal protection, emergency procedures, and toxic gas dispersion modeling.',
        },
        high_energy_process_equipment: {
          weight: 4,
          help_text: 'High pressure wellheads, separators, and compression equipment. Review pressure containment integrity, relief systems, and well control procedures.',
        },
        emergency_response_and_bcp: {
          weight: 4,
          help_text: 'Remote location emergency response depends on training and preparedness. Evaluate response team capabilities, medical facilities, evacuation procedures, and mutual aid.',
        },
      },
    },
    petrochemical_plastics: {
      label: 'Petrochemical / Plastics Manufacturing',
      modules: {
        process_control_and_stability: {
          weight: 5,
          help_text: 'Polymerization and petrochemical processes sensitive to upsets. Assess advanced process control, online analyzers, reactor control strategies, and process stability.',
        },
        safety_and_control_systems: {
          weight: 5,
          help_text: 'Multiple protection layers needed for polymerization hazards. Review SIS design, emergency shutdown logic, fire protection, and explosion protection systems.',
        },
        natural_hazard_exposure_and_controls: {
          weight: 3,
          help_text: 'Standard natural hazard exposure considerations. Evaluate site vulnerability to natural perils and adequacy of structural protection measures.',
        },
        electrical_and_utilities_reliability: {
          weight: 5,
          help_text: 'Continuous polymerization highly dependent on reliable utilities. Assess power reliability, cooling water, nitrogen, and consequences of utility failures.',
        },
        process_safety_management: {
          weight: 5,
          help_text: 'Strong PSM essential for reactive polymerization operations. Review MOC rigor, PHA quality, runaway reaction analysis, and process safety culture.',
        },
        flammable_liquids_and_fire_risk: {
          weight: 5,
          help_text: 'Flammable monomers and solvents create major fire hazards. Evaluate storage protection, process fire protection, fire water supply, and large fire response.',
        },
        critical_equipment_reliability: {
          weight: 5,
          help_text: 'Polymerization reactors and extruders must operate reliably. Review mechanical integrity, predictive maintenance, fouling management, and turnaround practices.',
        },
        high_energy_materials_control: {
          weight: 5,
          help_text: 'Reactive monomers and polymerization hazards require strict control. Assess inhibitor systems, temperature control, runaway reaction prevention, and emergency procedures.',
        },
        high_energy_process_equipment: {
          weight: 5,
          help_text: 'Polymerization reactors under pressure/temperature with runaway potential. Review relief sizing, emergency cooling, inhibitor injection, and dump systems.',
        },
        emergency_response_and_bcp: {
          weight: 4,
          help_text: 'Petrochemical facilities require robust emergency capabilities. Evaluate emergency response plans, training, industrial fire brigade, and business continuity.',
        },
      },
    },
    pharmaceutical_specialty_chemical: {
      label: 'Pharmaceutical / Specialty Chemical',
      modules: {
        process_control_and_stability: {
          weight: 4,
          help_text: 'Batch pharmaceutical processes require precise control for quality and safety. Assess batch control systems, recipe management, critical process parameters, and deviations.',
        },
        safety_and_control_systems: {
          weight: 4,
          help_text: 'Fire and safety systems appropriate for pharmaceutical operations. Review cleanroom fire protection, solvent area protection, detection systems, and sprinklers.',
        },
        natural_hazard_exposure_and_controls: {
          weight: 3,
          help_text: 'Standard exposure to natural hazards. Evaluate site protection against flood, wind, earthquake considering sensitive inventory and equipment.',
        },
        electrical_and_utilities_reliability: {
          weight: 4,
          help_text: 'Reliable utilities needed for manufacturing and cleanroom environments. Assess backup power for critical areas, HVAC reliability, and utility failure impacts.',
        },
        process_safety_management: {
          weight: 4,
          help_text: 'PSM integrated with cGMP requirements in pharmaceutical facilities. Review hazard assessments, process validation, MOC procedures, and safety culture.',
        },
        flammable_liquids_and_fire_risk: {
          weight: 4,
          help_text: 'Flammable solvents used in pharmaceutical synthesis and formulation. Evaluate solvent storage, process area protection, waste solvent handling, and fire risk.',
        },
        critical_equipment_reliability: {
          weight: 3,
          help_text: 'Batch reactors, dryers, and processing equipment must be reliable. Review preventive maintenance, equipment qualification, and critical spare parts.',
        },
        high_energy_materials_control: {
          weight: 4,
          help_text: 'Some APIs and intermediates may be energetic or reactive. Assess differential scanning calorimetry, reactive hazard screening, and controls for energetic compounds.',
        },
        high_energy_process_equipment: {
          weight: 3,
          help_text: 'Batch reactors and pressure vessels in pharmaceutical use. Review pressure relief, cooling adequacy, runaway reaction scenarios, and emergency procedures.',
        },
        emergency_response_and_bcp: {
          weight: 3,
          help_text: 'Emergency preparedness for pharmaceutical site hazards. Evaluate emergency plans, spill response, evacuation procedures, and business continuity for critical products.',
        },
      },
    },
    power_generation_fossil: {
      label: 'Power Generation - Fossil Fuel',
      modules: {
        process_control_and_stability: {
          weight: 4,
          help_text: 'Power plant control systems maintain stability and grid compliance. Assess DCS reliability, turbine controls, boiler controls, emissions controls, and operator interfaces.',
        },
        safety_and_control_systems: {
          weight: 4,
          help_text: 'Safety systems for boiler, turbine, and generator protection. Review emergency shutdown systems, fire protection for turbine hall and cable galleries, and H2 fire systems.',
        },
        natural_hazard_exposure_and_controls: {
          weight: 4,
          help_text: 'Power plants face exposure to natural hazards affecting supply reliability. Assess flood protection, cooling water intake protection, seismic bracing, and wind resistance.',
        },
        electrical_and_utilities_reliability: {
          weight: 5,
          help_text: 'Station auxiliary power critical for plant operation and safety. Evaluate backup generators, battery systems, blackstart capability, and loss of offsite power scenarios.',
        },
        process_safety_management: {
          weight: 3,
          help_text: 'Operations and maintenance management critical for power plants. Review outage management, switching procedures, lockout/tagout, and operational discipline.',
        },
        flammable_liquids_and_fire_risk: {
          weight: 3,
          help_text: 'Fuel oil and hydrogen systems present fire risks. Evaluate fuel oil storage protection, hydrogen system design, lube oil fire protection, and cable fire barriers.',
        },
        critical_equipment_reliability: {
          weight: 5,
          help_text: 'Turbine-generator and boiler reliability essential for availability. Review predictive maintenance, vibration monitoring, boiler tube management, and outage execution.',
        },
        high_energy_materials_control: {
          weight: 2,
          help_text: 'Limited high energy materials aside from hydrogen cooling. Assess hydrogen system design, purity monitoring, leak detection, and seal oil systems.',
        },
        high_energy_process_equipment: {
          weight: 4,
          help_text: 'High pressure/temperature boilers and steam turbines. Review boiler pressure parts integrity, turbine overspeed protection, and steam system safety valves.',
        },
        emergency_response_and_bcp: {
          weight: 4,
          help_text: 'Emergency preparedness for power plant incidents and grid stability. Evaluate fire brigade, emergency procedures, black start capability, and continuity planning.',
        },
      },
    },
    power_generation_renewable: {
      label: 'Power Generation - Renewable Energy',
      modules: {
        process_control_and_stability: {
          weight: 3,
          help_text: 'Renewable facilities require SCADA for monitoring and grid compliance. Assess control systems, remote monitoring, and inverter control for grid stability.',
        },
        safety_and_control_systems: {
          weight: 3,
          help_text: 'Safety systems appropriate for solar/wind installations. Review arc flash protection, electrical safety systems, fire detection in inverters/transformers, and emergency stops.',
        },
        natural_hazard_exposure_and_controls: {
          weight: 5,
          help_text: 'High exposure to weather for wind and solar installations. Assess wind resistance of turbines/panels, hail damage resistance, flood protection, and lightning protection.',
        },
        electrical_and_utilities_reliability: {
          weight: 4,
          help_text: 'Grid connection reliability important for renewable sites. Evaluate switchgear reliability, transformer condition, backup power for controls, and utility coordination.',
        },
        process_safety_management: {
          weight: 2,
          help_text: 'Operational management for renewable assets. Review maintenance procedures, contractor safety, electrical safe work practices, and climbing safety for wind.',
        },
        flammable_liquids_and_fire_risk: {
          weight: 2,
          help_text: 'Limited flammable materials in renewable facilities. Evaluate transformer oil protection, battery room fire protection, and electrical fire risks.',
        },
        critical_equipment_reliability: {
          weight: 4,
          help_text: 'Turbines, inverters, and electrical equipment must be reliable. Review preventive maintenance programs, condition monitoring, and spare parts strategy.',
        },
        high_energy_materials_control: {
          weight: 1,
          help_text: 'Minimal high energy materials hazard. Assess battery energy storage system (BESS) fire protection if present, and thermal runaway prevention.',
        },
        high_energy_process_equipment: {
          weight: 2,
          help_text: 'Limited high energy equipment compared to fossil plants. Review wind turbine overspeed protection, hydraulic systems, and high voltage electrical equipment.',
        },
        emergency_response_and_bcp: {
          weight: 3,
          help_text: 'Emergency response for electrical and turbine incidents. Evaluate emergency procedures, rescue plans for wind turbines, and business interruption considerations.',
        },
      },
    },
    food_beverage_processing: {
      label: 'Food & Beverage Processing',
      modules: {
        process_control_and_stability: {
          weight: 3,
          help_text: 'Process control for food safety and quality in cooking, pasteurization, refrigeration. Assess temperature controls, CCP monitoring, and process reliability.',
        },
        safety_and_control_systems: {
          weight: 3,
          help_text: 'Fire protection for food processing areas and storage. Review sprinkler systems, cold storage fire protection, ammonia refrigeration safety, and detection systems.',
        },
        natural_hazard_exposure_and_controls: {
          weight: 3,
          help_text: 'Natural hazard protection for food facilities. Evaluate flood protection for cold storage, wind resistance, and protection of refrigeration equipment.',
        },
        electrical_and_utilities_reliability: {
          weight: 4,
          help_text: 'Critical dependency on refrigeration and utilities for product integrity. Assess backup power for cold storage, refrigeration redundancy, and water supply reliability.',
        },
        process_safety_management: {
          weight: 3,
          help_text: 'Safety management integrated with food safety programs. Review ammonia PSM programs, lockout/tagout, hot work permits, and contractor management.',
        },
        flammable_liquids_and_fire_risk: {
          weight: 2,
          help_text: 'Limited flammables but combustible dust and packaging fires possible. Evaluate cooking oil fire protection, dust explosion prevention, and warehouse fire protection.',
        },
        critical_equipment_reliability: {
          weight: 4,
          help_text: 'Refrigeration systems, boilers, and process equipment reliability critical. Review ammonia refrigeration inspection, preventive maintenance, and equipment condition.',
        },
        high_energy_materials_control: {
          weight: 2,
          help_text: 'Ammonia refrigerant is primary hazard in food processing. Assess ammonia system design, leak detection, emergency ventilation, and emergency procedures.',
        },
        high_energy_process_equipment: {
          weight: 2,
          help_text: 'Limited high energy equipment aside from boilers and pressure vessels. Review boiler inspection programs, pressure relief, and steam system safety.',
        },
        emergency_response_and_bcp: {
          weight: 4,
          help_text: 'Business continuity critical for food supply chain. Evaluate ammonia emergency response, refrigeration failure procedures, and alternate production/storage arrangements.',
        },
      },
    },
    metal_manufacturing: {
      label: 'Metals Manufacturing / Fabrication',
      modules: {
        process_control_and_stability: {
          weight: 3,
          help_text: 'Process control for heat treatment, casting, forming operations. Assess furnace controls, molten metal handling procedures, and process monitoring.',
        },
        safety_and_control_systems: {
          weight: 3,
          help_text: 'Fire protection appropriate for metalworking operations. Review sprinkler systems, metal dust explosion protection, heat treatment area protection, and hot work controls.',
        },
        natural_hazard_exposure_and_controls: {
          weight: 3,
          help_text: 'Standard natural hazard considerations for manufacturing. Evaluate flood protection, earthquake bracing for heavy equipment, and building structural adequacy.',
        },
        electrical_and_utilities_reliability: {
          weight: 4,
          help_text: 'High electrical demand for furnaces, presses, machining equipment. Assess power quality, backup systems for critical processes, and utility failure procedures.',
        },
        process_safety_management: {
          weight: 3,
          help_text: 'Safety programs for metalworking operations. Review hot work permits, confined space entry, machine guarding, crane operations, and contractor safety.',
        },
        flammable_liquids_and_fire_risk: {
          weight: 3,
          help_text: 'Cutting fluids, hydraulic oils, and combustible metal dusts present fire risks. Evaluate housekeeping, dust collection systems, oil mist collection, and fire protection.',
        },
        critical_equipment_reliability: {
          weight: 4,
          help_text: 'Production equipment reliability important for operations. Review preventive maintenance for furnaces, presses, machining centers, and material handling equipment.',
        },
        high_energy_materials_control: {
          weight: 2,
          help_text: 'Combustible metal dusts (aluminum, magnesium) require controls. Assess dust explosion prevention, housekeeping, dust collector design, and emergency procedures.',
        },
        high_energy_process_equipment: {
          weight: 3,
          help_text: 'Molten metal, high pressure hydraulics, and furnaces present energy hazards. Review molten metal handling procedures, furnace safety systems, and press safety.',
        },
        emergency_response_and_bcp: {
          weight: 3,
          help_text: 'Emergency preparedness for metal fire and injuries. Evaluate emergency procedures, metal fire response (Class D), medical response, and recovery planning.',
        },
      },
    },
    automotive_assembly: {
      label: 'Automotive / Vehicle Assembly',
      modules: {
        process_control_and_stability: {
          weight: 2,
          help_text: 'Process control for assembly line operations and paint systems. Assess conveyor controls, robotic systems, paint line process control, and quality systems.',
        },
        safety_and_control_systems: {
          weight: 3,
          help_text: 'Fire protection for assembly, paint booths, and warehouse. Review sprinkler coverage, paint booth fire protection, warehouse storage protection, and detection systems.',
        },
        natural_hazard_exposure_and_controls: {
          weight: 3,
          help_text: 'Natural hazard considerations for large assembly facilities. Evaluate flood protection, roof integrity, and protection of high-value assembly lines and inventory.',
        },
        electrical_and_utilities_reliability: {
          weight: 3,
          help_text: 'Reliable utilities needed for continuous assembly operations. Assess power reliability, compressed air systems, cooling systems, and utility failure impacts.',
        },
        process_safety_management: {
          weight: 2,
          help_text: 'Safety management for manufacturing operations. Review lockout/tagout, confined space, robotic safety, hot work permits, and contractor management.',
        },
        flammable_liquids_and_fire_risk: {
          weight: 3,
          help_text: 'Paint solvents and finished vehicle fuel create fire risks. Evaluate paint storage and handling, paint booth protection, vehicle storage fire protection, and separation.',
        },
        critical_equipment_reliability: {
          weight: 3,
          help_text: 'Assembly line and paint equipment reliability important for production. Review preventive maintenance for conveyors, robotics, paint systems, and material handling.',
        },
        high_energy_materials_control: {
          weight: 1,
          help_text: 'Limited high energy materials hazards. Assess paint solvent handling, waste solvent management, and battery assembly safety (if EV production).',
        },
        high_energy_process_equipment: {
          weight: 2,
          help_text: 'Limited high energy equipment aside from presses and ovens. Review press safety systems, paint oven safety, and hydraulic system integrity.',
        },
        emergency_response_and_bcp: {
          weight: 3,
          help_text: 'Business continuity important for just-in-time manufacturing. Evaluate emergency procedures, evacuation plans, and recovery strategies for supply chain impacts.',
        },
      },
    },
    warehousing_distribution: {
      label: 'Warehousing / Distribution Center',
      modules: {
        process_control_and_stability: {
          weight: 2,
          help_text: 'Control systems for material handling automation. Assess warehouse management systems, automated storage/retrieval, conveyor controls, and sortation systems.',
        },
        safety_and_control_systems: {
          weight: 3,
          help_text: 'Fire protection critical for high-piled storage. Review sprinkler design adequacy for storage configuration, ESFR systems, detection, and fire department access.',
        },
        natural_hazard_exposure_and_controls: {
          weight: 4,
          help_text: 'Large roof areas vulnerable to wind, snow, and flood. Assess roof structural integrity, drainage adequacy, flood protection, and earthquake bracing for racks.',
        },
        electrical_and_utilities_reliability: {
          weight: 3,
          help_text: 'Reliable power needed for refrigerated storage and automation. Assess backup power for cold storage, fire pump reliability, and material handling power requirements.',
        },
        process_safety_management: {
          weight: 2,
          help_text: 'Safety management for warehouse operations. Review forklift safety, fall protection, material handling procedures, and contractor management.',
        },
        flammable_liquids_and_fire_risk: {
          weight: 3,
          help_text: 'Fire risk from commodity storage and packaging. Evaluate sprinkler adequacy, commodity classification, clear heights, warehouse housekeeping, and fire department capability.',
        },
        critical_equipment_reliability: {
          weight: 3,
          help_text: 'Material handling equipment reliability important for operations. Review preventive maintenance for forklifts, conveyors, sortation equipment, and dock equipment.',
        },
        high_energy_materials_control: {
          weight: 2,
          help_text: 'Hazardous materials storage requires segregation and controls. Assess hazmat storage compliance, aerosol storage protection, and incompatible material separation.',
        },
        high_energy_process_equipment: {
          weight: 1,
          help_text: 'Minimal high energy equipment in typical warehouse. Review battery charging areas, compressed air systems, and dock equipment.',
        },
        emergency_response_and_bcp: {
          weight: 4,
          help_text: 'Business continuity critical for distribution networks. Evaluate emergency procedures, large fire response capability, and alternate facility arrangements.',
        },
      },
    },
    data_center: {
      label: 'Data Center / Telecom',
      modules: {
        process_control_and_stability: {
          weight: 4,
          help_text: 'Building management and IT monitoring systems critical. Assess BMS reliability, environmental monitoring, capacity management, and change control procedures.',
        },
        safety_and_control_systems: {
          weight: 4,
          help_text: 'Specialized fire protection for data halls required. Review gaseous suppression systems (FM-200, Novec), VESDA smoke detection, electrical fire protection, and manual suppression.',
        },
        natural_hazard_exposure_and_controls: {
          weight: 4,
          help_text: 'Data centers require protection from natural hazards for uptime. Assess flood protection, earthquake bracing, wind resistance, and redundant utility feeds.',
        },
        electrical_and_utilities_reliability: {
          weight: 5,
          help_text: 'Electrical reliability paramount for data center operations. Evaluate UPS systems (N+1), generator redundancy, fuel supplies, automatic transfer switches, and utility feeds.',
        },
        process_safety_management: {
          weight: 2,
          help_text: 'Operational management for data center availability. Review change management, maintenance procedures, hot work controls, and contractor management.',
        },
        flammable_liquids_and_fire_risk: {
          weight: 2,
          help_text: 'Limited flammable materials but cable fire risk. Evaluate cable fire barriers, generator fuel storage protection, and UPS battery fire protection.',
        },
        critical_equipment_reliability: {
          weight: 5,
          help_text: 'Cooling and power equipment must be highly reliable. Review HVAC redundancy (N+1), chiller maintenance, CRAC unit condition, and preventive maintenance programs.',
        },
        high_energy_materials_control: {
          weight: 1,
          help_text: 'Minimal chemical hazards aside from batteries and refrigerants. Assess battery room fire protection, refrigerant leak detection, and gaseous suppression agent safety.',
        },
        high_energy_process_equipment: {
          weight: 2,
          help_text: 'Limited high energy equipment. Review chiller safety systems, compressed air quality, and high voltage electrical safety.',
        },
        emergency_response_and_bcp: {
          weight: 5,
          help_text: 'Business continuity essential for data center customers. Evaluate failover capabilities, backup sites, emergency procedures, and SLA compliance strategies.',
        },
      },
    },
    healthcare_facility: {
      label: 'Healthcare / Hospital',
      modules: {
        process_control_and_stability: {
          weight: 3,
          help_text: 'Building automation for HVAC, medical gas, and life safety systems. Assess BMS reliability, medical gas monitoring, pressure monitoring for isolation rooms, and alarms.',
        },
        safety_and_control_systems: {
          weight: 4,
          help_text: 'Life safety systems critical for patient safety. Review sprinkler systems, smoke compartmentation, medical gas shutoffs, emergency lighting, and egress systems.',
        },
        natural_hazard_exposure_and_controls: {
          weight: 4,
          help_text: 'Hospitals must remain operational during disasters. Assess flood protection, seismic nonstructural bracing, backup systems, and shelter-in-place capabilities.',
        },
        electrical_and_utilities_reliability: {
          weight: 5,
          help_text: 'Reliable power essential for patient care. Evaluate emergency generators, automatic transfer switches, fuel supply for extended outages, and critical systems identification.',
        },
        process_safety_management: {
          weight: 3,
          help_text: 'Safety management for healthcare operations. Review medical gas safety, infection control construction, hot work in occupied buildings, and contractor management.',
        },
        flammable_liquids_and_fire_risk: {
          weight: 2,
          help_text: 'Limited flammables but life safety critical. Evaluate medical gas storage, flammable storage rooms, laboratory chemical storage, and compartmentation.',
        },
        critical_equipment_reliability: {
          weight: 4,
          help_text: 'Critical HVAC, medical gas, and emergency systems must be reliable. Review preventive maintenance for generators, chillers, boilers, medical gas systems, and elevators.',
        },
        high_energy_materials_control: {
          weight: 2,
          help_text: 'Medical gases, ethylene oxide sterilization may be present. Assess medical gas safety programs, EtO safety systems if applicable, and laboratory chemical controls.',
        },
        high_energy_process_equipment: {
          weight: 2,
          help_text: 'Limited high energy equipment. Review boiler/steam systems, medical gas bulk systems, MRI quench systems, and hyperbaric chambers if present.',
        },
        emergency_response_and_bcp: {
          weight: 5,
          help_text: 'Hospitals must maintain operations during emergencies. Evaluate emergency operations plan, evacuation/defend in place procedures, surge capacity, and continuity of operations.',
        },
      },
    },
    office_commercial: {
      label: 'Office / Commercial Building',
      modules: {
        process_control_and_stability: {
          weight: 2,
          help_text: 'Building management systems for comfort and safety. Assess HVAC controls, lighting controls, access control systems, and building automation reliability.',
        },
        safety_and_control_systems: {
          weight: 3,
          help_text: 'Standard commercial fire protection and life safety. Review sprinkler system adequacy, fire alarm system, emergency lighting, egress signage, and elevator recall.',
        },
        natural_hazard_exposure_and_controls: {
          weight: 3,
          help_text: 'Building protection against natural hazards. Evaluate flood protection, window/cladding wind resistance, seismic nonstructural bracing, and roof integrity.',
        },
        electrical_and_utilities_reliability: {
          weight: 3,
          help_text: 'Reliable utilities for tenant comfort and business operations. Assess backup power for life safety and critical systems, utility coordination, and outage procedures.',
        },
        process_safety_management: {
          weight: 2,
          help_text: 'Building operations and maintenance management. Review preventive maintenance programs, contractor management, hot work permits, and tenant safety.',
        },
        flammable_liquids_and_fire_risk: {
          weight: 2,
          help_text: 'Limited fire risk in office occupancy. Evaluate combustible contents, file room protection, equipment room fire protection, and housekeeping.',
        },
        critical_equipment_reliability: {
          weight: 3,
          help_text: 'Building systems reliability for tenant satisfaction. Review HVAC maintenance, elevator maintenance, fire pump testing, and emergency generator testing.',
        },
        high_energy_materials_control: {
          weight: 1,
          help_text: 'Minimal hazardous materials in office setting. Assess janitorial chemical storage, backup generator fuel, and refrigerant management.',
        },
        high_energy_process_equipment: {
          weight: 1,
          help_text: 'Limited high energy equipment. Review boiler systems, emergency generator, and building electrical equipment.',
        },
        emergency_response_and_bcp: {
          weight: 3,
          help_text: 'Emergency preparedness for building occupants. Evaluate fire evacuation procedures, floor warden training, shelter-in-place plans, and tenant continuity.',
        },
      },
    },
  },
};

export const HRG_CANONICAL_KEYS = HRG_MASTER_MAP.meta.module_keys;

export interface HrgConfig {
  weight: number;
  helpText: string;
}

export function getHrgConfig(
  industryKey: string | null,
  canonicalKey: string
): HrgConfig {
  const defaultWeight = HRG_MASTER_MAP.meta.default_weight;

  if (!industryKey || !HRG_MASTER_MAP.industries[industryKey]) {
    return {
      weight: defaultWeight,
      helpText: 'No industry selected. Please select an industry classification in RE-1 Document Control.',
    };
  }

  const industry = HRG_MASTER_MAP.industries[industryKey];
  const moduleConfig = industry.modules[canonicalKey];

  if (!moduleConfig) {
    return {
      weight: defaultWeight,
      helpText: 'No configuration available for this risk factor.',
    };
  }

  let weight = moduleConfig.weight;

  if (typeof weight !== 'number' || weight < 1 || weight > 5) {
    console.warn(`Invalid weight ${weight} for ${canonicalKey}, using default ${defaultWeight}`);
    weight = defaultWeight;
  }

  return {
    weight,
    helpText: moduleConfig.help_text || '',
  };
}

export function humanizeCanonicalKey(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function humanizeIndustryKey(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
