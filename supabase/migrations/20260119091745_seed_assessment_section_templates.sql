/*
  # Seed Assessment Section Templates

  1. Overview
    Seeds section templates for all four assessment types across both jurisdictions
    - FRA (Fire Risk Assessment)
    - Fire Strategy Document
    - DSEAR (ATEX/DSEAR)
    - Wildfire Risk Assessment

  2. Jurisdictions
    - UK-EN
    - GENERIC

  3. Sections
    Each assessment type has specific sections with sort_order and is_required flags
*/

-- Clear existing templates (in case of re-run)
DELETE FROM assessment_sections WHERE jurisdiction IN ('UK-EN', 'GENERIC');

-- ============================================================================
-- FRA (Fire Risk Assessment) Sections
-- ============================================================================

-- UK-EN FRA Sections
INSERT INTO assessment_sections (assessment_type, jurisdiction, section_key, title, sort_order, is_required) VALUES
('fra', 'UK-EN', 'details', 'Assessment Details', 1, true),
('fra', 'UK-EN', 'premises', 'Premises Description', 2, true),
('fra', 'UK-EN', 'hazards', 'Fire Hazards', 3, true),
('fra', 'UK-EN', 'people', 'People at Risk', 4, true),
('fra', 'UK-EN', 'protection', 'Fire Protection Measures', 5, true),
('fra', 'UK-EN', 'escape', 'Means of Escape', 6, true),
('fra', 'UK-EN', 'management', 'Management & Training', 7, true),
('fra', 'UK-EN', 'high_risk', 'High-Risk Areas & Processes', 8, false),
('fra', 'UK-EN', 'rating', 'Findings & Risk Rating', 9, true),
('fra', 'UK-EN', 'recommendations', 'Recommendations', 10, false),
('fra', 'UK-EN', 'action_plan', 'Action Plan', 11, false);

-- GENERIC FRA Sections
INSERT INTO assessment_sections (assessment_type, jurisdiction, section_key, title, sort_order, is_required) VALUES
('fra', 'GENERIC', 'details', 'Assessment Details', 1, true),
('fra', 'GENERIC', 'premises', 'Premises Description', 2, true),
('fra', 'GENERIC', 'hazards', 'Fire Hazards', 3, true),
('fra', 'GENERIC', 'people', 'People at Risk', 4, true),
('fra', 'GENERIC', 'protection', 'Fire Protection Measures', 5, true),
('fra', 'GENERIC', 'escape', 'Means of Escape', 6, true),
('fra', 'GENERIC', 'management', 'Management & Training', 7, true),
('fra', 'GENERIC', 'high_risk', 'High-Risk Areas & Processes', 8, false),
('fra', 'GENERIC', 'rating', 'Findings & Risk Rating', 9, true),
('fra', 'GENERIC', 'recommendations', 'Recommendations', 10, false),
('fra', 'GENERIC', 'action_plan', 'Action Plan', 11, false);

-- ============================================================================
-- Fire Strategy Document Sections
-- ============================================================================

-- UK-EN Fire Strategy Sections
INSERT INTO assessment_sections (assessment_type, jurisdiction, section_key, title, sort_order, is_required) VALUES
('fire_strategy', 'UK-EN', 'overview', 'Project & Building Overview', 1, true),
('fire_strategy', 'UK-EN', 'basis', 'Objectives & Basis of Design', 2, true),
('fire_strategy', 'UK-EN', 'evacuation', 'Occupancy & Evacuation Strategy', 3, true),
('fire_strategy', 'UK-EN', 'structure', 'Compartmentation & Structure', 4, true),
('fire_strategy', 'UK-EN', 'alarm', 'Detection & Alarm Strategy', 5, true),
('fire_strategy', 'UK-EN', 'suppression', 'Suppression Strategy', 6, true),
('fire_strategy', 'UK-EN', 'smoke', 'Smoke Control / Ventilation', 7, true),
('fire_strategy', 'UK-EN', 'firefighting', 'Firefighting Facilities', 8, true),
('fire_strategy', 'UK-EN', 'management', 'Interfaces & Management', 9, true),
('fire_strategy', 'UK-EN', 'deviations', 'Deviations & Justifications', 10, false),
('fire_strategy', 'UK-EN', 'actions', 'Recommendations / Actions', 11, false);

-- GENERIC Fire Strategy Sections
INSERT INTO assessment_sections (assessment_type, jurisdiction, section_key, title, sort_order, is_required) VALUES
('fire_strategy', 'GENERIC', 'overview', 'Project & Building Overview', 1, true),
('fire_strategy', 'GENERIC', 'basis', 'Objectives & Basis of Design', 2, true),
('fire_strategy', 'GENERIC', 'evacuation', 'Occupancy & Evacuation Strategy', 3, true),
('fire_strategy', 'GENERIC', 'structure', 'Compartmentation & Structure', 4, true),
('fire_strategy', 'GENERIC', 'alarm', 'Detection & Alarm Strategy', 5, true),
('fire_strategy', 'GENERIC', 'suppression', 'Suppression Strategy', 6, true),
('fire_strategy', 'GENERIC', 'smoke', 'Smoke Control / Ventilation', 7, true),
('fire_strategy', 'GENERIC', 'firefighting', 'Firefighting Facilities', 8, true),
('fire_strategy', 'GENERIC', 'management', 'Interfaces & Management', 9, true),
('fire_strategy', 'GENERIC', 'deviations', 'Deviations & Justifications', 10, false),
('fire_strategy', 'GENERIC', 'actions', 'Recommendations / Actions', 11, false);

-- ============================================================================
-- DSEAR (ATEX/DSEAR) Sections
-- ============================================================================

-- UK-EN DSEAR Sections
INSERT INTO assessment_sections (assessment_type, jurisdiction, section_key, title, sort_order, is_required) VALUES
('dsear', 'UK-EN', 'scope', 'Scope & Site Context', 1, true),
('dsear', 'UK-EN', 'inventory', 'Substances Inventory', 2, true),
('dsear', 'UK-EN', 'releases', 'Release Sources', 3, true),
('dsear', 'UK-EN', 'ventilation', 'Ventilation & Dispersion (Qualitative)', 4, true),
('dsear', 'UK-EN', 'classification', 'Hazardous Area Classification', 5, true),
('dsear', 'UK-EN', 'ignition', 'Ignition Sources & Controls', 6, true),
('dsear', 'UK-EN', 'equipment', 'Equipment Suitability (Ex Register)', 7, true),
('dsear', 'UK-EN', 'procedures', 'Procedures & Management', 8, true),
('dsear', 'UK-EN', 'findings', 'Findings / Nonconformities', 9, false),
('dsear', 'UK-EN', 'recommendations', 'Recommendations & Action Plan', 10, false);

-- GENERIC DSEAR Sections
INSERT INTO assessment_sections (assessment_type, jurisdiction, section_key, title, sort_order, is_required) VALUES
('dsear', 'GENERIC', 'scope', 'Scope & Site Context', 1, true),
('dsear', 'GENERIC', 'inventory', 'Substances Inventory', 2, true),
('dsear', 'GENERIC', 'releases', 'Release Sources', 3, true),
('dsear', 'GENERIC', 'ventilation', 'Ventilation & Dispersion (Qualitative)', 4, true),
('dsear', 'GENERIC', 'classification', 'Hazardous Area Classification', 5, true),
('dsear', 'GENERIC', 'ignition', 'Ignition Sources & Controls', 6, true),
('dsear', 'GENERIC', 'equipment', 'Equipment Suitability (Ex Register)', 7, true),
('dsear', 'GENERIC', 'procedures', 'Procedures & Management', 8, true),
('dsear', 'GENERIC', 'findings', 'Findings / Nonconformities', 9, false),
('dsear', 'GENERIC', 'recommendations', 'Recommendations & Action Plan', 10, false);

-- ============================================================================
-- Wildfire Risk Assessment Sections
-- ============================================================================

-- UK-EN Wildfire Sections
INSERT INTO assessment_sections (assessment_type, jurisdiction, section_key, title, sort_order, is_required) VALUES
('wildfire', 'UK-EN', 'location', 'Location & Surroundings', 1, true),
('wildfire', 'UK-EN', 'fuel', 'Vegetation & Fuel Load', 2, true),
('wildfire', 'UK-EN', 'construction', 'Construction Vulnerability', 3, true),
('wildfire', 'UK-EN', 'layout', 'Site Layout & Firebreaks', 4, true),
('wildfire', 'UK-EN', 'response', 'Emergency Response & Water Supply', 5, true),
('wildfire', 'UK-EN', 'preparedness', 'Operations & Preparedness', 6, true),
('wildfire', 'UK-EN', 'rating', 'Risk Rating', 7, true),
('wildfire', 'UK-EN', 'recommendations', 'Recommendations', 8, false),
('wildfire', 'UK-EN', 'action_plan', 'Action Plan', 9, false);

-- GENERIC Wildfire Sections
INSERT INTO assessment_sections (assessment_type, jurisdiction, section_key, title, sort_order, is_required) VALUES
('wildfire', 'GENERIC', 'location', 'Location & Surroundings', 1, true),
('wildfire', 'GENERIC', 'fuel', 'Vegetation & Fuel Load', 2, true),
('wildfire', 'GENERIC', 'construction', 'Construction Vulnerability', 3, true),
('wildfire', 'GENERIC', 'layout', 'Site Layout & Firebreaks', 4, true),
('wildfire', 'GENERIC', 'response', 'Emergency Response & Water Supply', 5, true),
('wildfire', 'GENERIC', 'preparedness', 'Operations & Preparedness', 6, true),
('wildfire', 'GENERIC', 'rating', 'Risk Rating', 7, true),
('wildfire', 'GENERIC', 'recommendations', 'Recommendations', 8, false),
('wildfire', 'GENERIC', 'action_plan', 'Action Plan', 9, false);