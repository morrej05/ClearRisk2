/*
  # Create RE Recommendations System

  ## Overview
  Dedicated recommendations table for Risk Engineering assessments with:
  - Deterministic auto-generation from library + ratings
  - Structured text blocks (Observation, Action, Hazard, Comments)
  - Photo attachments (up to 3 per recommendation)
  - Reference numbering (YYYY-NN format based on document year)
  - Report-ready data structure

  ## 1. New Tables
  
  ### `re_recommendations`
  Main recommendations table with full structured fields for observation, action, hazard, comments

  ### `re_recommendation_library`
  Library of reusable recommendation templates that trigger based on ratings

  ## 2. Security
  - Enable RLS on both tables
  - Users can only see/edit recommendations for documents they have access to
  - Only super_admin can manage the recommendation library

  ## 3. Important Notes
  - Recommendations are document-scoped (not global)
  - rec_number is assigned once and never changes (YYYY-NN format)
  - Sequential numbering per document per year
  - Photos stored in 'evidence' bucket with RLS
*/

-- Create re_recommendation_library table
CREATE TABLE IF NOT EXISTS re_recommendation_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_module_key text NOT NULL,
  source_factor_key text,
  trigger_rating_threshold int NOT NULL CHECK (trigger_rating_threshold BETWEEN 1 AND 2),
  default_title text NOT NULL,
  default_observation text NOT NULL,
  default_action text NOT NULL,
  default_hazard text NOT NULL,
  default_priority text NOT NULL DEFAULT 'Medium' CHECK (default_priority IN ('High', 'Medium', 'Low')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create re_recommendations table
CREATE TABLE IF NOT EXISTS re_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  rec_number text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('auto', 'manual')),
  library_id uuid REFERENCES re_recommendation_library(id) ON DELETE SET NULL,
  source_module_key text NOT NULL,
  source_factor_key text,
  title text NOT NULL,
  observation_text text NOT NULL DEFAULT '',
  action_required_text text NOT NULL DEFAULT '',
  hazard_text text NOT NULL DEFAULT '',
  comments_text text,
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Completed')),
  priority text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
  target_date date,
  owner text,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_suppressed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  
  -- Unique rec_number per document
  UNIQUE(document_id, rec_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_re_recommendations_document ON re_recommendations(document_id);
CREATE INDEX IF NOT EXISTS idx_re_recommendations_status ON re_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_re_recommendations_priority ON re_recommendations(priority);
CREATE INDEX IF NOT EXISTS idx_re_recommendations_source ON re_recommendations(source_module_key, source_factor_key);
CREATE INDEX IF NOT EXISTS idx_re_recommendation_library_module ON re_recommendation_library(source_module_key);

-- Enable RLS
ALTER TABLE re_recommendation_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for re_recommendation_library
-- Only super_admin can manage library
CREATE POLICY "Super admins can view recommendation library"
  ON re_recommendation_library FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can insert recommendation library"
  ON re_recommendation_library FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can update recommendation library"
  ON re_recommendation_library FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can delete recommendation library"
  ON re_recommendation_library FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
  );

-- RLS Policies for re_recommendations
-- Users can view recommendations for documents they have access to
CREATE POLICY "Users can view recommendations for accessible documents"
  ON re_recommendations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      INNER JOIN user_profiles up ON up.organisation_id = d.organisation_id
      WHERE d.id = re_recommendations.document_id
        AND up.id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
  );

-- Users can create recommendations for documents they have access to
CREATE POLICY "Users can create recommendations for accessible documents"
  ON re_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d
      INNER JOIN user_profiles up ON up.organisation_id = d.organisation_id
      WHERE d.id = re_recommendations.document_id
        AND up.id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
  );

-- Users can update recommendations for documents they have access to
CREATE POLICY "Users can update recommendations for accessible documents"
  ON re_recommendations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      INNER JOIN user_profiles up ON up.organisation_id = d.organisation_id
      WHERE d.id = re_recommendations.document_id
        AND up.id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
  );

-- Users can delete recommendations for documents they have access to
CREATE POLICY "Users can delete recommendations for accessible documents"
  ON re_recommendations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      INNER JOIN user_profiles up ON up.organisation_id = d.organisation_id
      WHERE d.id = re_recommendations.document_id
        AND up.id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
  );

-- Function to generate next rec_number for a document
CREATE OR REPLACE FUNCTION generate_rec_number(p_document_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year text;
  v_seq int;
  v_rec_number text;
BEGIN
  -- Get the year from the document's assessment_date or created_at
  SELECT COALESCE(
    EXTRACT(YEAR FROM assessment_date)::text,
    EXTRACT(YEAR FROM created_at)::text,
    EXTRACT(YEAR FROM now())::text
  )
  INTO v_year
  FROM documents
  WHERE id = p_document_id;

  -- Get the next sequence number for this year and document
  SELECT COALESCE(MAX(
    CASE 
      WHEN rec_number ~ ('^' || v_year || '-[0-9]+$')
      THEN CAST(SUBSTRING(rec_number FROM '[0-9]+$') AS int)
      ELSE 0
    END
  ), 0) + 1
  INTO v_seq
  FROM re_recommendations
  WHERE document_id = p_document_id;

  -- Format as YYYY-NN (zero-padded to 2 digits)
  v_rec_number := v_year || '-' || LPAD(v_seq::text, 2, '0');

  RETURN v_rec_number;
END;
$$;

-- Trigger to auto-set rec_number on insert if not provided
CREATE OR REPLACE FUNCTION set_rec_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.rec_number IS NULL OR NEW.rec_number = '' THEN
    NEW.rec_number := generate_rec_number(NEW.document_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_rec_number
  BEFORE INSERT ON re_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION set_rec_number();

-- Trigger to update updated_at timestamp
CREATE TRIGGER trigger_re_recommendations_updated_at
  BEFORE UPDATE ON re_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_re_recommendation_library_updated_at
  BEFORE UPDATE ON re_recommendation_library
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();