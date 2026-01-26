/*
  # Add Organisation Branding Columns

  1. New Columns
    - `branding_logo_path` (text, nullable) - Path to organisation logo in storage
    - `branding_updated_at` (timestamptz, nullable) - Last branding update timestamp

  2. Purpose
    - Enable organisations to upload custom logos for PDF report covers
    - Track when branding was last updated
    - Support fallback to EziRisk logo if no custom logo exists

  3. Storage Convention
    - Bucket: org-assets
    - Path: org-logos/<org_id>/logo.{png|jpg|svg}
*/

-- Add branding columns to organisations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organisations' AND column_name = 'branding_logo_path'
  ) THEN
    ALTER TABLE organisations ADD COLUMN branding_logo_path TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organisations' AND column_name = 'branding_updated_at'
  ) THEN
    ALTER TABLE organisations ADD COLUMN branding_updated_at TIMESTAMPTZ NULL;
  END IF;
END $$;