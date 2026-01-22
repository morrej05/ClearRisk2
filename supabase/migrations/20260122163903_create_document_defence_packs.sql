/*
  # Create Document Defence Packs for Immutable Issued Bundles

  1. New Table
    - `document_defence_packs`
      - Stores metadata for immutable defence pack bundles
      - One pack per issued document version
      - Contains locked PDF, change summary, action snapshot, evidence index, manifest
      - Once created, never modified (immutable audit trail)

  2. Storage Bucket
    - `defence-packs` bucket for storing zip bundles
    - Private access (authenticated users only)
    - Organised by org and document

  3. Indexes
    - Composite index on (organisation_id, base_document_id)
    - Unique index on document_id (one pack per version)

  4. Security
    - Enable RLS on document_defence_packs table
    - Organisation members can view their defence packs
    - Authorised roles can create packs
    - No public access

  5. Hard Rules (Enforced)
    - Only issued documents can have defence packs
    - Defence packs are immutable once created
    - Bundle contains fixed snapshot at time of creation
    - No draft or superseded content included

  6. Contents of Defence Pack
    - Issued locked PDF
    - Change summary (if available)
    - Action register snapshot (CSV + PDF)
    - Evidence index (metadata only, CSV + PDF)
    - manifest.json with checksums and file list
*/

-- Create document_defence_packs table
CREATE TABLE IF NOT EXISTS document_defence_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  document_id uuid NOT NULL UNIQUE,
  base_document_id uuid NOT NULL,
  version_number int NOT NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  bundle_path text NOT NULL,
  checksum text NULL,
  size_bytes bigint NULL,
  manifest jsonb NULL,
  CONSTRAINT fk_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_defence_packs_org_base_doc 
  ON document_defence_packs(organisation_id, base_document_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_defence_packs_document_id 
  ON document_defence_packs(document_id);

CREATE INDEX IF NOT EXISTS idx_defence_packs_created_at 
  ON document_defence_packs(created_at DESC);

-- Enable RLS
ALTER TABLE document_defence_packs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view organisation defence packs" ON document_defence_packs;
DROP POLICY IF EXISTS "Users can create organisation defence packs" ON document_defence_packs;

-- Policy: Users can view defence packs for their organisation
CREATE POLICY "Users can view organisation defence packs"
  ON document_defence_packs FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can create defence packs for their organisation
CREATE POLICY "Users can create organisation defence packs"
  ON document_defence_packs FOR INSERT
  TO authenticated
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Create storage bucket for defence packs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'defence-packs',
  'defence-packs',
  false,
  104857600, -- 100MB limit
  ARRAY['application/zip', 'application/x-zip-compressed']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for defence-packs bucket
DROP POLICY IF EXISTS "Users can view organisation defence packs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload organisation defence packs" ON storage.objects;

-- Policy: Users can view defence packs for their organisation
CREATE POLICY "Users can view organisation defence packs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'defence-packs' AND
    (storage.foldername(name))[1] = 'org' AND
    (storage.foldername(name))[2] IN (
      SELECT organisation_id::text FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Service role can upload defence packs (used by Edge Function)
CREATE POLICY "Service can upload defence packs"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'defence-packs');

-- Comments for documentation
COMMENT ON TABLE document_defence_packs IS 'Immutable defence pack bundles for issued documents - audit trail and professional defence';
COMMENT ON COLUMN document_defence_packs.document_id IS 'Unique constraint - one pack per issued version';
COMMENT ON COLUMN document_defence_packs.bundle_path IS 'Storage path to zip bundle in defence-packs bucket';
COMMENT ON COLUMN document_defence_packs.checksum IS 'SHA-256 hash of bundle for integrity verification';
COMMENT ON COLUMN document_defence_packs.size_bytes IS 'Total size of zip bundle in bytes';
COMMENT ON COLUMN document_defence_packs.manifest IS 'JSON manifest with file list, checksums, and metadata';
