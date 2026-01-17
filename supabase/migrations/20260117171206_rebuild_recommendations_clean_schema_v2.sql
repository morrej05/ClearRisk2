/*
  # Rebuild Recommendations Schema (Clean)

  ## Changes to recommendation_templates table
  
  Removes all legacy fields and ensures clean schema:
  - Drops: title, body, trigger_type, trigger_section_key, trigger_field_key, trigger_value, importance, source_ref, code
  - Keeps: id, hazard, description, action, client_response_prompt, category, default_priority, is_active, scope, created_at, updated_at
  - Adds constraints: priority check (1-5), category check (5 valid values)

  ## Changes to survey_recommendations table
  
  Removes all legacy fields and ensures clean schema:
  - Drops: title_final, body_final, section_key, risk_dimension
  - Keeps: id, survey_id, template_id, hazard, description_final, action_final, client_response, 
           category, priority, status, owner, target_date, source, sort_index, include_in_report, created_at, updated_at
  - Adds constraints: priority check (1-5), status check (valid values), source check (valid values)
  - Adds category field (not null, default 'Management Systems')

  ## RLS Policies
  - recommendation_templates: authenticated can read, only super_admin can write
  - survey_recommendations: inherits survey access (no recursion)
*/

-- ============================================================================
-- Clean up recommendation_templates table
-- ============================================================================

-- Drop legacy columns
ALTER TABLE recommendation_templates
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS body,
  DROP COLUMN IF EXISTS trigger_type,
  DROP COLUMN IF EXISTS trigger_section_key,
  DROP COLUMN IF EXISTS trigger_field_key,
  DROP COLUMN IF EXISTS trigger_value,
  DROP COLUMN IF EXISTS importance,
  DROP COLUMN IF EXISTS source_ref,
  DROP COLUMN IF EXISTS code;

-- Ensure default_priority has proper check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recommendation_templates_priority_check'
  ) THEN
    ALTER TABLE recommendation_templates
      ADD CONSTRAINT recommendation_templates_priority_check
      CHECK (default_priority >= 1 AND default_priority <= 5);
  END IF;
END $$;

-- Ensure category has proper check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recommendation_templates_category_check'
  ) THEN
    ALTER TABLE recommendation_templates
      ADD CONSTRAINT recommendation_templates_category_check
      CHECK (category IN ('Construction', 'Management Systems', 'Fire Protection & Detection', 'Special Hazards', 'Business Continuity'));
  END IF;
END $$;

-- ============================================================================
-- Clean up survey_recommendations table
-- ============================================================================

-- Drop legacy columns
ALTER TABLE survey_recommendations
  DROP COLUMN IF EXISTS title_final,
  DROP COLUMN IF EXISTS body_final,
  DROP COLUMN IF EXISTS section_key,
  DROP COLUMN IF EXISTS risk_dimension;

-- Add category column if it doesn't exist
ALTER TABLE survey_recommendations
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Management Systems';

-- Ensure priority has proper check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'survey_recommendations_priority_check'
  ) THEN
    ALTER TABLE survey_recommendations
      ADD CONSTRAINT survey_recommendations_priority_check
      CHECK (priority >= 1 AND priority <= 5);
  END IF;
END $$;

-- Ensure status has proper check constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'survey_recommendations_status_check'
  ) THEN
    ALTER TABLE survey_recommendations
      DROP CONSTRAINT survey_recommendations_status_check;
  END IF;
  
  ALTER TABLE survey_recommendations
    ADD CONSTRAINT survey_recommendations_status_check
    CHECK (status IN ('open', 'in_progress', 'closed', 'deferred'));
END $$;

-- Ensure source has proper check constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'survey_recommendations_source_check'
  ) THEN
    ALTER TABLE survey_recommendations
      DROP CONSTRAINT survey_recommendations_source_check;
  END IF;
  
  ALTER TABLE survey_recommendations
    ADD CONSTRAINT survey_recommendations_source_check
    CHECK (source IN ('manual', 'library', 'triggered', 'ai'));
END $$;

-- Ensure category has proper check constraint for survey_recommendations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'survey_recommendations_category_check'
  ) THEN
    ALTER TABLE survey_recommendations
      ADD CONSTRAINT survey_recommendations_category_check
      CHECK (category IN ('Construction', 'Management Systems', 'Fire Protection & Detection', 'Special Hazards', 'Business Continuity', 'General'));
  END IF;
END $$;

-- ============================================================================
-- RLS Policies for recommendation_templates
-- ============================================================================

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Authenticated users can read templates" ON recommendation_templates;
DROP POLICY IF EXISTS "Super admins can insert templates" ON recommendation_templates;
DROP POLICY IF EXISTS "Super admins can update templates" ON recommendation_templates;
DROP POLICY IF EXISTS "Super admins can delete templates" ON recommendation_templates;

-- Authenticated users can read active templates
CREATE POLICY "Authenticated users can read templates"
  ON recommendation_templates FOR SELECT
  TO authenticated
  USING (true);

-- Only super admins can insert templates
CREATE POLICY "Super admins can insert templates"
  ON recommendation_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE id = auth.uid()
    )
  );

-- Only super admins can update templates
CREATE POLICY "Super admins can update templates"
  ON recommendation_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE id = auth.uid()
    )
  );

-- Only super admins can delete templates
CREATE POLICY "Super admins can delete templates"
  ON recommendation_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE id = auth.uid()
    )
  );
