/*
  # Create Attachments & Evidence Schema

  1. New Table
    - `attachments`
      - Stores photos, PDFs, and other evidence files
      - Links to documents, modules, and actions
      - Supports captions and metadata
  
  2. Indexes
    - Composite index on (organisation_id, document_id)
    - Individual indexes on document_id, action_id, module_instance_id for efficient queries
  
  3. Security
    - Enable RLS on attachments table
    - Users can only access attachments for their organisation
    - Full CRUD access for organisation members
    - Admin-only delete via application logic
  
  4. Storage
    - Bucket "evidence" will be created separately
    - Path convention: evidence/{organisation_id}/{document_id}/{yyyy-mm-dd}/{uuid}_{filename}
  
  5. Triggers
    - Auto-update updated_at timestamp on row changes
*/

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS attachments_updated_at ON attachments;

-- Create attachments table
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  module_instance_id uuid NULL REFERENCES module_instances(id) ON DELETE SET NULL,
  action_id uuid NULL REFERENCES actions(id) ON DELETE SET NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size_bytes bigint NULL,
  caption text NULL,
  taken_at timestamptz NULL,
  uploaded_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_attachments_org_doc ON attachments(organisation_id, document_id);
CREATE INDEX IF NOT EXISTS idx_attachments_document ON attachments(document_id);
CREATE INDEX IF NOT EXISTS idx_attachments_action ON attachments(action_id) WHERE action_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_module ON attachments(module_instance_id) WHERE module_instance_id IS NOT NULL;

-- Enable RLS
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view organisation attachments" ON attachments;
DROP POLICY IF EXISTS "Users can insert organisation attachments" ON attachments;
DROP POLICY IF EXISTS "Users can update organisation attachments" ON attachments;
DROP POLICY IF EXISTS "Users can delete organisation attachments" ON attachments;

-- Policy: Users can view attachments for their organisation
CREATE POLICY "Users can view organisation attachments"
  ON attachments FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert attachments for their organisation
CREATE POLICY "Users can insert organisation attachments"
  ON attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can update attachments for their organisation
CREATE POLICY "Users can update organisation attachments"
  ON attachments FOR UPDATE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete attachments for their organisation
CREATE POLICY "Users can delete organisation attachments"
  ON attachments FOR DELETE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Create trigger to auto-update updated_at timestamp
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