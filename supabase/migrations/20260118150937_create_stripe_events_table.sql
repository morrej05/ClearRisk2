/*
  # Create Stripe Events Table

  1. New Tables
    - `stripe_events_processed`
      - `id` (uuid, primary key)
      - `stripe_event_id` (text, unique) - Stripe event ID
      - `event_type` (text) - Type of Stripe event
      - `processed_at` (timestamptz) - When event was processed
      - `organisation_id` (uuid) - Organisation this event applies to
      - `metadata` (jsonb) - Additional event data

  2. Purpose
    - Track processed Stripe webhook events
    - Ensure idempotent webhook handling
    - Prevent duplicate processing

  3. Security
    - No RLS needed (internal service table)
    - Only webhook handler accesses this table
*/

-- Create stripe_events_processed table
CREATE TABLE IF NOT EXISTS stripe_events_processed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now(),
  organisation_id UUID REFERENCES organisations(id),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for fast duplicate checking
CREATE INDEX IF NOT EXISTS idx_stripe_events_stripe_event_id ON stripe_events_processed(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_organisation_id ON stripe_events_processed(organisation_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_at ON stripe_events_processed(processed_at);

-- Add helpful comment
COMMENT ON TABLE stripe_events_processed IS 'Tracks processed Stripe webhook events to ensure idempotent handling';
COMMENT ON COLUMN stripe_events_processed.stripe_event_id IS 'Unique Stripe event ID from webhook payload';
