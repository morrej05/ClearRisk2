/*
  # Create external_links table for secure external survey access

  1. New Tables
    - `external_links`
      - `id` (uuid, primary key)
      - `survey_id` (uuid, foreign key to survey_reports)
      - `token` (text, unique secure random string)
      - `link_type` (text, full/abridged/recommendation_only)
      - `expires_at` (timestamptz, optional expiration)
      - `used` (boolean, default false)
      - `created_by` (uuid, foreign key to user_profiles)
      - `created_at` (timestamptz, default now())
      - `used_at` (timestamptz, when link was used)
      - `client_name` (text, optional external user name)
      - `client_email` (text, optional external user email)

  2. Security
    - Enable RLS on `external_links` table
    - Admin and surveyor users can create and view links
    - External access validates via token only (no RLS needed for read)

  3. Indexes
    - Unique index on token
    - Index on survey_id for lookups
*/

-- Create external_links table
CREATE TABLE IF NOT EXISTS external_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES survey_reports(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  link_type text NOT NULL CHECK (link_type IN ('full', 'abridged', 'recommendation_only')),
  expires_at timestamptz,
  used boolean DEFAULT false,
  created_by uuid NOT NULL REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  used_at timestamptz,
  client_name text,
  client_email text
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_links_token ON external_links(token);
CREATE INDEX IF NOT EXISTS idx_external_links_survey_id ON external_links(survey_id);
CREATE INDEX IF NOT EXISTS idx_external_links_created_by ON external_links(created_by);

-- Enable RLS
ALTER TABLE external_links ENABLE ROW LEVEL SECURITY;

-- Policy: Admin users can do everything
CREATE POLICY "Admin users can manage all external links"
  ON external_links
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Policy: Surveyors can manage links for their own surveys
CREATE POLICY "Surveyors can manage links for own surveys"
  ON external_links
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = external_links.survey_id
      AND survey_reports.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = external_links.survey_id
      AND survey_reports.user_id = auth.uid()
    )
  );

-- Policy: Allow public read access by token (for external users)
-- This is handled in application logic, not RLS
-- External access bypasses authentication entirely
