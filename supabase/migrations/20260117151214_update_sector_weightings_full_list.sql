/*
  # Update Sector Weightings with Full Industry List

  1. Changes
    - Upserts all 38 industry sectors into sector_weightings table
    - Each sector starts with is_custom=false and all weights=3 (matching Default)
    - Preserves existing custom weightings if already configured
    - Ensures Default row exists as fallback

  2. Sectors Added
    - Aircraft Assembly, Aircraft Maintenance, Aircraft Painting
    - Aluminium, Auto Assembly, Auto Body, Auto Paint, Auto Press
    - Chemical, Data Centre, Electrical Equipment Assembly
    - Expanded Plastics, Food & Beverage, Foundry and Forge
    - Glass Manufacturing, Hospital, Hotel, Machine shops
    - Mining, Mixed use, Office, Other, Paper, Pharmaceutical
    - Power Generation, Printing, Retail, Residential
    - Semiconductor, Sheet Metal Working, Ship Building
    - Steel Mill, Textiles, Unexpanded Plastics, Vacant Plants
    - Warehouse - Ceiling sprinklers only, Waste Industry, Woodworking

  3. Notes
    - Uses ON CONFLICT to preserve existing custom settings
    - All new sectors default to is_custom=false (use Default weights)
    - Admins can customize any sector via Sector Weightings UI
*/

-- Ensure Default row exists
INSERT INTO sector_weightings (sector_name, is_custom, construction, management, fire_protection, special_hazards, business_continuity)
VALUES ('Default', true, 3, 3, 3, 3, 3)
ON CONFLICT (sector_name) DO NOTHING;

-- Insert all 38 industry sectors with default weights
INSERT INTO sector_weightings (sector_name, is_custom, construction, management, fire_protection, special_hazards, business_continuity)
VALUES 
  ('Aircraft Assembly', false, 3, 3, 3, 3, 3),
  ('Aircraft Maintenance', false, 3, 3, 3, 3, 3),
  ('Aircraft Painting', false, 3, 3, 3, 3, 3),
  ('Aluminium', false, 3, 3, 3, 3, 3),
  ('Auto Assembly', false, 3, 3, 3, 3, 3),
  ('Auto Body', false, 3, 3, 3, 3, 3),
  ('Auto Paint', false, 3, 3, 3, 3, 3),
  ('Auto Press', false, 3, 3, 3, 3, 3),
  ('Chemical', false, 3, 3, 3, 3, 3),
  ('Data Centre', false, 3, 3, 3, 3, 3),
  ('Electrical Equipment Assembly', false, 3, 3, 3, 3, 3),
  ('Expanded Plastics', false, 3, 3, 3, 3, 3),
  ('Food & Beverage', false, 3, 3, 3, 3, 3),
  ('Foundry and Forge', false, 3, 3, 3, 3, 3),
  ('Glass Manufacturing', false, 3, 3, 3, 3, 3),
  ('Hospital', false, 3, 3, 3, 3, 3),
  ('Hotel', false, 3, 3, 3, 3, 3),
  ('Machine shops', false, 3, 3, 3, 3, 3),
  ('Mining', false, 3, 3, 3, 3, 3),
  ('Mixed use', false, 3, 3, 3, 3, 3),
  ('Office', false, 3, 3, 3, 3, 3),
  ('Other', false, 3, 3, 3, 3, 3),
  ('Paper', false, 3, 3, 3, 3, 3),
  ('Pharmaceutical', false, 3, 3, 3, 3, 3),
  ('Power Generation', false, 3, 3, 3, 3, 3),
  ('Printing', false, 3, 3, 3, 3, 3),
  ('Retail', false, 3, 3, 3, 3, 3),
  ('Residential', false, 3, 3, 3, 3, 3),
  ('Semiconductor', false, 3, 3, 3, 3, 3),
  ('Sheet Metal Working', false, 3, 3, 3, 3, 3),
  ('Ship Building', false, 3, 3, 3, 3, 3),
  ('Steel Mill', false, 3, 3, 3, 3, 3),
  ('Textiles', false, 3, 3, 3, 3, 3),
  ('Unexpanded Plastics', false, 3, 3, 3, 3, 3),
  ('Vacant Plants', false, 3, 3, 3, 3, 3),
  ('Warehouse - Ceiling sprinklers only', false, 3, 3, 3, 3, 3),
  ('Waste Industry', false, 3, 3, 3, 3, 3),
  ('Woodworking', false, 3, 3, 3, 3, 3)
ON CONFLICT (sector_name) 
DO UPDATE SET
  construction = CASE 
    WHEN sector_weightings.is_custom = false THEN EXCLUDED.construction
    ELSE sector_weightings.construction
  END,
  management = CASE 
    WHEN sector_weightings.is_custom = false THEN EXCLUDED.management
    ELSE sector_weightings.management
  END,
  fire_protection = CASE 
    WHEN sector_weightings.is_custom = false THEN EXCLUDED.fire_protection
    ELSE sector_weightings.fire_protection
  END,
  special_hazards = CASE 
    WHEN sector_weightings.is_custom = false THEN EXCLUDED.special_hazards
    ELSE sector_weightings.special_hazards
  END,
  business_continuity = CASE 
    WHEN sector_weightings.is_custom = false THEN EXCLUDED.business_continuity
    ELSE sector_weightings.business_continuity
  END;
