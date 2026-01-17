/*
  # Update Recommendation Schema to Structured Fields

  ## Changes to recommendation_templates table
  1. Add structured fields:
    - `hazard` (text, not null) - Identification/hazard type (e.g., "Hot Work", "DSEAR")
    - `description` (text, not null) - Observation details
    - `action` (text, not null) - Recommended action
    - `client_response_prompt` (text, nullable) - Default text for site response
    - `importance` (int, nullable) - Optional importance rating
    - `source_ref` (text, nullable) - Reference to source document (e.g., "Endurance V1.13 item 1")

  2. Keep existing `title` and `body` fields for backward compatibility

  ## Changes to survey_recommendations table
  1. Add structured fields:
    - `hazard` (text, not null, default 'General') - Hazard/heading
    - `description_final` (text, not null, default '') - Observation text
    - `action_final` (text, not null, default '') - Recommended action text
    - `client_response` (text, nullable) - Client's response or status note

  2. Keep existing `title_final` and `body_final` fields for backward compatibility

  ## Migration Strategy
  - Add new columns with defaults to allow existing rows to remain valid
  - Migrate existing data where possible (title → hazard, body → action)
  - Future inserts should use new fields primarily
*/

-- ============================================================================
-- Update recommendation_templates table
-- ============================================================================

ALTER TABLE recommendation_templates
  ADD COLUMN IF NOT EXISTS hazard text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS client_response_prompt text,
  ADD COLUMN IF NOT EXISTS importance int,
  ADD COLUMN IF NOT EXISTS source_ref text;

-- Migrate existing data: title → hazard, body → action
UPDATE recommendation_templates
SET
  hazard = COALESCE(hazard, title, 'General Recommendation'),
  description = COALESCE(description, ''),
  action = COALESCE(action, body, '')
WHERE hazard IS NULL OR description IS NULL OR action IS NULL;

-- Now make the new fields NOT NULL
ALTER TABLE recommendation_templates
  ALTER COLUMN hazard SET NOT NULL,
  ALTER COLUMN description SET NOT NULL,
  ALTER COLUMN action SET NOT NULL;

-- ============================================================================
-- Update survey_recommendations table
-- ============================================================================

ALTER TABLE survey_recommendations
  ADD COLUMN IF NOT EXISTS hazard text,
  ADD COLUMN IF NOT EXISTS description_final text,
  ADD COLUMN IF NOT EXISTS action_final text,
  ADD COLUMN IF NOT EXISTS client_response text;

-- Migrate existing data: title_final → hazard, body_final → action_final
UPDATE survey_recommendations
SET
  hazard = COALESCE(hazard, title_final, 'General'),
  description_final = COALESCE(description_final, ''),
  action_final = COALESCE(action_final, body_final, ''),
  client_response = COALESCE(client_response, '')
WHERE hazard IS NULL OR description_final IS NULL OR action_final IS NULL;

-- Now make the new fields NOT NULL (except client_response which stays nullable)
ALTER TABLE survey_recommendations
  ALTER COLUMN hazard SET NOT NULL,
  ALTER COLUMN hazard SET DEFAULT 'General',
  ALTER COLUMN description_final SET NOT NULL,
  ALTER COLUMN description_final SET DEFAULT '',
  ALTER COLUMN action_final SET NOT NULL,
  ALTER COLUMN action_final SET DEFAULT '';

-- ============================================================================
-- Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_recommendation_templates_hazard
  ON recommendation_templates(hazard);

CREATE INDEX IF NOT EXISTS idx_survey_recommendations_hazard
  ON survey_recommendations(hazard);
