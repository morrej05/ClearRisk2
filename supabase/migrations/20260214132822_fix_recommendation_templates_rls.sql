/*
  # Fix RLS Policies for recommendation_templates

  1. Policy Changes
    - Platform admins: SELECT all templates (active + inactive)
    - Normal users: SELECT only is_active = true templates
    - Platform admins only: INSERT, UPDATE, DELETE

  2. Security
    - RLS enforced at database level
    - No bypassing via UI
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read active templates" ON recommendation_templates;
DROP POLICY IF EXISTS "Platform admins can insert templates" ON recommendation_templates;
DROP POLICY IF EXISTS "Platform admins can update templates" ON recommendation_templates;
DROP POLICY IF EXISTS "Platform admins can delete templates" ON recommendation_templates;

-- Platform admins can SELECT all templates (active and inactive)
CREATE POLICY "Platform admins can read all templates"
  ON recommendation_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_platform_admin = true
    )
  );

-- Normal users can SELECT only active templates
CREATE POLICY "Users can read active templates"
  ON recommendation_templates
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_platform_admin = true
    )
  );

-- Platform admins can INSERT templates
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

-- Platform admins can UPDATE templates
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

-- Platform admins can DELETE templates
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
