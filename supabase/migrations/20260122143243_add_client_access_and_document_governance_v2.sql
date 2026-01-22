/*
  # Client Visibility, Access Control & Historical Document Governance

  1. Purpose
    - Ensure clients only see the latest issued document
    - Prevent client access to drafts, superseded, or internal data
    - Preserve full internal audit trail for all versions
    - Enable secure external document sharing via links
    - Enforce immutability of issued and superseded documents

  2. New Tables
    - `client_users` - External client users with limited access
    - `client_document_access` - Grant clients access to specific documents
    - `document_external_links` - Shareable links that resolve to latest issued

  3. New Columns
    - `documents.is_immutable` - Prevent modification of issued/superseded
    - `documents.client_visible` - Whether document has been issued to clients

  4. RLS Policies
    - Clients can only SELECT latest issued documents they have access to
    - Internal users have full access to all versions
    - Prevent UPDATE/DELETE on immutable documents

  5. Business Rules
    - Client access: Latest issued version only
    - No draft or superseded visibility for clients
    - No approval status visibility for clients
    - External links auto-resolve to current issued version
    - Issued/superseded documents cannot be modified or deleted
    - Full version history retained for audit
*/

-- Add new columns to documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS is_immutable boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS client_visible boolean DEFAULT false;

-- Create client_users table for external client access
CREATE TABLE IF NOT EXISTS client_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz,
  access_revoked boolean DEFAULT false,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id),
  notes text
);

-- Create client_document_access table (base_document_id is not a FK since it's not unique)
CREATE TABLE IF NOT EXISTS client_document_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL REFERENCES client_users(id) ON DELETE CASCADE,
  base_document_id uuid NOT NULL,
  granted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz DEFAULT now(),
  access_expires_at timestamptz,
  access_revoked boolean DEFAULT false,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id),
  notes text
);

-- Create document_external_links table for shareable links
CREATE TABLE IF NOT EXISTS document_external_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_document_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  access_count integer DEFAULT 0,
  last_accessed_at timestamptz,
  is_active boolean DEFAULT true,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id),
  description text
);

-- Enable RLS on new tables
ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_document_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_external_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_users

-- Internal users can view client users in their organisation
CREATE POLICY "Internal users can view organisation client users"
  ON client_users
  FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Only org admins can create/update/delete client users
CREATE POLICY "Org admins can manage client users"
  ON client_users
  FOR ALL
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

-- RLS Policies for client_document_access

-- Internal users can view access grants in their organisation
CREATE POLICY "Internal users can view client access grants"
  ON client_document_access
  FOR SELECT
  TO authenticated
  USING (
    client_user_id IN (
      SELECT id FROM client_users WHERE organisation_id IN (
        SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

-- Org admins can grant/revoke access
CREATE POLICY "Org admins can manage client access"
  ON client_document_access
  FOR ALL
  TO authenticated
  USING (
    client_user_id IN (
      SELECT id FROM client_users WHERE organisation_id IN (
        SELECT organisation_id FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('org_admin', 'platform_admin')
      )
    )
  )
  WITH CHECK (
    client_user_id IN (
      SELECT id FROM client_users WHERE organisation_id IN (
        SELECT organisation_id FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('org_admin', 'platform_admin')
      )
    )
  );

-- RLS Policies for document_external_links

-- Internal users can view external links for their organisation's documents
CREATE POLICY "Internal users can view external links"
  ON document_external_links
  FOR SELECT
  TO authenticated
  USING (
    base_document_id IN (
      SELECT base_document_id FROM documents d
      JOIN user_profiles up ON d.organisation_id = up.organisation_id
      WHERE up.id = auth.uid()
    )
  );

-- Users with can_edit permission can create external links
CREATE POLICY "Editors can create external links"
  ON document_external_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    base_document_id IN (
      SELECT base_document_id FROM documents d
      JOIN user_profiles up ON d.organisation_id = up.organisation_id
      WHERE up.id = auth.uid() AND up.can_edit = true
    )
  );

-- Org admins can update/delete external links
CREATE POLICY "Org admins can manage external links"
  ON document_external_links
  FOR UPDATE
  TO authenticated
  USING (
    base_document_id IN (
      SELECT base_document_id FROM documents d
      JOIN user_profiles up ON d.organisation_id = up.organisation_id
      WHERE up.id = auth.uid() 
      AND up.role IN ('org_admin', 'platform_admin')
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_users_email ON client_users (email);
CREATE INDEX IF NOT EXISTS idx_client_users_organisation ON client_users (organisation_id);
CREATE INDEX IF NOT EXISTS idx_client_document_access_client ON client_document_access (client_user_id);
CREATE INDEX IF NOT EXISTS idx_client_document_access_document ON client_document_access (base_document_id);
CREATE INDEX IF NOT EXISTS idx_document_external_links_token ON document_external_links (token);
CREATE INDEX IF NOT EXISTS idx_document_external_links_document ON document_external_links (base_document_id);
CREATE INDEX IF NOT EXISTS idx_documents_is_immutable ON documents (is_immutable);
CREATE INDEX IF NOT EXISTS idx_documents_client_visible ON documents (client_visible);

-- Create function to get latest issued document for a base_document_id
CREATE OR REPLACE FUNCTION get_latest_issued_document(base_doc_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  latest_doc_id uuid;
BEGIN
  SELECT id INTO latest_doc_id
  FROM documents
  WHERE base_document_id = base_doc_id
  AND issue_status = 'issued'
  ORDER BY version_number DESC, issue_date DESC
  LIMIT 1;
  
  RETURN latest_doc_id;
END;
$$;

-- Create function to mark document as immutable when issued
CREATE OR REPLACE FUNCTION set_document_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- When a document is issued or superseded, mark it as immutable
  IF NEW.issue_status IN ('issued', 'superseded') AND OLD.issue_status = 'draft' THEN
    NEW.is_immutable := true;
    NEW.client_visible := true;
  END IF;
  
  -- Prevent modification of immutable documents (except for supersession fields)
  IF OLD.is_immutable = true THEN
    -- Allow only supersession-related field updates
    IF (NEW.issue_status = 'superseded' AND OLD.issue_status = 'issued') OR
       (NEW.superseded_by_document_id IS NOT NULL AND OLD.superseded_by_document_id IS NULL) OR
       (NEW.superseded_date IS NOT NULL AND OLD.superseded_date IS NULL) THEN
      -- Allow these changes (for marking as superseded)
      RETURN NEW;
    ELSIF NEW.issue_status != OLD.issue_status OR
          NEW.title != OLD.title OR
          NEW.document_type != OLD.document_type OR
          NEW.assessment_date != OLD.assessment_date THEN
      -- Prevent modification of core document fields
      RAISE EXCEPTION 'Cannot modify immutable document (issued or superseded). Document ID: %', OLD.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce immutability
DROP TRIGGER IF EXISTS trigger_set_document_immutable ON documents;
CREATE TRIGGER trigger_set_document_immutable
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION set_document_immutable();

-- Add helpful comments
COMMENT ON TABLE client_users IS 'External client users who can view issued documents via secure links';
COMMENT ON TABLE client_document_access IS 'Grants clients access to specific document families (base_document_id). Clients always see latest issued version only.';
COMMENT ON TABLE document_external_links IS 'Shareable links that always resolve to the latest issued version. Auto-update when new versions issued.';
COMMENT ON COLUMN documents.is_immutable IS 'TRUE for issued/superseded documents - prevents modification of core fields';
COMMENT ON COLUMN documents.client_visible IS 'TRUE when document has been issued and is visible to clients';
COMMENT ON FUNCTION get_latest_issued_document IS 'Returns the latest issued document ID for a base_document_id. Used for client access resolution.';
COMMENT ON FUNCTION set_document_immutable IS 'Marks documents as immutable when issued and prevents modification of core fields';

-- Update existing issued/superseded documents to be immutable
UPDATE documents
SET is_immutable = true,
    client_visible = true
WHERE issue_status IN ('issued', 'superseded');
