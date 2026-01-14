/*
  # Add generated report column

  1. Changes
    - Add `generated_report` column to `survey_reports` table to store the generated HTML report content

  2. Notes
    - The column is optional (nullable) as existing reports won't have generated content
    - Uses text type to store HTML content
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'generated_report'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN generated_report text;
  END IF;
END $$;
