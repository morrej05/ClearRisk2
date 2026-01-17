/*
  # Clean Up Old Editor Role Policies

  1. Changes
    - Drop old policies that reference 'editor' and 'admin' roles
    - These are conflicting with the new role system
    - Keep only the generic "Users can X" policies and the new super_admin/org_admin policies

  2. Security
    - Surveyors can create/update/delete their own surveys
    - Org admins and super admins can manage all surveys
    - No role check needed for basic CRUD on own surveys

  3. Notes
    - Old 'editor' role no longer exists in the system
    - This was blocking surveyors from creating/updating surveys
*/

-- Drop old policies that reference 'editor' role
DROP POLICY IF EXISTS "Editors and admins can create surveys" ON survey_reports;
DROP POLICY IF EXISTS "Editors and admins can update own surveys" ON survey_reports;
DROP POLICY IF EXISTS "Editors and admins can delete own surveys" ON survey_reports;

-- Verify we have the basic policies for all users
-- These should already exist, but we'll ensure they're present

-- Users can create their own reports (no role check needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'survey_reports' 
    AND policyname = 'Users can create reports'
  ) THEN
    CREATE POLICY "Users can create reports"
      ON survey_reports
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Users can update their own reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'survey_reports' 
    AND policyname = 'Users can update own reports'
  ) THEN
    CREATE POLICY "Users can update own reports"
      ON survey_reports
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Users can delete their own reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'survey_reports' 
    AND policyname = 'Users can delete own reports'
  ) THEN
    CREATE POLICY "Users can delete own reports"
      ON survey_reports
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
