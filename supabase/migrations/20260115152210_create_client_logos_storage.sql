/*
  # Create Client Logos Storage Bucket

  1. Storage
    - Create `client-logos` bucket for storing company logo images
    - Set appropriate size limits and file type restrictions
    
  2. Security
    - Enable RLS on storage bucket
    - Admin users can upload and update logos
    - All authenticated users can read logos from their organization
*/

-- Create storage bucket for client logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-logos',
  'client-logos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Admin users can upload logos
CREATE POLICY "Admin users can upload logos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'client-logos' AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Policy: Admin users can update logos
CREATE POLICY "Admin users can update logos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'client-logos' AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Policy: Admin users can delete logos
CREATE POLICY "Admin users can delete logos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'client-logos' AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Policy: All authenticated users can read logos
CREATE POLICY "Authenticated users can read logos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'client-logos');