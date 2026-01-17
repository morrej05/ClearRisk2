/*
  # Normalize Trigger Rating Values
  
  ## Purpose
  Makes trigger matching case-insensitive and robust by:
  - Converting all rating_value entries to lowercase
  - Ensures matching works regardless of form input casing
  
  ## Changes
  - Updates existing triggers to use lowercase rating values
  - Future inserts should also use lowercase (enforced in app code)
*/

-- Normalize existing trigger rating values to lowercase
UPDATE recommendation_triggers
SET rating_value = LOWER(rating_value)
WHERE rating_value != LOWER(rating_value);

-- Add comment to table for future reference
COMMENT ON COLUMN recommendation_triggers.rating_value IS 'Rating values should be stored in lowercase for case-insensitive matching';
