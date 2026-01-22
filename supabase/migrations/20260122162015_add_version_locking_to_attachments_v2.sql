/*
  # Add Version Locking to Attachments

  1. Changes to attachments table
    - Add `base_document_id` for tracking document families across versions
    - Add `deleted_at` for soft delete functionality
    - Update indexes to support version queries

  2. RLS Policy Updates
    - Block INSERT/UPDATE/DELETE on attachments when document is issued or superseded
    - Only allow attachment modifications on draft documents
    - Maintain read access for all issued documents

  3. Helper Function
    - Create function to check if document is mutable (draft status only)
    - Use in RLS policies to enforce locking

  4. Security
    - Evidence on issued documents becomes immutable
    - New versions can carry forward evidence references
    - Cross-org access remains blocked
*/

-- Add new columns to attachments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attachments' AND column_name = 'base_document_id'
  ) THEN
    ALTER TABLE attachments ADD COLUMN base_document_id uuid NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attachments' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE attachments ADD COLUMN deleted_at timestamptz NULL;
  END IF;
END $$;

-- Backfill base_document_id from documents table
UPDATE attachments a
SET base_document_id = d.base_document_id
FROM documents d
WHERE a.document_id = d.id
  AND a.base_document_id IS NULL;

-- Create index for soft-deleted items
CREATE INDEX IF NOT EXISTS idx_attachments_not_deleted ON attachments(document_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_base_doc ON attachments(organisation_id, base_document_id) WHERE deleted_at IS NULL;

-- Helper function to check if a document is mutable
CREATE OR REPLACE FUNCTION is_document_mutable(doc_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM documents
    WHERE id = doc_id
      AND issue_status = 'draft'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Drop and recreate RLS policies with locking enforcement

DROP POLICY IF EXISTS "Users can view organisation attachments" ON attachments;
DROP POLICY IF EXISTS "Users can insert organisation attachments" ON attachments;
DROP POLICY IF EXISTS "Users can update organisation attachments" ON attachments;
DROP POLICY IF EXISTS "Users can delete organisation attachments" ON attachments;

-- Policy: Users can view attachments for their organisation (including soft-deleted for audit)
CREATE POLICY "Users can view organisation attachments"
  ON attachments FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert attachments ONLY for draft documents in their organisation
CREATE POLICY "Users can insert organisation attachments"
  ON attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
    AND is_document_mutable(document_id)
  );

-- Policy: Users can update attachments ONLY for draft documents in their organisation
CREATE POLICY "Users can update organisation attachments"
  ON attachments FOR UPDATE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
    AND is_document_mutable(document_id)
  )
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
    AND is_document_mutable(document_id)
  );

-- Policy: Users can soft-delete attachments ONLY for draft documents in their organisation
CREATE POLICY "Users can delete organisation attachments"
  ON attachments FOR DELETE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
    AND is_document_mutable(document_id)
  );

-- Grant execute on helper function
GRANT EXECUTE ON FUNCTION is_document_mutable(uuid) TO authenticated;

-- Comment on the table for documentation
COMMENT ON COLUMN attachments.base_document_id IS 'Links attachment to document family across versions';
COMMENT ON COLUMN attachments.deleted_at IS 'Soft delete timestamp - null means active';
COMMENT ON FUNCTION is_document_mutable(uuid) IS 'Returns true if document is in draft status and can accept new evidence';
