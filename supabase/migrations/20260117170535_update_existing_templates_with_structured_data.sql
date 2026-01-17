/*
  # Update Existing Templates with Structured Data

  Updates all existing recommendation templates to use the new structured format:
  - hazard: Brief identification of the hazard/issue
  - description: Observation about the current state
  - action: Recommended action to address the issue
  
  This migration restructures the existing title/body data into the new format.
*/

-- Management Systems recommendations
UPDATE recommendation_templates SET
  hazard = 'Loss Prevention Programme',
  description = 'Management commitment to loss prevention could be enhanced through a more formal and structured approach.',
  action = 'Implement a formal risk management programme with documented procedures, regular reviews, and clear accountability structures to demonstrate commitment to loss prevention.',
  source_ref = 'Template MS-001'
WHERE code = 'MS-001';

UPDATE recommendation_templates SET
  hazard = 'Hot Work Controls',
  description = 'Hot work activities present ignition risks during maintenance and operational activities.',
  action = 'Implement a formal hot work permit system with pre-work inspections, fire watch procedures, and post-work monitoring to reduce ignition risks.',
  source_ref = 'Template MS-002'
WHERE code = 'MS-002';

UPDATE recommendation_templates SET
  hazard = 'Electrical Maintenance',
  description = 'Electrical systems require regular maintenance to prevent failures that could lead to fire.',
  action = 'Upgrade electrical maintenance programme to include thermal imaging surveys, regular testing by qualified electricians, and immediate remediation of identified defects.',
  source_ref = 'Template MS-003'
WHERE code = 'MS-003';

UPDATE recommendation_templates SET
  hazard = 'General Maintenance',
  description = 'General maintenance standards impact overall fire safety and property condition.',
  action = 'Develop and implement a comprehensive maintenance programme with scheduled inspections, preventive maintenance tasks, and prompt repairs to maintain property condition and reduce fire risk.',
  source_ref = 'Template MS-004'
WHERE code = 'MS-004';

UPDATE recommendation_templates SET
  hazard = 'Smoking Controls',
  description = 'Smoking activities can create ignition risks if not properly controlled and managed.',
  action = 'Strengthen smoking controls by designating safe smoking areas away from combustible materials, providing proper disposal receptacles, and enforcing no-smoking policies in high-risk zones.',
  source_ref = 'Template MS-005'
WHERE code = 'MS-005';

UPDATE recommendation_templates SET
  hazard = 'Housekeeping Standards',
  description = 'Poor housekeeping can increase fire risk through accumulation of combustible materials and inadequate separation from ignition sources.',
  action = 'Improve housekeeping standards by implementing regular cleaning schedules, proper waste management, and clear storage procedures that maintain adequate separation from ignition sources.',
  source_ref = 'Template MS-006'
WHERE code = 'MS-006';

UPDATE recommendation_templates SET
  hazard = 'Self-Inspection Programme',
  description = 'Regular self-inspections are needed to proactively identify and address fire safety deficiencies.',
  action = 'Establish a structured self-inspection programme with trained personnel, documented checklists, and corrective action tracking.',
  source_ref = 'Template MS-007'
WHERE code = 'MS-007';

UPDATE recommendation_templates SET
  hazard = 'Change Management',
  description = 'Changes to operations, processes, or facilities can introduce new fire safety risks if not properly assessed.',
  action = 'Implement a formal change management process requiring risk assessment for all operational, process, or facility changes to ensure fire safety implications are identified and mitigated before implementation.',
  source_ref = 'Template MS-008'
WHERE code = 'MS-008';

UPDATE recommendation_templates SET
  hazard = 'Contractor Controls',
  description = 'Contractor activities can introduce fire risks if not properly controlled and supervised.',
  action = 'Strengthen contractor control procedures by requiring site inductions, hot work permits, supervision during high-risk activities, and verification of contractor insurance and qualifications.',
  source_ref = 'Template MS-009'
WHERE code = 'MS-009';

UPDATE recommendation_templates SET
  hazard = 'Emergency Response',
  description = 'Emergency response capability requires ongoing development and testing to ensure effectiveness.',
  action = 'Enhance emergency response by developing site-specific emergency plans, conducting regular drills, training response teams, and establishing clear communication protocols with emergency services.',
  source_ref = 'Template MS-010'
WHERE code = 'MS-010';

-- Fire Protection & Detection recommendations
UPDATE recommendation_templates SET
  hazard = 'Fire Equipment Testing',
  description = 'Fire protection and detection equipment requires regular testing and maintenance to remain operational.',
  action = 'Establish a comprehensive fire equipment testing and maintenance programme with documented schedules, qualified personnel, and regular third-party verification.',
  source_ref = 'Template FP-001'
WHERE code = 'FP-001';

UPDATE recommendation_templates SET
  hazard = 'System Impairment Handling',
  description = 'Fire protection system impairments can significantly increase fire risk if not properly managed.',
  action = 'Develop a formal impairment handling programme requiring notification to insurers, implementation of compensatory measures, expedited restoration timelines, and documented tracking of all system outages.',
  source_ref = 'Template FP-002'
WHERE code = 'FP-002';

UPDATE recommendation_templates SET
  hazard = 'Fire Detection Coverage',
  description = 'Fire detection coverage should provide early warning across all occupied and high-risk areas.',
  action = 'Upgrade fire detection coverage to ensure early warning in line with recognised standards such as BS 5839 or equivalent, with appropriate detector types for the hazards present.',
  source_ref = 'Template FP-003'
WHERE code = 'FP-003';

UPDATE recommendation_templates SET
  hazard = 'Fire Hydrant Provision',
  description = 'Fire hydrant provision and accessibility impacts firefighting capability.',
  action = 'Improve fire hydrant provision by installing additional hydrants to achieve adequate coverage, ensuring clear access routes, implementing regular flow testing, and addressing any defects identified.',
  source_ref = 'Template FP-004'
WHERE code = 'FP-004';

UPDATE recommendation_templates SET
  hazard = 'Water Supply for Firefighting',
  description = 'Water supply reliability is critical for effective firefighting operations.',
  action = 'Enhance water supply by upgrading infrastructure, installing additional storage capacity, ensuring adequate flow rates and pressures, and implementing regular testing and maintenance.',
  source_ref = 'Template FP-005'
WHERE code = 'FP-005';

UPDATE recommendation_templates SET
  hazard = 'Fire Protection System Adequacy',
  description = 'Fire protection systems should provide adequate coverage levels in line with the risk profile.',
  action = 'Upgrade fire protection systems by installing or extending automatic sprinkler protection to cover high-value and high-risk areas, ensuring compliance with recognised standards.',
  source_ref = 'Template FP-006'
WHERE code = 'FP-006';

UPDATE recommendation_templates SET
  hazard = 'Water Supply Reliability',
  description = 'Reliable water supply is essential for firefighting operations and automatic fire protection systems.',
  action = 'Improve water supply reliability by upgrading mains connections, installing additional storage tanks or pumps, ensuring adequate flow rates and pressures, and implementing regular flow testing and maintenance.',
  source_ref = 'Template FP-007'
WHERE code = 'FP-007';

-- Construction recommendations
UPDATE recommendation_templates SET
  hazard = 'Fire Compartmentation',
  description = 'Fire compartmentation limits fire spread and protects escape routes and property.',
  action = 'Improve fire compartmentation by sealing penetrations, upgrading fire-rated doors, and ensuring compartment boundaries are maintained to prevent fire and smoke spread.',
  source_ref = 'Template CO-001'
WHERE code = 'CO-001';

UPDATE recommendation_templates SET
  hazard = 'Building Construction',
  description = 'Building construction type and materials impact fire resistance and spread characteristics.',
  action = 'Address construction deficiencies by upgrading fire-resistant materials, improving structural fire protection, and ensuring construction meets current fire safety standards.',
  source_ref = 'Template CO-002'
WHERE code = 'CO-002';

-- Special Hazards recommendations
UPDATE recommendation_templates SET
  hazard = 'Process Fire Risk',
  description = 'Specific process hazards require targeted risk control measures.',
  action = 'Implement process-specific fire risk controls including equipment upgrades, procedural safeguards, monitoring systems, and emergency response procedures.',
  source_ref = 'Template SH-001'
WHERE code = 'SH-001';

-- Business Continuity recommendations
UPDATE recommendation_templates SET
  hazard = 'Business Continuity Planning',
  description = 'Business continuity planning ensures resilience and recovery capability following a fire incident.',
  action = 'Develop and implement a comprehensive business continuity plan including alternative premises arrangements, data backup and recovery, supply chain continuity, and regular testing.',
  source_ref = 'Template BC-001'
WHERE code = 'BC-001';
