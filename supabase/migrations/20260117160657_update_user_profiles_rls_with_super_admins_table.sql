/*
  # Update user_profiles RLS to use super_admins table

  1. Changes
    - Replace all super_admin RLS policies that reference user_profiles.role
    - Use super_admins table instead to avoid infinite recursion
    - This enables super_admins to:
      - Read all user profiles (needed for User Management in /admin)
      - Update all user profiles
      - Delete user profiles
      - Insert new user profiles
  
  2. Security
    - Checks super_admins table instead of user_profiles.role
    - No more recursion issues
    - Maintains same security level
  
  3. Notes
    - Regular users can still read/update their own profile
    - Org admins retain their existing permissions
    - Super admins get full access via super_admins table check
*/

-- Drop existing super_admin policies that cause recursion
DROP POLICY IF EXISTS "Super admins can read all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Super admins can update all user profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Super admins can insert user profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Super admins can delete user profiles" ON public.user_profiles;

-- Create new super_admin policies using super_admins table
CREATE POLICY "Super admins can read all profiles via super_admins table"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins sa
      WHERE sa.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can update all profiles via super_admins table"
  ON public.user_profiles
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

CREATE POLICY "Super admins can insert profiles via super_admins table"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.super_admins sa
      WHERE sa.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can delete profiles via super_admins table"
  ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins sa
      WHERE sa.id = auth.uid()
    )
  );
