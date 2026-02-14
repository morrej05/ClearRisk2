/*
  # Seed Recommendation Templates - Starter Set

  1. Purpose
    - Bootstrap recommendation_templates with 20+ common Risk Engineering recommendations
    - Provides immediate value for RE assessments (RE04, RE06, RE09, etc.)
    - All templates set to is_active=true by default

  2. Categories Used (matching schema CHECK constraint):
    - Construction
    - Management Systems
    - Fire Protection & Detection
    - Special Hazards
    - Business Continuity

  3. Template Structure
    - code: Unique identifier (e.g., RE09-001)
    - title: Short heading
    - body: Legacy combined field (observation + action for backward compatibility)
    - observation: What was observed
    - action_required: Specific corrective action
    - hazard_risk_description: Neutral risk statement (no insurer/client language)
    - category: Grouping for filtering (matches schema constraint)
    - default_priority: 1=Critical, 2=High, 3=Medium, 4=Low, 5=Lowest
    - related_module_key: RE04, RE06, RE09, etc.
    - is_active: true (all templates active)
    - scope: 'global' (available to all orgs)
*/

-- Insert starter recommendation templates
INSERT INTO recommendation_templates (
  code,
  title,
  body,
  observation,
  action_required,
  hazard_risk_description,
  client_response_prompt,
  category,
  default_priority,
  related_module_key,
  trigger_type,
  is_active,
  scope
) VALUES

-- Management Systems
(
  'RE09-001',
  'Hot Work Controls',
  'Hot work controls are not consistently applied and authorisation is not always evidenced. Implement a formal hot work permit system with clear roles, checks, and sign-off procedures.',
  'Hot work controls are not consistently applied and authorisation is not always evidenced.',
  'Implement a formal hot work permit system with clear roles, checks, and sign-off procedures. Retain all permit records.',
  'Weak hot work governance increases the likelihood of ignition during maintenance activities. A fire starting during hot work can develop rapidly and exceed first-aid firefighting capability, increasing damage extent and downtime. Strong permit controls reduce both the likelihood and impact of hot work-related incidents.',
  'Provide evidence of implemented hot work permit system including sample permits and training records.',
  'Management Systems',
  2,
  'RE09',
  'manual',
  true,
  'global'
),
(
  'RE09-002',
  'Emergency Response Plan',
  'The site emergency response plan has not been reviewed or tested in the last 12 months. Review and update the plan annually and conduct regular drills.',
  'The site emergency response plan has not been reviewed or tested in the last 12 months.',
  'Review and update the emergency response plan annually. Conduct regular drills and document findings. Ensure all personnel are trained on emergency procedures.',
  'Outdated emergency plans may not reflect current site conditions, staffing levels, or hazards. Untested procedures increase the time to effective response during an incident, potentially increasing casualty rates and asset damage.',
  'Provide updated emergency response plan dated within the last 12 months and drill records.',
  'Management Systems',
  2,
  'RE09',
  'manual',
  true,
  'global'
),
(
  'RE09-003',
  'Contractor Management',
  'Contractor induction and supervision processes do not adequately address site-specific hazards. Develop comprehensive contractor induction program.',
  'Contractor induction and supervision processes do not adequately address site-specific hazards.',
  'Develop comprehensive contractor induction program covering site hazards, emergency procedures, and permit requirements. Implement contractor competency verification and supervision procedures.',
  'Inadequately briefed contractors may introduce ignition sources, compromise fire protection systems, or respond inappropriately during emergencies. This increases both the likelihood of incidents and the potential severity of outcomes.',
  'Provide contractor induction materials and competency verification records.',
  'Management Systems',
  2,
  'RE09',
  'manual',
  true,
  'global'
),
(
  'RE09-004',
  'Fire Brigade Access',
  'Fire brigade access routes are obstructed by parked vehicles and stored materials. Establish and mark designated fire brigade access routes.',
  'Fire brigade access routes are obstructed by parked vehicles and stored materials.',
  'Establish and mark designated fire brigade access routes. Implement vehicle parking controls and ensure access routes remain clear at all times. Conduct monthly access route inspections.',
  'Delayed fire brigade access extends the time between ignition and effective suppression, allowing fires to develop beyond single-compartment involvement. This increases damage extent and reduces the probability of business continuity.',
  'Provide site plan showing designated fire brigade access routes and enforcement procedures.',
  'Management Systems',
  2,
  'RE09',
  'manual',
  true,
  'global'
),
(
  'RE09-005',
  'Assembly Point Safety',
  'Emergency assembly points are located too close to buildings. Relocate to positions at least 50 meters from buildings.',
  'Emergency assembly points are located too close to buildings, in areas potentially affected by fire, smoke, or structural collapse.',
  'Relocate emergency assembly points to positions at least 50 meters from buildings and clear of potential collapse zones. Ensure assembly areas have adequate capacity and protection from weather.',
  'Assembly points in hazardous locations may require secondary evacuation during incidents, creating confusion and delaying accountability. This increases life safety risk during emergencies.',
  'Provide site plan showing relocated assembly points and signage installation confirmation.',
  'Management Systems',
  2,
  'RE09',
  'manual',
  true,
  'global'
),

-- Fire Protection & Detection
(
  'RE04-001',
  'Sprinkler Impairment Procedure',
  'Procedures for managing sprinkler system impairments are not documented or consistently followed. Develop and implement a formal sprinkler impairment procedure.',
  'Procedures for managing sprinkler system impairments are not documented or consistently followed.',
  'Develop and implement a formal sprinkler impairment procedure including notification requirements, enhanced surveillance, and approval/authorization processes. Maintain impairment logs.',
  'Unmanaged sprinkler impairments create windows of vulnerability where fire protection is degraded or absent. A fire during an impairment period can develop unchecked, dramatically increasing potential damage and business interruption.',
  'Provide documented impairment procedure and example impairment notification records.',
  'Fire Protection & Detection',
  1,
  'RE04',
  'manual',
  true,
  'global'
),
(
  'RE04-002',
  'Sprinkler Coverage Gaps',
  'Sprinkler coverage is incomplete in areas containing combustible storage and ignition hazards. Extend sprinkler protection to all at-risk areas.',
  'Sprinkler coverage is incomplete in areas containing combustible storage and ignition hazards.',
  'Extend sprinkler protection to all areas with combustible storage, processing equipment, or significant ignition sources. Ensure sprinkler design meets current loading and hazard levels.',
  'Unsprinklered areas with combustible materials allow fires to develop beyond manual firefighting capability before suppression can be achieved. This increases the maximum foreseeable loss and extends business interruption duration.',
  'Provide plans showing extended sprinkler coverage with installation completion date.',
  'Fire Protection & Detection',
  1,
  'RE04',
  'manual',
  true,
  'global'
),
(
  'RE04-003',
  'Fire Alarm Testing',
  'Fire alarm system testing and inspection records are incomplete or overdue. Establish quarterly fire alarm testing program.',
  'Fire alarm system testing and inspection records are incomplete or overdue.',
  'Establish quarterly fire alarm testing program covering all zones, devices, and alarm sequences. Maintain comprehensive test records and address deficiencies promptly.',
  'Unreliable fire alarm systems may fail to detect fires early, delaying occupant notification and emergency response. Detection delays increase evacuation risk and allow fires to develop, increasing potential damage severity.',
  'Provide fire alarm test records covering the last 12 months.',
  'Fire Protection & Detection',
  2,
  'RE04',
  'manual',
  true,
  'global'
),
(
  'RE04-004',
  'Fire Extinguisher Maintenance',
  'Portable fire extinguisher inspection tags indicate overdue annual maintenance. Schedule and complete annual maintenance for all extinguishers.',
  'Portable fire extinguisher inspection tags indicate overdue annual maintenance.',
  'Schedule and complete annual maintenance for all portable fire extinguishers. Implement monthly visual inspection program and document checks.',
  'Unmaintained extinguishers may not function when needed for incipient fire response. Early firefighting failures allow fires to grow beyond manual control, increasing damage and evacuation urgency.',
  'Provide current fire extinguisher maintenance records.',
  'Fire Protection & Detection',
  3,
  'RE04',
  'manual',
  true,
  'global'
),
(
  'RE06-001',
  'Emergency Generator Testing',
  'Emergency generator testing records indicate irregular testing or unresolved defects. Establish monthly load testing program.',
  'Emergency generator testing records indicate irregular testing or unresolved defects.',
  'Establish monthly emergency generator load testing program. Address all defects promptly and maintain comprehensive test records including load transfer and runtime.',
  'Unreliable emergency generators may fail during utility outages, leaving critical systems (fire pumps, alarms, emergency lighting) without power. This compounds incident severity by degrading detection, notification, and suppression capabilities during emergencies.',
  'Provide emergency generator test records covering the last 12 months.',
  'Fire Protection & Detection',
  2,
  'RE06',
  'manual',
  true,
  'global'
),
(
  'RE06-002',
  'Water Supply Reliability',
  'Fire water supply is dependent on a single source without backup or redundancy. Establish secondary water supply or supplementary storage.',
  'Fire water supply is dependent on a single source without backup or redundancy.',
  'Establish secondary water supply or supplementary storage to ensure reliable fire protection water during primary supply disruptions. Consider fire pump arrangements that can utilize multiple sources.',
  'Single-source water supplies create vulnerability to supply interruptions. A fire during a water supply outage encounters no effective suppression, resulting in total loss scenarios rather than contained damage.',
  'Provide secondary water supply installation plan with completion timeline.',
  'Fire Protection & Detection',
  1,
  'RE06',
  'manual',
  true,
  'global'
),

-- Construction
(
  'RE02-001',
  'Combustible Cladding',
  'External wall cladding contains combustible panels or insulation materials. Replace with non-combustible alternatives.',
  'External wall cladding contains combustible panels or insulation materials.',
  'Replace combustible cladding with non-combustible alternatives. Where immediate replacement is not feasible, implement interim risk controls including enhanced fire watch, sprinkler protection at cladding interfaces, and hot work restrictions.',
  'Combustible cladding provides a vertical fire path enabling rapid external fire spread. This can compromise evacuation routes, create multiple simultaneous fire floors, and result in total building loss rather than contained single-floor damage.',
  'Provide cladding replacement plan with timeline or interim protection measures.',
  'Construction',
  1,
  'RE02',
  'manual',
  true,
  'global'
),
(
  'RE02-002',
  'Fire Door Defects',
  'Multiple fire doors are wedged open, damaged, or have defective self-closing devices. Remove wedges and repair all fire doors immediately.',
  'Multiple fire doors are wedged open, damaged, or have defective self-closing devices.',
  'Immediately remove wedges and obstructions from fire doors. Repair or replace damaged doors and self-closing devices. Implement inspection and maintenance program for all fire-rated doors.',
  'Compromised fire doors allow fire and smoke to spread rapidly between compartments, reducing available safe egress time and allowing fires to involve larger areas before suppression. This increases both life safety risk and property damage potential.',
  'Provide fire door inspection and repair completion records.',
  'Construction',
  2,
  'RE02',
  'manual',
  true,
  'global'
),
(
  'RE02-003',
  'Fire Compartmentation Breaches',
  'Fire-rated walls and floors have unsealed penetrations for cables, pipes, and services. Survey and seal all breaches with rated fire-stopping.',
  'Fire-rated walls and floors have unsealed penetrations for cables, pipes, and services.',
  'Survey and seal all fire compartmentation breaches with appropriately rated fire-stopping materials. Implement procedures requiring fire-stopping sign-off before any new penetration is closed out.',
  'Unsealed penetrations allow fire and smoke to bypass fire compartmentation, reducing fire resistance duration and enabling rapid spread to adjacent compartments. This increases maximum damage potential and reduces available evacuation time.',
  'Provide compartmentation breach survey and fire-stopping completion records.',
  'Construction',
  2,
  'RE02',
  'manual',
  true,
  'global'
),
(
  'RE03-001',
  'Housekeeping Standards',
  'Housekeeping standards are poor with accumulations of combustible waste and packaging materials. Implement daily housekeeping program.',
  'Housekeeping standards are poor with accumulations of combustible waste and packaging materials.',
  'Implement daily housekeeping program with assigned responsibilities. Provide adequate waste containers and establish regular waste removal schedules. Conduct weekly housekeeping inspections.',
  'Poor housekeeping increases fuel loading and provides ignition sources with readily available fuel. This increases both fire ignition frequency and fire development speed, reducing the time available for detection and manual suppression.',
  'Provide housekeeping procedure and inspection records demonstrating sustained improvement.',
  'Construction',
  2,
  'RE03',
  'manual',
  true,
  'global'
),
(
  'RE03-002',
  'High-Piled Storage Protection',
  'Storage heights exceed sprinkler design parameters without enhanced protection. Reduce heights or upgrade sprinkler system.',
  'Storage heights exceed sprinkler design parameters without enhanced protection.',
  'Reduce storage heights to match sprinkler design limits or upgrade sprinkler system to address current storage configuration. Implement storage height monitoring and enforcement procedures.',
  'Storage exceeding sprinkler design height prevents effective water penetration and cooling. Fires in over-height storage can develop shielded from suppression, resulting in total rack involvement and significantly increased damage compared to properly protected storage.',
  'Provide storage height compliance program or sprinkler upgrade completion timeline.',
  'Construction',
  1,
  'RE03',
  'manual',
  true,
  'global'
),

-- Special Hazards
(
  'RE05-001',
  'External Fire Exposure',
  'Separation distance between buildings is insufficient to prevent fire spread. Increase separation or install fire-rated walls.',
  'Separation distance between buildings is insufficient to prevent fire spread via radiation and convection.',
  'Increase separation distance between buildings, install fire-rated walls, or provide fixed water curtain protection at exposed interfaces. Ensure combustible materials are not stored in external exposure zones.',
  'Inadequate separation allows fire in one building to ignite adjacent structures before suppression can be achieved. This escalates single-building fires into multiple-building conflagrations, dramatically increasing total property damage and business interruption duration.',
  'Provide separation improvement plan or exposure protection measures with completion timeline.',
  'Special Hazards',
  1,
  'RE05',
  'manual',
  true,
  'global'
),
(
  'RE05-002',
  'Combustible Storage Near Buildings',
  'Combustible materials, waste containers, and pallets are stored against external walls. Establish 10-meter clear zone around all buildings.',
  'Combustible materials, waste containers, and pallets are stored against external walls.',
  'Establish 10-meter clear zone around all buildings. Relocate all combustible storage, waste containers, and staging areas away from external walls. Implement housekeeping procedures to maintain clearance.',
  'External combustible storage provides a fire exposure mechanism that can breach external walls or enter buildings through openings. This converts minor external fires into building fires, increasing damage severity and threatening business continuity.',
  'Provide photographic evidence of cleared external zones.',
  'Special Hazards',
  2,
  'RE05',
  'manual',
  true,
  'global'
),
(
  'RE10-001',
  'Electrical Equipment Maintenance',
  'Electrical equipment shows signs of overheating, damage, or poor maintenance. Conduct thermographic survey and address defects immediately.',
  'Electrical equipment shows signs of overheating, damage, or poor maintenance.',
  'Conduct thermographic survey of electrical distribution systems. Address identified defects immediately. Establish preventive maintenance program for electrical systems.',
  'Deteriorating electrical equipment is a leading ignition source. Electrical fires often start in concealed locations and can develop undetected, involving switchgear and distribution systems critical for emergency response.',
  'Provide thermographic survey report and remediation completion records.',
  'Special Hazards',
  2,
  'RE10',
  'manual',
  true,
  'global'
),
(
  'RE10-002',
  'Process Equipment Ignition Controls',
  'Process equipment capable of generating ignition sources lacks adequate protection or isolation from combustible materials.',
  'Process equipment capable of generating ignition sources lacks adequate protection or isolation from combustible materials.',
  'Install guarding, separation, or suppression systems to isolate ignition sources from combustible materials. Implement process monitoring and automatic shutdown systems where appropriate.',
  'Uncontrolled ignition sources in proximity to combustible materials create high-frequency fire scenarios. Process fires can escalate rapidly and may involve hazardous materials, increasing both property damage and business interruption duration.',
  'Provide ignition source control implementation plan with completion timeline.',
  'Special Hazards',
  1,
  'RE10',
  'manual',
  true,
  'global'
)

ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  observation = EXCLUDED.observation,
  action_required = EXCLUDED.action_required,
  hazard_risk_description = EXCLUDED.hazard_risk_description,
  client_response_prompt = EXCLUDED.client_response_prompt,
  category = EXCLUDED.category,
  default_priority = EXCLUDED.default_priority,
  related_module_key = EXCLUDED.related_module_key,
  trigger_type = EXCLUDED.trigger_type,
  is_active = EXCLUDED.is_active,
  scope = EXCLUDED.scope,
  updated_at = now();

COMMENT ON TABLE recommendation_templates IS 'Seeded with 20 common Risk Engineering recommendation templates covering Management Systems, Fire Protection & Detection, Construction, and Special Hazards.';
