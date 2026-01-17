/*
  # Seed Recommendation Templates (Clean Schema)

  Seeds the recommendation_templates table with structured recommendations:
  - Hazard identification
  - Observation (description)
  - Recommended action
  - Category assignment
  - Default priority

  All recommendations use the clean schema format:
  - hazard: Short identification
  - description: Observation details  
  - action: Recommended action
  - category: One of 5 categories
  - default_priority: 1-5 (3=medium, 4=high, 5=critical)
  - is_active: true
  - scope: global
*/

-- Clear existing data
TRUNCATE TABLE recommendation_templates CASCADE;

-- Management Systems recommendations
INSERT INTO recommendation_templates (hazard, description, action, category, default_priority, is_active, scope, client_response_prompt)
VALUES
  ('Loss Prevention Programme', 'Management commitment to loss prevention could be enhanced through a more formal and structured approach.', 'Implement a formal risk management programme with documented procedures, regular reviews, and clear accountability structures to demonstrate commitment to loss prevention.', 'Management Systems', 3, true, 'global', null),
  
  ('Hot Work Controls', 'Hot work activities present ignition risks during maintenance and operational activities.', 'Implement a formal hot work permit system with pre-work inspections, fire watch procedures, and post-work monitoring to reduce ignition risks.', 'Management Systems', 4, true, 'global', null),
  
  ('Electrical Maintenance', 'Electrical systems require regular maintenance to prevent failures that could lead to fire.', 'Upgrade electrical maintenance programme to include thermal imaging surveys, regular testing by qualified electricians, and immediate remediation of identified defects.', 'Management Systems', 3, true, 'global', null),
  
  ('General Maintenance', 'General maintenance standards impact overall fire safety and property condition.', 'Develop and implement a comprehensive maintenance programme with scheduled inspections, preventive maintenance tasks, and prompt repairs to maintain property condition and reduce fire risk.', 'Management Systems', 3, true, 'global', null),
  
  ('Smoking Controls', 'Smoking activities can create ignition risks if not properly controlled and managed.', 'Strengthen smoking controls by designating safe smoking areas away from combustible materials, providing proper disposal receptacles, and enforcing no-smoking policies in high-risk zones.', 'Management Systems', 3, true, 'global', null),
  
  ('Housekeeping Standards', 'Poor housekeeping can increase fire risk through accumulation of combustible materials and inadequate separation from ignition sources.', 'Improve housekeeping standards by implementing regular cleaning schedules, proper waste management, and clear storage procedures that maintain adequate separation from ignition sources.', 'Management Systems', 3, true, 'global', null),
  
  ('Self-Inspection Programme', 'Regular self-inspections are needed to proactively identify and address fire safety deficiencies.', 'Establish a structured self-inspection programme with trained personnel, documented checklists, and corrective action tracking.', 'Management Systems', 3, true, 'global', null),
  
  ('Change Management', 'Changes to operations, processes, or facilities can introduce new fire safety risks if not properly assessed.', 'Implement a formal change management process requiring risk assessment for all operational, process, or facility changes to ensure fire safety implications are identified and mitigated before implementation.', 'Management Systems', 3, true, 'global', null),
  
  ('Contractor Controls', 'Contractor activities can introduce fire risks if not properly controlled and supervised.', 'Strengthen contractor control procedures by requiring site inductions, hot work permits, supervision during high-risk activities, and verification of contractor insurance and qualifications.', 'Management Systems', 3, true, 'global', null),
  
  ('Emergency Response', 'Emergency response capability requires ongoing development and testing to ensure effectiveness.', 'Enhance emergency response by developing site-specific emergency plans, conducting regular drills, training response teams, and establishing clear communication protocols with emergency services.', 'Management Systems', 4, true, 'global', null);

-- Fire Protection & Detection recommendations
INSERT INTO recommendation_templates (hazard, description, action, category, default_priority, is_active, scope, client_response_prompt)
VALUES
  ('Fire Equipment Testing', 'Fire protection and detection equipment requires regular testing and maintenance to remain operational.', 'Establish a comprehensive fire equipment testing and maintenance programme with documented schedules, qualified personnel, and regular third-party verification.', 'Fire Protection & Detection', 4, true, 'global', null),
  
  ('System Impairment Handling', 'Fire protection system impairments can significantly increase fire risk if not properly managed.', 'Develop a formal impairment handling programme requiring notification to insurers, implementation of compensatory measures, expedited restoration timelines, and documented tracking of all system outages.', 'Fire Protection & Detection', 5, true, 'global', null),
  
  ('Fire Detection Coverage', 'Fire detection coverage should provide early warning across all occupied and high-risk areas.', 'Upgrade fire detection coverage to ensure early warning in line with recognised standards such as BS 5839 or equivalent, with appropriate detector types for the hazards present.', 'Fire Protection & Detection', 4, true, 'global', null),
  
  ('Fire Hydrant Provision', 'Fire hydrant provision and accessibility impacts firefighting capability.', 'Improve fire hydrant provision by installing additional hydrants to achieve adequate coverage, ensuring clear access routes, implementing regular flow testing, and addressing any defects identified.', 'Fire Protection & Detection', 4, true, 'global', null),
  
  ('Water Supply for Firefighting', 'Water supply reliability is critical for effective firefighting operations.', 'Enhance water supply by upgrading infrastructure, installing additional storage capacity, ensuring adequate flow rates and pressures, and implementing regular testing and maintenance.', 'Fire Protection & Detection', 4, true, 'global', null),
  
  ('Fire Protection System Adequacy', 'Fire protection systems should provide adequate coverage levels in line with the risk profile.', 'Upgrade fire protection systems by installing or extending automatic sprinkler protection to cover high-value and high-risk areas, ensuring compliance with recognised standards.', 'Fire Protection & Detection', 5, true, 'global', null);

-- Construction recommendations
INSERT INTO recommendation_templates (hazard, description, action, category, default_priority, is_active, scope, client_response_prompt)
VALUES
  ('Fire Compartmentation', 'Fire compartmentation limits fire spread and protects escape routes and property.', 'Improve fire compartmentation by sealing penetrations, upgrading fire-rated doors, and ensuring compartment boundaries are maintained to prevent fire and smoke spread.', 'Construction', 4, true, 'global', null),
  
  ('Building Construction', 'Building construction type and materials impact fire resistance and spread characteristics.', 'Address construction deficiencies by upgrading fire-resistant materials, improving structural fire protection, and ensuring construction meets current fire safety standards.', 'Construction', 3, true, 'global', null);

-- Special Hazards recommendations
INSERT INTO recommendation_templates (hazard, description, action, category, default_priority, is_active, scope, client_response_prompt)
VALUES
  ('Process Fire Risk', 'Specific process hazards require targeted risk control measures.', 'Implement process-specific fire risk controls including equipment upgrades, procedural safeguards, monitoring systems, and emergency response procedures.', 'Special Hazards', 4, true, 'global', null);

-- Business Continuity recommendations
INSERT INTO recommendation_templates (hazard, description, action, category, default_priority, is_active, scope, client_response_prompt)
VALUES
  ('Business Continuity Planning', 'Business continuity planning ensures resilience and recovery capability following a fire incident.', 'Develop and implement a comprehensive business continuity plan including alternative premises arrangements, data backup and recovery, supply chain continuity, and regular testing.', 'Business Continuity', 3, true, 'global', null);
