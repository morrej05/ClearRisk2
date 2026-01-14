/*
  # Add new survey form fields

  1. Changes
    - Add `site_contact` column to store site contact information
    - Add `bcp_rating` column to store BCP rating (Good/Tolerable/Poor)
    - Add `loss_expectancy_summary` column to store loss expectancy summary description
    - Modify `discussions_on_site` to support JSONB array for multiple contacts
    - Update report_status check constraint to remove 'Internally Reviewed' option

  2. Data Migration
    - Convert existing `discussions_on_site` text values to JSONB arrays
    - Convert any 'Internally Reviewed' status to 'Draft'
*/

-- Add new columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'site_contact'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN site_contact text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'bcp_rating'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN bcp_rating text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'loss_expectancy_summary'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN loss_expectancy_summary text;
  END IF;
END $$;

-- Migrate existing discussions_on_site to JSONB array format
-- First, create a temporary column for the new JSONB format
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'discussions_on_site'
    AND data_type = 'text'
  ) THEN
    -- Add temporary column
    ALTER TABLE survey_reports ADD COLUMN discussions_on_site_temp jsonb;

    -- Migrate data: convert text to JSONB array
    UPDATE survey_reports
    SET discussions_on_site_temp =
      CASE
        WHEN discussions_on_site IS NULL OR discussions_on_site = '' THEN '[""]'::jsonb
        ELSE jsonb_build_array(discussions_on_site)
      END;

    -- Drop old column and rename new one
    ALTER TABLE survey_reports DROP COLUMN discussions_on_site;
    ALTER TABLE survey_reports RENAME COLUMN discussions_on_site_temp TO discussions_on_site;
  END IF;
END $$;

-- Update any 'Internally Reviewed' status to 'Draft'
UPDATE survey_reports
SET report_status = 'Draft'
WHERE report_status = 'Internally Reviewed';

-- Update the check constraint to remove 'Internally Reviewed'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'survey_reports' AND constraint_name = 'survey_reports_report_status_check'
  ) THEN
    ALTER TABLE survey_reports DROP CONSTRAINT survey_reports_report_status_check;
  END IF;

  ALTER TABLE survey_reports
    ADD CONSTRAINT survey_reports_report_status_check
    CHECK (report_status IN ('Draft', 'Issue Ready'));
END $$;
