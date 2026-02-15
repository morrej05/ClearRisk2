/*
  # Add Trigger Fields to Actions Table

  1. Changes
    - Add `trigger_id` column to store the trigger identifier (e.g., "MOE-P1-01", "DA-P2-01")
    - Add `trigger_text` column to store the human-readable reason for priority

  2. Purpose
    - Support the new severity engine that returns structured trigger information
    - Enable "Reason for priority" display in FRA PDFs for P1/P2 actions
    - Maintain audit trail of why actions received their priority

  3. Notes
    - Columns are nullable to support legacy actions and gradual migration
    - No default values - will be populated via backfill script
    - These fields complement (not replace) severity_tier and priority_band
*/

-- Add trigger_id column to store structured trigger identifier
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actions' AND column_name = 'trigger_id'
  ) THEN
    ALTER TABLE actions ADD COLUMN trigger_id text;
    COMMENT ON COLUMN actions.trigger_id IS 'Structured trigger identifier from severity engine (e.g., MOE-P1-01)';
  END IF;
END $$;

-- Add trigger_text column to store human-readable reason
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actions' AND column_name = 'trigger_text'
  ) THEN
    ALTER TABLE actions ADD COLUMN trigger_text text;
    COMMENT ON COLUMN actions.trigger_text IS 'Human-readable explanation of why this priority was assigned';
  END IF;
END $$;

-- Create index on trigger_id for efficient queries
CREATE INDEX IF NOT EXISTS idx_actions_trigger_id ON actions(trigger_id)
  WHERE trigger_id IS NOT NULL;
