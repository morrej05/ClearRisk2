/*
  # Seed Legacy Triggers and Templates
  
  ## Purpose
  Seeds recommendation templates and triggers from the legacy trigger mapping system.
  This restores the auto-generated recommendations functionality.
  
  ## Process
  1. Insert templates from legacy mappings (if not already exist)
  2. Create triggers linking templates to field ratings
  3. Handles duplicates gracefully using ON CONFLICT
  
  ## Data Source
  Based on legacyRecommendationMap.json containing ~10-20 common trigger patterns
*/

-- Seed templates from legacy mappings
INSERT INTO recommendation_templates (hazard, description, action, client_response_prompt, category, default_priority, is_active, scope)
VALUES
  ('Loss Prevention Programme', 'Management commitment to loss prevention requires enhancement through a more formal and structured approach.', 'Enhance management commitment to loss prevention by implementing a formal risk management programme with documented procedures, regular reviews, and clear accountability structures.', 'Site Response', 'Management Systems', 3, true, 'global'),
  ('Fire Equipment Testing', 'Fire protection and detection equipment testing and maintenance programme requires improvement.', 'Establish a comprehensive fire equipment testing and maintenance programme with documented schedules, qualified personnel, and regular third-party verification to ensure all systems remain operational.', 'Site Response', 'Fire Protection & Detection', 4, true, 'global'),
  ('Hot Work Controls', 'Hot work activities present ignition risks during maintenance and operational activities.', 'Implement a formal hot work permit system with pre-work inspections, fire watch procedures, and post-work monitoring to reduce ignition risks during maintenance activities.', 'Site Response', 'Management Systems', 4, true, 'global'),
  ('Electrical Maintenance', 'Electrical systems require enhanced maintenance to prevent failures that could lead to fire.', 'Upgrade electrical maintenance programme to include thermal imaging surveys, regular testing by qualified electricians, and immediate remediation of identified defects to prevent electrical fires.', 'Site Response', 'Management Systems', 3, true, 'global'),
  ('General Maintenance', 'General maintenance standards impact overall fire safety and property condition.', 'Develop and implement a comprehensive maintenance programme with scheduled inspections, preventive maintenance tasks, and prompt repairs to maintain property condition and reduce fire risk.', 'Site Response', 'Management Systems', 3, true, 'global'),
  ('Smoking Controls', 'Smoking activities can create ignition risks if not properly controlled and managed.', 'Strengthen smoking controls by designating safe smoking areas away from combustible materials, providing proper disposal receptacles, and enforcing no-smoking policies in high-risk zones.', 'Site Response', 'Management Systems', 3, true, 'global'),
  ('Housekeeping Standards', 'Poor housekeeping can increase fire risk through accumulation of combustible materials and inadequate separation from ignition sources.', 'Improve housekeeping standards to minimise combustible loading by implementing regular cleaning schedules, proper waste management, and clear storage procedures that maintain adequate separation from ignition sources.', 'Site Response', 'Management Systems', 3, true, 'global'),
  ('Self-Inspection Programme', 'Regular self-inspections are needed to proactively identify and address fire safety deficiencies.', 'Establish a structured self-inspection programme with trained personnel, documented checklists, and corrective action tracking to identify and address fire safety deficiencies proactively.', 'Site Response', 'Management Systems', 3, true, 'global'),
  ('Change Management', 'Changes to operations, processes, or facilities can introduce new fire safety risks if not properly assessed.', 'Implement a formal change management process requiring risk assessment for all operational, process, or facility changes to ensure fire safety implications are identified and mitigated before implementation.', 'Site Response', 'Management Systems', 3, true, 'global'),
  ('Contractor Controls', 'Contractor activities can introduce fire risks if not properly controlled and supervised.', 'Strengthen contractor control procedures by requiring site inductions, hot work permits, supervision during high-risk activities, and verification of contractor insurance and qualifications.', 'Site Response', 'Management Systems', 3, true, 'global')
ON CONFLICT (scope, hazard, (LEFT(description, 255))) DO UPDATE SET
  action = EXCLUDED.action,
  category = EXCLUDED.category,
  default_priority = EXCLUDED.default_priority,
  is_active = EXCLUDED.is_active;

-- Now create triggers linking templates to field ratings
-- We need to look up template IDs first, then create triggers

-- Poor/Inadequate triggers for Management section
DO $$
DECLARE
  template_rec RECORD;
BEGIN
  -- Loss Prevention Programme
  SELECT id INTO template_rec FROM recommendation_templates WHERE hazard = 'Loss Prevention Programme' AND scope = 'global' LIMIT 1;
  IF FOUND THEN
    INSERT INTO recommendation_triggers (section_key, field_key, rating_value, template_id, priority, is_active)
    VALUES 
      ('FP_09_Management', 'commitmentLossPrevention_rating', 'Poor', template_rec.id, 3, true),
      ('FP_09_Management', 'commitmentLossPrevention_rating', 'Inadequate', template_rec.id, 3, true)
    ON CONFLICT (section_key, field_key, rating_value, template_id) DO NOTHING;
  END IF;

  -- Fire Equipment Testing
  SELECT id INTO template_rec FROM recommendation_templates WHERE hazard = 'Fire Equipment Testing' AND scope = 'global' LIMIT 1;
  IF FOUND THEN
    INSERT INTO recommendation_triggers (section_key, field_key, rating_value, template_id, priority, is_active)
    VALUES 
      ('FP_09_Management', 'fireEquipmentTesting_rating', 'Poor', template_rec.id, 4, true),
      ('FP_09_Management', 'fireEquipmentTesting_rating', 'Inadequate', template_rec.id, 4, true)
    ON CONFLICT (section_key, field_key, rating_value, template_id) DO NOTHING;
  END IF;

  -- Hot Work Controls
  SELECT id INTO template_rec FROM recommendation_templates WHERE hazard = 'Hot Work Controls' AND scope = 'global' LIMIT 1;
  IF FOUND THEN
    INSERT INTO recommendation_triggers (section_key, field_key, rating_value, template_id, priority, is_active)
    VALUES 
      ('FP_09_Management', 'controlHotWork_rating', 'Poor', template_rec.id, 4, true),
      ('FP_09_Management', 'controlHotWork_rating', 'Inadequate', template_rec.id, 4, true)
    ON CONFLICT (section_key, field_key, rating_value, template_id) DO NOTHING;
  END IF;

  -- Electrical Maintenance
  SELECT id INTO template_rec FROM recommendation_templates WHERE hazard = 'Electrical Maintenance' AND scope = 'global' LIMIT 1;
  IF FOUND THEN
    INSERT INTO recommendation_triggers (section_key, field_key, rating_value, template_id, priority, is_active)
    VALUES 
      ('FP_09_Management', 'electricalMaintenance_rating', 'Poor', template_rec.id, 3, true),
      ('FP_09_Management', 'electricalMaintenance_rating', 'Inadequate', template_rec.id, 3, true)
    ON CONFLICT (section_key, field_key, rating_value, template_id) DO NOTHING;
  END IF;

  -- General Maintenance
  SELECT id INTO template_rec FROM recommendation_templates WHERE hazard = 'General Maintenance' AND scope = 'global' LIMIT 1;
  IF FOUND THEN
    INSERT INTO recommendation_triggers (section_key, field_key, rating_value, template_id, priority, is_active)
    VALUES 
      ('FP_09_Management', 'generalMaintenance_rating', 'Poor', template_rec.id, 3, true),
      ('FP_09_Management', 'generalMaintenance_rating', 'Inadequate', template_rec.id, 3, true)
    ON CONFLICT (section_key, field_key, rating_value, template_id) DO NOTHING;
  END IF;

  -- Smoking Controls
  SELECT id INTO template_rec FROM recommendation_templates WHERE hazard = 'Smoking Controls' AND scope = 'global' LIMIT 1;
  IF FOUND THEN
    INSERT INTO recommendation_triggers (section_key, field_key, rating_value, template_id, priority, is_active)
    VALUES 
      ('FP_09_Management', 'smokingControls_rating', 'Poor', template_rec.id, 3, true),
      ('FP_09_Management', 'smokingControls_rating', 'Inadequate', template_rec.id, 3, true)
    ON CONFLICT (section_key, field_key, rating_value, template_id) DO NOTHING;
  END IF;

  -- Housekeeping Standards
  SELECT id INTO template_rec FROM recommendation_templates WHERE hazard = 'Housekeeping Standards' AND scope = 'global' LIMIT 1;
  IF FOUND THEN
    INSERT INTO recommendation_triggers (section_key, field_key, rating_value, template_id, priority, is_active)
    VALUES 
      ('FP_09_Management', 'fireSafetyHousekeeping_rating', 'Poor', template_rec.id, 3, true),
      ('FP_09_Management', 'fireSafetyHousekeeping_rating', 'Inadequate', template_rec.id, 3, true)
    ON CONFLICT (section_key, field_key, rating_value, template_id) DO NOTHING;
  END IF;

  -- Self-Inspection Programme
  SELECT id INTO template_rec FROM recommendation_templates WHERE hazard = 'Self-Inspection Programme' AND scope = 'global' LIMIT 1;
  IF FOUND THEN
    INSERT INTO recommendation_triggers (section_key, field_key, rating_value, template_id, priority, is_active)
    VALUES 
      ('FP_09_Management', 'selfInspections_rating', 'Poor', template_rec.id, 3, true),
      ('FP_09_Management', 'selfInspections_rating', 'Inadequate', template_rec.id, 3, true)
    ON CONFLICT (section_key, field_key, rating_value, template_id) DO NOTHING;
  END IF;

  -- Change Management
  SELECT id INTO template_rec FROM recommendation_templates WHERE hazard = 'Change Management' AND scope = 'global' LIMIT 1;
  IF FOUND THEN
    INSERT INTO recommendation_triggers (section_key, field_key, rating_value, template_id, priority, is_active)
    VALUES 
      ('FP_09_Management', 'changeManagement_rating', 'Poor', template_rec.id, 3, true),
      ('FP_09_Management', 'changeManagement_rating', 'Inadequate', template_rec.id, 3, true)
    ON CONFLICT (section_key, field_key, rating_value, template_id) DO NOTHING;
  END IF;

  -- Contractor Controls
  SELECT id INTO template_rec FROM recommendation_templates WHERE hazard = 'Contractor Controls' AND scope = 'global' LIMIT 1;
  IF FOUND THEN
    INSERT INTO recommendation_triggers (section_key, field_key, rating_value, template_id, priority, is_active)
    VALUES 
      ('FP_09_Management', 'contractorControls_rating', 'Poor', template_rec.id, 3, true),
      ('FP_09_Management', 'contractorControls_rating', 'Inadequate', template_rec.id, 3, true)
    ON CONFLICT (section_key, field_key, rating_value, template_id) DO NOTHING;
  END IF;

END $$;
