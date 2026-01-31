/*
  # Add RE (Risk Engineering) Document Type

  1. Changes
    - Add 'RE' to the document_type CHECK constraint on documents table
    - This allows Risk Engineering assessments to be stored as documents
  
  2. Purpose
    - Unify RE assessments with FRA/FSD/DSEAR in the documents system
    - Enable RE to use the same modular framework, module_instances, and actions
    - Fix navigation bug where RE creation used property_surveys but routed to documents
  
  3. Security
    - No RLS changes needed (existing policies apply to all document types)
*/

-- Drop the old constraint
ALTER TABLE documents 
DROP CONSTRAINT IF EXISTS documents_document_type_check;

-- Add new constraint with RE included
ALTER TABLE documents 
ADD CONSTRAINT documents_document_type_check 
CHECK (document_type IN ('FRA', 'FSD', 'DSEAR', 'RE'));