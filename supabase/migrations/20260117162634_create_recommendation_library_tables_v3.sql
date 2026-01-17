/*
  # Create Recommendation Library System

  1. New Tables
    - `recommendation_templates`
      - Global recommendation library owned by super admins
      - Generic, reusable recommendations
      - Can be triggered automatically or added manually
      - Columns: id, code, title, body, category, default_priority, trigger configuration, metadata
    
    - `survey_recommendations`
      - Survey-specific recommendation instances
      - Snapshots from templates (frozen after creation)
      - Editable per survey without affecting other surveys
      - Columns: id, survey_id, template_id, title_final, body_final, priority, status, ownership fields

  2. Security
    - recommendation_templates:
      - READ: all authenticated users
      - WRITE: super_admin only (via super_admins table)
    
    - survey_recommendations:
      - Same access rules as survey_reports (owner-based)
      - No recursive policies

  3. Categories
    - Construction
    - Management Systems
    - Fire Protection & Detection
    - Special Hazards
    - Business Continuity
*/

-- Create recommendation_templates table
CREATE TABLE IF NOT EXISTS recommendation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  title text NOT NULL,
  body text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'Construction',
    'Management Systems',
    'Fire Protection & Detection',
    'Special Hazards',
    'Business Continuity'
  )),
  default_priority int NOT NULL DEFAULT 3 CHECK (default_priority BETWEEN 1 AND 5),
  trigger_type text NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'grade', 'presence')),
  trigger_section_key text,
  trigger_field_key text,
  trigger_value text,
  is_active boolean NOT NULL DEFAULT true,
  scope text NOT NULL DEFAULT 'global',
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

-- Create survey_recommendations table
CREATE TABLE IF NOT EXISTS survey_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES survey_reports(id) ON DELETE CASCADE,
  template_id uuid REFERENCES recommendation_templates(id) ON DELETE SET NULL,
  title_final text NOT NULL,
  body_final text NOT NULL,
  priority int NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed', 'deferred')),
  owner text,
  target_date date,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'library', 'triggered', 'ai')),
  section_key text,
  sort_index int NOT NULL DEFAULT 0,
  include_in_report boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recommendation_templates_category ON recommendation_templates(category);
CREATE INDEX IF NOT EXISTS idx_recommendation_templates_active ON recommendation_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_recommendation_templates_trigger ON recommendation_templates(trigger_type, trigger_field_key);
CREATE INDEX IF NOT EXISTS idx_survey_recommendations_survey_id ON survey_recommendations(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_recommendations_template_id ON survey_recommendations(template_id);
CREATE INDEX IF NOT EXISTS idx_survey_recommendations_sort ON survey_recommendations(survey_id, sort_index);

-- Enable RLS
ALTER TABLE recommendation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recommendation_templates

-- All authenticated users can read active templates
CREATE POLICY "Anyone can read active recommendation templates"
  ON recommendation_templates
  FOR SELECT
  TO authenticated
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM super_admins WHERE super_admins.id = auth.uid()
  ));

-- Super admins can insert templates
CREATE POLICY "Super admins can insert recommendation templates"
  ON recommendation_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.id = auth.uid())
  );

-- Super admins can update templates
CREATE POLICY "Super admins can update recommendation templates"
  ON recommendation_templates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.id = auth.uid())
  );

-- Super admins can delete templates
CREATE POLICY "Super admins can delete recommendation templates"
  ON recommendation_templates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.id = auth.uid())
  );

-- RLS Policies for survey_recommendations

-- Users can read recommendations for their own surveys
CREATE POLICY "Users can read own survey recommendations"
  ON survey_recommendations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = survey_recommendations.survey_id
      AND survey_reports.user_id = auth.uid()
    )
  );

-- Users can insert recommendations for their own surveys
CREATE POLICY "Users can insert own survey recommendations"
  ON survey_recommendations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = survey_recommendations.survey_id
      AND survey_reports.user_id = auth.uid()
    )
  );

-- Users can update recommendations for their own surveys
CREATE POLICY "Users can update own survey recommendations"
  ON survey_recommendations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = survey_recommendations.survey_id
      AND survey_reports.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = survey_recommendations.survey_id
      AND survey_reports.user_id = auth.uid()
    )
  );

-- Users can delete recommendations for their own surveys
CREATE POLICY "Users can delete own survey recommendations"
  ON survey_recommendations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM survey_reports
      WHERE survey_reports.id = survey_recommendations.survey_id
      AND survey_reports.user_id = auth.uid()
    )
  );

-- Create updated_at trigger for recommendation_templates
CREATE OR REPLACE FUNCTION update_recommendation_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_recommendation_templates_updated_at
  BEFORE UPDATE ON recommendation_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_recommendation_templates_updated_at();

-- Create updated_at trigger for survey_recommendations
CREATE OR REPLACE FUNCTION update_survey_recommendations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_survey_recommendations_updated_at
  BEFORE UPDATE ON survey_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION update_survey_recommendations_updated_at();
