/*
  # Create Sector Weightings Table

  1. New Tables
    - `sector_weightings`
      - `id` (uuid, primary key)
      - `sector_name` (text, unique) - Name of the industry sector
      - `is_custom` (boolean) - Whether custom weightings are enabled for this sector
      - `construction` (integer 1-5) - Weight for Construction & Combustibility section
      - `management` (integer 1-5) - Weight for Management Systems section
      - `fire_protection` (integer 1-5) - Weight for Fire Protection section
      - `special_hazards` (integer 1-5) - Weight for Special Hazards section
      - `business_continuity` (integer 1-5) - Weight for Business Continuity section
      - `updated_at` (timestamptz) - Last update timestamp
      - `updated_by` (uuid) - User who last updated (references auth.users)
      - `created_at` (timestamptz) - Creation timestamp

  2. Security
    - Enable RLS on `sector_weightings` table
    - Add policy for authenticated users to read sector weightings
    - Add policy for admins to update sector weightings

  3. Data Seeding
    - Insert "Default" sector with is_custom=true, all weights = 3
    - Insert all industry sectors with is_custom=false, all weights = 3
*/

-- Create the sector_weightings table
CREATE TABLE IF NOT EXISTS sector_weightings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_name text UNIQUE NOT NULL,
  is_custom boolean DEFAULT false NOT NULL,
  construction integer CHECK (construction >= 1 AND construction <= 5) DEFAULT 3 NOT NULL,
  management integer CHECK (management >= 1 AND management <= 5) DEFAULT 3 NOT NULL,
  fire_protection integer CHECK (fire_protection >= 1 AND fire_protection <= 5) DEFAULT 3 NOT NULL,
  special_hazards integer CHECK (special_hazards >= 1 AND special_hazards <= 5) DEFAULT 3 NOT NULL,
  business_continuity integer CHECK (business_continuity >= 1 AND business_continuity <= 5) DEFAULT 3 NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE sector_weightings ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read sector weightings
CREATE POLICY "Authenticated users can read sector weightings"
  ON sector_weightings
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only admins can update sector weightings
CREATE POLICY "Admins can update sector weightings"
  ON sector_weightings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Seed Default sector (is_custom = true, acts as fallback)
INSERT INTO sector_weightings (sector_name, is_custom, construction, management, fire_protection, special_hazards, business_continuity)
VALUES ('Default', true, 3, 3, 3, 3, 3)
ON CONFLICT (sector_name) DO NOTHING;

-- Seed Industry Sectors (is_custom = false by default, all weights = 3)
INSERT INTO sector_weightings (sector_name, is_custom, construction, management, fire_protection, special_hazards, business_continuity)
VALUES 
  ('Food & Beverage', false, 3, 3, 3, 3, 3),
  ('Foundry / Metal', false, 3, 3, 3, 3, 3),
  ('Chemical / ATEX', false, 3, 3, 3, 3, 3),
  ('Logistics / Warehouse', false, 3, 3, 3, 3, 3),
  ('Office / Commercial', false, 3, 3, 3, 3, 3),
  ('General Industrial', false, 3, 3, 3, 3, 3),
  ('Other', false, 3, 3, 3, 3, 3)
ON CONFLICT (sector_name) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_sector_weightings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sector_weightings_updated_at
  BEFORE UPDATE ON sector_weightings
  FOR EACH ROW
  EXECUTE FUNCTION update_sector_weightings_updated_at();
