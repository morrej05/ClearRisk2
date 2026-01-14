/*
  # Add Survey Framework Architecture

  1. Changes to survey_reports
    - Add `framework_type` column to distinguish different survey frameworks
      - fire_property: Fire Property Risk Survey (default, current)
      - fire_risk_assessment: FRA surveys
      - atex: ATEX/DSEAR surveys
      - asear: ASEAR surveys

  2. New Tables
    - `survey_sections`
      - Tracks completion status of individual sections within a survey
      - `survey_id` (uuid, foreign key)
      - `section_code` (text) - standardized codes like FP_01_Location, FP_02_Construction
      - `section_complete` (boolean)
      - `completed_at` (timestamp)
      - Enables framework-agnostic section tracking

  3. Security
    - Enable RLS on survey_sections table
    - Add policies for authenticated users to manage their own survey sections

  4. Important Notes
    - This migration establishes the foundation for multi-framework support
    - All existing surveys default to 'fire_property' framework
    - Section codes follow naming convention: [Framework]_[Number]_[Name]
      - FP = Fire Property
      - AT = ATEX
      - AS = ASEAR
      - FR = Fire Risk Assessment
*/

-- Add framework_type column to survey_reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'framework_type'
  ) THEN
    ALTER TABLE survey_reports
    ADD COLUMN framework_type text NOT NULL DEFAULT 'fire_property'
    CHECK (framework_type IN ('fire_property', 'fire_risk_assessment', 'atex', 'asear'));
  END IF;
END $$;

-- Create survey_sections table
CREATE TABLE IF NOT EXISTS survey_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES survey_reports(id) ON DELETE CASCADE,
  section_code text NOT NULL,
  section_complete boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(survey_id, section_code)
);

-- Enable RLS on survey_sections
ALTER TABLE survey_sections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own survey sections
CREATE POLICY "Users can view own survey sections"
  ON survey_sections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = survey_sections.survey_id
      AND survey_reports.user_id = auth.uid()
    )
  );

-- Policy: Users can insert their own survey sections
CREATE POLICY "Users can insert own survey sections"
  ON survey_sections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = survey_sections.survey_id
      AND survey_reports.user_id = auth.uid()
    )
  );

-- Policy: Users can update their own survey sections
CREATE POLICY "Users can update own survey sections"
  ON survey_sections
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = survey_sections.survey_id
      AND survey_reports.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = survey_sections.survey_id
      AND survey_reports.user_id = auth.uid()
    )
  );

-- Policy: Users can delete their own survey sections
CREATE POLICY "Users can delete own survey sections"
  ON survey_sections
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = survey_sections.survey_id
      AND survey_reports.user_id = auth.uid()
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_survey_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_survey_sections_updated_at ON survey_sections;

CREATE TRIGGER update_survey_sections_updated_at
  BEFORE UPDATE ON survey_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_survey_sections_updated_at();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_survey_sections_survey_id ON survey_sections(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_sections_section_code ON survey_sections(section_code);
