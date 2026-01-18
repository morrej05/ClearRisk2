/*
  # EziRisk Finalization - Complete Schema Update

  1. Plan System Updates
    - Update plan types: free, core, professional, enterprise
    - Add organization-level settings
    - Add editor limits per plan
    - Add discipline_type: engineering, assessment, both
    - Add bolt_ons JSONB field for feature flags

  2. Stripe Integration
    - Add stripe_customer_id
    - Add stripe_subscription_id
    - Add subscription_status: active, past_due, canceled, inactive
    - Add billing_cycle: monthly, annual

  3. Role System Updates
    - Update roles: admin, surveyor, viewer
    - Migrate existing roles to new system

  4. Editor Tracking
    - Add active_editors count
    - Add max_editors limit based on plan

  5. Notes
    - All existing users migrated to 'free' plan
    - All data preserved
    - Stripe webhooks will update subscription fields
*/

-- First, drop existing constraints
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_plan_check;
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Update all existing plan values to new system
UPDATE user_profiles SET plan = 'free' WHERE plan = 'trial';
UPDATE user_profiles SET plan = 'free' WHERE plan = 'pro';
UPDATE user_profiles SET plan = 'free' WHERE plan = 'pro_fra';
UPDATE user_profiles SET plan = 'free' WHERE plan NOT IN ('free', 'core', 'professional', 'enterprise');

-- Update all existing role values to new system
UPDATE user_profiles SET role = 'admin' WHERE role = 'super_admin';
UPDATE user_profiles SET role = 'admin' WHERE role = 'org_admin';

-- Now add the new constraints
ALTER TABLE user_profiles 
  ADD CONSTRAINT user_profiles_plan_check 
  CHECK (plan IN ('free', 'core', 'professional', 'enterprise'));

ALTER TABLE user_profiles 
  ADD CONSTRAINT user_profiles_role_check 
  CHECK (role IN ('admin', 'surveyor', 'viewer'));

-- Add discipline_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'discipline_type'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN discipline_type text NOT NULL DEFAULT 'engineering';
  END IF;
END $$;

-- Add constraint for discipline_type after column exists
DO $$
BEGIN
  ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_discipline_type_check;
  ALTER TABLE user_profiles 
    ADD CONSTRAINT user_profiles_discipline_type_check
    CHECK (discipline_type IN ('engineering', 'assessment', 'both'));
END $$;

-- Add bolt_ons JSONB field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'bolt_ons'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN bolt_ons jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add Stripe fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN stripe_customer_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN stripe_subscription_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN subscription_status text DEFAULT 'inactive';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'billing_cycle'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN billing_cycle text;
  END IF;
END $$;

-- Add constraints for subscription status and billing cycle
DO $$
BEGIN
  ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_subscription_status_check;
  ALTER TABLE user_profiles 
    ADD CONSTRAINT user_profiles_subscription_status_check
    CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'inactive'));

  ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_billing_cycle_check;
  ALTER TABLE user_profiles 
    ADD CONSTRAINT user_profiles_billing_cycle_check
    CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly', 'annual'));
END $$;

-- Add editor limit tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'max_editors'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN max_editors integer DEFAULT 999;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'active_editors'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN active_editors integer DEFAULT 1;
  END IF;
END $$;

-- Set max_editors based on plan
UPDATE user_profiles SET max_editors = 999 WHERE plan = 'free';
UPDATE user_profiles SET max_editors = 1 WHERE plan = 'core';
UPDATE user_profiles SET max_editors = 3 WHERE plan = 'professional';
UPDATE user_profiles SET max_editors = 10 WHERE plan = 'enterprise';

-- Enable all bolt-ons for enterprise by default
UPDATE user_profiles 
SET bolt_ons = '["fra_form", "bcm_form", "specialist_modules"]'::jsonb 
WHERE plan = 'enterprise';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id ON user_profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_subscription_id ON user_profiles(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_discipline_type ON user_profiles(discipline_type);

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.plan IS 'Subscription plan: free, core (1 editor), professional (3 editors), enterprise (10 editors)';
COMMENT ON COLUMN user_profiles.discipline_type IS 'Discipline: engineering, assessment, or both (enterprise only)';
COMMENT ON COLUMN user_profiles.bolt_ons IS 'Feature flag bolt-ons (e.g., fra_form, bcm_form)';
COMMENT ON COLUMN user_profiles.max_editors IS 'Maximum number of editors allowed for this organization';
COMMENT ON COLUMN user_profiles.active_editors IS 'Current number of active editors';