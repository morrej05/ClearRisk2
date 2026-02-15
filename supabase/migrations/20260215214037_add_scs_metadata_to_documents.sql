/*
  # Add SCS Metadata to Documents

  1. Changes
    - Add `scs_score` column to store calculated Structural Complexity Score
    - Add `scs_band` column to store complexity band (Low, Moderate, High, VeryHigh)

  2. Purpose
    - Store pre-calculated SCS for performance and historical tracking
    - Enable internal analytics and dashboard displays
    - SCS is not shown in client PDFs (numeric score), only band-based tone adjustments

  3. Notes
    - Columns are nullable as SCS is calculated on-demand if missing
    - SCS is recalculated whenever document modules are updated
    - Band values: 'Low', 'Moderate', 'High', 'VeryHigh'
*/

-- Add SCS score column (numeric value, max 20)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'scs_score'
  ) THEN
    ALTER TABLE documents ADD COLUMN scs_score integer;
    COMMENT ON COLUMN documents.scs_score IS 'Structural Complexity Score (0-20) calculated from building profile and fire protection systems';
  END IF;
END $$;

-- Add SCS band column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'scs_band'
  ) THEN
    ALTER TABLE documents ADD COLUMN scs_band text CHECK (scs_band IN ('Low', 'Moderate', 'High', 'VeryHigh'));
    COMMENT ON COLUMN documents.scs_band IS 'Complexity band derived from SCS score, used for executive summary tone';
  END IF;
END $$;

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_documents_scs_band ON documents(scs_band)
  WHERE scs_band IS NOT NULL;
