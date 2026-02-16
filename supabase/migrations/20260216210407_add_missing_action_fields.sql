/*
  # Add Missing Action Fields - Fix PGRST204 Insert Error

  1. Purpose
    - Fix action creation failure (PGRST204: missing columns)
    - Add severity_tier, finding_category, and escalation_justification columns
    - Support AddActionModal insert payload requirements

  2. New Columns
    - `severity_tier` (text) - Severity classification (T1, T2, T3, T4)
    - `finding_category` (text) - FRA finding category (Means of Escape, Fire Detection, etc.)
    - `escalation_justification` (text) - Required justification when escalating action to P1

  3. Notes
    - All columns nullable to support existing actions and gradual adoption
    - severity_tier complements priority_band (priority is P1-P4, severity is T1-T4)
    - finding_category helps categorize actions for reporting
    - escalation_justification provides audit trail for manual P1 escalations

  4. Security
    - No RLS changes needed (inherits from actions table)
*/

-- Add severity_tier column for T1-T4 classification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actions' AND column_name = 'severity_tier'
  ) THEN
    ALTER TABLE actions ADD COLUMN severity_tier TEXT;
    COMMENT ON COLUMN actions.severity_tier IS 'Severity tier classification (T1=low, T2=moderate, T3=high, T4=critical)';
  END IF;
END $$;

-- Add finding_category column for FRA categorization
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actions' AND column_name = 'finding_category'
  ) THEN
    ALTER TABLE actions ADD COLUMN finding_category TEXT;
    COMMENT ON COLUMN actions.finding_category IS 'Category of finding (e.g., Means of Escape, Fire Detection, Compartmentation, Other)';
  END IF;
END $$;

-- Add escalation_justification column for manual P1 escalations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actions' AND column_name = 'escalation_justification'
  ) THEN
    ALTER TABLE actions ADD COLUMN escalation_justification TEXT;
    COMMENT ON COLUMN actions.escalation_justification IS 'Required justification when assessor manually escalates action to P1 priority';
  END IF;
END $$;

-- Create index on severity_tier for filtering
CREATE INDEX IF NOT EXISTS idx_actions_severity_tier 
ON actions(severity_tier) 
WHERE severity_tier IS NOT NULL;

-- Create index on finding_category for filtering
CREATE INDEX IF NOT EXISTS idx_actions_finding_category 
ON actions(finding_category) 
WHERE finding_category IS NOT NULL;