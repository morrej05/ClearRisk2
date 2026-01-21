/*
  # Approval vs Issue Status - Clean Separation

  1. Purpose
    - Separate internal approval from formal document issue
    - Add optional approval workflow for quality/peer/management sign-off
    - Prevent confusion between approval and issue status
    - Ensure clear governance and audit trail

  2. New Columns on `documents` table
    - `approval_status` (text) - 'not_required' | 'pending' | 'approved' | 'rejected'
    - `approved_by` (uuid) - User who approved the document
    - `approval_date` (date) - When document was approved
    - `approval_notes` (text) - Approval comments or rejection reason

  3. New Table: `organisation_settings`
    - Store per-organisation configuration
    - `approval_required` (boolean) - Whether approval workflow is enabled

  4. Business Rules
    - Approval is internal only (not client-visible)
    - Draft documents can be edited regardless of approval state
    - Cannot issue if approval_status = 'rejected'
    - Cannot issue if approval required and approval_status != 'approved'
    - Approval history persists across versions

  5. Default Behavior
    - Approval workflow disabled by default (approval_status = 'not_required')
    - Can be enabled per organisation
    - Existing documents backfilled as 'not_required'
*/

-- Add approval fields to documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'not_required',
ADD COLUMN IF NOT EXISTS approved_by uuid,
ADD COLUMN IF NOT EXISTS approval_date date,
ADD COLUMN IF NOT EXISTS approval_notes text;

-- Add check constraint for approval_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_approval_status_check'
    AND conrelid = 'documents'::regclass
  ) THEN
    ALTER TABLE documents
    ADD CONSTRAINT documents_approval_status_check
    CHECK (approval_status IN ('not_required', 'pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Add foreign key for approved_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_approved_by_fkey'
    AND conrelid = 'documents'::regclass
  ) THEN
    ALTER TABLE documents
    ADD CONSTRAINT documents_approved_by_fkey
    FOREIGN KEY (approved_by)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Create organisation_settings table
CREATE TABLE IF NOT EXISTS organisation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL UNIQUE,
  approval_required boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT organisation_settings_organisation_fkey
    FOREIGN KEY (organisation_id)
    REFERENCES organisations(id)
    ON DELETE CASCADE
);

-- Enable RLS on organisation_settings
ALTER TABLE organisation_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organisation_settings

-- Users can view their own organisation's settings
CREATE POLICY "Users can view own organisation settings"
  ON organisation_settings
  FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Only org admins and platform admins can update settings
CREATE POLICY "Org admins can update organisation settings"
  ON organisation_settings
  FOR UPDATE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('org_admin', 'platform_admin')
    )
  )
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('org_admin', 'platform_admin')
    )
  );

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_documents_approval_status 
ON documents (approval_status);

CREATE INDEX IF NOT EXISTS idx_documents_approved_by 
ON documents (approved_by);

CREATE INDEX IF NOT EXISTS idx_organisation_settings_org_id
ON organisation_settings (organisation_id);

-- Add helpful comments
COMMENT ON COLUMN documents.approval_status IS 'Internal approval state: not_required (default), pending, approved, rejected. Separate from issue_status.';
COMMENT ON COLUMN documents.approved_by IS 'User who approved the document internally. Not the same as issued_by.';
COMMENT ON COLUMN documents.approval_date IS 'Date of internal approval. Not the same as issue_date.';
COMMENT ON COLUMN documents.approval_notes IS 'Approval comments or rejection reason. Internal only.';
COMMENT ON TABLE organisation_settings IS 'Per-organisation configuration including approval workflow settings.';

-- Backfill existing documents with 'not_required' approval status
UPDATE documents
SET approval_status = 'not_required'
WHERE approval_status IS NULL;

-- Make approval_status NOT NULL after backfill
ALTER TABLE documents
ALTER COLUMN approval_status SET NOT NULL;

-- Create default organisation_settings for existing organisations
INSERT INTO organisation_settings (organisation_id, approval_required)
SELECT id, false
FROM organisations
ON CONFLICT (organisation_id) DO NOTHING;
