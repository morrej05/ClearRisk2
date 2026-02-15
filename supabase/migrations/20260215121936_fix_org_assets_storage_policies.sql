/*
  # Fix Organisation Assets Storage Policies

  1. Problem
    - Storage policies incorrectly reference `user_profiles.name` instead of storage object's `name`
    - This prevents admins from uploading logos (always fails RLS check)

  2. Solution
    - Fix all policies to correctly reference storage object path via `name` column
    - Verify organisation_id matches between path (org-logos/<org_id>/) and user profile

  3. Security
    - Org admins can only upload/update/delete their own org's assets
    - All authenticated users can read their own org's assets
    - Platform admins can access all assets
*/

-- Drop existing buggy policies
DROP POLICY IF EXISTS "Users can read own org assets" ON storage.objects;
DROP POLICY IF EXISTS "Org admins can upload org assets" ON storage.objects;
DROP POLICY IF EXISTS "Org admins can update org assets" ON storage.objects;
DROP POLICY IF EXISTS "Org admins can delete org assets" ON storage.objects;

-- Policy: Users can read their own organisation's assets
CREATE POLICY "Users can read own org assets"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'org-assets'
    AND (
      -- User belongs to the org (extract org_id from path org-logos/<org_id>/...)
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND split_part(storage.objects.name, '/', 2) = user_profiles.organisation_id::text
      )
      OR
      -- Platform admin can read all
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.is_platform_admin = true
      )
    )
  );

-- Policy: Org admins can upload their org's assets
CREATE POLICY "Org admins can upload org assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'org-assets'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (
        (user_profiles.role = 'admin' AND split_part(storage.objects.name, '/', 2) = user_profiles.organisation_id::text)
        OR user_profiles.is_platform_admin = true
      )
    )
  );

-- Policy: Org admins can update their org's assets
CREATE POLICY "Org admins can update org assets"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'org-assets'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (
        (user_profiles.role = 'admin' AND split_part(storage.objects.name, '/', 2) = user_profiles.organisation_id::text)
        OR user_profiles.is_platform_admin = true
      )
    )
  );

-- Policy: Org admins can delete their org's assets
CREATE POLICY "Org admins can delete org assets"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'org-assets'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (
        (user_profiles.role = 'admin' AND split_part(storage.objects.name, '/', 2) = user_profiles.organisation_id::text)
        OR user_profiles.is_platform_admin = true
      )
    )
  );
