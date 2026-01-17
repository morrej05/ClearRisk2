/*
  # Update User Roles to Super Admin System

  1. Changes
    - Updates role enum to support: super_admin, org_admin, surveyor
    - Migrates existing 'admin' users to 'org_admin'
    - Migrates existing 'user' users to 'surveyor'
    - Updates all RLS policies to use new role names
    - First user becomes super_admin automatically

  2. New Role Hierarchy
    - super_admin: Platform-wide settings (sector weightings, recommendation library)
    - org_admin: Organization management (users, surveys, client branding)
    - surveyor: Create and edit surveys only

  3. Security
    - Super admin can see everything
    - Org admin can manage their organization
    - Surveyor has limited access to surveys

  4. Notes
    - sector_weightings table remains globally scoped (not per org)
    - Platform-level settings only accessible to super_admin
*/

-- Step 1: Drop the existing constraint FIRST
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Step 2: Now migrate existing roles
UPDATE user_profiles 
SET role = CASE 
  WHEN role = 'admin' THEN 'org_admin'
  WHEN role = 'user' THEN 'surveyor'
  WHEN role = 'external' THEN 'surveyor'
  ELSE 'surveyor'
END
WHERE role IN ('admin', 'user', 'external');

-- Step 3: Make the first created user a super_admin
UPDATE user_profiles 
SET role = 'super_admin'
WHERE id = (
  SELECT id FROM user_profiles 
  ORDER BY created_at ASC 
  LIMIT 1
);

-- Step 4: Add the new constraint
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check 
  CHECK (role IN ('super_admin', 'org_admin', 'surveyor'));

-- Update default role in the table
ALTER TABLE user_profiles ALTER COLUMN role SET DEFAULT 'surveyor';

-- Drop old admin policies
DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all surveys" ON survey_reports;
DROP POLICY IF EXISTS "Admins can update all surveys" ON survey_reports;
DROP POLICY IF EXISTS "Admins can delete all surveys" ON survey_reports;

-- Create new policies for user_profiles

-- Super admins can read all profiles
CREATE POLICY "Super admins can read all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Org admins can read all profiles
CREATE POLICY "Org admins can read all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('org_admin', 'super_admin')
    )
  );

-- Create new policies for survey_reports

-- Super admins can view all surveys
CREATE POLICY "Super admins can view all surveys"
  ON survey_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Org admins can view all surveys
CREATE POLICY "Org admins can view all surveys"
  ON survey_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('org_admin', 'super_admin')
    )
  );

-- Super admins can update all surveys
CREATE POLICY "Super admins can update all surveys"
  ON survey_reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Org admins can update all surveys
CREATE POLICY "Org admins can update all surveys"
  ON survey_reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('org_admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('org_admin', 'super_admin')
    )
  );

-- Super admins can delete all surveys
CREATE POLICY "Super admins can delete all surveys"
  ON survey_reports
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Org admins can delete all surveys
CREATE POLICY "Org admins can delete all surveys"
  ON survey_reports
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('org_admin', 'super_admin')
    )
  );

-- Update the handle_new_user function to use new roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_count integer;
BEGIN
  -- Count existing users
  SELECT COUNT(*) INTO user_count FROM user_profiles;

  -- Insert new profile, make first user super_admin, rest are surveyors
  INSERT INTO public.user_profiles (id, role, name)
  VALUES (
    NEW.id,
    CASE WHEN user_count = 0 THEN 'super_admin' ELSE 'surveyor' END,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
