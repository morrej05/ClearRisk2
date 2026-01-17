/*
  # Update Sector Weightings RLS for Super Admin

  1. Changes
    - Drop old admin policy on sector_weightings
    - Create new policy that only allows super_admin to update
    - Keep read policy for all authenticated users

  2. Security
    - Only super_admin can modify sector weightings
    - All authenticated users can read sector weightings
*/

-- Drop old admin update policy
DROP POLICY IF EXISTS "Admins can update sector weightings" ON sector_weightings;

-- Create new super admin only update policy
CREATE POLICY "Super admins can update sector weightings"
  ON sector_weightings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

-- Add insert policy for super admins (in case they want to add new sectors)
CREATE POLICY "Super admins can insert sector weightings"
  ON sector_weightings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

-- Add delete policy for super admins
CREATE POLICY "Super admins can delete sector weightings"
  ON sector_weightings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );
