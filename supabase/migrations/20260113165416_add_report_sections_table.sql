/*
  # Add Report Sections Table

  1. New Tables
    - `report_sections`
      - `id` (uuid, primary key)
      - `survey_report_id` (uuid, foreign key to survey_reports)
      - `section_name` (text) - Name of the section (e.g., "Roof Details", "Walls")
      - `section_order` (integer) - Order of sections for display
      - `rough_notes` (text) - User's raw input notes
      - `ai_text` (text) - AI-generated content
      - `has_notes` (boolean) - Computed: whether rough_notes exist
      - `show_in_preview` (boolean) - Whether to show in preview
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `user_id` (uuid, foreign key to auth.users) - Who created this section

  2. Security
    - Enable RLS on `report_sections` table
    - Add policies for authenticated users to manage their own report sections
*/

-- Create report_sections table
CREATE TABLE IF NOT EXISTS report_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_report_id uuid NOT NULL REFERENCES survey_reports(id) ON DELETE CASCADE,
  section_name text NOT NULL,
  section_order integer DEFAULT 0,
  rough_notes text DEFAULT '',
  ai_text text DEFAULT '',
  has_notes boolean GENERATED ALWAYS AS (rough_notes IS NOT NULL AND rough_notes != '') STORED,
  show_in_preview boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT valid_section_order CHECK (section_order >= 0)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_report_sections_survey_report_id ON report_sections(survey_report_id);
CREATE INDEX IF NOT EXISTS idx_report_sections_user_id ON report_sections(user_id);
CREATE INDEX IF NOT EXISTS idx_report_sections_order ON report_sections(survey_report_id, section_order);

-- Enable RLS
ALTER TABLE report_sections ENABLE ROW LEVEL SECURITY;

-- Policies for report_sections
CREATE POLICY "Users can view report sections for their surveys"
  ON report_sections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = report_sections.survey_report_id
      AND survey_reports.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert report sections for their surveys"
  ON report_sections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = report_sections.survey_report_id
      AND survey_reports.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update report sections for their surveys"
  ON report_sections
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = report_sections.survey_report_id
      AND survey_reports.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = report_sections.survey_report_id
      AND survey_reports.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete report sections for their surveys"
  ON report_sections
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = report_sections.survey_report_id
      AND survey_reports.user_id = auth.uid()
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_report_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER report_sections_updated_at
  BEFORE UPDATE ON report_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_report_sections_updated_at();

-- Add ai_summary field to survey_reports table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'ai_summary'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN ai_summary text DEFAULT '';
  END IF;
END $$;