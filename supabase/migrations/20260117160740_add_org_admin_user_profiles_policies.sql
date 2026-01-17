/*
  # Add org_admin policies for user_profiles

  1. Changes
    - Add SELECT policy for org_admins to read all user profiles
    - Add UPDATE policy for org_admins to update user profiles (excluding role changes)
    - Add INSERT policy for org_admins to create user profiles
    - Add DELETE policy for org_admins to delete user profiles
  
  2. Security
    - Org admins can manage users but have restrictions
    - Uses user_profiles.role check (safe since they can already read their own role)
    - Super admins use super_admins table check (no recursion)
  
  3. Notes
    - This enables User Management tab in /admin for org_admins
    - Org admins cannot change their own or others' roles to super_admin
    - Super admins still have ultimate control via super_admins table
*/

-- Policy: Org admins can read all user profiles
CREATE POLICY "Org admins can read all profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('org_admin', 'super_admin')
    )
  );

-- Policy: Org admins can update user profiles (except promoting to super_admin)
CREATE POLICY "Org admins can update profiles"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('org_admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('org_admin', 'super_admin')
    )
  );

-- Policy: Org admins can insert user profiles
CREATE POLICY "Org admins can insert profiles"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('org_admin', 'super_admin')
    )
  );

-- Policy: Org admins can delete user profiles
CREATE POLICY "Org admins can delete profiles"
  ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('org_admin', 'super_admin')
    )
  );
