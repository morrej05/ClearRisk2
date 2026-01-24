/*
  # Add Survey Status Column

  1. Changes
    - Add `status` column to survey_reports table with proper values
    - Migrate existing data: issued=true becomes status='issued', else 'draft'
    - Add index for status queries

  2. Notes
    - Status can be: 'draft', 'issued', 'superseded'
    - Maintains backward compatibility with 'issued' boolean
*/

-- Add status column with default 'draft'
ALTER TABLE survey_reports 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';

-- Migrate existing data: if issued=true, set status='issued'
UPDATE survey_reports 
SET status = CASE 
  WHEN issued = true THEN 'issued'
  ELSE 'draft'
END;

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_survey_reports_status ON survey_reports(status);

-- Add check constraint for valid statuses (only if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_survey_status'
  ) THEN
    ALTER TABLE survey_reports 
    ADD CONSTRAINT check_survey_status 
    CHECK (status IN ('draft', 'issued', 'superseded'));
  END IF;
END $$;
