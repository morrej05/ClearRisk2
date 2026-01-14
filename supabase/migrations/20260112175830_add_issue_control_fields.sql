/*
  # Add Issue Control and Company Fields to Survey Reports

  1. New Columns
    - `company_name` (text) - Name of the company/client for the survey
    - `survey_date` (date) - Date when the survey was conducted
    - `issue_date` (date, nullable) - Date when the report was officially issued
    - `issued` (boolean, default false) - Whether the report has been issued (locked)
    - `superseded_by_id` (uuid, nullable) - References newer survey if this one was superseded

  2. Security
    - No RLS changes needed (inherits from existing policies)

  3. Important Notes
    - Issued reports should be treated as read-only in the application
    - Superseded reports link to the newer survey that replaced them
    - Issue date is set when a report moves from "Issue Ready" to "Issued"
*/

-- Add new columns to survey_reports table
DO $$
BEGIN
  -- Add company_name column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN company_name text;
  END IF;

  -- Add survey_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'survey_date'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN survey_date date;
  END IF;

  -- Add issue_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'issue_date'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN issue_date date;
  END IF;

  -- Add issued column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'issued'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN issued boolean DEFAULT false NOT NULL;
  END IF;

  -- Add superseded_by_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'superseded_by_id'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN superseded_by_id uuid REFERENCES survey_reports(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for superseded_by_id lookups
CREATE INDEX IF NOT EXISTS idx_survey_reports_superseded_by_id ON survey_reports(superseded_by_id);

-- Create index for issued reports
CREATE INDEX IF NOT EXISTS idx_survey_reports_issued ON survey_reports(issued);

-- Add comment for documentation
COMMENT ON COLUMN survey_reports.issued IS 'When true, report is locked and cannot be edited or deleted';
COMMENT ON COLUMN survey_reports.superseded_by_id IS 'References the newer survey that superseded this one';