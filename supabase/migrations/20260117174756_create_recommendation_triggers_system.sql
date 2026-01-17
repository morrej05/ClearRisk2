/*
  # Create Recommendation Triggers System
  
  ## Purpose
  Restores auto-generated (triggered) recommendations when graded fields match specific values.
  
  ## Changes
  
  1. New Table: recommendation_triggers
    - Maps (section_key, field_key, rating_value) to recommendation templates
    - Allows configuring which recommendations fire for which field ratings
    - Columns: id, section_key, field_key, rating_value, template_id, priority, is_active
    - Unique constraint on (section_key, field_key, rating_value)
    
  2. Update survey_recommendations
    - Add trigger_key for idempotent upserts
    - Add trigger_context jsonb for storing trigger metadata
    - Add unique constraint on (survey_id, trigger_key) for upsert behavior
    
  3. Security
    - recommendation_triggers: READ all authenticated, WRITE super_admin only
    - survey_recommendations: Existing RLS policies continue to work
    
  ## Trigger Flow
  When a field is graded (e.g., "Fire Detection" = "Poor"):
  1. Look up triggers matching (section_key="fire_safety", field_key="fire_detection", rating_value="Poor")
  2. For each match, UPSERT recommendation using trigger_key as unique identifier
  3. If grade changes/improves, set include_in_report=false (soft delete)
*/

-- ============================================================================
-- Create recommendation_triggers table
-- ============================================================================

CREATE TABLE IF NOT EXISTS recommendation_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL,
  field_key text NOT NULL,
  rating_value text NOT NULL,
  template_id uuid NOT NULL REFERENCES recommendation_templates(id) ON DELETE CASCADE,
  priority int NOT NULL DEFAULT 4 CHECK (priority >= 1 AND priority <= 5),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  
  CONSTRAINT recommendation_triggers_unique_key UNIQUE (section_key, field_key, rating_value, template_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_recommendation_triggers_lookup
  ON recommendation_triggers(section_key, field_key, rating_value, is_active);

CREATE INDEX IF NOT EXISTS idx_recommendation_triggers_template
  ON recommendation_triggers(template_id);

-- Enable RLS
ALTER TABLE recommendation_triggers ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active triggers
CREATE POLICY "Authenticated users can read active triggers"
  ON recommendation_triggers FOR SELECT
  TO authenticated
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM super_admins WHERE super_admins.id = auth.uid()
  ));

-- Super admins can manage triggers
CREATE POLICY "Super admins can insert triggers"
  ON recommendation_triggers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.id = auth.uid())
  );

CREATE POLICY "Super admins can update triggers"
  ON recommendation_triggers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.id = auth.uid())
  );

CREATE POLICY "Super admins can delete triggers"
  ON recommendation_triggers FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.id = auth.uid())
  );

-- ============================================================================
-- Update survey_recommendations for idempotent triggers
-- ============================================================================

-- Add trigger fields
ALTER TABLE survey_recommendations
  ADD COLUMN IF NOT EXISTS trigger_key text,
  ADD COLUMN IF NOT EXISTS trigger_context jsonb;

-- Create unique constraint for idempotent upserts
-- First check if constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'survey_recommendations_trigger_key_unique'
  ) THEN
    ALTER TABLE survey_recommendations
      ADD CONSTRAINT survey_recommendations_trigger_key_unique
      UNIQUE NULLS NOT DISTINCT (survey_id, trigger_key);
  END IF;
END $$;

-- Create index for trigger lookups
CREATE INDEX IF NOT EXISTS idx_survey_recommendations_trigger_key
  ON survey_recommendations(survey_id, trigger_key) WHERE trigger_key IS NOT NULL;

-- ============================================================================
-- Create updated_at trigger for recommendation_triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_recommendation_triggers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_recommendation_triggers_updated_at
  BEFORE UPDATE ON recommendation_triggers
  FOR EACH ROW
  EXECUTE FUNCTION update_recommendation_triggers_updated_at();
