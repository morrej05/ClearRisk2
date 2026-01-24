/*
  # Issued Survey Write-Lock RLS Policies

  1. Purpose
    - Enforce server-side immutability of issued surveys at the database level
    - Prevent any mutations to issued survey data (defense-in-depth)
    - Block updates to survey_reports when status='issued'
    - Block mutations to recommendations when parent survey is issued
    - Complement edge function guards with database-level enforcement

  2. New Policies
    - survey_reports: Block updates when status='issued'
    - survey_recommendations: Block INSERT/UPDATE/DELETE when parent survey is issued
    - Exceptions: create-revision and issue-survey edge functions (use service role)

  3. Security Benefits
    - Defense-in-depth: Even if edge function guard fails, DB blocks write
    - Prevents client-side bypass attempts
    - Protects against bugs in application logic
    - Ensures issued surveys remain immutable

  4. Notes
    - These are RESTRICTIVE policies (deny by default approach)
    - Edge functions using service role can still write (as intended)
    - Users with anon key cannot mutate issued surveys
*/

-- ========================================
-- SURVEY_REPORTS: Block updates when issued
-- ========================================

-- Drop any existing conflicting policies
DROP POLICY IF EXISTS "block_issued_survey_updates" ON survey_reports;

-- Create restrictive policy to block updates to issued surveys
-- This is a RESTRICTIVE policy that denies even when other policies allow
CREATE POLICY "block_issued_survey_updates"
ON survey_reports
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  -- Only allow updates if status is NOT 'issued'
  status <> 'issued'
);

-- ========================================
-- SURVEY_RECOMMENDATIONS: Protect when parent survey is issued
-- ========================================

-- Drop any existing conflicting policies
DROP POLICY IF EXISTS "block_recommendations_on_issued_surveys_insert" ON survey_recommendations;
DROP POLICY IF EXISTS "block_recommendations_on_issued_surveys_update" ON survey_recommendations;
DROP POLICY IF EXISTS "block_recommendations_on_issued_surveys_delete" ON survey_recommendations;

-- Block INSERT when parent survey is issued
CREATE POLICY "block_recommendations_on_issued_surveys_insert"
ON survey_recommendations
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  -- Only allow inserts if parent survey is NOT issued
  survey_id IN (
    SELECT id FROM survey_reports
    WHERE status <> 'issued'
  )
);

-- Block UPDATE when parent survey is issued
CREATE POLICY "block_recommendations_on_issued_surveys_update"
ON survey_recommendations
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  -- Only allow updates if parent survey is NOT issued
  survey_id IN (
    SELECT id FROM survey_reports
    WHERE status <> 'issued'
  )
)
WITH CHECK (
  -- Ensure survey remains non-issued after update
  survey_id IN (
    SELECT id FROM survey_reports
    WHERE status <> 'issued'
  )
);

-- Block DELETE when parent survey is issued
CREATE POLICY "block_recommendations_on_issued_surveys_delete"
ON survey_recommendations
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  -- Only allow deletes if parent survey is NOT issued
  survey_id IN (
    SELECT id FROM survey_reports
    WHERE status <> 'issued'
  )
);

-- ========================================
-- COMMENTS
-- ========================================

-- Add comments explaining the protection
COMMENT ON POLICY "block_issued_survey_updates" ON survey_reports IS 
'RESTRICTIVE policy: Prevents any updates to issued surveys. Ensures immutability of issued documents.';

COMMENT ON POLICY "block_recommendations_on_issued_surveys_insert" ON survey_recommendations IS 
'RESTRICTIVE policy: Prevents adding recommendations to issued surveys.';

COMMENT ON POLICY "block_recommendations_on_issued_surveys_update" ON survey_recommendations IS 
'RESTRICTIVE policy: Prevents modifying recommendations on issued surveys (includes close/reopen).';

COMMENT ON POLICY "block_recommendations_on_issued_surveys_delete" ON survey_recommendations IS 
'RESTRICTIVE policy: Prevents deleting recommendations from issued surveys.';

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Test: Try to update issued survey (should fail for non-service-role)
-- UPDATE survey_reports SET form_data = '{}' WHERE id = 'xxx' AND status = 'issued';
-- Expected: Policy violation

-- Test: Try to close action on issued survey (should fail)
-- UPDATE survey_recommendations SET status = 'closed' WHERE survey_id = 'xxx' AND survey has status='issued';
-- Expected: Policy violation