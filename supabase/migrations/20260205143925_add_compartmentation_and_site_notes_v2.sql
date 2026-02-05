/*
  # Add compartmentation minutes and site notes

  1. Changes to re_buildings
    - Add `compartmentation_minutes` integer column (nullable)
    - Represents fire compartmentation factor in minutes (0, 60, 120, 180, 240, or null for unknown)

  2. New Table: re_site_notes
    - `document_id` (uuid, primary key, references documents)
    - `construction_notes` (text) - Site-level construction observations
    - `fire_protection_notes` (text) - Site-level fire protection observations
    - `updated_at` (timestamptz) - Last update timestamp
    
  3. Security
    - Enable RLS on re_site_notes
    - Add policies for authenticated users to read/write their org's data
*/

-- Add compartmentation_minutes to re_buildings
ALTER TABLE re_buildings 
ADD COLUMN IF NOT EXISTS compartmentation_minutes integer;

-- Create re_site_notes table
CREATE TABLE IF NOT EXISTS re_site_notes (
  document_id uuid PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  construction_notes text,
  fire_protection_notes text,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE re_site_notes ENABLE ROW LEVEL SECURITY;

-- Policies for re_site_notes (authenticated users can manage their org's notes)
CREATE POLICY "Users can read site notes for their org documents"
  ON re_site_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = re_site_notes.document_id
      AND documents.organisation_id IN (
        SELECT organisation_id FROM user_profiles
        WHERE user_profiles.id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert site notes for their org documents"
  ON re_site_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = re_site_notes.document_id
      AND documents.organisation_id IN (
        SELECT organisation_id FROM user_profiles
        WHERE user_profiles.id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update site notes for their org documents"
  ON re_site_notes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = re_site_notes.document_id
      AND documents.organisation_id IN (
        SELECT organisation_id FROM user_profiles
        WHERE user_profiles.id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = re_site_notes.document_id
      AND documents.organisation_id IN (
        SELECT organisation_id FROM user_profiles
        WHERE user_profiles.id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete site notes for their org documents"
  ON re_site_notes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = re_site_notes.document_id
      AND documents.organisation_id IN (
        SELECT organisation_id FROM user_profiles
        WHERE user_profiles.id = auth.uid()
      )
    )
  );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_re_site_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_re_site_notes_updated_at_trigger ON re_site_notes;

CREATE TRIGGER update_re_site_notes_updated_at_trigger
  BEFORE UPDATE ON re_site_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_re_site_notes_updated_at();
