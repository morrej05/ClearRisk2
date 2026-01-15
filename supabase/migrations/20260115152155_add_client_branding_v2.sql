/*
  # Add Client Branding System

  1. New Tables
    - `client_branding`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users) - Organization identifier
      - `company_name` (text) - Client company name
      - `logo_url` (text, nullable) - URL to uploaded logo in storage
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `client_branding` table
    - Admin users can create and update branding
    - All authenticated users can read their organization's branding
    - Only one branding record per user organization

  3. Notes
    - This stores client branding information including logo
    - Logo files will be stored in a separate storage bucket
    - Each user account represents an organization and has one branding config
*/

-- Create client_branding table
CREATE TABLE IF NOT EXISTS client_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_name text NOT NULL DEFAULT 'ClearRisk',
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE client_branding ENABLE ROW LEVEL SECURITY;

-- Policy: Admin users can read their organization's branding
CREATE POLICY "Users can read own branding"
  ON client_branding
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Admin users can insert branding for their organization
CREATE POLICY "Admin users can insert branding"
  ON client_branding
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Policy: Admin users can update their organization's branding
CREATE POLICY "Admin users can update branding"
  ON client_branding
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Create updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_client_branding_updated_at'
  ) THEN
    CREATE TRIGGER update_client_branding_updated_at
      BEFORE UPDATE ON client_branding
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_client_branding_user_id ON client_branding(user_id);