/*
  # Outputs & Professional Defence System

  Complete system for making EZIRisk a defensible, insurer-grade platform
*/

-- Tables
CREATE TABLE document_change_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  previous_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  
  new_actions_count int DEFAULT 0,
  closed_actions_count int DEFAULT 0,
  reopened_actions_count int DEFAULT 0,
  outstanding_actions_count int DEFAULT 0,
  new_actions jsonb DEFAULT '[]'::jsonb,
  closed_actions jsonb DEFAULT '[]'::jsonb,
  reopened_actions jsonb DEFAULT '[]'::jsonb,
  
  risk_rating_changes jsonb DEFAULT '[]'::jsonb,
  material_field_changes jsonb DEFAULT '[]'::jsonb,
  
  summary_text text,
  has_material_changes boolean DEFAULT false,
  visible_to_client boolean DEFAULT true,
  
  generated_at timestamptz DEFAULT now(),
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_change_summaries_document ON document_change_summaries(document_id);
CREATE INDEX idx_change_summaries_org ON document_change_summaries(organisation_id);

ALTER TABLE document_change_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own org summaries" ON document_change_summaries FOR SELECT TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Editors create summaries" ON document_change_summaries FOR INSERT TO authenticated
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM user_profiles WHERE id = auth.uid() AND can_edit = true));

CREATE TABLE external_access_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  
  access_token text NOT NULL UNIQUE,
  recipient_name text,
  recipient_email text,
  recipient_organisation text,
  
  expires_at timestamptz NOT NULL,
  max_access_count int,
  access_count int DEFAULT 0,
  is_active boolean DEFAULT true,
  
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoke_reason text
);

CREATE INDEX idx_ext_links_token ON external_access_links(access_token) WHERE is_active = true;
CREATE INDEX idx_ext_links_doc ON external_access_links(document_id);
CREATE INDEX idx_ext_links_org ON external_access_links(organisation_id);

ALTER TABLE external_access_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own links" ON external_access_links FOR SELECT TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Editors create links" ON external_access_links FOR INSERT TO authenticated
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM user_profiles WHERE id = auth.uid() AND can_edit = true));

CREATE POLICY "Editors update links" ON external_access_links FOR UPDATE TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM user_profiles WHERE id = auth.uid() AND can_edit = true));

CREATE TABLE access_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  access_link_id uuid REFERENCES external_access_links(id) ON DELETE SET NULL,
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  
  accessed_at timestamptz DEFAULT now(),
  ip_address inet,
  user_agent text,
  action_type text NOT NULL,
  resource_path text,
  
  access_granted boolean DEFAULT true,
  denial_reason text,
  session_id text,
  request_metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_audit_org ON access_audit_log(organisation_id);
CREATE INDEX idx_audit_accessed ON access_audit_log(accessed_at DESC);

ALTER TABLE access_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own audit" ON access_audit_log FOR SELECT TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "System insert audit" ON access_audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE defence_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  
  title text NOT NULL,
  description text,
  
  included_pdf boolean DEFAULT true,
  included_change_summary boolean DEFAULT true,
  included_action_register boolean DEFAULT true,
  included_evidence_list boolean DEFAULT true,
  
  bundle_storage_path text,
  bundle_size_bytes bigint,
  
  internal_only boolean DEFAULT true,
  client_accessible boolean DEFAULT false,
  
  generated_at timestamptz DEFAULT now(),
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  version_timestamp timestamptz DEFAULT now(),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_defence_doc ON defence_packs(document_id);
CREATE INDEX idx_defence_org ON defence_packs(organisation_id);

ALTER TABLE defence_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own packs" ON defence_packs FOR SELECT TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Editors create packs" ON defence_packs FOR INSERT TO authenticated
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM user_profiles WHERE id = auth.uid() AND can_edit = true));

-- Functions
CREATE FUNCTION generate_change_summary(p_new_document_id uuid, p_old_document_id uuid, p_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id uuid; v_summary_id uuid; v_new_actions jsonb; v_closed_actions jsonb;
  v_outstanding_count int; v_has_changes boolean;
BEGIN
  SELECT organisation_id INTO v_org_id FROM documents WHERE id = p_new_document_id;
  
  SELECT jsonb_agg(jsonb_build_object('id', a.id, 'recommended_action', a.recommended_action,
    'priority_band', a.priority_band, 'status', a.status)) INTO v_new_actions
  FROM actions a WHERE a.document_id = p_new_document_id AND a.deleted_at IS NULL
    AND (a.origin_action_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM actions old_a WHERE old_a.document_id = p_old_document_id AND old_a.id = a.origin_action_id));
  
  SELECT jsonb_agg(jsonb_build_object('id', old_a.id, 'recommended_action', old_a.recommended_action,
    'priority_band', old_a.priority_band, 'closure_date', old_a.closed_at)) INTO v_closed_actions
  FROM actions old_a WHERE old_a.document_id = p_old_document_id AND old_a.status = 'open' AND old_a.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM actions new_a WHERE new_a.document_id = p_new_document_id
      AND new_a.origin_action_id = old_a.id AND new_a.status = 'open');
  
  SELECT COUNT(*) INTO v_outstanding_count FROM actions
  WHERE document_id = p_new_document_id AND status IN ('open', 'in_progress', 'deferred') AND deleted_at IS NULL;
  
  v_has_changes := (COALESCE(jsonb_array_length(v_new_actions), 0) > 0 OR
    COALESCE(jsonb_array_length(v_closed_actions), 0) > 0);
  
  INSERT INTO document_change_summaries (organisation_id, document_id, previous_document_id,
    new_actions_count, closed_actions_count, outstanding_actions_count, new_actions, closed_actions,
    has_material_changes, generated_by)
  VALUES (v_org_id, p_new_document_id, p_old_document_id,
    COALESCE(jsonb_array_length(v_new_actions), 0), COALESCE(jsonb_array_length(v_closed_actions), 0),
    v_outstanding_count, COALESCE(v_new_actions, '[]'::jsonb), COALESCE(v_closed_actions, '[]'::jsonb),
    v_has_changes, p_user_id)
  RETURNING id INTO v_summary_id;
  
  RETURN v_summary_id;
END;
$$;

CREATE FUNCTION create_external_access_link(p_document_id uuid, p_recipient_name text,
  p_recipient_email text, p_expires_in_days int, p_created_by uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_org_id uuid; v_link_id uuid; v_token text; v_doc_status text;
BEGIN
  SELECT organisation_id, issue_status INTO v_org_id, v_doc_status FROM documents WHERE id = p_document_id;
  IF v_doc_status != 'issued' THEN
    RAISE EXCEPTION 'Can only create access links for issued documents';
  END IF;
  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO external_access_links (organisation_id, document_id, access_token, recipient_name,
    recipient_email, expires_at, created_by)
  VALUES (v_org_id, p_document_id, v_token, p_recipient_name, p_recipient_email,
    now() + (p_expires_in_days || ' days')::interval, p_created_by)
  RETURNING id INTO v_link_id;
  RETURN v_link_id;
END;
$$;

CREATE FUNCTION validate_and_log_access(p_access_token text, p_document_id uuid, p_ip_address inet,
  p_user_agent text, p_action_type text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_link record; v_access_granted boolean := false; v_denial_reason text;
BEGIN
  SELECT * INTO v_link FROM external_access_links WHERE access_token = p_access_token
    AND document_id = p_document_id AND is_active = true;
  
  IF v_link IS NULL THEN v_denial_reason := 'Invalid or inactive access token';
  ELSIF v_link.expires_at < now() THEN v_denial_reason := 'Access link has expired';
  ELSIF v_link.max_access_count IS NOT NULL AND v_link.access_count >= v_link.max_access_count THEN
    v_denial_reason := 'Maximum access count exceeded';
  ELSE
    v_access_granted := true;
    UPDATE external_access_links SET access_count = access_count + 1, last_accessed_at = now()
    WHERE id = v_link.id;
  END IF;
  
  INSERT INTO access_audit_log (organisation_id, access_link_id, document_id, ip_address, user_agent,
    action_type, access_granted, denial_reason)
  VALUES (v_link.organisation_id, v_link.id, p_document_id, p_ip_address, p_user_agent,
    p_action_type, v_access_granted, v_denial_reason);
  
  RETURN v_access_granted;
END;
$$;

-- Views
CREATE VIEW action_register_site_level AS
SELECT a.id, a.organisation_id, a.document_id, d.title as document_title, d.issue_date,
  a.recommended_action, a.priority_band, a.timescale, a.target_date, a.status, a.owner_user_id,
  up.name as owner_name, a.source, a.created_at, a.closed_at, a.carried_from_document_id, a.origin_action_id,
  CASE WHEN a.status = 'closed' THEN 'closed' WHEN a.target_date < CURRENT_DATE THEN 'overdue'
    WHEN a.target_date < CURRENT_DATE + interval '7 days' THEN 'due_soon' ELSE 'on_track' END as tracking_status,
  DATE_PART('day', CURRENT_DATE - a.created_at) as age_days
FROM actions a LEFT JOIN documents d ON a.document_id = d.id LEFT JOIN user_profiles up ON a.owner_user_id = up.id
WHERE a.deleted_at IS NULL;

CREATE VIEW action_register_org_level AS
SELECT a.organisation_id, COUNT(*) as total_actions,
  COUNT(*) FILTER (WHERE a.status = 'open') as open_actions,
  COUNT(*) FILTER (WHERE a.status = 'closed') as closed_actions,
  COUNT(*) FILTER (WHERE a.status = 'in_progress') as in_progress_actions,
  COUNT(*) FILTER (WHERE a.priority_band = 'P1') as p1_actions,
  COUNT(*) FILTER (WHERE a.priority_band = 'P2') as p2_actions,
  COUNT(*) FILTER (WHERE a.priority_band = 'P3') as p3_actions,
  COUNT(*) FILTER (WHERE a.priority_band = 'P4') as p4_actions,
  COUNT(*) FILTER (WHERE a.target_date < CURRENT_DATE AND a.status != 'closed') as overdue_actions,
  AVG(DATE_PART('day', a.closed_at - a.created_at)) FILTER (WHERE a.closed_at IS NOT NULL) as avg_closure_days
FROM actions a WHERE a.deleted_at IS NULL GROUP BY a.organisation_id;
