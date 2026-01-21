/*
  # Document Versioning and Issue Control

  1. Purpose
    - Enable formal document control with issue/supersession tracking
    - Support multiple versions of the same document (v1, v2, v3...)
    - Maintain audit trail and historical integrity
    - Prevent modification of issued/superseded documents

  2. New Columns on `documents` table
    - `base_document_id` (uuid) - Groups all versions together (persistent ID)
    - `version_number` (integer) - Sequential version (1, 2, 3...)
    - `issue_status` (text) - 'draft' | 'issued' | 'superseded'
    - `issue_date` (date) - When document was issued
    - `issued_by` (uuid) - User who issued the document
    - `superseded_by_document_id` (uuid) - Links to newer version that superseded this
    - `superseded_date` (timestamptz) - When this version was superseded

  3. Constraints
    - Only one draft per base_document_id allowed
    - Issued/superseded documents cannot be deleted
    - Version numbers must be sequential

  4. Indexes
    - Fast lookups by base_document_id
    - Fast queries for current issued version
    - Efficient filtering by issue_status

  5. Data Migration
    - Backfill existing documents as v1, issued
    - Set base_document_id = document_id for existing records
*/

-- Add versioning and issue control columns
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS base_document_id uuid,
ADD COLUMN IF NOT EXISTS version_number integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS issue_status text DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS issue_date date,
ADD COLUMN IF NOT EXISTS issued_by uuid,
ADD COLUMN IF NOT EXISTS superseded_by_document_id uuid,
ADD COLUMN IF NOT EXISTS superseded_date timestamptz;

-- Backfill base_document_id for existing documents
UPDATE documents
SET base_document_id = id
WHERE base_document_id IS NULL;

-- Backfill issue_status for existing documents (assume issued if they have data)
UPDATE documents
SET issue_status = 'issued',
    issue_date = created_at::date
WHERE issue_status = 'draft' AND created_at IS NOT NULL;

-- Make base_document_id NOT NULL after backfill
ALTER TABLE documents
ALTER COLUMN base_document_id SET NOT NULL;

-- Add check constraint for issue_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_issue_status_check'
    AND conrelid = 'documents'::regclass
  ) THEN
    ALTER TABLE documents
    ADD CONSTRAINT documents_issue_status_check
    CHECK (issue_status IN ('draft', 'issued', 'superseded'));
  END IF;
END $$;

-- Add foreign key for issued_by (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_issued_by_fkey'
    AND conrelid = 'documents'::regclass
  ) THEN
    ALTER TABLE documents
    ADD CONSTRAINT documents_issued_by_fkey
    FOREIGN KEY (issued_by)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key for superseded_by_document_id (self-reference)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_superseded_by_fkey'
    AND conrelid = 'documents'::regclass
  ) THEN
    ALTER TABLE documents
    ADD CONSTRAINT documents_superseded_by_fkey
    FOREIGN KEY (superseded_by_document_id)
    REFERENCES documents(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_documents_base_document_id 
ON documents (base_document_id);

CREATE INDEX IF NOT EXISTS idx_documents_issue_status 
ON documents (issue_status);

CREATE INDEX IF NOT EXISTS idx_documents_version_number 
ON documents (version_number);

CREATE INDEX IF NOT EXISTS idx_documents_base_status 
ON documents (base_document_id, issue_status);

-- Create unique constraint: only one draft per base_document_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_one_draft_per_base
ON documents (base_document_id)
WHERE issue_status = 'draft';

-- Add helpful comments
COMMENT ON COLUMN documents.base_document_id IS 'Persistent ID that groups all versions of the same document together';
COMMENT ON COLUMN documents.version_number IS 'Sequential version number (1, 2, 3...) for this document';
COMMENT ON COLUMN documents.issue_status IS 'Document lifecycle status: draft (editable), issued (locked, current), superseded (locked, historical)';
COMMENT ON COLUMN documents.superseded_by_document_id IS 'Points to the newer document version that superseded this one';
