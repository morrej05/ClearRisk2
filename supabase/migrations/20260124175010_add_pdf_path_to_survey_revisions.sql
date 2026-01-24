/*
  # Add PDF Path to Survey Revisions

  1. Changes
    - Add pdf_path column to survey_revisions for caching issued PDFs
    - Issued PDFs are generated once and stored, making them truly immutable

  2. Notes
    - PDF stored at: reports/{survey_id}/rev-{revision_number}.pdf
    - When downloading issued revision, use cached PDF if available
*/

-- Add pdf_path column for caching generated PDFs
ALTER TABLE survey_revisions
ADD COLUMN IF NOT EXISTS pdf_path TEXT;

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_survey_revisions_pdf_path 
ON survey_revisions(survey_id, revision_number) 
WHERE pdf_path IS NOT NULL;

-- Add comment
COMMENT ON COLUMN survey_revisions.pdf_path IS 
  'Storage path to cached PDF for this issued revision. Generated once on issuance for immutability.';
