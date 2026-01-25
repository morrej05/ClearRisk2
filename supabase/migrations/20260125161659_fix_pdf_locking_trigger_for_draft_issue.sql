/*
  # Fix PDF Locking Trigger for Draft Document Issue Flow
  
  ## Problem
  The existing `cleanup_pdf_fields_on_draft` trigger clears locked_pdf_path 
  whenever a draft document is updated, which breaks the issue flow:
  1. Document is draft
  2. Generate PDF and set locked_pdf_path
  3. Trigger sees draft status and clears locked_pdf_path → NULL
  4. Issue operation fails because locked_pdf_path is NULL
  
  ## Solution
  Update trigger to only clear PDF fields when:
  - Inserting a new draft document (initial creation)
  - Transitioning from issued/superseded back to draft (shouldn't happen normally)
  
  Do NOT clear PDF fields when:
  - Updating a draft that already exists (issue flow sets locked_pdf_path before changing status)
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_cleanup_pdf_fields_on_draft ON documents;
DROP FUNCTION IF EXISTS cleanup_pdf_fields_on_draft();

-- Create improved function that only clears on INSERT or when transitioning TO draft
CREATE OR REPLACE FUNCTION cleanup_pdf_fields_on_draft()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only clear PDF fields when:
  -- 1. INSERT of a new draft document
  -- 2. UPDATE where status is transitioning TO draft (from issued/superseded)
  
  IF TG_OP = 'INSERT' AND NEW.issue_status = 'draft' THEN
    -- New draft being created - clear PDF fields
    NEW.locked_pdf_path := NULL;
    NEW.locked_pdf_checksum := NULL;
    NEW.locked_pdf_generated_at := NULL;
    NEW.locked_pdf_size_bytes := NULL;
    NEW.pdf_generation_error := NULL;
  ELSIF TG_OP = 'UPDATE' AND NEW.issue_status = 'draft' AND OLD.issue_status != 'draft' THEN
    -- Transitioning TO draft from another status - clear PDF fields
    NEW.locked_pdf_path := NULL;
    NEW.locked_pdf_checksum := NULL;
    NEW.locked_pdf_generated_at := NULL;
    NEW.locked_pdf_size_bytes := NULL;
    NEW.pdf_generation_error := NULL;
  END IF;
  -- Otherwise, leave PDF fields as-is (allows setting locked_pdf_path before issue)
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER trigger_cleanup_pdf_fields_on_draft
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_pdf_fields_on_draft();

COMMENT ON FUNCTION cleanup_pdf_fields_on_draft IS 'Clears PDF fields only on new draft creation or transition TO draft, allowing PDF locking during issue flow';
