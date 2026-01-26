/*
  # Add Action Reference Number and Lifecycle Tracking

  1. Purpose
    - Add permanent reference numbers for actions (R-01, R-02, etc.)
    - Track when actions were first raised (version number)
    - Track superseded actions and their replacements
    - Support Issued Report PDF requirements

  2. New Columns
    - `reference_number` (text, nullable) - Permanent reference (R-01, R-02...)
    - `first_raised_in_version` (integer, nullable) - Document version when action was first created
    - `superseded_by_action_id` (uuid, nullable) - Points to action that replaces this one
    - `superseded_at` (timestamptz, nullable) - When action was superseded

  3. Status Updates
    - Add 'superseded' to allowed statuses

  4. Notes
    - reference_number is assigned when action is first created in an issued document
    - Numbers are sequential within a document lineage (base_document_id)
    - first_raised_in_version helps track action history across versions
    - superseded_by_action_id creates replacement chain
*/

-- Add new lifecycle tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actions' AND column_name = 'reference_number'
  ) THEN
    ALTER TABLE actions ADD COLUMN reference_number TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actions' AND column_name = 'first_raised_in_version'
  ) THEN
    ALTER TABLE actions ADD COLUMN first_raised_in_version INTEGER NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actions' AND column_name = 'superseded_by_action_id'
  ) THEN
    ALTER TABLE actions ADD COLUMN superseded_by_action_id UUID NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actions' AND column_name = 'superseded_at'
  ) THEN
    ALTER TABLE actions ADD COLUMN superseded_at TIMESTAMPTZ NULL;
  END IF;
END $$;

-- Drop existing status constraint and add superseded
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
CHECK (status IN ('open', 'in_progress', 'closed', 'not_applicable', 'deferred', 'superseded'));

-- Add foreign key for superseded_by_action_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'actions_superseded_by_fk'
  ) THEN
    ALTER TABLE actions
    ADD CONSTRAINT actions_superseded_by_fk
    FOREIGN KEY (superseded_by_action_id) 
    REFERENCES actions(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for reference number lookups
CREATE INDEX IF NOT EXISTS idx_actions_reference_number 
ON actions (reference_number);

-- Create index for superseded tracking
CREATE INDEX IF NOT EXISTS idx_actions_superseded_by 
ON actions (superseded_by_action_id);

-- Create unique index for reference numbers within a document
CREATE UNIQUE INDEX IF NOT EXISTS idx_actions_unique_ref_per_document
ON actions (document_id, reference_number)
WHERE reference_number IS NOT NULL;