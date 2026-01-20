/*
  # Modular Document System Schema

  1. New Tables
    - `documents` - Core document table (FRA/FSD/DSEAR)
    - `module_instances` - Module execution records linked to documents
    - `actions` - Recommended actions from modules
    - `action_ratings` - Risk ratings for actions (likelihood x impact)

  2. Purpose
    - Replace old assessments table with flexible modular system
    - Support FRA, FSD, DSEAR with shared infrastructure
    - Track module completion and outcomes
    - Manage actions with risk-based prioritization

  3. Security
    - Enable RLS on all tables
    - Organisation-level isolation
    - Authenticated users only
*/

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  site_id UUID,
  building_id UUID,
  document_type TEXT NOT NULL CHECK (document_type IN ('FRA', 'FSD', 'DSEAR')),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'superseded')),
  version INTEGER NOT NULL DEFAULT 1,
  assessment_date DATE NOT NULL,
  review_date DATE,
  responsible_person TEXT,
  assessor_name TEXT,
  assessor_role TEXT,
  scope_description TEXT,
  limitations_assumptions TEXT,
  standards_selected JSONB DEFAULT '[]'::jsonb,
  regulatory_framework TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Module instances table
CREATE TABLE IF NOT EXISTS module_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  site_id UUID,
  building_id UUID,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  module_scope TEXT NOT NULL CHECK (module_scope IN ('site', 'building', 'document')),
  outcome TEXT CHECK (outcome IN ('compliant', 'minor_def', 'material_def', 'info_gap', 'na')),
  assessor_notes TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Actions table
CREATE TABLE IF NOT EXISTS actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  module_instance_id UUID REFERENCES module_instances(id) ON DELETE CASCADE,
  recommended_action TEXT NOT NULL,
  owner_user_id UUID REFERENCES auth.users(id),
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'complete', 'deferred', 'not_applicable')),
  priority_band TEXT CHECK (priority_band IN ('P1', 'P2', 'P3', 'P4')),
  timescale TEXT,
  override_justification TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Action ratings table
CREATE TABLE IF NOT EXISTS action_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  likelihood INTEGER NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
  impact INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 5),
  score INTEGER NOT NULL,
  rated_by_user_id UUID REFERENCES auth.users(id),
  rated_at TIMESTAMPTZ DEFAULT now(),
  rating_basis TEXT
);

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_ratings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for documents
CREATE POLICY "Users can view org documents"
ON documents FOR SELECT
TO authenticated
USING (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
);

CREATE POLICY "Users can create org documents"
ON documents FOR INSERT
TO authenticated
WITH CHECK (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
);

CREATE POLICY "Users can update org documents"
ON documents FOR UPDATE
TO authenticated
USING (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
)
WITH CHECK (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
);

CREATE POLICY "Users can delete org documents"
ON documents FOR DELETE
TO authenticated
USING (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
  AND status = 'draft'
);

-- RLS Policies for module_instances
CREATE POLICY "Users can view org modules"
ON module_instances FOR SELECT
TO authenticated
USING (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
);

CREATE POLICY "Users can create org modules"
ON module_instances FOR INSERT
TO authenticated
WITH CHECK (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
);

CREATE POLICY "Users can update org modules"
ON module_instances FOR UPDATE
TO authenticated
USING (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
)
WITH CHECK (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
);

CREATE POLICY "Users can delete org modules"
ON module_instances FOR DELETE
TO authenticated
USING (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
);

-- RLS Policies for actions
CREATE POLICY "Users can view org actions"
ON actions FOR SELECT
TO authenticated
USING (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
);

CREATE POLICY "Users can create org actions"
ON actions FOR INSERT
TO authenticated
WITH CHECK (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
);

CREATE POLICY "Users can update org actions"
ON actions FOR UPDATE
TO authenticated
USING (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
)
WITH CHECK (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
);

CREATE POLICY "Users can delete org actions"
ON actions FOR DELETE
TO authenticated
USING (
  organisation_id IN (
    SELECT organisation_id FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
);

-- RLS Policies for action_ratings
CREATE POLICY "Users can view org action ratings"
ON action_ratings FOR SELECT
TO authenticated
USING (
  action_id IN (
    SELECT id FROM actions
    WHERE organisation_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )
  )
);

CREATE POLICY "Users can create action ratings"
ON action_ratings FOR INSERT
TO authenticated
WITH CHECK (
  action_id IN (
    SELECT id FROM actions
    WHERE organisation_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update action ratings"
ON action_ratings FOR UPDATE
TO authenticated
USING (
  action_id IN (
    SELECT id FROM actions
    WHERE organisation_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )
  )
)
WITH CHECK (
  action_id IN (
    SELECT id FROM actions
    WHERE organisation_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_org_id ON documents(organisation_id);
CREATE INDEX IF NOT EXISTS idx_documents_type_status ON documents(document_type, status);
CREATE INDEX IF NOT EXISTS idx_module_instances_document_id ON module_instances(document_id);
CREATE INDEX IF NOT EXISTS idx_module_instances_org_id ON module_instances(organisation_id);
CREATE INDEX IF NOT EXISTS idx_actions_document_id ON actions(document_id);
CREATE INDEX IF NOT EXISTS idx_actions_org_status ON actions(organisation_id, status);
CREATE INDEX IF NOT EXISTS idx_action_ratings_action_id ON action_ratings(action_id);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_module_instances_updated_at
  BEFORE UPDATE ON module_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_actions_updated_at
  BEFORE UPDATE ON actions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Helpful comments
COMMENT ON TABLE documents IS 'Core documents table supporting FRA, FSD, DSEAR with modular architecture';
COMMENT ON TABLE module_instances IS 'Module execution records with outcomes and data storage';
COMMENT ON TABLE actions IS 'Recommended actions from module assessments with priority bands';
COMMENT ON TABLE action_ratings IS 'Risk ratings (likelihood x impact) for action prioritization';
