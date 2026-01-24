/*
  # Update Recommendations for Revision Tracking

  1. Changes to recommendations table
    - Add revision_number to track which revision action first appeared in
    - Add closed_at and closed_by for tracking closure
    - Ensure status supports open/closed states

  2. Security
    - Maintain existing RLS policies
*/

-- Add revision tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recommendations' AND column_name = 'revision_number'
  ) THEN
    ALTER TABLE recommendations ADD COLUMN revision_number INTEGER NOT NULL DEFAULT 1;
    COMMENT ON COLUMN recommendations.revision_number IS 'Revision number where this action first appeared';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recommendations' AND column_name = 'closed_at'
  ) THEN
    ALTER TABLE recommendations ADD COLUMN closed_at TIMESTAMPTZ;
    COMMENT ON COLUMN recommendations.closed_at IS 'Timestamp when action was closed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recommendations' AND column_name = 'closed_by'
  ) THEN
    ALTER TABLE recommendations ADD COLUMN closed_by UUID REFERENCES auth.users(id);
    COMMENT ON COLUMN recommendations.closed_by IS 'User who closed this action';
  END IF;
END $$;

-- Update status constraint to include 'open' and 'closed' if not already present
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recommendations_status_check'
  ) THEN
    ALTER TABLE recommendations DROP CONSTRAINT recommendations_status_check;
  END IF;

  -- Add updated constraint
  ALTER TABLE recommendations
  ADD CONSTRAINT recommendations_status_check
  CHECK (status IN ('Not Started', 'In Progress', 'Under Review', 'Completed', 'Rejected', 'open', 'closed'));
END $$;