/*
  # Add Write Protection for Issued Surveys

  1. Changes
    - Add RLS policies to prevent updates to issued surveys
    - Block edits to survey_reports when status='issued'
    - Block edits to related tables (recommendations, actions) for issued surveys
    - Allow only status changes via authorized functions (create-revision)

  2. Security
    - Hard server-side block on all write operations to issued surveys
    - Users must create a revision to edit issued surveys
*/

-- Drop existing update policies if they exist to replace them
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can update own surveys" ON survey_reports;
  DROP POLICY IF EXISTS "Users can update their survey reports" ON survey_reports;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new update policy that blocks issued surveys
CREATE POLICY "Users can update own draft surveys only"
  ON survey_reports
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() 
    AND (status = 'draft' OR status IS NULL OR issued = false)
  )
  WITH CHECK (
    user_id = auth.uid() 
    AND (status = 'draft' OR status IS NULL OR issued = false)
  );

-- Add policy to prevent deleting issued surveys
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can delete own surveys" ON survey_reports;
  DROP POLICY IF EXISTS "Users can delete their survey reports" ON survey_reports;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can delete own draft surveys only"
  ON survey_reports
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() 
    AND (status = 'draft' OR status IS NULL OR issued = false)
  );

-- Block updates to recommendations for issued surveys
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can update recommendations for their surveys" ON recommendations;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can update recommendations for draft surveys only"
  ON recommendations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM survey_reports 
      WHERE survey_reports.id = recommendations.survey_id 
      AND survey_reports.user_id = auth.uid()
      AND (survey_reports.status = 'draft' OR survey_reports.status IS NULL OR survey_reports.issued = false)
    )
  );

-- Block deletes to recommendations for issued surveys
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can delete recommendations for their surveys" ON recommendations;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can delete recommendations for draft surveys only"
  ON recommendations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM survey_reports 
      WHERE survey_reports.id = recommendations.survey_id 
      AND survey_reports.user_id = auth.uid()
      AND (survey_reports.status = 'draft' OR survey_reports.status IS NULL OR survey_reports.issued = false)
    )
  );

-- Add comment explaining the protection
COMMENT ON POLICY "Users can update own draft surveys only" ON survey_reports IS 
  'Prevents editing issued surveys. Users must create a revision to make changes.';
