/*
  # Fix Infinite Recursion in User Profiles RLS Policies

  ## Problem
  The RLS policies on user_profiles and survey_reports were causing infinite recursion
  because they query user_profiles to check admin status, which triggers the same policies.

  ## Solution
  1. Create a helper function with SECURITY DEFINER that bypasses RLS
  2. Update all policies to use this helper function instead of direct queries
  
  ## Changes
  - Drop existing problematic policies
  - Create `is_admin()` helper function that safely checks admin status
  - Recreate policies using the helper function
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own name" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all surveys" ON survey_reports;
DROP POLICY IF EXISTS "Admins can update all surveys" ON survey_reports;
DROP POLICY IF EXISTS "Admins can delete all surveys" ON survey_reports;

-- Create a helper function to check if user is admin (bypasses RLS with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate admin policy for user_profiles using helper function
CREATE POLICY "Admins can read all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Recreate update policy for user_profiles
CREATE POLICY "Users can update own name"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (role = (SELECT role FROM user_profiles WHERE id = auth.uid()) OR is_admin())
  );

-- Recreate admin policies for survey_reports using helper function
CREATE POLICY "Admins can view all surveys"
  ON survey_reports
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update all surveys"
  ON survey_reports
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete all surveys"
  ON survey_reports
  FOR DELETE
  TO authenticated
  USING (is_admin());
