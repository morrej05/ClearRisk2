/*
  # Update Jurisdiction Values to Explicit Legal Regimes

  1. Changes
    - Removes old check constraint that only allowed 'UK' and 'IE'
    - Adds new check constraint for explicit legal regimes
    - Migrates existing data to new jurisdiction values

  2. New Jurisdictions
    - 'england_wales' (England & Wales)
    - 'scotland' (Scotland)
    - 'northern_ireland' (Northern Ireland)
    - 'ireland' (Republic of Ireland)

  3. Data Migration
    - 'UK' → 'england_wales'
    - 'IE' → 'ireland'
    - NULL → 'england_wales' (default)
*/

-- Step 1: Drop the old check constraint
ALTER TABLE documents
DROP CONSTRAINT IF EXISTS documents_jurisdiction_check;

-- Step 2: Update existing data from old values to new values
UPDATE documents
SET jurisdiction = 'england_wales'
WHERE jurisdiction = 'UK' OR jurisdiction IS NULL;

UPDATE documents
SET jurisdiction = 'ireland'
WHERE jurisdiction = 'IE';

-- Step 3: Add new check constraint with all valid jurisdictions
ALTER TABLE documents
ADD CONSTRAINT documents_jurisdiction_check 
CHECK (jurisdiction IN ('england_wales', 'scotland', 'northern_ireland', 'ireland'));
