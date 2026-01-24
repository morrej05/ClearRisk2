/*
  # Add Action Close-out and Reopen Fields

  1. Purpose
    - Add closure_note field for documenting why actions were closed
    - Add reopen tracking fields (reopened_at, reopened_by, reopen_note)
    - Support full lifecycle of close/reopen actions

  2. New Columns (survey_recommendations)
    - closure_note TEXT - Notes about why action was closed
    - reopened_at TIMESTAMPTZ - When action was reopened
    - reopened_by UUID - User who reopened the action
    - reopen_note TEXT - Notes about why action was reopened

  3. Status Behavior
    - status='closed' means action is resolved/completed
    - When reopened, status changes to 'open' and reopen fields populated
    - closed_at/closed_by cleared when reopened (or kept for history)

  4. Security
    - RLS policies already exist on survey_recommendations
    - These are data columns only, no additional policies needed
*/

-- Add closure and reopen fields to survey_recommendations
ALTER TABLE survey_recommendations
ADD COLUMN IF NOT EXISTS closure_note TEXT,
ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reopened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reopen_note TEXT;

-- Add comments for documentation
COMMENT ON COLUMN survey_recommendations.closure_note IS 'Notes about why this action was closed';
COMMENT ON COLUMN survey_recommendations.reopened_at IS 'Timestamp when this action was reopened after being closed';
COMMENT ON COLUMN survey_recommendations.reopened_by IS 'User who reopened this action';
COMMENT ON COLUMN survey_recommendations.reopen_note IS 'Notes about why this action was reopened';

-- Create index for finding reopened actions
CREATE INDEX IF NOT EXISTS idx_survey_recommendations_reopened_at
ON survey_recommendations(reopened_at) WHERE reopened_at IS NOT NULL;