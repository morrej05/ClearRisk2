/*
  # Fix RLS recursion on all tables

  1. Problem
    - Multiple tables reference user_profiles.role in policies
    - client_branding checks role = 'admin'
    - external_links checks role = 'admin'
    - sector_weightings checks role = 'super_admin'
    - All cause infinite recursion (42P17)
  
  2. Solution
    - Replace all user_profiles.role checks with super_admins table
    - Remove 'admin' role checks (doesn't exist in our system)
    - Use only super_admins table for privilege checks
  
  3. Security
    - No recursion possible
    - Super admins have full control
    - Regular users maintain their access
*/

-- Fix client_branding policies
DROP POLICY IF EXISTS "Admin users can insert branding" ON public.client_branding;
DROP POLICY IF EXISTS "Admin users can update branding" ON public.client_branding;

CREATE POLICY "Super admins can insert branding"
  ON public.client_branding
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.super_admins sa
      WHERE sa.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can update branding"
  ON public.client_branding
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

-- Fix external_links policies
DROP POLICY IF EXISTS "Admin users can manage all external links" ON public.external_links;

CREATE POLICY "Super admins can manage all external links"
  ON public.external_links
  FOR ALL
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

-- Fix sector_weightings policies
DROP POLICY IF EXISTS "Super admins can delete sector weightings" ON public.sector_weightings;
DROP POLICY IF EXISTS "Super admins can insert sector weightings" ON public.sector_weightings;
DROP POLICY IF EXISTS "Super admins can update sector weightings" ON public.sector_weightings;

CREATE POLICY "Super admins can delete sector weightings"
  ON public.sector_weightings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins sa
      WHERE sa.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can insert sector weightings"
  ON public.sector_weightings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.super_admins sa
      WHERE sa.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can update sector weightings"
  ON public.sector_weightings
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
