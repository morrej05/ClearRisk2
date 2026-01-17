/*
  # Create Trigger Evaluation Log System
  
  ## Purpose
  Provides debugging and visibility into trigger evaluation process.
  Super admins can see which triggers were evaluated, matched, and why.
  
  ## New Table: trigger_evaluation_log
  - Stores every trigger evaluation attempt
  - Shows what was searched for and what was found
  - Helps debug why triggers don't fire
  
  ## Security
  - Super admins only (read/write)
  - Automatically cleaned up after 30 days
*/

CREATE TABLE IF NOT EXISTS trigger_evaluation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES survey_reports(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  field_key text NOT NULL,
  rating_value text NOT NULL,
  matched_trigger_count int NOT NULL DEFAULT 0,
  recommendations_added int NOT NULL DEFAULT 0,
  error_message text,
  evaluation_context jsonb,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trigger_eval_log_survey
  ON trigger_evaluation_log(survey_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trigger_eval_log_created_at
  ON trigger_evaluation_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trigger_eval_log_field_key
  ON trigger_evaluation_log(section_key, field_key, rating_value);

-- Enable RLS
ALTER TABLE trigger_evaluation_log ENABLE ROW LEVEL SECURITY;

-- Only super admins can read logs
CREATE POLICY "Super admins can read trigger eval logs"
  ON trigger_evaluation_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.id = auth.uid())
  );

-- Only super admins can insert logs
CREATE POLICY "Super admins can insert trigger eval logs"
  ON trigger_evaluation_log FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.id = auth.uid())
  );

-- Auto-delete logs older than 30 days (optional - can be run as cron job)
-- For now, just create a function that can be called manually
CREATE OR REPLACE FUNCTION cleanup_old_trigger_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM trigger_evaluation_log
  WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
