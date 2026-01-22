/*
  # Create Stripe Webhook Events Table

  1. New Tables
    - `stripe_webhook_events`
      - `event_id` (text, primary key) - Stripe event ID for idempotency
      - `event_type` (text) - Type of webhook event
      - `received_at` (timestamptz) - When event was received
      - `processed` (boolean) - Whether event was successfully processed

  2. Purpose
    - Prevent duplicate webhook processing
    - Enable idempotent webhook handling
    - Track webhook processing history

  3. Security
    - No RLS needed - internal system table
*/

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  received_at timestamptz DEFAULT now(),
  processed boolean DEFAULT false
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received_at 
ON public.stripe_webhook_events(received_at);