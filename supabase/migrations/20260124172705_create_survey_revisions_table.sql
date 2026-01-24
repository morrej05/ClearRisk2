/*
  # Create Survey Revisions Table

  1. New Table: survey_revisions
    - Stores immutable snapshots of survey data at issue time
    - Links to parent survey via survey_id
    - Tracks revision_number for versioning
    - Stores complete snapshot as JSONB
    - Records issue metadata (issued_at, issued_by)

  2. Security
    - Enable RLS
    - Users can read revisions from their surveys
    - Only system can create revisions (via Edge Function)
*/

-- Create survey_revisions table
CREATE TABLE IF NOT EXISTS survey_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES survey_reports(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued')),
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  issued_at TIMESTAMPTZ,
  issued_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(survey_id, revision_number)
);

COMMENT ON TABLE survey_revisions IS 'Immutable revision history for surveys - stores complete state at issue time';
COMMENT ON COLUMN survey_revisions.snapshot IS 'Complete survey data snapshot: metadata, answers, actions, confirmation';
COMMENT ON COLUMN survey_revisions.revision_number IS 'Sequential revision number (1, 2, 3...)';

-- Enable RLS
ALTER TABLE survey_revisions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view revisions from their own surveys
CREATE POLICY "Users can view own survey revisions"
  ON survey_revisions
  FOR SELECT
  TO authenticated
  USING (
    survey_id IN (
      SELECT id FROM survey_reports
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Service role can insert revisions (for Edge Function)
CREATE POLICY "Service role can create revisions"
  ON survey_revisions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_survey_revisions_survey_id 
  ON survey_revisions(survey_id);

CREATE INDEX IF NOT EXISTS idx_survey_revisions_issued_at 
  ON survey_revisions(issued_at) WHERE issued_at IS NOT NULL;