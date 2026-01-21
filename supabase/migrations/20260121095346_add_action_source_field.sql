/*
  # Add action source tracking field

  1. Changes
    - Add `source` column to actions table
    - Values: 'manual', 'info_gap', 'recommendation', 'system'
    - Default: 'manual'
    - Used to identify actions created from information gaps

  2. Purpose
    - Track origin of actions for UI labeling and filtering
    - Support info gap action identification (PHASE 6.3 - Step 4)
    - Enable future analytics on action sources
*/

-- Add source column to actions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actions' AND column_name = 'source'
  ) THEN
    ALTER TABLE actions ADD COLUMN source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'info_gap', 'recommendation', 'system'));
  END IF;
END $$;

-- Add index for filtering by source
CREATE INDEX IF NOT EXISTS idx_actions_source ON actions(source);

-- Comment for documentation
COMMENT ON COLUMN actions.source IS 'Origin of action: manual (user-created), info_gap (from info gap quick actions), recommendation (from recommendation library), system (auto-generated)';
