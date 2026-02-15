/*
  # Add Draft PDF Paths and RE Module Selection

  1. New Columns
    - `draft_pdf_path` (text, nullable) - Path to draft PDF in storage for FRA/FSD/EX
    - `draft_re_survey_pdf_path` (text, nullable) - Path to draft Risk Engineering Survey Report PDF
    - `draft_re_lp_pdf_path` (text, nullable) - Path to draft Risk Engineering Loss Prevention Report PDF
    - `draft_re_survey_included_modules` (jsonb, nullable) - Array of module keys included in RE Survey Report

  2. Purpose
    - Support storage-backed draft PDF preview with signed URLs
    - Enable RE Survey Report to have customizable module selection
    - Track which modules are included in the RE Survey Report draft
    - Separate paths for RE Survey vs LP reports

  3. Notes
    - Draft PDFs are stored in document-pdfs bucket under: {org_id}/{doc_id}/draft/
    - Module selection persists between page visits
    - Defaults to all visible RE modules if not set
*/

-- Add draft PDF path columns to documents table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'draft_pdf_path'
  ) THEN
    ALTER TABLE documents ADD COLUMN draft_pdf_path TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'draft_re_survey_pdf_path'
  ) THEN
    ALTER TABLE documents ADD COLUMN draft_re_survey_pdf_path TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'draft_re_lp_pdf_path'
  ) THEN
    ALTER TABLE documents ADD COLUMN draft_re_lp_pdf_path TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'draft_re_survey_included_modules'
  ) THEN
    ALTER TABLE documents ADD COLUMN draft_re_survey_included_modules JSONB NULL;
  END IF;
END $$;
