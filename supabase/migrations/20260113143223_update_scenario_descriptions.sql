/*
  # Update scenario description fields

  1. Changes
    - Rename `scenario_description` column to `nle_scenario_description`
    - Add `wcl_scenario_description` column for WCL scenario descriptions

  2. Notes
    - These changes support separate scenario descriptions for WCL and NLE tables in Section 9
*/

-- Rename existing column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'scenario_description'
  ) THEN
    ALTER TABLE survey_reports RENAME COLUMN scenario_description TO nle_scenario_description;
  END IF;
END $$;

-- Add WCL scenario description column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'wcl_scenario_description'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN wcl_scenario_description text;
  END IF;
END $$;

-- If nle_scenario_description doesn't exist (fresh install), add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'nle_scenario_description'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN nle_scenario_description text;
  END IF;
END $$;
