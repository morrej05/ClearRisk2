/*
  # PDF Locking, Integrity & Controlled Re-Export

  1. Purpose
    - Lock issued PDFs to prevent silent changes
    - Store generated PDFs for issued/superseded documents
    - Enable checksum/hash verification for integrity
    - Ensure re-exports return the same locked PDF
    - Support professional defensibility and audit requirements

  2. Storage Bucket
    - `document-pdfs` - Stores locked PDFs for issued/superseded documents

  3. New Columns on documents table
    - `locked_pdf_path` - Path to stored PDF in storage bucket
    - `locked_pdf_checksum` - SHA-256 hash of locked PDF for integrity verification
    - `locked_pdf_generated_at` - Timestamp when PDF was generated and locked
    - `locked_pdf_size_bytes` - Size of locked PDF file
    - `pdf_generation_error` - Error message if PDF generation failed during issue

  4. Business Rules
    - Draft documents: Regenerate freely, always use latest data
    - Issued documents: Use locked PDF, never regenerate
    - Superseded documents: Use locked PDF, never regenerate
    - Re-export: Return locked PDF if exists, regenerate only for drafts
    - Re-issue: Generate new locked PDF for new version
    - Integrity: Checksum must match locked PDF for verification

  5. Failure Handling
    - If PDF generation fails during issue, abort issue action
    - Document remains in draft
    - Error stored in pdf_generation_error column
    - Clear error messaging to user

  6. Audit Trail
    - locked_pdf_generated_at: When PDF was locked
    - locked_pdf_checksum: Proof PDF hasn't changed
    - locked_pdf_path: Reference to immutable file
    - issue_date, issued_by: Who issued, when
*/

-- Add PDF locking columns to documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS locked_pdf_path text,
ADD COLUMN IF NOT EXISTS locked_pdf_checksum text,
ADD COLUMN IF NOT EXISTS locked_pdf_generated_at timestamptz,
ADD COLUMN IF NOT EXISTS locked_pdf_size_bytes bigint,
ADD COLUMN IF NOT EXISTS pdf_generation_error text;

-- Create storage bucket for locked PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('document-pdfs', 'document-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for document-pdfs bucket

-- Policy: Internal users can view PDFs from their organisation
CREATE POLICY "Users can view organisation document PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'document-pdfs'
  AND (storage.foldername(name))[1] IN (
    SELECT organisation_id::text FROM user_profiles WHERE id = auth.uid()
  )
);

-- Policy: Users with can_edit can upload PDFs (for issue operation)
CREATE POLICY "Editors can upload document PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'document-pdfs'
  AND (storage.foldername(name))[1] IN (
    SELECT organisation_id::text FROM user_profiles 
    WHERE id = auth.uid() AND can_edit = true
  )
);

-- Policy: Org admins can delete PDFs (for cleanup/re-issue)
CREATE POLICY "Org admins can delete document PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'document-pdfs'
  AND (storage.foldername(name))[1] IN (
    SELECT organisation_id::text FROM user_profiles 
    WHERE id = auth.uid() 
    AND role IN ('org_admin', 'platform_admin')
  )
);

-- Create function to validate PDF integrity
CREATE OR REPLACE FUNCTION verify_pdf_integrity(
  document_id_param uuid,
  provided_checksum text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  stored_checksum text;
BEGIN
  SELECT locked_pdf_checksum INTO stored_checksum
  FROM documents
  WHERE id = document_id_param;
  
  IF stored_checksum IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN stored_checksum = provided_checksum;
END;
$$;

-- Create function to check if PDF should be regenerated
CREATE OR REPLACE FUNCTION should_regenerate_pdf(document_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  doc_status text;
  has_locked_pdf boolean;
BEGIN
  SELECT 
    issue_status,
    locked_pdf_path IS NOT NULL
  INTO doc_status, has_locked_pdf
  FROM documents
  WHERE id = document_id_param;
  
  -- Draft documents can always regenerate
  IF doc_status = 'draft' THEN
    RETURN true;
  END IF;
  
  -- Issued/superseded documents should use locked PDF if available
  IF doc_status IN ('issued', 'superseded') AND has_locked_pdf THEN
    RETURN false;
  END IF;
  
  -- If issued/superseded but no locked PDF, allow regeneration (legacy documents)
  RETURN true;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_locked_pdf_path ON documents (locked_pdf_path);
CREATE INDEX IF NOT EXISTS idx_documents_locked_pdf_checksum ON documents (locked_pdf_checksum);
CREATE INDEX IF NOT EXISTS idx_documents_pdf_generation_error ON documents (pdf_generation_error) WHERE pdf_generation_error IS NOT NULL;

-- Create function to clean up PDF fields on draft creation
CREATE OR REPLACE FUNCTION cleanup_pdf_fields_on_draft()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- When a document transitions back to draft (shouldn't happen, but safety check)
  -- Or when a new draft is created, clear PDF fields
  IF NEW.issue_status = 'draft' THEN
    NEW.locked_pdf_path := NULL;
    NEW.locked_pdf_checksum := NULL;
    NEW.locked_pdf_generated_at := NULL;
    NEW.locked_pdf_size_bytes := NULL;
    NEW.pdf_generation_error := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for PDF field cleanup
DROP TRIGGER IF EXISTS trigger_cleanup_pdf_fields_on_draft ON documents;
CREATE TRIGGER trigger_cleanup_pdf_fields_on_draft
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW
  WHEN (NEW.issue_status = 'draft')
  EXECUTE FUNCTION cleanup_pdf_fields_on_draft();

-- Add helpful comments
COMMENT ON COLUMN documents.locked_pdf_path IS 'Path to immutable PDF in storage bucket. Set when document is issued.';
COMMENT ON COLUMN documents.locked_pdf_checksum IS 'SHA-256 hash of locked PDF for integrity verification';
COMMENT ON COLUMN documents.locked_pdf_generated_at IS 'Timestamp when PDF was generated and locked at issue';
COMMENT ON COLUMN documents.locked_pdf_size_bytes IS 'Size of locked PDF file in bytes';
COMMENT ON COLUMN documents.pdf_generation_error IS 'Error message if PDF generation failed during issue';
COMMENT ON FUNCTION verify_pdf_integrity IS 'Verifies that provided checksum matches stored checksum for integrity validation';
COMMENT ON FUNCTION should_regenerate_pdf IS 'Determines if PDF should be regenerated (true for drafts) or use locked PDF (false for issued/superseded)';

-- Create view for PDF audit trail
CREATE OR REPLACE VIEW document_pdf_audit AS
SELECT
  d.id as document_id,
  d.base_document_id,
  d.title,
  d.document_type,
  d.version_number,
  d.issue_status,
  d.issue_date,
  d.issued_by,
  d.locked_pdf_path,
  d.locked_pdf_checksum,
  d.locked_pdf_generated_at,
  d.locked_pdf_size_bytes,
  d.superseded_date,
  d.superseded_by_document_id,
  up.name as issued_by_name,
  CASE
    WHEN d.locked_pdf_path IS NOT NULL THEN 'PDF Locked'
    WHEN d.issue_status = 'draft' THEN 'Draft - No Lock Required'
    WHEN d.issue_status IN ('issued', 'superseded') AND d.locked_pdf_path IS NULL THEN 'Legacy - No Locked PDF'
    ELSE 'Unknown'
  END as pdf_status
FROM documents d
LEFT JOIN user_profiles up ON d.issued_by = up.id
ORDER BY d.base_document_id, d.version_number DESC;

COMMENT ON VIEW document_pdf_audit IS 'Audit view showing PDF locking status and integrity data for all documents';
