/*
  # Create Attachments & Evidence Schema

  1. New Tables
    - `attachments`
      - `id` (uuid, primary key)
      - `organisation_id` (uuid, foreign key to organisations)
      - `document_id` (uuid, foreign key to documents)
      - `module_instance_id` (uuid, nullable, foreign key to module_instances)
      - `action_id` (uuid, nullable, foreign key to actions)
      - `file_path` (text, path in Supabase Storage)
      - `file_name` (text, original filename)
      - `file_type` (text, MIME type)
      - `file_size_bytes` (bigint, file size)
      - `caption` (text, nullable, user-provided description)
      - `taken_at` (timestamptz, nullable, photo capture time)
      - `uploaded_by` (uuid, nullable, foreign key to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `attachments` table
    - Users can only access attachments in their organisation
    - Policies for SELECT, INSERT, UPDATE, DELETE

  3. Indexes
    - Index on (organisation_id, document_id)
    - Index on document_id
    - Index on action_id
    - Index on module_instance_id

  4. Storage Bucket
    - Create 'evidence' bucket
    - RLS policies for authenticated users
*/

-- Create attachments table
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  module_instance_id uuid REFERENCES module_instances(id) ON DELETE SET NULL,
  action_id uuid REFERENCES actions(id) ON DELETE SET NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size_bytes bigint,
  caption text,
  taken_at timestamptz,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_attachments_org_doc ON attachments(organisation_id, document_id);
CREATE INDEX IF NOT EXISTS idx_attachments_document ON attachments(document_id);
CREATE INDEX IF NOT EXISTS idx_attachments_action ON attachments(action_id);
CREATE INDEX IF NOT EXISTS idx_attachments_module ON attachments(module_instance_id);

-- Enable RLS
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for attachments
CREATE POLICY "Users can view attachments in their organisation"
  ON attachments FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can create attachments in their organisation"
  ON attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can update attachments in their organisation"
  ON attachments FOR UPDATE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )
  )
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete attachments in their organisation"
  ON attachments FOR DELETE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_attachments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attachments_updated_at
  BEFORE UPDATE ON attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_attachments_updated_at();

-- Create storage bucket for evidence
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for evidence bucket
CREATE POLICY "Authenticated users can view evidence in their organisation"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'evidence' AND
    (storage.foldername(name))[1] IN (
      SELECT organisation_id::text FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can upload evidence to their organisation"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'evidence' AND
    (storage.foldername(name))[1] IN (
      SELECT organisation_id::text FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can update evidence in their organisation"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'evidence' AND
    (storage.foldername(name))[1] IN (
      SELECT organisation_id::text FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can delete evidence in their organisation"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'evidence' AND
    (storage.foldername(name))[1] IN (
      SELECT organisation_id::text FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )
  );
