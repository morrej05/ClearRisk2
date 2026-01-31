/*
  # Remove Duplicate Module Instances and Add Unique Constraint

  1. Changes
    - Remove duplicate module_instances rows (keeping the most recent one per document_id + module_key)
    - Add UNIQUE constraint on (document_id, module_key) in module_instances table
  
  2. Purpose
    - Clean up existing duplicates
    - Enforce data integrity going forward
    - Enable safe upsert operations when backfilling missing modules
    - Prevent accidental duplicate module creation
  
  3. Security
    - No RLS changes needed (constraint is at data integrity level)
*/

-- Step 1: Remove duplicates, keeping the most recent entry per (document_id, module_key)
DELETE FROM module_instances
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY document_id, module_key 
        ORDER BY updated_at DESC, created_at DESC, id DESC
      ) as rn
    FROM module_instances
  ) t
  WHERE rn > 1
);

-- Step 2: Add unique constraint to prevent future duplicates
ALTER TABLE module_instances 
DROP CONSTRAINT IF EXISTS module_instances_document_module_unique;

ALTER TABLE module_instances 
ADD CONSTRAINT module_instances_document_module_unique 
UNIQUE (document_id, module_key);