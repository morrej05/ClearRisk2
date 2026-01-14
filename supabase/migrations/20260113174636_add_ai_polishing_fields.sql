/*
  # Add AI Polishing Fields to Survey Reports

  1. New Columns
    - `survey_text` (text, nullable) - Original survey report text written by author
    - `recommendation_text` (text, nullable) - AI-polished version of the survey report
    - `ai_polished` (boolean, default false) - Flag indicating if AI has polished this report
    
  2. Purpose
    - Enables deterministic AI polishing workflow
    - Separates original author text from AI-enhanced version
    - Prevents accidental re-polishing with ai_polished flag
    
  3. Notes
    - survey_text stores the raw, unpolished report content
    - recommendation_text stores AI-enhanced version (generated with temperature=0)
    - ai_polished=true prevents accidental overwriting of polished content
*/

-- Add survey_text column to store original author-written text
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'survey_text'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN survey_text text;
  END IF;
END $$;

-- Add recommendation_text column to store AI-polished version
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'recommendation_text'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN recommendation_text text;
  END IF;
END $$;

-- Add ai_polished flag to track polishing status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'ai_polished'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN ai_polished boolean DEFAULT false;
  END IF;
END $$;

-- Add comment for clarity
COMMENT ON COLUMN survey_reports.survey_text IS 'Original survey report text written by author';
COMMENT ON COLUMN survey_reports.recommendation_text IS 'AI-polished version of survey report (temperature=0 for deterministic output)';
COMMENT ON COLUMN survey_reports.ai_polished IS 'True if AI has polished this report; prevents accidental re-polishing';