/*
  # Add version_number to document_change_summaries

  1. Changes
    - Add version_number (int) to document_change_summaries
    - Backfill existing rows with deterministic version numbers
    - Add unique constraint on (base_document_id, version_number)
    - Add index for efficient ordering
    - Update generate_change_summary RPC to populate version_number

  2. Security
    - No RLS changes needed (inherits from existing policies)

  3. Purpose
    - Enable stable version tracking for revision history
    - Support PDF ordering by version_number
    - Prevent duplicate version numbers per document chain
*/

-- Step 1: Add version_number column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_change_summaries' AND column_name = 'version_number'
  ) THEN
    ALTER TABLE public.document_change_summaries ADD COLUMN version_number int;
  END IF;
END $$;

-- Step 2: Backfill existing rows with deterministic version numbers
-- Order by created_at to maintain chronological version numbering
WITH ranked AS (
  SELECT
    id,
    base_document_id,
    row_number() OVER (
      PARTITION BY base_document_id
      ORDER BY created_at ASC
    ) AS rn
  FROM public.document_change_summaries
  WHERE base_document_id IS NOT NULL
    AND version_number IS NULL
)
UPDATE public.document_change_summaries d
SET version_number = r.rn::int
FROM ranked r
WHERE d.id = r.id;

-- Step 3: Add unique constraint to prevent duplicate version numbers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'document_change_summaries_base_version_uniq'
  ) THEN
    ALTER TABLE public.document_change_summaries
      ADD CONSTRAINT document_change_summaries_base_version_uniq
      UNIQUE (base_document_id, version_number);
  END IF;
END $$;

-- Step 4: Add index for efficient ordering by version (DESC)
CREATE INDEX IF NOT EXISTS idx_dcs_base_version_desc
  ON public.document_change_summaries (base_document_id, version_number DESC);

-- Step 5: Update generate_change_summary function to populate version_number
CREATE OR REPLACE FUNCTION public.generate_change_summary(
  p_new_document_id uuid,
  p_old_document_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_org_id uuid;
  v_base_doc_id uuid;
  v_version_number int;
  v_summary_id uuid;
  v_new_actions jsonb;
  v_closed_actions jsonb;
  v_outstanding_count int;
  v_has_changes boolean;
  v_summary_markdown text;
BEGIN
  -- Get organisation, base document ID, and version number from the new document
  SELECT organisation_id, base_document_id, version_number
  INTO v_org_id, v_base_doc_id, v_version_number
  FROM documents
  WHERE id = p_new_document_id;

  -- Find new actions (not carried over from previous)
  SELECT jsonb_agg(jsonb_build_object(
    'id', a.id,
    'recommended_action', a.recommended_action,
    'priority_band', a.priority_band,
    'status', a.status
  )) INTO v_new_actions
  FROM actions a
  WHERE a.document_id = p_new_document_id
    AND a.deleted_at IS NULL
    AND (a.origin_action_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM actions old_a
        WHERE old_a.document_id = p_old_document_id
          AND old_a.id = a.origin_action_id
      )
    );

  -- Find closed actions (were open in old, now closed or not carried)
  SELECT jsonb_agg(jsonb_build_object(
    'id', old_a.id,
    'recommended_action', old_a.recommended_action,
    'priority_band', old_a.priority_band,
    'closure_date', old_a.closed_at
  )) INTO v_closed_actions
  FROM actions old_a
  WHERE old_a.document_id = p_old_document_id
    AND old_a.status IN ('open', 'in_progress', 'deferred')
    AND old_a.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM actions new_a
      WHERE new_a.document_id = p_new_document_id
        AND new_a.origin_action_id = old_a.id
        AND new_a.status IN ('open', 'in_progress', 'deferred')
    );

  -- Count outstanding actions in new document
  SELECT COUNT(*) INTO v_outstanding_count
  FROM actions
  WHERE document_id = p_new_document_id
    AND status IN ('open', 'in_progress', 'deferred')
    AND deleted_at IS NULL;

  -- Determine if there are material changes
  v_has_changes := (
    COALESCE(jsonb_array_length(v_new_actions), 0) > 0 OR
    COALESCE(jsonb_array_length(v_closed_actions), 0) > 0
  );

  -- Generate markdown summary
  v_summary_markdown := '# Changes Since Last Issue' || E'\n\n';

  IF COALESCE(jsonb_array_length(v_new_actions), 0) > 0 THEN
    v_summary_markdown := v_summary_markdown || '## New Actions (' ||
      jsonb_array_length(v_new_actions) || ')' || E'\n';
  END IF;

  IF COALESCE(jsonb_array_length(v_closed_actions), 0) > 0 THEN
    v_summary_markdown := v_summary_markdown || '## Closed Actions (' ||
      jsonb_array_length(v_closed_actions) || ')' || E'\n';
  END IF;

  IF v_outstanding_count > 0 THEN
    v_summary_markdown := v_summary_markdown || E'\n' ||
      '**Outstanding Actions:** ' || v_outstanding_count || E'\n';
  END IF;

  IF NOT v_has_changes THEN
    v_summary_markdown := v_summary_markdown || E'\n' ||
      '_No material changes since last issue._';
  END IF;

  -- Insert summary record with version_number
  INSERT INTO document_change_summaries (
    organisation_id,
    base_document_id,
    document_id,
    previous_document_id,
    version_number,
    new_actions_count,
    closed_actions_count,
    outstanding_actions_count,
    new_actions,
    closed_actions,
    has_material_changes,
    summary_markdown,
    generated_by
  ) VALUES (
    v_org_id,
    v_base_doc_id,
    p_new_document_id,
    p_old_document_id,
    v_version_number,
    COALESCE(jsonb_array_length(v_new_actions), 0),
    COALESCE(jsonb_array_length(v_closed_actions), 0),
    v_outstanding_count,
    COALESCE(v_new_actions, '[]'::jsonb),
    COALESCE(v_closed_actions, '[]'::jsonb),
    v_has_changes,
    v_summary_markdown,
    p_user_id
  )
  RETURNING id INTO v_summary_id;

  RETURN v_summary_id;
END;
$function$;