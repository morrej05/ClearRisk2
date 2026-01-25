/*
  # Add Soft Delete to Documents

  1. Changes
    - Add `deleted_at` column to track when document was deleted
    - Add `deleted_by` column to track who deleted the document
    - Add index on deleted_at for efficient filtering
    
  2. Security
    - No RLS changes needed (deletion handled at application level)
    
  3. Notes
    - Soft delete allows recovery if needed
    - Deleted surveys hidden from standard list views
    - Issued surveys cannot be deleted (enforced in application)
*/

-- Add soft delete columns to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID NULL REFERENCES auth.users(id);

-- Add index for efficient filtering of non-deleted documents
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at 
ON documents(deleted_at) 
WHERE deleted_at IS NULL;

-- Add comment for clarity
COMMENT ON COLUMN documents.deleted_at IS 'Timestamp when document was soft-deleted. NULL means not deleted.';
COMMENT ON COLUMN documents.deleted_by IS 'User who deleted this document (for audit purposes).';
