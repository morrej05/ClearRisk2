/*
  # Add Subscription Plans

  1. Schema Changes
    - Add `plan` column to `user_profiles` table
      - Type: text with CHECK constraint
      - Values: 'trial', 'pro', 'pro_fra'
      - Default: 'trial'
      - Not null

  2. Data Migration
    - Set all existing users to 'trial' plan

  3. Security
    - Super admins can update any user's plan
    - Org admins can view their organization's plan
    - Users can view their own plan

  4. Notes
    - This implements plan-based feature gating
    - No billing integration yet (coming later with Stripe)
    - Plans control access to:
      * trial: Basic survey editing + report export
      * pro: Includes Smart Recommendations
      * pro_fra: Includes Smart Recommendations + FRA module
*/

-- Add plan column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'plan'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN plan text NOT NULL DEFAULT 'trial'
    CHECK (plan IN ('trial', 'pro', 'pro_fra'));
  END IF;
END $$;

-- Set all existing users to trial plan
UPDATE user_profiles 
SET plan = 'trial' 
WHERE plan IS NULL OR plan = '';

-- Create index for faster plan lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_plan ON user_profiles(plan);

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.plan IS 'Subscription plan: trial (free), pro (with Smart Recommendations), pro_fra (with FRA module)';