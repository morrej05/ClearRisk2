/*
  # Create storage bucket for survey attachments

  ## Overview
  Creates a Supabase Storage bucket for storing photos and site plans uploaded with survey reports.

  ## Storage Buckets
  
  ### `survey-attachments`
  - Bucket for storing photos and site plans
  - Organized by user_id/report_id/filename structure
  - Supports common image and PDF formats

  ## Security
  - Enable RLS on the storage bucket
  - Allow authenticated users to upload files to their own folders
  - Allow authenticated users to view their own files
  - Allow authenticated users to delete their own files

  ## Notes
  - Files are organized by user ID and report ID for easy management
  - Supports images (jpg, jpeg, png, gif, webp) and PDFs
  - Maximum file size controlled by Supabase Storage settings
*/

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('survey-attachments', 'survey-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload files to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'survey-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow authenticated users to view their own files
CREATE POLICY "Users can view own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'survey-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow authenticated users to update their own files
CREATE POLICY "Users can update own files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'survey-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'survey-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'survey-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );