/*
  # Fix Users Can Update Own Name Policy

  1. Changes
    - Drop old policy that references is_admin() function (which doesn't exist)
    - Create new policy that allows users to update their own name/email
    - Prevent users from changing their own role

  2. Security
    - Users can update their own profile data (name, email)
    - Users CANNOT change their own role
    - Role changes require admin privileges

  3. Notes
    - Fixes issue with undefined is_admin() function
*/

-- Drop old policy with broken function reference
DROP POLICY IF EXISTS "Users can update own name" ON user_profiles;

-- Create new policy that allows self-update but prevents role changes
CREATE POLICY "Users can update own profile data"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    role = (SELECT role FROM user_profiles WHERE id = auth.uid())
  );
