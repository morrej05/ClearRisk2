/*
  # Seed Recommendation Templates (V1)

  Seeds the recommendation_templates table with generic, reusable recommendations
  converted from the existing recommendationTemplates.ts file.

  Categories assigned based on recommendation focus:
  - Management Systems: Loss prevention, maintenance, controls, procedures
  - Fire Protection & Detection: Sprinklers, detection, water supply, hydrants
  - Construction: Building elements and compartmentation
  - Special Hazards: Process-specific risks
  - Business Continuity: Recovery and continuity planning

  All recommendations set to:
  - trigger_type = 'manual' (automated triggering deferred to later phase)
  - default_priority = 3 (medium) unless clearly critical
  - is_active = true
  - scope = 'global'
*/

-- Insert Management Systems recommendations
INSERT INTO recommendation_templates (code, title, body, category, default_priority, trigger_type, trigger_field_key, is_active, scope)
VALUES
  ('MS-001', 'Loss Prevention Commitment', 'Enhance management commitment to loss prevention by implementing a formal risk management programme with documented procedures, regular reviews, and clear accountability structures.', 'Management Systems', 3, 'grade', 'commitmentLossPrevention_rating', true, 'global'),
  ('MS-002', 'Hot Work Controls', 'Implement a formal hot work permit system with pre-work inspections, fire watch procedures, and post-work monitoring to reduce ignition risks during maintenance activities.', 'Management Systems', 4, 'grade', 'controlHotWork_rating', true, 'global'),
  ('MS-003', 'Electrical Maintenance', 'Upgrade electrical maintenance programme to include thermal imaging surveys, regular testing by qualified electricians, and immediate remediation of identified defects to prevent electrical fires.', 'Management Systems', 3, 'grade', 'electricalMaintenance_rating', true, 'global'),
  ('MS-004', 'General Maintenance', 'Develop and implement a comprehensive maintenance programme with scheduled inspections, preventive maintenance tasks, and prompt repairs to maintain property condition and reduce fire risk.', 'Management Systems', 3, 'grade', 'generalMaintenance_rating', true, 'global'),
  ('MS-005', 'Smoking Controls', 'Strengthen smoking controls by designating safe smoking areas away from combustible materials, providing proper disposal receptacles, and enforcing no-smoking policies in high-risk zones.', 'Management Systems', 3, 'grade', 'smokingControls_rating', true, 'global'),
  ('MS-006', 'Housekeeping Standards', 'Improve housekeeping standards to minimise combustible loading by implementing regular cleaning schedules, proper waste management, and clear storage procedures that maintain adequate separation from ignition sources.', 'Management Systems', 3, 'grade', 'fireSafetyHousekeeping_rating', true, 'global'),
  ('MS-007', 'Self-Inspection Programme', 'Establish a structured self-inspection programme with trained personnel, documented checklists, and corrective action tracking to identify and address fire safety deficiencies proactively.', 'Management Systems', 3, 'grade', 'selfInspections_rating', true, 'global'),
  ('MS-008', 'Change Management', 'Implement a formal change management process requiring risk assessment for all operational, process, or facility changes to ensure fire safety implications are identified and mitigated before implementation.', 'Management Systems', 3, 'grade', 'changeManagement_rating', true, 'global'),
  ('MS-009', 'Contractor Controls', 'Strengthen contractor control procedures by requiring site inductions, hot work permits, supervision during high-risk activities, and verification of contractor insurance and qualifications.', 'Management Systems', 3, 'grade', 'contractorControls_rating', true, 'global'),
  ('MS-010', 'Emergency Response', 'Enhance emergency response capability by developing site-specific emergency plans, conducting regular drills, training response teams, and establishing clear communication protocols with emergency services.', 'Management Systems', 4, 'grade', 'emergencyResponse_rating', true, 'global')
ON CONFLICT (code) DO NOTHING;

-- Insert Fire Protection & Detection recommendations
INSERT INTO recommendation_templates (code, title, body, category, default_priority, trigger_type, trigger_field_key, is_active, scope)
VALUES
  ('FP-001', 'Fire Equipment Testing', 'Establish a comprehensive fire equipment testing and maintenance programme with documented schedules, qualified personnel, and regular third-party verification to ensure all systems remain operational.', 'Fire Protection & Detection', 4, 'grade', 'fireEquipmentTesting_rating', true, 'global'),
  ('FP-002', 'Impairment Handling', 'Develop a formal impairment handling programme requiring notification to insurers, implementation of compensatory measures, expedited restoration timelines, and documented tracking of all system outages.', 'Fire Protection & Detection', 5, 'grade', 'impairmentHandling_rating', true, 'global'),
  ('FP-003', 'Fire Detection Systems', 'Upgrade fire detection coverage to ensure early warning across all occupied and high-risk areas, in line with recognised standards such as BS 5839 or equivalent, with appropriate detector types for the hazards present.', 'Fire Protection & Detection', 4, 'grade', 'fireDetectionNotes_rating', true, 'global'),
  ('FP-004', 'Fire Hydrant Provision', 'Improve fire hydrant provision and accessibility by installing additional hydrants to achieve adequate coverage, ensuring clear access routes, implementing regular flow testing, and addressing any defects identified.', 'Fire Protection & Detection', 4, 'grade', 'fireHydrantNotes_rating', true, 'global'),
  ('FP-005', 'Water Supply', 'Enhance water supply reliability for firefighting by upgrading infrastructure, installing additional storage capacity, ensuring adequate flow rates and pressures, and implementing regular testing and maintenance.', 'Fire Protection & Detection', 4, 'grade', 'waterSupplyNotes_rating', true, 'global'),
  ('FP-006', 'Fire Protection Adequacy', 'Upgrade fire protection systems to achieve adequate coverage levels in line with the risk profile. Install or extend automatic sprinkler protection to cover high-value and high-risk areas, ensuring compliance with recognised standards.', 'Fire Protection & Detection', 5, 'grade', 'fire_protection_adequacy', true, 'global'),
  ('FP-007', 'Water Supply Reliability', 'Improve water supply reliability by upgrading mains connections, installing additional storage tanks or pumps, ensuring adequate flow rates and pressures for firefighting, and implementing regular flow testing and maintenance.', 'Fire Protection & Detection', 4, 'grade', 'water_supply_reliability', true, 'global')
ON CONFLICT (code) DO NOTHING;
