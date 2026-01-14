/*
  # Create survey_reports table

  ## Overview
  Creates the main table for storing survey reports with property information, form data, and generated AI reports.

  ## New Tables
  
  ### `survey_reports`
  Main table for storing survey report data
  - `id` (uuid, primary key) - Unique survey identifier
  - `user_id` (uuid, foreign key) - Owner of the survey
  - `property_name` (text) - Property name displayed in dashboard
  - `property_address` (text) - Property address for display
  - `form_data` (jsonb) - Complete survey form data stored as JSON
  - `generated_report` (text) - AI-generated report output (HTML)
  - `summary_text` (text) - AI-generated summary text for future use
  - `created_at` (timestamptz) - Timestamp when report was created
  - `updated_at` (timestamptz) - Timestamp when report was last updated

  ## Security
  - Enable Row Level Security (RLS) on `survey_reports` table
  - Add policy for authenticated users to view their own reports
  - Add policy for authenticated users to create reports
  - Add policy for authenticated users to update their own reports
  - Add policy for authenticated users to delete their own reports

  ## Indexes
  - Index on `user_id` for efficient queries by user

  ## Notes
  - All columns except id, created_at, and updated_at are nullable
  - Uses JSONB for flexible form data storage
  - Timestamps are automatically managed with defaults
*/

CREATE TABLE IF NOT EXISTS survey_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  property_name text,
  property_address text,
  form_data jsonb DEFAULT '{}'::jsonb,
  generated_report text,
  summary_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
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