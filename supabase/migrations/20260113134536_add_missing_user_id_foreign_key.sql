/*
  # Add Missing Foreign Key for survey_reports.user_id

  ## Problem
  The survey_reports table has a user_id column but is missing the foreign key constraint
  to user_profiles.id, causing queries with joins to fail.

  ## Changes
  - Add foreign key constraint from survey_reports.user_id to user_profiles.id
  - This enables PostgREST to properly join surveys with user profile data
*/

-- Add the missing foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'survey_reports_user_id_fkey'
    AND table_name = 'survey_reports'
  ) THEN
    ALTER TABLE survey_reports
    ADD CONSTRAINT survey_reports_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
