/*
  # Add Action Lifecycle - Soft Delete and Source Tracing

  1. Purpose
    - Add soft-delete capability (deleted_at, deleted_by)
    - Add source_document_id for stable origin tracking
    - Ensure priority_band constraint exists
    - Add performance indexes for common queries

  2. New Columns
    - `source_document_id` (uuid) - Original document where action was first created (stable reference)
    - `deleted_at` (timestamptz) - Soft delete timestamp
    - `deleted_by` (uuid) - User who soft-deleted the action

  3. Constraints
    - Ensure status values are valid (if not already constrained)
    - Ensure priority_band values are valid (P1-P4)

  4. Indexes
    - Fast lookups by document_id, module_instance_id
    - Soft-delete filtering on deleted_at
    - Origin tracking via origin_action_id

  5. Data Migration
    - Backfill source_document_id for existing actions (equals their current document_id)
*/

-- Add soft delete and source tracking columns
ALTER TABLE actions 
ADD COLUMN IF NOT EXISTS source_document_id uuid,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Backfill source_document_id for existing rows
UPDATE actions
SET source_document_id = document_id
WHERE source_document_id IS NULL;

-- Ensure status constraint exists (expand if already present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'actions_status_check' AND conrelid = 'actions'::regclass
  ) THEN
    ALTER TABLE actions DROP CONSTRAINT actions_status_check;
  END IF;
END $$;

ALTER TABLE actions
ADD CONSTRAINT actions_status_check
CHECK (status IN ('open', 'in_progress', 'closed', 'deferred', 'not_applicable'));

-- Ensure priority_band constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'actions_priority_band_check' AND conrelid = 'actions'::regclass
  ) THEN
    ALTER TABLE actions
    ADD CONSTRAINT actions_priority_band_check
    CHECK (priority_band IN ('P1', 'P2', 'P3', 'P4'));
  END IF;
END $$;

-- Add foreign key for deleted_by (references auth.users)
ALTER TABLE actions
ADD CONSTRAINT actions_deleted_by_fkey
FOREIGN KEY (deleted_by) 
REFERENCES auth.users(id) 
ON DELETE SET NULL;

-- Add foreign key for source_document_id
ALTER TABLE actions
ADD CONSTRAINT actions_source_document_fkey
FOREIGN KEY (source_document_id) 
REFERENCES documents(id) 
ON DELETE SET NULL;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_actions_document 
ON actions (document_id);

CREATE INDEX IF NOT EXISTS idx_actions_module_instance 
ON actions (module_instance_id);

CREATE INDEX IF NOT EXISTS idx_actions_deleted_at 
ON actions (deleted_at);

CREATE INDEX IF NOT EXISTS idx_actions_status 
ON actions (status);

CREATE INDEX IF NOT EXISTS idx_actions_priority 
ON actions (priority_band);
