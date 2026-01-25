/*
  # Add enabled_modules to Documents Table

  1. Changes to documents table
    - Add enabled_modules TEXT[] column for combined surveys
    - Populate from existing document_type for backward compatibility
    - Add helper functions for module checks

  2. Notes
    - Single-module: enabled_modules = ['FRA'] or ['FSD'] or ['DSEAR']
    - Combined: enabled_modules = ['FRA', 'FSD']
    - Falls back to document_type if enabled_modules is NULL

  3. Security
    - Maintains existing RLS policies
*/

-- Step 1: Add enabled_modules column to documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'enabled_modules'
  ) THEN
    ALTER TABLE documents ADD COLUMN enabled_modules TEXT[];
    COMMENT ON COLUMN documents.enabled_modules IS 'Array of enabled module types: FRA, FSD, DSEAR. Supports combined documents.';
  END IF;
END $$;

-- Step 2: Populate enabled_modules from existing document_type
UPDATE documents
SET enabled_modules = ARRAY[document_type]::TEXT[]
WHERE enabled_modules IS NULL AND document_type IS NOT NULL;

-- Step 3: Create helper function to get active modules for a document
CREATE OR REPLACE FUNCTION get_document_modules(doc_row documents)
RETURNS TEXT[] AS $$
BEGIN
  -- If enabled_modules is set, use it
  IF doc_row.enabled_modules IS NOT NULL AND array_length(doc_row.enabled_modules, 1) > 0 THEN
    RETURN doc_row.enabled_modules;
  END IF;

  -- Fall back to document_type for legacy documents
  IF doc_row.document_type IS NOT NULL THEN
    RETURN ARRAY[doc_row.document_type]::TEXT[];
  END IF;

  -- Default to empty array
  RETURN ARRAY[]::TEXT[];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_document_modules IS 'Returns active modules for a document (enabled_modules or falls back to document_type)';

-- Step 4: Create helper function to check if document has specific module
CREATE OR REPLACE FUNCTION document_has_module(
  doc_row documents,
  module_name TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  active_modules TEXT[];
BEGIN
  active_modules := get_document_modules(doc_row);
  RETURN module_name = ANY(active_modules);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION document_has_module IS 'Checks if document has a specific module enabled (FRA, FSD, or DSEAR)';

-- Step 5: Add constraint to ensure valid module names
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_enabled_modules_check'
  ) THEN
    ALTER TABLE documents
    ADD CONSTRAINT documents_enabled_modules_check
    CHECK (
      enabled_modules IS NULL OR
      (
        enabled_modules <@ ARRAY['FRA', 'FSD', 'DSEAR']::TEXT[] AND
        array_length(enabled_modules, 1) > 0
      )
    );
  END IF;
END $$;

-- Step 6: Create index for enabled_modules queries
CREATE INDEX IF NOT EXISTS idx_documents_enabled_modules
ON documents USING GIN (enabled_modules);
