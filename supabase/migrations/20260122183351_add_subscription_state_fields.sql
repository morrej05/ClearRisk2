/*
  # Add Subscription State Fields to Organisations

  1. Changes
    - Add `stripe_customer_id` - Stripe customer ID for billing
    - Add `stripe_subscription_id` - Active Stripe subscription ID
    - Add `stripe_price_id` - Current price ID from Stripe
    - Add `stripe_current_period_end` - When current billing period ends
    - Add `subscription_status` - Stripe subscription status (active, trialing, past_due, canceled, etc.)
    - Add `cancel_at_period_end` - Whether subscription will cancel at period end
    - Add `plan_interval` - Billing interval (month or year)

  2. Purpose
    - Enable reliable Stripe subscription state tracking
    - Support upgrade/downgrade flows
    - Handle payment failures gracefully
    - Drive entitlements from subscription status
*/

ALTER TABLE public.organisations
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
ADD COLUMN IF NOT EXISTS stripe_price_id text,
ADD COLUMN IF NOT EXISTS stripe_current_period_end timestamptz,
ADD COLUMN IF NOT EXISTS subscription_status text,
ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS plan_interval text;

-- Add index for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_organisations_stripe_customer 
ON public.organisations(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_organisations_stripe_subscription 
ON public.organisations(stripe_subscription_id);