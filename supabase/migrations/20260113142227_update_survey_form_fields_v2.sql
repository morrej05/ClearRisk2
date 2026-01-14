/*
  # Update survey form fields - Phase 2

  1. Changes
    - Add `surveyor_company_name` column to store surveyor's company name
    - Add `scenario_description` column for scenario descriptions in Section 9
    - Remove `profit_generation` column (no longer needed)
    - Remove `loss_expectancy_summary` column (replaced by scenario_description)

  2. Notes
    - These changes align with the updated survey form structure
    - Data from removed columns will be lost, but these fields were optional
*/

-- Add new columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'surveyor_company_name'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN surveyor_company_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'scenario_description'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN scenario_description text;
  END IF;
END $$;

-- Remove old columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'profit_generation'
  ) THEN
    ALTER TABLE survey_reports DROP COLUMN profit_generation;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'loss_expectancy_summary'
  ) THEN
    ALTER TABLE survey_reports DROP COLUMN loss_expectancy_summary;
  END IF;
END $$;
