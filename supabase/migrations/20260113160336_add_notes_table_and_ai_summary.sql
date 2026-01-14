/*
  # Add Notes Table and AI Summary Fields

  1. New Tables
    - `survey_notes`
      - `id` (uuid, primary key)
      - `survey_id` (uuid, foreign key to survey_reports)
      - `section_name` (text) - e.g., "Section 2", "Fire Protection"
      - `note_text` (text) - the actual note content
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to `survey_reports`
    - Add `notes_summary` (text, nullable) - AI-generated summary
    - Add `template_version` (text, default '1.0') - template versioning

  3. Security
    - Enable RLS on `survey_notes` table
    - Add policies for authenticated users to manage their own notes
*/

-- Create survey_notes table
CREATE TABLE IF NOT EXISTS survey_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES survey_reports(id) ON DELETE CASCADE,
  section_name text NOT NULL,
  note_text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add template_version column to survey_reports if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'template_version'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN template_version text DEFAULT '1.0';
  END IF;
END $$;

-- Add notes_summary column to survey_reports if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'notes_summary'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN notes_summary text;
  END IF;
END $$;

-- Enable RLS on survey_notes
ALTER TABLE survey_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view notes for their own surveys
CREATE POLICY "Users can view own survey notes"
  ON survey_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = survey_notes.survey_id
      AND survey_reports.user_id = auth.uid()
    )
  );

-- Policy: Users can insert notes for their own surveys
CREATE POLICY "Users can create own survey notes"
  ON survey_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = survey_notes.survey_id
      AND survey_reports.user_id = auth.uid()
    )
  );

-- Policy: Users can update notes for their own surveys
CREATE POLICY "Users can update own survey notes"
  ON survey_notes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = survey_notes.survey_id
      AND survey_reports.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = survey_notes.survey_id
      AND survey_reports.user_id = auth.uid()
    )
  );

-- Policy: Users can delete notes for their own surveys
CREATE POLICY "Users can delete own survey notes"
  ON survey_notes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = survey_notes.survey_id
      AND survey_reports.user_id = auth.uid()
    )
  );

-- Create updated_at trigger for survey_notes
CREATE OR REPLACE FUNCTION update_survey_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_survey_notes_updated_at
  BEFORE UPDATE ON survey_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_survey_notes_updated_at();