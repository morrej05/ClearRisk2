/*
  # Create survey reports schema

  ## Overview
  Creates the database structure for the ClearRisk survey draft tool, allowing users to create and store survey reports with multiple sections.

  ## New Tables
  
  ### `survey_reports`
  Main table for storing survey report data
  - `id` (uuid, primary key) - Unique identifier for each report
  - `title` (text) - Title of the survey report
  - `section_data` (jsonb) - Flexible storage for all section form data
  - `status` (text) - Report status (draft or submitted)
  - `created_at` (timestamptz) - Timestamp when report was created
  - `updated_at` (timestamptz) - Timestamp when report was last updated
  - `user_id` (uuid) - Reference to the user who created the report

  ## Security
  - Enable RLS on `survey_reports` table
  - Add policy for authenticated users to view their own reports
  - Add policy for authenticated users to create reports
  - Add policy for authenticated users to update their own reports
  - Add policy for authenticated users to delete their own reports

  ## Notes
  - Uses JSONB for flexible section data storage
  - Status defaults to 'draft' for new reports
  - Timestamps are automatically managed
*/

CREATE TABLE IF NOT EXISTS survey_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  section_data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id)
);

ALTER TABLE survey_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports"
  ON survey_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create reports"
  ON survey_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports"
  ON survey_reports FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON survey_reports FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_survey_reports_user_id ON survey_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_survey_reports_status ON survey_reports(status);