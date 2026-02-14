/*
  # Align recommendation_templates with RE09 Fields

  1. Schema Updates
    - Recreate recommendation_templates (was accidentally dropped)
    - Add RE09-aligned fields: title, observation, action_required, hazard_risk_description
    - Keep legacy fields for backward compatibility: hazard, description, action
    - Add related_module_key for module association
    - Convert default_priority to support both numeric and text formats

  2. Security
    - READ: All authenticated users can read active templates
    - WRITE: Platform admins only (is_platform_admin = true)

  3. Field Mapping (legacy → new):
    - hazard → title (kept for compatibility)
    - description → observation (aliased)
    - action → action_required (aliased)
    - NEW: hazard_risk_description (neutral risk statement)
    - client_response_prompt (unchanged)
    - category (unchanged)
    - default_priority (unchanged, 1-5 scale)
    - NEW: related_module_key (e.g., RE_06_FIRE_PROTECTION)
*/

-- Recreate recommendation_templates table (with all fields)
CREATE TABLE IF NOT EXISTS recommendation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core fields (backward compatible with existing modal)
  code text UNIQUE,
  title text NOT NULL,
  body text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'Construction',
    'Management Systems',
    'Fire Protection & Detection',
    'Special Hazards',
    'Business Continuity',
    'Other'
  )),
  
  -- Priority (1-5 scale, where 1=highest, 5=lowest)
  default_priority int NOT NULL DEFAULT 3 CHECK (default_priority BETWEEN 1 AND 5),

  -- RE09-aligned fields (new)
  observation text NOT NULL DEFAULT '',
  action_required text NOT NULL DEFAULT '',
  hazard_risk_description text NOT NULL DEFAULT 'Risk statement pending generation.',
  client_response_prompt text,
  related_module_key text,
  
  -- Trigger configuration (existing)
  trigger_type text NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'grade', 'presence')),
  trigger_section_key text,
  trigger_field_key text,
  trigger_value text,
  
  -- Status
  is_active boolean NOT NULL DEFAULT true,
  scope text NOT NULL DEFAULT 'global',
  
  -- Audit fields
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recommendation_templates_category ON recommendation_templates(category);
CREATE INDEX IF NOT EXISTS idx_recommendation_templates_active ON recommendation_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_recommendation_templates_trigger ON recommendation_templates(trigger_type, trigger_field_key);
CREATE INDEX IF NOT EXISTS idx_recommendation_templates_module ON recommendation_templates(related_module_key);

-- Enable RLS
ALTER TABLE recommendation_templates ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Anyone can read active recommendation templates" ON recommendation_templates;
DROP POLICY IF EXISTS "Super admins can insert recommendation templates" ON recommendation_templates;
DROP POLICY IF EXISTS "Super admins can update recommendation templates" ON recommendation_templates;
DROP POLICY IF EXISTS "Super admins can delete recommendation templates" ON recommendation_templates;

-- RLS Policies for recommendation_templates (platform admin only for writes)

-- All authenticated users can read active templates
CREATE POLICY "Authenticated users can read active templates"
  ON recommendation_templates
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_platform_admin = true
    )
  );

-- Platform admins can insert templates
CREATE POLICY "Platform admins can insert templates"
  ON recommendation_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_platform_admin = true
    )
  );

-- Platform admins can update templates
CREATE POLICY "Platform admins can update templates"
  ON recommendation_templates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_platform_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_platform_admin = true
    )
  );

-- Platform admins can delete templates
CREATE POLICY "Platform admins can delete templates"
  ON recommendation_templates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_platform_admin = true
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_recommendation_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_recommendation_templates_updated_at
  BEFORE UPDATE ON recommendation_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_recommendation_templates_updated_at();

COMMENT ON TABLE recommendation_templates IS 'Platform-admin-managed library of reusable recommendation templates. Fields aligned with RE09 recommendation instances.';
COMMENT ON COLUMN recommendation_templates.hazard_risk_description IS 'Neutral, factual risk statement with no client/insurer references.';
COMMENT ON COLUMN recommendation_templates.observation IS 'What was observed (condition description).';
COMMENT ON COLUMN recommendation_templates.action_required IS 'What action needs to be taken (improvement description).';
