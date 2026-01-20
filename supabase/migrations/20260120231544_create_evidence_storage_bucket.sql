/*
  # Create Evidence Storage Bucket

  1. Storage Bucket
    - Create "evidence" bucket for photos, PDFs, and other attachments
    - Path convention: evidence/{organisation_id}/{document_id}/{yyyy-mm-dd}/{uuid}_{filename}
  
  2. Security Policies
    - Read: Authenticated users can read files from their organisation
    - Write: Authenticated users can upload files to their organisation path
    - Delete: Authenticated users can delete files from their organisation path
*/

-- Create evidence bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence',
  'evidence',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can read files from their organisation
CREATE POLICY "Users can read organisation evidence"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'evidence' AND
    (storage.foldername(name))[1] IN (
      SELECT organisation_id::text FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can upload files to their organisation
CREATE POLICY "Users can upload organisation evidence"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'evidence' AND
    (storage.foldername(name))[1] IN (
      SELECT organisation_id::text FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can update files in their organisation
CREATE POLICY "Users can update organisation evidence"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'evidence' AND
    (storage.foldername(name))[1] IN (
      SELECT organisation_id::text FROM user_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'evidence' AND
    (storage.foldername(name))[1] IN (
      SELECT organisation_id::text FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete files from their organisation
CREATE POLICY "Users can delete organisation evidence"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'evidence' AND
    (storage.foldername(name))[1] IN (
      SELECT organisation_id::text FROM user_profiles WHERE id = auth.uid()
    )
  );