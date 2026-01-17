/*
  # Add Trigger Fields to Survey Recommendations

  ## Changes
  
  1. Adds trigger tracking fields:
     - trigger_key (text, nullable): Unique identifier for auto-triggered recommendations
       Format: "{survey_id}:{section_key}:{field_key}:{rating_value}"
     - trigger_context (jsonb, nullable): Stores context about what triggered this recommendation
       Contains: {section_key, field_key, rating_value, building_id (optional)}
  
  2. Adds unique constraint:
     - Ensures each trigger_key is unique per survey
     - Prevents duplicate triggered recommendations
  
  ## Purpose
  
  Preserves legacy auto-recommendation behavior (Poor/Inadequate ratings generate recommendations)
  but routes them through the Smart Recommendations table for unified management.
*/

-- Add trigger_key column
ALTER TABLE survey_recommendations
  ADD COLUMN IF NOT EXISTS trigger_key text NULL;

-- Add trigger_context column
ALTER TABLE survey_recommendations
  ADD COLUMN IF NOT EXISTS trigger_context jsonb NULL;

-- Add unique constraint on (survey_id, trigger_key) where trigger_key is not null
-- This prevents duplicate triggered recommendations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'survey_recommendations_unique_trigger'
  ) THEN
    CREATE UNIQUE INDEX survey_recommendations_unique_trigger
      ON survey_recommendations(survey_id, trigger_key)
      WHERE trigger_key IS NOT NULL;
  END IF;
END $$;

-- Add index for faster lookups by trigger_key
CREATE INDEX IF NOT EXISTS idx_survey_recommendations_trigger_key
  ON survey_recommendations(trigger_key)
  WHERE trigger_key IS NOT NULL;

-- Add comment explaining the trigger fields
COMMENT ON COLUMN survey_recommendations.trigger_key IS 'Unique identifier for auto-triggered recommendations. Format: {survey_id}:{section_key}:{field_key}:{rating_value}';
COMMENT ON COLUMN survey_recommendations.trigger_context IS 'JSON context about what triggered this recommendation: {section_key, field_key, rating_value, building_id}';
