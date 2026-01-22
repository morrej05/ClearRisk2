/*
  # Add base_document_id trigger for new documents

  1. Changes
    - Create trigger function to set base_document_id to document id for new documents (v1)
    - Apply trigger BEFORE INSERT on documents table

  2. Security
    - Trigger runs automatically, no RLS changes needed
*/

-- Create trigger function to set base_document_id for new documents
CREATE OR REPLACE FUNCTION set_base_document_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If base_document_id is null and this is a new document, set it to the document id
  IF NEW.base_document_id IS NULL THEN
    NEW.base_document_id := NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that runs before insert on documents table
DROP TRIGGER IF EXISTS trigger_set_base_document_id ON documents;
CREATE TRIGGER trigger_set_base_document_id
  BEFORE INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION set_base_document_id();
