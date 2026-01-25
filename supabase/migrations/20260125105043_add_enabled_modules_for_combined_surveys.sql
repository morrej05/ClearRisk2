/*
  # Enable Combined FRA + FSD Surveys

  1. Changes to survey_reports table
    - Add enabled_modules TEXT[] column to support multiple module types
    - Populate enabled_modules from existing document_type for backward compatibility
    - Maintain document_type for legacy compatibility
    - Add helper function to determine active modules

  2. Notes
    - Single-module surveys: enabled_modules = ['FRA'] or ['FSD'] or ['DSEAR']
    - Combined surveys: enabled_modules = ['FRA', 'FSD']
    - If enabled_modules is NULL, falls back to document_type
    - Issuing validation will check all enabled modules

  3. Security
    - Maintains existing RLS policies
*/

-- Step 1: Add enabled_modules column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'enabled_modules'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN enabled_modules TEXT[];
    COMMENT ON COLUMN survey_reports.enabled_modules IS 'Array of enabled module types: FRA, FSD, DSEAR. Supports combined surveys.';
  END IF;
END $$;

-- Step 2: Populate enabled_modules from existing document_type
UPDATE survey_reports
SET enabled_modules = ARRAY[document_type]::TEXT[]
WHERE enabled_modules IS NULL AND document_type IS NOT NULL;

-- Step 3: Create helper function to get active modules for a survey
CREATE OR REPLACE FUNCTION get_survey_modules(survey_row survey_reports)
RETURNS TEXT[] AS $$
BEGIN
  -- If enabled_modules is set, use it
  IF survey_row.enabled_modules IS NOT NULL AND array_length(survey_row.enabled_modules, 1) > 0 THEN
    RETURN survey_row.enabled_modules;
  END IF;

  -- Fall back to document_type for legacy surveys
  IF survey_row.document_type IS NOT NULL THEN
    RETURN ARRAY[survey_row.document_type]::TEXT[];
  END IF;

  -- Default to empty array
  RETURN ARRAY[]::TEXT[];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_survey_modules IS 'Returns active modules for a survey (enabled_modules or falls back to document_type)';

-- Step 4: Create helper function to check if survey has specific module
CREATE OR REPLACE FUNCTION survey_has_module(
  survey_row survey_reports,
  module_name TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  active_modules TEXT[];
BEGIN
  active_modules := get_survey_modules(survey_row);
  RETURN module_name = ANY(active_modules);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION survey_has_module IS 'Checks if survey has a specific module enabled (FRA, FSD, or DSEAR)';

-- Step 5: Add constraint to ensure valid module names
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'survey_reports_enabled_modules_check'
  ) THEN
    ALTER TABLE survey_reports
    ADD CONSTRAINT survey_reports_enabled_modules_check
    CHECK (
      enabled_modules IS NULL OR
      (
        enabled_modules <@ ARRAY['FRA', 'FSD', 'DSEAR']::TEXT[] AND
        array_length(enabled_modules, 1) > 0
      )
    );
  END IF;
END $$;

-- Step 6: Create index for enabled_modules queries
CREATE INDEX IF NOT EXISTS idx_survey_reports_enabled_modules
ON survey_reports USING GIN (enabled_modules);

-- Step 7: Update snapshots to include enabled_modules
-- Future snapshots will automatically include enabled_modules
-- Existing snapshots remain unchanged (immutable)
