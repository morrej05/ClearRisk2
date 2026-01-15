/*
  # Add Admin User Management Policies

  1. New Policies
    - Allow admins to update any user profile (including role changes)
    - Allow admins to delete user profiles
    - Allow admins to insert new user profiles

  2. Security
    - Only users with 'admin' role can manage other users
    - Regular users can still update their own name (existing policy)
    - Users cannot change their own role

  3. Important Notes
    - Admins have full control over user management
    - This enables the user management panel for admins
*/

-- Policy: Admins can update any user profile including roles
CREATE POLICY "Admins can update all user profiles"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Policy: Admins can delete user profiles
CREATE POLICY "Admins can delete user profiles"
  ON user_profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Policy: Admins can insert new user profiles
CREATE POLICY "Admins can insert user profiles"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );
