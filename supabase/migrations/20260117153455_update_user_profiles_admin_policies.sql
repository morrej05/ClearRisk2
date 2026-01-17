/*
  # Update User Profiles Admin Policies

  1. Changes
    - Drop old "Admins can X" policies that check for 'admin' role
    - Create new policies for org_admin and super_admin roles
    - Ensure proper access control for user management

  2. Security
    - Super admins can insert/update/delete user profiles
    - Org admins can insert/update/delete user profiles
    - Regular users can only update their own name (role protected)

  3. Notes
    - Old 'admin' role no longer exists
    - New roles: super_admin, org_admin, surveyor
*/

-- Drop old admin policies
DROP POLICY IF EXISTS "Admins can delete user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all user profiles" ON user_profiles;

-- Super admins can insert user profiles
CREATE POLICY "Super admins can insert user profiles"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'super_admin'
    )
  );

-- Org admins can insert user profiles
CREATE POLICY "Org admins can insert user profiles"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('org_admin', 'super_admin')
    )
  );

-- Super admins can update all user profiles
CREATE POLICY "Super admins can update all user profiles"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'super_admin'
    )
  );

-- Org admins can update all user profiles
CREATE POLICY "Org admins can update all user profiles"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('org_admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('org_admin', 'super_admin')
    )
  );

-- Super admins can delete user profiles
CREATE POLICY "Super admins can delete user profiles"
  ON user_profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'super_admin'
    )
  );

-- Org admins can delete user profiles
CREATE POLICY "Org admins can delete user profiles"
  ON user_profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('org_admin', 'super_admin')
    )
  );
