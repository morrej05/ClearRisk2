/*
  # Add Action Close-out and Carry-forward Fields

  1. Purpose
    - Track action lifecycle (close-out) with timestamps and notes
    - Enable action carry-forward between document versions
    - Link related actions across versions via origin tracking
    - Support expanded status values for action management

  2. New Columns
    - `origin_action_id` (uuid, nullable) - Links to the original action if this is a carried-forward copy
    - `carried_from_document_id` (uuid, nullable) - Source document when action was carried forward
    - `closed_at` (timestamptz, nullable) - When action was closed
    - `closed_by` (uuid, nullable) - User who closed the action
    - `closure_notes` (text, nullable) - Notes about action closure

  3. Status Updates
    - Expand allowed statuses: open, in_progress, closed, not_applicable, deferred
    - Previously was: open, in_progress, complete
    - 'closed' = completed/resolved
    - 'not_applicable' = determined not needed
    - 'deferred' = postponed to future

  4. Indexes
    - Dedupe index on (document_id, module_instance_id, status) for fast duplicate checks
    - Index on origin_action_id for tracking related actions

  5. Notes
    - origin_action_id creates a chain: when action is carried forward, it points to the source action
    - When closing actions, we close the entire chain (all related actions)
    - closed_by references auth.users for audit trail
*/

-- Add new columns for action close-out tracking
ALTER TABLE actions 
ADD COLUMN IF NOT EXISTS origin_action_id uuid,
ADD COLUMN IF NOT EXISTS carried_from_document_id uuid,
ADD COLUMN IF NOT EXISTS closed_at timestamptz,
ADD COLUMN IF NOT EXISTS closed_by uuid,
ADD COLUMN IF NOT EXISTS closure_notes text;

-- Drop existing status constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'actions_status_check' AND conrelid = 'actions'::regclass
  ) THEN
    ALTER TABLE actions DROP CONSTRAINT actions_status_check;
  END IF;
END $$;

-- Add expanded status constraint
ALTER TABLE actions
ADD CONSTRAINT actions_status_check
CHECK (status IN ('open', 'in_progress', 'closed', 'not_applicable', 'deferred'));

-- Add foreign key for origin_action_id (self-referential)
ALTER TABLE actions
ADD CONSTRAINT actions_origin_action_fk
FOREIGN KEY (origin_action_id) 
REFERENCES actions(id) 
ON DELETE SET NULL;

-- Add foreign key for carried_from_document_id
ALTER TABLE actions
ADD CONSTRAINT actions_carried_from_document_fk
FOREIGN KEY (carried_from_document_id) 
REFERENCES documents(id) 
ON DELETE SET NULL;

-- Add foreign key for closed_by
ALTER TABLE actions
ADD CONSTRAINT actions_closed_by_fk
FOREIGN KEY (closed_by) 
REFERENCES auth.users(id) 
ON DELETE SET NULL;

-- Create index for deduplication checks
CREATE INDEX IF NOT EXISTS idx_actions_dedupe 
ON actions (document_id, module_instance_id, status);

-- Create index for origin tracking
CREATE INDEX IF NOT EXISTS idx_actions_origin 
ON actions (origin_action_id);

-- Create index for carried_from tracking
CREATE INDEX IF NOT EXISTS idx_actions_carried_from 
ON actions (carried_from_document_id);

-- Create index for closure tracking
CREATE INDEX IF NOT EXISTS idx_actions_closed_at 
ON actions (closed_at);
