/*
  # Add Survey Issuing Metadata and Revision Control

  1. Changes to survey_reports table
    - Add document_type column (FRA/FSD/DSEAR) for new system
    - Add current_revision INTEGER for tracking active revision number
    - Add scope_type (full/limited/desktop/other) for FRA scope tracking
    - Add scope_limitations TEXT for limitation statements
    - Add engineered_solutions_used BOOLEAN for FSD conditional gating
    - Add change_log TEXT for issue notes
    - Modify status check to support 'draft' | 'issued'

  2. Security
    - Maintain existing RLS policies
*/

-- Add new columns to survey_reports
DO $$
BEGIN
  -- Add document_type if not exists (maps to FRA/FSD/DSEAR)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'document_type'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN document_type TEXT;
    COMMENT ON COLUMN survey_reports.document_type IS 'Document type: FRA, FSD, or DSEAR';
  END IF;

  -- Add current_revision if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'current_revision'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN current_revision INTEGER NOT NULL DEFAULT 1;
    COMMENT ON COLUMN survey_reports.current_revision IS 'Current active revision number (1, 2, 3...)';
  END IF;

  -- Add scope_type if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'scope_type'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN scope_type TEXT;
    COMMENT ON COLUMN survey_reports.scope_type IS 'Assessment scope: full, limited, desktop, other';
  END IF;

  -- Add scope_limitations if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'scope_limitations'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN scope_limitations TEXT;
    COMMENT ON COLUMN survey_reports.scope_limitations IS 'Free text limitation statement required for limited/desktop scope';
  END IF;

  -- Add engineered_solutions_used if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'engineered_solutions_used'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN engineered_solutions_used BOOLEAN NOT NULL DEFAULT false;
    COMMENT ON COLUMN survey_reports.engineered_solutions_used IS 'FSD: True when engineered solutions used (triggers limitations requirement)';
  END IF;

  -- Add change_log if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'change_log'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN change_log TEXT;
    COMMENT ON COLUMN survey_reports.change_log IS 'Summary of changes for this revision/issue';
  END IF;

  -- Add issued_confirmed if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'issued_confirmed'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN issued_confirmed BOOLEAN NOT NULL DEFAULT false;
    COMMENT ON COLUMN survey_reports.issued_confirmed IS 'Assessor confirmation checkbox for completeness';
  END IF;
END $$;

-- Update existing records to set document_type based on framework_type
UPDATE survey_reports
SET document_type = CASE
  WHEN framework_type = 'fire_risk_assessment' THEN 'FRA'
  WHEN framework_type = 'fire_property' THEN 'FRA'
  WHEN framework_type IN ('atex', 'asear') THEN 'DSEAR'
  ELSE 'FRA'
END
WHERE document_type IS NULL;

-- Add constraint for document_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'survey_reports_document_type_check'
  ) THEN
    ALTER TABLE survey_reports
    ADD CONSTRAINT survey_reports_document_type_check
    CHECK (document_type IN ('FRA', 'FSD', 'DSEAR'));
  END IF;
END $$;

-- Add constraint for scope_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'survey_reports_scope_type_check'
  ) THEN
    ALTER TABLE survey_reports
    ADD CONSTRAINT survey_reports_scope_type_check
    CHECK (scope_type IS NULL OR scope_type IN ('full', 'limited', 'desktop', 'other'));
  END IF;
END $$;