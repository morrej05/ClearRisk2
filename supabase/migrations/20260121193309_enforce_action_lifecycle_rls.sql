/*
  # Enforce Action Lifecycle RLS Policies

  1. Purpose
    - Prevent modification/deletion of actions when parent document status = 'issued'
    - Prevent modification/deletion of attachments when parent document status = 'issued'
    - Allow full CRUD on actions and attachments while document status = 'draft'

  2. Changes
    - DROP and recreate UPDATE/DELETE policies for `actions` table with document status check
    - DROP and recreate UPDATE/DELETE policies for `attachments` table with document status check
    - Users can only modify/delete actions and attachments if parent document is 'draft'

  3. Security Impact
    - Issued documents become immutable (actions and evidence cannot be changed/deleted)
    - Draft documents remain fully editable
    - Organisation-level isolation maintained

  4. Important Notes
    - Document DELETE policy already checks status = 'draft' (from previous migration)
    - This migration extends that protection to child records (actions, attachments)
*/

-- ============================================================================
-- ACTIONS TABLE: Update policies to enforce lifecycle
-- ============================================================================

-- Drop existing UPDATE policy for actions
DROP POLICY IF EXISTS "Users can update org actions" ON actions;

-- Recreate UPDATE policy with document status check
CREATE POLICY "Users can update org actions"
ON actions FOR UPDATE
TO authenticated
USING (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
  AND (
    -- Allow update only if parent document is draft
    document_id IS NULL OR
    document_id IN (
      SELECT id FROM documents
      WHERE status = 'draft'
    )
  )
)
WITH CHECK (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
  AND (
    -- Allow update only if parent document is draft
    document_id IS NULL OR
    document_id IN (
      SELECT id FROM documents
      WHERE status = 'draft'
    )
  )
);

-- Drop existing DELETE policy for actions
DROP POLICY IF EXISTS "Users can delete org actions" ON actions;

-- Recreate DELETE policy with document status check
CREATE POLICY "Users can delete org actions"
ON actions FOR DELETE
TO authenticated
USING (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
  AND (
    -- Allow delete only if parent document is draft
    document_id IS NULL OR
    document_id IN (
      SELECT id FROM documents
      WHERE status = 'draft'
    )
  )
);

-- ============================================================================
-- ATTACHMENTS TABLE: Update policies to enforce lifecycle
-- ============================================================================

-- Drop existing UPDATE policy for attachments
DROP POLICY IF EXISTS "Users can update attachments in their organisation" ON attachments;

-- Recreate UPDATE policy with document status check
CREATE POLICY "Users can update attachments in their organisation"
ON attachments FOR UPDATE
TO authenticated
USING (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
  AND (
    -- Allow update only if parent document is draft
    document_id IN (
      SELECT id FROM documents
      WHERE status = 'draft'
    )
  )
)
WITH CHECK (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
  AND (
    -- Allow update only if parent document is draft
    document_id IN (
      SELECT id FROM documents
      WHERE status = 'draft'
    )
  )
);

-- Drop existing DELETE policy for attachments (if exists)
DROP POLICY IF EXISTS "Users can delete attachments in their organisation" ON attachments;

-- Create DELETE policy with document status check
CREATE POLICY "Users can delete attachments in their organisation"
ON attachments FOR DELETE
TO authenticated
USING (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
  AND (
    -- Allow delete only if parent document is draft
    document_id IN (
      SELECT id FROM documents
      WHERE status = 'draft'
    )
  )
);

-- ============================================================================
-- MODULE_INSTANCES TABLE: Update policies for consistency
-- ============================================================================

-- Drop existing UPDATE policy for module_instances
DROP POLICY IF EXISTS "Users can update org modules" ON module_instances;

-- Recreate UPDATE policy with document status check
CREATE POLICY "Users can update org modules"
ON module_instances FOR UPDATE
TO authenticated
USING (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
  AND (
    -- Allow update only if parent document is draft
    document_id IS NULL OR
    document_id IN (
      SELECT id FROM documents
      WHERE status = 'draft'
    )
  )
)
WITH CHECK (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
  AND (
    -- Allow update only if parent document is draft
    document_id IS NULL OR
    document_id IN (
      SELECT id FROM documents
      WHERE status = 'draft'
    )
  )
);

-- Drop existing DELETE policy for module_instances
DROP POLICY IF EXISTS "Users can delete org modules" ON module_instances;

-- Recreate DELETE policy with document status check
CREATE POLICY "Users can delete org modules"
ON module_instances FOR DELETE
TO authenticated
USING (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
  AND (
    -- Allow delete only if parent document is draft
    document_id IS NULL OR
    document_id IN (
      SELECT id FROM documents
      WHERE status = 'draft'
    )
  )
);
