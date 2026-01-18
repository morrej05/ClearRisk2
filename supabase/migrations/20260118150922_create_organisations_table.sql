/*
  # Create Organisations Table

  1. New Tables
    - `organisations`
      - `id` (uuid, primary key)
      - `name` (text) - Organisation name
      - `plan_type` (text) - free, core, professional, enterprise
      - `discipline_type` (text) - engineering, assessment, both
      - `enabled_addons` (jsonb) - Array of enabled addon keys
      - `max_editors` (integer) - Maximum number of editors allowed
      - `subscription_status` (text) - active, past_due, canceled, inactive
      - `stripe_customer_id` (text, unique) - Stripe customer ID
      - `stripe_subscription_id` (text, unique) - Stripe subscription ID
      - `billing_cycle` (text) - monthly, annual
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to user_profiles
    - Add `organisation_id` (uuid, foreign key to organisations)
    - Add `can_edit` (boolean) - Whether user can edit surveys
    - Keep existing role, is_platform_admin fields

  3. Security
    - Enable RLS on organisations table
    - Users can read their own organisation
    - Admins can update their organisation
    - Platform admins can read all organisations

  4. Data Migration
    - Create default organisation for existing users
    - Migrate subscription data from user_profiles to organisations
*/

-- Create organisations table
CREATE TABLE IF NOT EXISTS organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Organisation',
  plan_type TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'core', 'professional', 'enterprise')),
  discipline_type TEXT NOT NULL DEFAULT 'engineering' CHECK (discipline_type IN ('engineering', 'assessment', 'both')),
  enabled_addons JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_editors INTEGER NOT NULL DEFAULT 0,
  subscription_status TEXT NOT NULL DEFAULT 'inactive' CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'inactive')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'annual')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

-- Add organisation_id to user_profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'organisation_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN organisation_id UUID REFERENCES organisations(id);
  END IF;
END $$;

-- Add can_edit to user_profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'can_edit'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN can_edit BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Migrate existing users to have their own organisation
DO $$
DECLARE
  user_record RECORD;
  new_org_id UUID;
BEGIN
  FOR user_record IN SELECT * FROM user_profiles WHERE organisation_id IS NULL LOOP
    -- Create organisation for this user
    INSERT INTO organisations (
      name,
      plan_type,
      discipline_type,
      enabled_addons,
      max_editors,
      subscription_status,
      stripe_customer_id,
      stripe_subscription_id,
      billing_cycle
    ) VALUES (
      COALESCE(user_record.name, 'My Organisation'),
      COALESCE(user_record.plan, 'free'),
      COALESCE(user_record.discipline_type, 'engineering'),
      COALESCE(user_record.bolt_ons, '[]'::jsonb),
      COALESCE(user_record.max_editors, 0),
      COALESCE(user_record.subscription_status, 'inactive'),
      user_record.stripe_customer_id,
      user_record.stripe_subscription_id,
      user_record.billing_cycle
    ) RETURNING id INTO new_org_id;

    -- Link user to organisation
    UPDATE user_profiles
    SET organisation_id = new_org_id
    WHERE id = user_record.id;
  END LOOP;
END $$;

-- RLS Policies for organisations

-- Users can read their own organisation
CREATE POLICY "Users can read own organisation"
ON organisations
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
);

-- Organisation admins can update their organisation
CREATE POLICY "Organisation admins can update"
ON organisations
FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
)
WITH CHECK (
  id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Platform admins can read all organisations
CREATE POLICY "Platform admins can read all organisations"
ON organisations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
    AND user_profiles.is_platform_admin = true
  )
);

-- Platform admins can update all organisations
CREATE POLICY "Platform admins can update all organisations"
ON organisations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
    AND user_profiles.is_platform_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
    AND user_profiles.is_platform_admin = true
  )
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_organisation_id ON user_profiles(organisation_id);
CREATE INDEX IF NOT EXISTS idx_organisations_stripe_customer_id ON organisations(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_organisations_stripe_subscription_id ON organisations(stripe_subscription_id);

-- Add helpful comments
COMMENT ON TABLE organisations IS 'Organisations with subscription and entitlement data';
COMMENT ON COLUMN organisations.plan_type IS 'Subscription plan: free (0 editors), core (1 editor), professional (3 editors), enterprise (10+ editors)';
COMMENT ON COLUMN organisations.discipline_type IS 'Discipline: engineering, assessment, or both (enterprise only)';
COMMENT ON COLUMN organisations.enabled_addons IS 'Array of enabled addon keys (e.g., ["fra_form", "bcm_form"])';
COMMENT ON COLUMN organisations.subscription_status IS 'Stripe subscription status: active, past_due, canceled, inactive';
COMMENT ON COLUMN user_profiles.can_edit IS 'Whether this user can edit surveys (based on role and plan limits)';
