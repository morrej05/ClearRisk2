/*
  # Lifecycle Guardrails & Validation - Complete System

  1. Permission Guards (server-side)
  2. Lifecycle Invariants (triggers)
  3. Edit Protection (triggers)
  4. Validation Functions
  5. Data Integrity Checks
*/

-- =====================================================
-- DROP EXISTING FUNCTIONS IF ANY
-- =====================================================

DROP FUNCTION IF EXISTS can_user_issue_document(uuid, uuid);
DROP FUNCTION IF EXISTS can_user_close_action(uuid, uuid);
DROP FUNCTION IF EXISTS can_document_be_edited(uuid);
DROP FUNCTION IF EXISTS validate_document_for_issue(uuid, uuid);
DROP FUNCTION IF EXISTS check_version_chain_integrity(uuid);
DROP FUNCTION IF EXISTS check_locked_pdf_integrity();

-- =====================================================
-- PERMISSION GUARD FUNCTIONS
-- =====================================================

CREATE FUNCTION can_user_issue_document(
  p_user_id uuid,
  p_document_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_user_can_edit boolean;
  v_doc_org_id uuid;
  v_user_org_id uuid;
BEGIN
  SELECT organisation_id INTO v_doc_org_id
  FROM documents WHERE id = p_document_id;

  IF v_doc_org_id IS NULL THEN RETURN false; END IF;

  SELECT can_edit, organisation_id INTO v_user_can_edit, v_user_org_id
  FROM user_profiles WHERE user_id = p_user_id;

  IF v_user_org_id IS NULL OR v_user_org_id != v_doc_org_id THEN
    RETURN false;
  END IF;

  RETURN v_user_can_edit = true;
END;
$$;

CREATE FUNCTION can_user_close_action(
  p_user_id uuid,
  p_action_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_user_can_edit boolean;
  v_action_org_id uuid;
  v_user_org_id uuid;
  v_action_owner_id uuid;
BEGIN
  SELECT organisation_id, owner_user_id INTO v_action_org_id, v_action_owner_id
  FROM actions WHERE id = p_action_id;

  IF v_action_org_id IS NULL THEN RETURN false; END IF;

  SELECT can_edit, organisation_id INTO v_user_can_edit, v_user_org_id
  FROM user_profiles WHERE user_id = p_user_id;

  IF v_user_org_id IS NULL OR v_user_org_id != v_action_org_id THEN
    RETURN false;
  END IF;

  RETURN v_user_can_edit = true OR v_action_owner_id = p_user_id;
END;
$$;

CREATE FUNCTION can_document_be_edited(p_document_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_doc_status text;
BEGIN
  SELECT issue_status INTO v_doc_status
  FROM documents WHERE id = p_document_id;
  RETURN v_doc_status = 'draft';
END;
$$;

-- =====================================================
-- LIFECYCLE INVARIANT TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION enforce_single_issued_per_chain()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_issued_count int;
BEGIN
  IF NEW.issue_status != 'issued' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_existing_issued_count
  FROM documents
  WHERE base_document_id = NEW.base_document_id
    AND issue_status = 'issued'
    AND id != NEW.id;

  IF v_existing_issued_count > 0 THEN
    RAISE EXCEPTION 'Cannot have multiple issued documents in the same chain';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_single_issued_per_chain ON documents;
CREATE TRIGGER trigger_enforce_single_issued_per_chain
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION enforce_single_issued_per_chain();

CREATE OR REPLACE FUNCTION enforce_single_draft_per_chain()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_draft_count int;
BEGIN
  IF NEW.issue_status != 'draft' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_existing_draft_count
  FROM documents
  WHERE base_document_id = NEW.base_document_id
    AND issue_status = 'draft'
    AND id != NEW.id;

  IF v_existing_draft_count > 0 THEN
    RAISE EXCEPTION 'Cannot have multiple draft documents in the same chain';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_single_draft_per_chain ON documents;
CREATE TRIGGER trigger_enforce_single_draft_per_chain
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION enforce_single_draft_per_chain();

CREATE OR REPLACE FUNCTION auto_supersede_on_issue()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_issued_id uuid;
BEGIN
  IF NEW.issue_status = 'issued' AND (OLD IS NULL OR OLD.issue_status != 'issued') THEN
    SELECT id INTO v_old_issued_id
    FROM documents
    WHERE base_document_id = NEW.base_document_id
      AND issue_status = 'issued'
      AND id != NEW.id;

    IF v_old_issued_id IS NOT NULL THEN
      UPDATE documents
      SET 
        issue_status = 'superseded',
        superseded_date = CURRENT_DATE,
        superseded_by_document_id = NEW.id,
        updated_at = NOW()
      WHERE id = v_old_issued_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_supersede_on_issue ON documents;
CREATE TRIGGER trigger_auto_supersede_on_issue
  AFTER INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION auto_supersede_on_issue();

CREATE OR REPLACE FUNCTION prevent_reopening_closed_actions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  IF OLD.status = 'closed' AND NEW.status != 'closed' THEN
    SELECT role IN ('org_admin', 'platform_admin') INTO v_is_admin
    FROM user_profiles
    WHERE user_id = auth.uid();

    IF NOT COALESCE(v_is_admin, false) THEN
      RAISE EXCEPTION 'Closed actions cannot be reopened except by administrators';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_reopening_closed_actions ON actions;
CREATE TRIGGER trigger_prevent_reopening_closed_actions
  BEFORE UPDATE ON actions
  FOR EACH ROW
  WHEN (OLD.status = 'closed' AND NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION prevent_reopening_closed_actions();

-- =====================================================
-- EDIT PROTECTION TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION prevent_editing_issued_documents()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.issue_status IN ('issued', 'superseded') THEN
    IF NEW.title IS DISTINCT FROM OLD.title
       OR NEW.document_type IS DISTINCT FROM OLD.document_type
       OR NEW.scope_description IS DISTINCT FROM OLD.scope_description
       OR NEW.limitations_assumptions IS DISTINCT FROM OLD.limitations_assumptions
       OR NEW.standards_selected IS DISTINCT FROM OLD.standards_selected
    THEN
      RAISE EXCEPTION 'Cannot edit issued or superseded documents. Create a new version instead.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_editing_issued_documents ON documents;
CREATE TRIGGER trigger_prevent_editing_issued_documents
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION prevent_editing_issued_documents();

CREATE OR REPLACE FUNCTION prevent_editing_issued_document_modules()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_doc_status text;
BEGIN
  SELECT issue_status INTO v_doc_status
  FROM documents
  WHERE id = NEW.document_id;

  IF v_doc_status IN ('issued', 'superseded') THEN
    RAISE EXCEPTION 'Cannot edit modules in issued or superseded documents';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_editing_issued_document_modules ON module_instances;
CREATE TRIGGER trigger_prevent_editing_issued_document_modules
  BEFORE UPDATE ON module_instances
  FOR EACH ROW
  EXECUTE FUNCTION prevent_editing_issued_document_modules();

-- =====================================================
-- VALIDATION FUNCTIONS
-- =====================================================

CREATE FUNCTION validate_document_for_issue(
  p_document_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  is_valid boolean,
  error_code text,
  error_message text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_doc record;
  v_module_count int;
  v_empty_module_count int;
  v_approval_required boolean;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id;

  IF v_doc IS NULL THEN
    RETURN QUERY SELECT false, 'DOC_NOT_FOUND'::text, 'Document not found'::text;
    RETURN;
  END IF;

  IF v_doc.issue_status != 'draft' THEN
    RETURN QUERY SELECT false, 'NOT_DRAFT'::text, 'Only draft documents can be issued'::text;
    RETURN;
  END IF;

  IF NOT can_user_issue_document(p_user_id, p_document_id) THEN
    RETURN QUERY SELECT false, 'NO_PERMISSION'::text, 'User does not have permission to issue documents'::text;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_module_count
  FROM module_instances WHERE document_id = p_document_id;

  IF v_module_count = 0 THEN
    RETURN QUERY SELECT false, 'NO_MODULES'::text, 'Document must have at least one module'::text;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_empty_module_count
  FROM module_instances
  WHERE document_id = p_document_id
    AND (payload IS NULL OR payload = '{}');

  IF v_empty_module_count > 0 THEN
    RETURN QUERY SELECT false, 'EMPTY_MODULES'::text, format('Document has %s modules with no data', v_empty_module_count)::text;
    RETURN;
  END IF;

  SELECT approval_workflow_enabled INTO v_approval_required
  FROM organisations WHERE id = v_doc.organisation_id;

  IF COALESCE(v_approval_required, false) THEN
    IF v_doc.approval_status IS NULL OR v_doc.approval_status = 'pending' THEN
      RETURN QUERY SELECT false, 'APPROVAL_REQUIRED'::text, 'Document requires approval before issue'::text;
      RETURN;
    END IF;

    IF v_doc.approval_status = 'rejected' THEN
      RETURN QUERY SELECT false, 'APPROVAL_REJECTED'::text, 'Document approval was rejected'::text;
      RETURN;
    END IF;

    IF v_doc.approval_status != 'approved' THEN
      RETURN QUERY SELECT false, 'APPROVAL_INVALID'::text, 'Document does not have valid approval'::text;
      RETURN;
    END IF;
  END IF;

  IF v_doc.locked_pdf_path IS NOT NULL THEN
    RETURN QUERY SELECT false, 'ALREADY_HAS_PDF'::text, 'Document already has a locked PDF'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 'VALID'::text, 'Document is valid for issue'::text;
END;
$$;

-- =====================================================
-- DATA INTEGRITY CHECK FUNCTIONS
-- =====================================================

CREATE FUNCTION check_version_chain_integrity(p_base_document_id uuid)
RETURNS TABLE (
  is_valid boolean,
  issue_description text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_issued_count int;
  v_draft_count int;
BEGIN
  SELECT COUNT(*) INTO v_issued_count
  FROM documents
  WHERE base_document_id = p_base_document_id AND issue_status = 'issued';

  IF v_issued_count > 1 THEN
    RETURN QUERY SELECT false, format('Version chain has %s issued documents (should be 0 or 1)', v_issued_count)::text;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_draft_count
  FROM documents
  WHERE base_document_id = p_base_document_id AND issue_status = 'draft';

  IF v_draft_count > 1 THEN
    RETURN QUERY SELECT false, format('Version chain has %s draft documents (should be 0 or 1)', v_draft_count)::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 'Version chain integrity is valid'::text;
END;
$$;

CREATE FUNCTION check_locked_pdf_integrity()
RETURNS TABLE (
  document_id uuid,
  title text,
  issue_status text,
  issue_description text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.issue_status::text,
    'Issued/superseded document missing locked PDF'::text
  FROM documents d
  WHERE d.issue_status IN ('issued', 'superseded')
    AND d.locked_pdf_path IS NULL
    AND d.created_at > '2026-01-22'::date;

  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.issue_status::text,
    'Draft document has locked PDF (should be null)'::text
  FROM documents d
  WHERE d.issue_status = 'draft'
    AND d.locked_pdf_path IS NOT NULL;
END;
$$;

-- =====================================================
-- MONITORING VIEW
-- =====================================================

CREATE OR REPLACE VIEW document_lifecycle_health AS
SELECT
  d.organisation_id,
  d.base_document_id,
  COUNT(*) as total_versions,
  COUNT(*) FILTER (WHERE d.issue_status = 'draft') as draft_count,
  COUNT(*) FILTER (WHERE d.issue_status = 'issued') as issued_count,
  COUNT(*) FILTER (WHERE d.issue_status = 'superseded') as superseded_count,
  MAX(d.version_number) as latest_version,
  CASE
    WHEN COUNT(*) FILTER (WHERE d.issue_status = 'issued') > 1 THEN 'ERROR: Multiple issued'
    WHEN COUNT(*) FILTER (WHERE d.issue_status = 'draft') > 1 THEN 'ERROR: Multiple drafts'
    WHEN COUNT(*) FILTER (WHERE d.issue_status = 'issued') = 0 AND COUNT(*) FILTER (WHERE d.issue_status = 'draft') = 0 THEN 'WARNING: No active version'
    ELSE 'OK'
  END as health_status
FROM documents d
GROUP BY d.organisation_id, d.base_document_id;

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_documents_base_status ON documents (base_document_id, issue_status);
CREATE INDEX IF NOT EXISTS idx_documents_org_status ON documents (organisation_id, issue_status);
CREATE INDEX IF NOT EXISTS idx_actions_status_deleted ON actions (status, deleted_at) WHERE deleted_at IS NULL;
