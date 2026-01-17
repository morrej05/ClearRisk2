/*
  # Fix survey_reports RLS recursion

  1. Problem
    - survey_reports policies check user_profiles.role for org_admin
    - This causes infinite recursion (42P17)
  
  2. Solution
    - Drop all policies that reference user_profiles.role
    - Keep only:
      a) Users can manage their own surveys
      b) Super admins can manage all surveys (via super_admins table)
    - NO references to user_profiles.role anywhere
  
  3. Impact
    - Org admins temporarily lose "view all surveys" privilege
    - Can be restored later with org_admins table
    - Super admins still have full access
    - Regular users still have access to their own surveys
  
  4. Security
    - No recursion possible
    - Super admins use super_admins table (safe)
    - Users access own data only
*/

-- Drop all survey_reports policies that reference user_profiles
DROP POLICY IF EXISTS "Org admins can view all surveys" ON public.survey_reports;
DROP POLICY IF EXISTS "Org admins can update all surveys" ON public.survey_reports;
DROP POLICY IF EXISTS "Org admins can delete all surveys" ON public.survey_reports;
DROP POLICY IF EXISTS "Super admins can view all surveys" ON public.survey_reports;
DROP POLICY IF EXISTS "Super admins can update all surveys" ON public.survey_reports;
DROP POLICY IF EXISTS "Super admins can delete all surveys" ON public.survey_reports;

-- Recreate super admin policies using super_admins table (no recursion)
CREATE POLICY "Super admins can view all surveys"
  ON public.survey_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins sa
      WHERE sa.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can update all surveys"
  ON public.survey_reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins sa
      WHERE sa.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.super_admins sa
      WHERE sa.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can delete all surveys"
  ON public.survey_reports
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins sa
      WHERE sa.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can insert surveys"
  ON public.survey_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.super_admins sa
      WHERE sa.id = auth.uid()
    )
  );
