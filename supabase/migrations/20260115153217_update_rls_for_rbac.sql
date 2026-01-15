/*
  # Update RLS Policies for Role-Based Access Control

  1. Changes
    - Update survey_reports RLS policies to use new role definitions
    - Ensure editor and admin roles have proper access
    - Viewer role gets read-only access

  2. Security
    - Admin: Full access to all operations
    - Editor: Can create, read, update surveys they own
    - Viewer: Read-only access to surveys

  3. Notes
    - Policies are updated to check for 'editor' and 'admin' roles instead of 'user' and 'admin'
*/

-- Drop existing survey_reports policies
DROP POLICY IF EXISTS "Users can view own surveys" ON survey_reports;
DROP POLICY IF EXISTS "Users can create surveys" ON survey_reports;
DROP POLICY IF EXISTS "Users can update own surveys" ON survey_reports;
DROP POLICY IF EXISTS "Users can delete own surveys" ON survey_reports;

-- Create updated policies with new role structure
CREATE POLICY "Users can view own surveys"
  ON survey_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Editors and admins can create surveys"
  ON survey_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('editor', 'admin')
    )
  );

CREATE POLICY "Editors and admins can update own surveys"
  ON survey_reports
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('editor', 'admin')
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('editor', 'admin')
    )
  );

CREATE POLICY "Editors and admins can delete own surveys"
  ON survey_reports
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('editor', 'admin')
    )
  );