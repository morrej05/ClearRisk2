/*
  # Add survey_type column to survey_reports table

  1. Changes
    - Add `survey_type` column to `survey_reports` table
      - Type: text with check constraint
      - Values: 'Full' or 'Abridged'
      - Default: 'Full'
      - Not null
  
  2. Notes
    - This enables the system to differentiate between full surveys (all sections) and abridged surveys (sections 1-5, 10-11 only)
    - Existing records will default to 'Full' survey type
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'survey_type'
  ) THEN
    ALTER TABLE survey_reports 
    ADD COLUMN survey_type text NOT NULL DEFAULT 'Full'
    CHECK (survey_type IN ('Full', 'Abridged'));
  END IF;
END $$;
