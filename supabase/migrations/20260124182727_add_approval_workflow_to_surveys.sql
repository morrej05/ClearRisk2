/*
  # Add Approval Workflow to Surveys

  1. Changes to survey_reports table
    - Extend status enum to include: 'draft', 'in_review', 'approved', 'issued'
    - Add approval metadata fields:
      - approved_at (timestamptz, nullable) - When survey was approved
      - approved_by (uuid, nullable) - Who approved the survey
      - approval_note (text, nullable) - Optional approval note/comments

  2. Audit Log Event Types
    - New event types: 'submitted_for_review', 'returned_to_draft', 'approved'

  3. State Transition Rules (enforced in edge functions and UI)
    - draft → in_review (any authorized user)
    - in_review → draft (admin only)
    - in_review → approved (admin only)
    - approved → draft (admin only)
    - approved → issued (admin only, via issueSurvey)
    - issued → draft (only via createRevision)

  4. Permission Model
    - Draft: Editable by surveyor + admin
    - In Review: Editable by admin only, surveyor read-only
    - Approved: Read-only for everyone except admin, can be issued
    - Issued: Locked (existing logic)

  5. Important Notes
    - Approval is per revision (when new revision created, status resets to 'draft')
    - Issuance requires status='approved' (enforced in /issueSurvey)
    - Never auto-skip approval on revision creation
    - Immutability and snapshot logic unchanged
*/

-- Step 1: Add approval metadata columns to survey_reports
DO $$
BEGIN
  -- Add approved_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN approved_at TIMESTAMPTZ;
    COMMENT ON COLUMN survey_reports.approved_at IS 'Timestamp when survey was approved for issuance';
  END IF;

  -- Add approved_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN approved_by UUID REFERENCES auth.users(id);
    COMMENT ON COLUMN survey_reports.approved_by IS 'User who approved the survey';
  END IF;

  -- Add approval_note column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'approval_note'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN approval_note TEXT;
    COMMENT ON COLUMN survey_reports.approval_note IS 'Optional note provided during approval';
  END IF;
END $$;

-- Step 2: Update status column to support new workflow states
-- Drop existing constraint if it exists and recreate with new values
DO $$
BEGIN
  -- Drop the old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'survey_reports' AND constraint_name LIKE '%status%check%'
  ) THEN
    ALTER TABLE survey_reports DROP CONSTRAINT IF EXISTS survey_reports_status_check;
  END IF;

  -- Add new constraint with all workflow states
  ALTER TABLE survey_reports
  ADD CONSTRAINT survey_reports_status_check
  CHECK (status IN ('draft', 'in_review', 'approved', 'issued'));
END $$;

-- Step 3: Ensure default status is 'draft' for new surveys
ALTER TABLE survey_reports
ALTER COLUMN status SET DEFAULT 'draft';

-- Step 4: Update any existing surveys with NULL or invalid status to 'draft'
UPDATE survey_reports
SET status = 'draft'
WHERE status IS NULL OR status NOT IN ('draft', 'in_review', 'approved', 'issued');

-- Step 5: Update issued surveys to have correct status
-- If issued=true but status is not 'issued', fix it
UPDATE survey_reports
SET status = 'issued'
WHERE issued = true AND status != 'issued';

-- Step 6: Create index for approval queries
CREATE INDEX IF NOT EXISTS idx_survey_reports_status
ON survey_reports(status) WHERE status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_survey_reports_approved_by
ON survey_reports(approved_by) WHERE approved_by IS NOT NULL;

-- Step 7: Add comment to status column explaining workflow
COMMENT ON COLUMN survey_reports.status IS 'Workflow status: draft → in_review → approved → issued. Approval required before issuance.';

-- Step 8: Create helper function to validate status transitions
CREATE OR REPLACE FUNCTION validate_survey_status_transition(
  p_current_status TEXT,
  p_new_status TEXT,
  p_is_admin BOOLEAN
) RETURNS BOOLEAN AS $$
BEGIN
  -- Allowed transitions
  IF p_current_status = 'draft' AND p_new_status = 'in_review' THEN
    RETURN TRUE;
  END IF;

  IF p_current_status = 'in_review' AND p_new_status = 'draft' AND p_is_admin THEN
    RETURN TRUE;
  END IF;

  IF p_current_status = 'in_review' AND p_new_status = 'approved' AND p_is_admin THEN
    RETURN TRUE;
  END IF;

  IF p_current_status = 'approved' AND p_new_status = 'draft' AND p_is_admin THEN
    RETURN TRUE;
  END IF;

  IF p_current_status = 'approved' AND p_new_status = 'issued' AND p_is_admin THEN
    RETURN TRUE;
  END IF;

  -- Special case: issued can only go to draft via revision creation
  -- This is handled in application logic, not this function

  -- All other transitions are invalid
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION validate_survey_status_transition IS 'Validates allowed status transitions in approval workflow';
