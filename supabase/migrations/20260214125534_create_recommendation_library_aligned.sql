/*
  # Create Aligned Recommendation Library System

  1. New Tables
    - `recommendation_library`
      - Platform-admin-managed library of reusable recommendations
      - Fields aligned with actual recommendation instances in RE09
      - Contains only template-level fields (no instance-specific data)

  2. Security
    - READ: All authenticated users (within org context)
    - INSERT/UPDATE/DELETE: Platform admins only
    - Enforced via RLS with is_platform_admin flag

  3. Library Fields (canonical, matching RE09 form):
    - title (required)
    - observation_text (required)
    - action_required_text (required)
    - hazard_risk_description (required) - neutral wording
    - client_response_prompt (optional guidance)
    - priority (High/Medium/Low, default Medium)
    - related_module_key (e.g., RE_06_FIRE_PROTECTION)
    - is_active (boolean, default true)
    - tags (array of strings, optional)

  4. Instance-only fields (NOT in library):
    - owner, target_date, status (Open/Closed)
    - author_comments_internal, photos
    These remain in re_recommendations table only
*/

-- Drop old tables if they exist (clean slate)
DROP TABLE IF EXISTS survey_recommendations CASCADE;
DROP TABLE IF EXISTS recommendation_templates CASCADE;

-- Create recommendation_library table
CREATE TABLE IF NOT EXISTS recommendation_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core recommendation fields (aligned with RE09 form)
  title text NOT NULL,
  observation_text text NOT NULL,
  action_required_text text NOT NULL,
  hazard_risk_description text NOT NULL,
  client_response_prompt text,

  -- Metadata
  priority text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
  related_module_key text,
  is_active boolean NOT NULL DEFAULT true,
  tags text[] DEFAULT '{}',

  -- Optional: original recommendation code for legacy mapping
  legacy_code text,

  -- Audit fields
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recommendation_library_active ON recommendation_library(is_active);
CREATE INDEX IF NOT EXISTS idx_recommendation_library_priority ON recommendation_library(priority);
CREATE INDEX IF NOT EXISTS idx_recommendation_library_module ON recommendation_library(related_module_key);
CREATE INDEX IF NOT EXISTS idx_recommendation_library_tags ON recommendation_library USING gin(tags);

-- Enable RLS
ALTER TABLE recommendation_library ENABLE ROW LEVEL SECURITY;

-- RLS Policies: READ for all authenticated, WRITE for platform admins only

-- All authenticated users can read active library items
CREATE POLICY "Authenticated users can read active library items"
  ON recommendation_library
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

-- Platform admins can insert library items
CREATE POLICY "Platform admins can insert library items"
  ON recommendation_library
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_platform_admin = true
    )
  );

-- Platform admins can update library items
CREATE POLICY "Platform admins can update library items"
  ON recommendation_library
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

-- Platform admins can delete library items (soft delete via is_active preferred)
CREATE POLICY "Platform admins can delete library items"
  ON recommendation_library
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
CREATE OR REPLACE FUNCTION update_recommendation_library_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_recommendation_library_updated_at
  BEFORE UPDATE ON recommendation_library
  FOR EACH ROW
  EXECUTE FUNCTION update_recommendation_library_updated_at();

COMMENT ON TABLE recommendation_library IS 'Platform-admin-managed library of reusable recommendations. Fields aligned with RE09 recommendation instances.';
COMMENT ON COLUMN recommendation_library.hazard_risk_description IS 'Neutral, factual risk statement with no client/insurer references. Generated via template or manually added.';
COMMENT ON COLUMN recommendation_library.client_response_prompt IS 'Optional guidance for client response/closeout documentation.';
