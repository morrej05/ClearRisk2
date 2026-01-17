/*
  # Create super_admins table for RLS policies

  1. New Tables
    - `super_admins`
      - `id` (uuid, primary key) - References auth.users
      - `granted_at` (timestamptz) - When super admin privileges were granted
      - `granted_by` (uuid) - Who granted the privileges (nullable for initial setup)
  
  2. Changes
    - This table acts as a source of truth for super admin status
    - Avoids infinite recursion in RLS policies by not referencing user_profiles within user_profiles policies
    - Enables super_admins to read/update all user profiles safely
  
  3. Security
    - Enable RLS on super_admins table
    - Only existing super_admins can insert/update/delete
    - All authenticated users can read (to check super admin status)
  
  4. Data
    - Insert current super_admin (james.morrell1@gmail.com) into the table
*/

-- Create super_admins table
CREATE TABLE IF NOT EXISTS public.super_admins (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at timestamptz DEFAULT now() NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read super_admins table (needed for RLS checks)
CREATE POLICY "Anyone can read super_admins list"
  ON public.super_admins
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only existing super_admins can insert new super_admins
CREATE POLICY "Super admins can grant super admin privileges"
  ON public.super_admins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.super_admins sa
      WHERE sa.id = auth.uid()
    )
  );

-- Policy: Only existing super_admins can remove super admin privileges
CREATE POLICY "Super admins can revoke super admin privileges"
  ON public.super_admins
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins sa
      WHERE sa.id = auth.uid()
    )
  );

-- Insert current super_admin user
INSERT INTO public.super_admins (id, granted_at, granted_by)
SELECT 
  au.id,
  now(),
  NULL
FROM auth.users au
JOIN user_profiles up ON au.id = up.id
WHERE up.role = 'super_admin'
ON CONFLICT (id) DO NOTHING;
