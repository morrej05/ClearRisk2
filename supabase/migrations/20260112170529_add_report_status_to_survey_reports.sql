/*
  # Add Report Status Column to Survey Reports

  ## Overview
  Adds a report_status column to track the review status of survey reports.
  Replaces the previous informationAccurate and draftReportOnly boolean fields with a more professional status system.

  ## Changes Made
  
  ### New Column
  - `report_status` (text) - Report review status with check constraint
    - Allowed values: 'Draft', 'Internally Reviewed', 'Issue Ready'
    - Default: 'Draft'
    - NOT NULL constraint ensures all reports have a status

  ## Migration Strategy
  - Adds column with default value
  - All existing reports will default to 'Draft' status
  - No data loss (old boolean fields remain in JSONB form_data if present)

  ## Index
  - Add index on report_status for efficient filtering by status

  ## Notes
  - Check constraint ensures only valid status values can be stored
  - Default 'Draft' status is appropriate for auto-generated reports
  - Status can be updated by users through the UI
*/

-- Add report_status column with default value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'report_status'
  ) THEN
    ALTER TABLE survey_reports 
    ADD COLUMN report_status text NOT NULL DEFAULT 'Draft'
    CHECK (report_status IN ('Draft', 'Internally Reviewed', 'Issue Ready'));
  END IF;
END $$;

-- Add index for efficient filtering by status
CREATE INDEX IF NOT EXISTS idx_survey_reports_status ON survey_reports(report_status);