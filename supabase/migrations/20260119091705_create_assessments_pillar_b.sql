/*
  # Create Assessments (Pillar B) Schema

  1. New Tables
    - `assessments`
      - Core assessment records for FRA, Fire Strategy, DSEAR, Wildfire
      - Supports UK-EN and GENERIC jurisdictions
      - Draft/Issued workflow with versioning

    - `assessment_sections`
      - Template definitions for each assessment type
      - Jurisdiction-specific section configuration
      - Defines required sections and ordering

    - `assessment_responses`
      - User responses for each section
      - Flexible JSONB storage for field data
      - Supports ratings and notes per section

  2. Changes
    - Extend `survey_recommendations` table with `assessment_id`
    - Add CHECK constraint to ensure exactly one parent (survey OR assessment)
    - Add indexes for performance

  3. Security
    - Enable RLS on all new tables
    - Organisation-based access control
    - Platform admin can view all
    - Assessment responses restricted to org members

  4. Notes
    - Supports four assessment types: fra, fire_strategy, dsear, wildfire
    - Two jurisdictions at launch: UK-EN, GENERIC
    - Status workflow: draft → issued
    - Recommendations can belong to either surveys or assessments
*/

-- Create assessments table
CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('fra', 'fire_strategy', 'dsear', 'wildfire')),
  jurisdiction text NOT NULL CHECK (jurisdiction IN ('UK-EN', 'GENERIC')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued')),
  issued_at timestamptz,
  site_name text NOT NULL,
  site_address text,
  client_name text,
  client_address text,
  assessor_name text NOT NULL,
  assessor_company text,
  assessment_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for assessments
CREATE INDEX IF NOT EXISTS idx_assessments_org_type ON assessments(org_id, type);
CREATE INDEX IF NOT EXISTS idx_assessments_org_created ON assessments(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);

-- Create assessment_sections table (templates)
CREATE TABLE IF NOT EXISTS assessment_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_type text NOT NULL CHECK (assessment_type IN ('fra', 'fire_strategy', 'dsear', 'wildfire')),
  jurisdiction text NOT NULL CHECK (jurisdiction IN ('UK-EN', 'GENERIC')),
  section_key text NOT NULL,
  title text NOT NULL,
  sort_order int NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Unique constraint for assessment sections
CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_sections_unique
  ON assessment_sections(assessment_type, jurisdiction, section_key);

-- Create assessment_responses table
CREATE TABLE IF NOT EXISTS assessment_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  field_key text NOT NULL,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  rating text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for assessment_responses
CREATE INDEX IF NOT EXISTS idx_assessment_responses_assessment_section
  ON assessment_responses(assessment_id, section_key);

-- Extend survey_recommendations with assessment_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_recommendations' AND column_name = 'assessment_id'
  ) THEN
    ALTER TABLE survey_recommendations ADD COLUMN assessment_id uuid REFERENCES assessments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add CHECK constraint to ensure exactly one parent (survey_id XOR assessment_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'survey_recommendations_single_parent_check'
  ) THEN
    ALTER TABLE survey_recommendations
    ADD CONSTRAINT survey_recommendations_single_parent_check
    CHECK (
      (survey_id IS NOT NULL AND assessment_id IS NULL) OR
      (survey_id IS NULL AND assessment_id IS NOT NULL)
    );
  END IF;
END $$;

-- Create index for assessment_id lookups
CREATE INDEX IF NOT EXISTS idx_survey_recommendations_assessment_id
  ON survey_recommendations(assessment_id);

-- Enable RLS on assessments
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

-- Enable RLS on assessment_sections
ALTER TABLE assessment_sections ENABLE ROW LEVEL SECURITY;

-- Enable RLS on assessment_responses
ALTER TABLE assessment_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assessments

-- Platform admins can view all assessments
CREATE POLICY "Platform admins can view all assessments"
  ON assessments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_platform_admin = true
    )
  );

-- Organisation members can view their org's assessments
CREATE POLICY "Organisation members can view org assessments"
  ON assessments FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- Organisation members can create assessments for their org
CREATE POLICY "Organisation members can create assessments"
  ON assessments FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- Organisation members can update their org's assessments
CREATE POLICY "Organisation members can update org assessments"
  ON assessments FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- Organisation members can delete their org's draft assessments
CREATE POLICY "Organisation members can delete org draft assessments"
  ON assessments FOR DELETE
  TO authenticated
  USING (
    status = 'draft'
    AND org_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- RLS Policies for assessment_sections (templates are readable by all authenticated)

CREATE POLICY "Authenticated users can view assessment section templates"
  ON assessment_sections FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for assessment_responses

-- Organisation members can view responses for their org's assessments
CREATE POLICY "Organisation members can view assessment responses"
  ON assessment_responses FOR SELECT
  TO authenticated
  USING (
    assessment_id IN (
      SELECT id FROM assessments
      WHERE org_id IN (
        SELECT organisation_id FROM user_profiles
        WHERE id = auth.uid()
      )
    )
  );

-- Organisation members can insert responses for their org's assessments
CREATE POLICY "Organisation members can create assessment responses"
  ON assessment_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    assessment_id IN (
      SELECT id FROM assessments
      WHERE org_id IN (
        SELECT organisation_id FROM user_profiles
        WHERE id = auth.uid()
      )
    )
  );

-- Organisation members can update responses for their org's assessments
CREATE POLICY "Organisation members can update assessment responses"
  ON assessment_responses FOR UPDATE
  TO authenticated
  USING (
    assessment_id IN (
      SELECT id FROM assessments
      WHERE org_id IN (
        SELECT organisation_id FROM user_profiles
        WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    assessment_id IN (
      SELECT id FROM assessments
      WHERE org_id IN (
        SELECT organisation_id FROM user_profiles
        WHERE id = auth.uid()
      )
    )
  );

-- Organisation members can delete responses for their org's assessments
CREATE POLICY "Organisation members can delete assessment responses"
  ON assessment_responses FOR DELETE
  TO authenticated
  USING (
    assessment_id IN (
      SELECT id FROM assessments
      WHERE org_id IN (
        SELECT organisation_id FROM user_profiles
        WHERE id = auth.uid()
      )
    )
  );

-- Add comments for documentation
COMMENT ON TABLE assessments IS 'Professional tier assessments: FRA, Fire Strategy, DSEAR, Wildfire';
COMMENT ON TABLE assessment_sections IS 'Template definitions for assessment sections by type and jurisdiction';
COMMENT ON TABLE assessment_responses IS 'User responses to assessment sections with flexible JSONB storage';
COMMENT ON COLUMN survey_recommendations.assessment_id IS 'Links recommendation to an assessment (mutually exclusive with survey_id)';