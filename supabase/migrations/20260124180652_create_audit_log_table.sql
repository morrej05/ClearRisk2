/*
  # Create Audit Log Table

  1. Purpose
    - Track all significant events across the platform
    - Provide complete audit trail for compliance
    - Enable history/timeline views for surveys
    - Support forensic analysis and debugging

  2. New Table: audit_log
    - id (uuid, primary key) - Unique event identifier
    - created_at (timestamptz) - When event occurred
    - organisation_id (uuid) - Organization context
    - survey_id (uuid) - Survey being acted upon
    - revision_number (int, nullable) - Revision context if applicable
    - actor_id (uuid, nullable) - User who performed action
    - event_type (text) - Type of event (issued, revision_created, action_closed, action_reopened)
    - details (jsonb) - Event-specific metadata

  3. Event Types
    - 'issued' - Survey revision was issued
    - 'revision_created' - New revision created
    - 'action_closed' - Action/recommendation closed
    - 'action_reopened' - Action/recommendation reopened

  4. Indexes
    - (survey_id, created_at DESC) - Fast timeline queries
    - (survey_id, event_type) - Event type filtering
    - (organisation_id, created_at DESC) - Org-wide audit queries

  5. Security
    - RLS enabled
    - Users can only read audit logs for surveys they have access to
    - Only edge functions (service role) can insert audit logs
*/

-- Create audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  survey_id UUID NOT NULL REFERENCES survey_reports(id) ON DELETE CASCADE,
  revision_number INTEGER,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'issued',
    'revision_created',
    'action_closed',
    'action_reopened'
  )),
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_audit_log_survey_created 
ON audit_log (survey_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_survey_event_type 
ON audit_log (survey_id, event_type);

CREATE INDEX IF NOT EXISTS idx_audit_log_org_created 
ON audit_log (organisation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor 
ON audit_log (actor_id);

-- Add comments for documentation
COMMENT ON TABLE audit_log IS 'Comprehensive audit trail of all significant platform events';
COMMENT ON COLUMN audit_log.event_type IS 'Type of event: issued, revision_created, action_closed, action_reopened';
COMMENT ON COLUMN audit_log.details IS 'Event-specific metadata (change_log, notes, action details, etc.)';
COMMENT ON COLUMN audit_log.actor_id IS 'User who performed the action (null if system-initiated)';
COMMENT ON COLUMN audit_log.revision_number IS 'Revision number context for the event';

-- Enable RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read audit logs for surveys they have access to
CREATE POLICY "Users can view audit logs for their org surveys"
ON audit_log FOR SELECT
TO authenticated
USING (
  survey_id IN (
    SELECT id FROM survey_reports
    WHERE organisation_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )
  )
);

-- Policy: Only service role can insert audit logs (enforced by edge functions)
-- Note: This is implicitly handled by not creating an INSERT policy
-- Edge functions use service role key which bypasses RLS