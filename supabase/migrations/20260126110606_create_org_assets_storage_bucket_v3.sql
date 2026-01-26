/*
  # Create Organisation Assets Storage Bucket

  1. New Storage Bucket
    - `org-assets` - Private bucket for organisation branding assets

  2. Storage Structure
    - org-logos/<org_id>/logo.{png|jpg|svg}

  3. Security
    - Storage policies for authenticated access
    - Organisation admins can upload/update their org's logo
    - All authenticated users can read their org's logo
    - Platform admins can read all logos
*/

-- Create org-assets bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-assets', 'org-assets', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
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
        AND SPLIT_PART(name, '/', 2) = user_profiles.organisation_id::text
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

-- Policy: Org admins can upload/update their org's assets
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
        (user_profiles.role = 'admin' AND SPLIT_PART(name, '/', 2) = user_profiles.organisation_id::text)
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
        (user_profiles.role = 'admin' AND SPLIT_PART(name, '/', 2) = user_profiles.organisation_id::text)
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
        (user_profiles.role = 'admin' AND SPLIT_PART(name, '/', 2) = user_profiles.organisation_id::text)
        OR user_profiles.is_platform_admin = true
      )
    )
  );