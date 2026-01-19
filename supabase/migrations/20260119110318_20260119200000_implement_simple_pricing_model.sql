/*
  # Implement Simple Pricing Model (Single Source of Truth)

  1. New Tables
    - `plan_definitions` - Defines available plans with their limits
      - `id` (solo/team/consultancy)
      - `name` (display name)
      - `max_users` (user cap)
      - `max_storage_mb` (storage cap in MB)

  2. Changes to `organisations`
    - Add `plan_id` (references plan_definitions)
    - Add `storage_used_mb` (tracks storage usage)
    - Migrate from old `plan_type` to new `plan_id`
    - Keep old fields for backwards compatibility during transition

  3. Data Migration
    - Convert existing plan_type values to new plan_id system:
      - free → solo
      - core → solo
      - professional → team
      - enterprise → consultancy

  4. Security
    - Enable RLS on plan_definitions
    - Add policies for reading plan data
*/

-- Create plan_definitions table
CREATE TABLE IF NOT EXISTS plan_definitions (
  id TEXT PRIMARY KEY CHECK (id IN ('solo', 'team', 'consultancy')),
  name TEXT NOT NULL,
  max_users INTEGER NOT NULL,
  max_storage_mb INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed plan definitions
INSERT INTO plan_definitions (id, name, max_users, max_storage_mb) VALUES
  ('solo', 'Solo', 1, 2048),
  ('team', 'Team', 5, 10240),
  ('consultancy', 'Consultancy', 999, 51200)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  max_users = EXCLUDED.max_users,
  max_storage_mb = EXCLUDED.max_storage_mb;

-- Add new columns to organisations
DO $$
BEGIN
  -- Add plan_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organisations' AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE organisations ADD COLUMN plan_id TEXT REFERENCES plan_definitions(id) DEFAULT 'solo';
  END IF;

  -- Add storage_used_mb column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organisations' AND column_name = 'storage_used_mb'
  ) THEN
    ALTER TABLE organisations ADD COLUMN storage_used_mb INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Migrate existing organisations from old plan_type to new plan_id
UPDATE organisations
SET plan_id = CASE
  WHEN plan_type = 'free' THEN 'solo'
  WHEN plan_type = 'core' THEN 'solo'
  WHEN plan_type = 'professional' THEN 'team'
  WHEN plan_type = 'enterprise' THEN 'consultancy'
  ELSE 'solo'
END
WHERE plan_id IS NULL OR plan_id = 'solo';

-- Ensure all organisations have a valid plan_id
UPDATE organisations
SET plan_id = 'solo'
WHERE plan_id IS NULL;

-- Enable RLS on plan_definitions
ALTER TABLE plan_definitions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read plan definitions
CREATE POLICY "Anyone can read plan definitions"
  ON plan_definitions
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow platform admins to manage plan definitions
CREATE POLICY "Platform admins can manage plan definitions"
  ON plan_definitions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_platform_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_platform_admin = true
    )
  );