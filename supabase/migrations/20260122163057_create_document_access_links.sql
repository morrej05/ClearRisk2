/*
  # Create Document Access Links for External Sharing

  1. New Table
    - `document_access_links`
      - Stores secure, time-limited tokens for external document access
      - Links to base_document_id (resolves to latest issued version)
      - Supports expiry, revocation, and audit tracking
      - Optional labels for identifying recipients

  2. Indexes
    - Composite index on (organisation_id, base_document_id)
    - Unique index on token for fast lookups
    - Index on expires_at for cleanup queries

  3. Security
    - Enable RLS on document_access_links table
    - Organisation members can manage their own links
    - No public SELECT (access handled via Edge Function with service role)
    - Edge Function validates token, expiry, and revocation

  4. Audit Fields
    - last_accessed_at: Track when link was last used
    - access_count: Count number of accesses
    - revoked_at: Soft revocation timestamp

  5. Hard Rules (Enforced)
    - Only latest issued document returned for base_document_id
    - Never expose drafts or superseded versions
    - Token must be long, random, and unpredictable
*/

-- Create document_access_links table
CREATE TABLE IF NOT EXISTS document_access_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  base_document_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  last_accessed_at timestamptz NULL,
  access_count int NOT NULL DEFAULT 0,
  label text NULL,
  allowed_actions jsonb NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_document_access_links_org_base_doc 
  ON document_access_links(organisation_id, base_document_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_access_links_token 
  ON document_access_links(token);

CREATE INDEX IF NOT EXISTS idx_document_access_links_expires_at 
  ON document_access_links(expires_at) 
  WHERE revoked_at IS NULL;

-- Enable RLS
ALTER TABLE document_access_links ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view organisation access links" ON document_access_links;
DROP POLICY IF EXISTS "Users can create organisation access links" ON document_access_links;
DROP POLICY IF EXISTS "Users can update organisation access links" ON document_access_links;
DROP POLICY IF EXISTS "Users can delete organisation access links" ON document_access_links;

-- Policy: Users can view access links for their organisation
CREATE POLICY "Users can view organisation access links"
  ON document_access_links FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can create access links for their organisation
CREATE POLICY "Users can create organisation access links"
  ON document_access_links FOR INSERT
  TO authenticated
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can update access links for their organisation
CREATE POLICY "Users can update organisation access links"
  ON document_access_links FOR UPDATE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete access links for their organisation
CREATE POLICY "Users can delete organisation access links"
  ON document_access_links FOR DELETE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Helper function to generate secure random tokens
CREATE OR REPLACE FUNCTION generate_access_token()
RETURNS text AS $$
BEGIN
  -- Generate a 32-character random token using gen_random_uuid() twice
  RETURN encode(gen_random_bytes(32), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Grant execute on helper function
GRANT EXECUTE ON FUNCTION generate_access_token() TO authenticated;

-- Comments for documentation
COMMENT ON TABLE document_access_links IS 'Secure, time-limited tokens for external document access without authentication';
COMMENT ON COLUMN document_access_links.token IS 'Unique random token for URL - must be long and unpredictable';
COMMENT ON COLUMN document_access_links.base_document_id IS 'Links to document family - always resolves to latest issued version';
COMMENT ON COLUMN document_access_links.expires_at IS 'Link becomes invalid after this timestamp';
COMMENT ON COLUMN document_access_links.revoked_at IS 'Soft revocation - link disabled before expiry';
COMMENT ON COLUMN document_access_links.last_accessed_at IS 'Audit trail of last access time';
COMMENT ON COLUMN document_access_links.access_count IS 'Audit trail of total access count';
COMMENT ON COLUMN document_access_links.label IS 'Optional label for identifying recipient (e.g., "Broker", "Client")';
COMMENT ON COLUMN document_access_links.allowed_actions IS 'Future extensibility for granular permissions';
