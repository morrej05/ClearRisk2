/*
  # Add Jurisdiction Field to Documents

  1. Changes
    - Add `jurisdiction` column to `documents` table
    - Default to 'UK' for backward compatibility
    - Allowed values: 'UK', 'IE'
  
  2. Notes
    - Existing documents will default to 'UK' jurisdiction
    - This field controls display names for assessments:
      - UK → "DSEAR Risk Assessment"
      - IE → "Explosive Atmospheres Risk Assessment"
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'jurisdiction'
  ) THEN
    ALTER TABLE documents 
    ADD COLUMN jurisdiction TEXT NOT NULL DEFAULT 'UK' CHECK (jurisdiction IN ('UK', 'IE'));
  END IF;
END $$;