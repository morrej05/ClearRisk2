/*
  # Create RE-06 Fire Protection Tables

  1. New Tables
    - `re06_site_water`
      - Site-level water supply and fire pump assessment
      - One record per document
      - Stores water reliability, pump configuration, testing regime
      - Produces water_score_1_5 (1-5 rating)

    - `re06_building_sprinklers`
      - Building-level sprinkler assessment
      - One record per building per document
      - Stores coverage %, adequacy, maintenance status
      - Produces sprinkler_score_1_5 and final_active_score_1_5 (min of sprinkler and water)

  2. Security
    - Enable RLS on both tables
    - Authenticated users can read records for documents they have access to
    - Authenticated users can insert/update records for documents they have access to

  3. Constraints
    - Unique constraint on document_id for re06_site_water
    - Unique constraint on (document_id, building_id) for re06_building_sprinklers
*/

-- Create re06_site_water table
CREATE TABLE IF NOT EXISTS re06_site_water (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  data jsonb DEFAULT '{}'::jsonb,
  water_score_1_5 int CHECK (water_score_1_5 >= 1 AND water_score_1_5 <= 5),
  comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add unique constraint on document_id (one site water record per document)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 're06_site_water_document_id_unique'
  ) THEN
    ALTER TABLE re06_site_water ADD CONSTRAINT re06_site_water_document_id_unique UNIQUE (document_id);
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS re06_site_water_document_id_idx ON re06_site_water(document_id);

-- Create re06_building_sprinklers table
CREATE TABLE IF NOT EXISTS re06_building_sprinklers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES re_buildings(id) ON DELETE CASCADE,
  data jsonb DEFAULT '{}'::jsonb,
  sprinkler_score_1_5 int CHECK (sprinkler_score_1_5 >= 1 AND sprinkler_score_1_5 <= 5),
  final_active_score_1_5 int CHECK (final_active_score_1_5 >= 1 AND final_active_score_1_5 <= 5),
  comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add unique constraint on (document_id, building_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 're06_building_sprinklers_doc_bldg_unique'
  ) THEN
    ALTER TABLE re06_building_sprinklers ADD CONSTRAINT re06_building_sprinklers_doc_bldg_unique UNIQUE (document_id, building_id);
  END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS re06_building_sprinklers_document_id_idx ON re06_building_sprinklers(document_id);
CREATE INDEX IF NOT EXISTS re06_building_sprinklers_building_id_idx ON re06_building_sprinklers(building_id);

-- Enable RLS
ALTER TABLE re06_site_water ENABLE ROW LEVEL SECURITY;
ALTER TABLE re06_building_sprinklers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for re06_site_water
CREATE POLICY "Users can view site water records for accessible documents"
  ON re06_site_water FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = re06_site_water.document_id
      AND documents.organisation_id IN (
        SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert site water records for accessible documents"
  ON re06_site_water FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = re06_site_water.document_id
      AND documents.organisation_id IN (
        SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update site water records for accessible documents"
  ON re06_site_water FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = re06_site_water.document_id
      AND documents.organisation_id IN (
        SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = re06_site_water.document_id
      AND documents.organisation_id IN (
        SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for re06_building_sprinklers
CREATE POLICY "Users can view building sprinkler records for accessible documents"
  ON re06_building_sprinklers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = re06_building_sprinklers.document_id
      AND documents.organisation_id IN (
        SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert building sprinkler records for accessible documents"
  ON re06_building_sprinklers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = re06_building_sprinklers.document_id
      AND documents.organisation_id IN (
        SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update building sprinkler records for accessible documents"
  ON re06_building_sprinklers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = re06_building_sprinklers.document_id
      AND documents.organisation_id IN (
        SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = re06_building_sprinklers.document_id
      AND documents.organisation_id IN (
        SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

-- Add updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_re06_site_water_updated_at'
  ) THEN
    CREATE TRIGGER update_re06_site_water_updated_at
      BEFORE UPDATE ON re06_site_water
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_re06_building_sprinklers_updated_at'
  ) THEN
    CREATE TRIGGER update_re06_building_sprinklers_updated_at
      BEFORE UPDATE ON re06_building_sprinklers
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
