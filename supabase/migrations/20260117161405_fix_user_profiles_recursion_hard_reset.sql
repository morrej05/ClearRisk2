/*
  # Fix user_profiles RLS recursion - Hard Reset

  1. Problem
    - survey_reports policies check user_profiles.role
    - This causes infinite recursion when loading data
    - Error: "infinite recursion detected in policy for relation user_profiles" (42P17)
  
  2. Solution
    - Drop ALL policies on user_profiles
    - Create only 3 non-recursive policies:
      a) Users can read own row (auth.uid() = id)
      b) Users can update own row (auth.uid() = id)
      c) Super admins full access via super_admins table ONLY
    - NO policies reference user_profiles.role or query user_profiles
    - NO org_admin policies (they would cause recursion)
  
  3. Important
    - Super admins use super_admins table (no recursion)
    - Regular users can only access their own row
    - Org admins temporarily lose user management (will fix separately)
  
  4. Security
    - Users can read/update only their own profile
    - Super admins have full access via separate table
    - No recursion possible
*/

-- Drop ALL existing policies on user_profiles
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Super admins can read all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Super admins can update all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Super admins can read all profiles via super_admins table" ON public.user_profiles;
DROP POLICY IF EXISTS "Super admins can update all profiles via super_admins table" ON public.user_profiles;
DROP POLICY IF EXISTS "Super admins can insert profiles via super_admins table" ON public.user_profiles;
DROP POLICY IF EXISTS "Super admins can delete profiles via super_admins table" ON public.user_profiles;
DROP POLICY IF EXISTS "Org admins can read all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Org admins can update profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Org admins can insert profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Org admins can delete profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own name" ON public.user_profiles;

-- Create ONLY non-recursive policies

-- Policy 1: Users can read their own row
CREATE POLICY "Users can read own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy 2: Users can update their own row
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 3: Super admins have full access via super_admins table (no recursion)
CREATE POLICY "Super admins can read all profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins sa
      WHERE sa.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can update all profiles"
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

CREATE POLICY "Super admins can insert profiles"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.super_admins sa
      WHERE sa.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can delete profiles"
  ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins sa
      WHERE sa.id = auth.uid()
    )
  );
