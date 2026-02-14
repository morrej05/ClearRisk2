/*
  # Add Tags Field to Recommendation Templates

  1. Purpose
    - Add tags field to support categorization and filtering
    - Enable 'derived' tag for templates promoted from actual recommendations
    - Support multiple tags per template for flexible organization

  2. Changes
    - Add tags column as text array with default empty array
    - Tags can be used for: 'derived', 'verified', 'draft', etc.
*/

-- Add tags field if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recommendation_templates' AND column_name = 'tags'
  ) THEN
    ALTER TABLE recommendation_templates ADD COLUMN tags text[] DEFAULT '{}';
  END IF;
END $$;

COMMENT ON COLUMN recommendation_templates.tags IS 'Tags for categorization and filtering. Common tags: derived, verified, draft, auto-generated.';
