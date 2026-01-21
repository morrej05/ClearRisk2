/*
  # Add Document Issuance Tracking Fields

  1. Purpose
    - Track when a document is issued and by whom
    - Support audit trail for document lifecycle
    - Enable UI to show issuance history

  2. Changes
    - Add `issued_at` (timestamptz, nullable) to documents table
    - Add `issued_by` (uuid, nullable, foreign key to auth.users) to documents table
    - Ensure status constraint only allows 'draft' | 'issued' | 'superseded'

  3. Notes
    - These fields remain NULL for draft documents
    - Once set, they provide an immutable record of issuance
    - issued_by references auth.users (not user_profiles) to maintain referential integrity
*/

-- Add issued_at column
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS issued_at timestamptz;

-- Add issued_by column with foreign key to auth.users
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Drop existing constraint if it exists and recreate with correct values
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;

-- Add constraint to ensure status is only draft, issued, or superseded
ALTER TABLE documents 
ADD CONSTRAINT documents_status_check 
CHECK (status IN ('draft', 'issued', 'superseded'));

-- Create index on issued_by for performance
CREATE INDEX IF NOT EXISTS idx_documents_issued_by ON documents(issued_by);

-- Create index on issued_at for filtering/sorting
CREATE INDEX IF NOT EXISTS idx_documents_issued_at ON documents(issued_at);
