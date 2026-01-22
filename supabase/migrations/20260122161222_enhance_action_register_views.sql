/*
  # Enhance Action Register Views

  1. Changes
    - Update action_register_site_level view to include:
      - document_type (FRA, FSD, DSEAR)
      - base_document_id (for version tracking)
      - version_number (document version)
      - issue_status (draft, issued, superseded)
      - module_key (from module_instance)
      - module_outcome (from module_instance)
    - Ensures all fields needed for filtering and export are available

  2. Security
    - No RLS changes (views inherit from underlying table permissions)
*/

-- Drop and recreate the view with additional fields
DROP VIEW IF EXISTS public.action_register_site_level;

CREATE OR REPLACE VIEW public.action_register_site_level AS
SELECT 
  a.id,
  a.organisation_id,
  a.document_id,
  d.title AS document_title,
  d.document_type,
  d.base_document_id,
  d.version_number,
  d.issue_status,
  d.issue_date,
  a.module_instance_id,
  mi.module_key,
  mi.outcome AS module_outcome,
  a.recommended_action,
  a.priority_band,
  a.timescale,
  a.target_date,
  a.status,
  a.owner_user_id,
  up.name AS owner_name,
  a.source,
  a.created_at,
  a.closed_at,
  a.carried_from_document_id,
  a.origin_action_id,
  CASE
    WHEN a.status = 'closed' THEN 'closed'
    WHEN a.target_date < CURRENT_DATE THEN 'overdue'
    WHEN a.target_date < CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
    ELSE 'on_track'
  END AS tracking_status,
  EXTRACT(DAY FROM (CURRENT_DATE::timestamp with time zone - a.created_at)) AS age_days
FROM actions a
LEFT JOIN documents d ON a.document_id = d.id
LEFT JOIN user_profiles up ON a.owner_user_id = up.id
LEFT JOIN module_instances mi ON a.module_instance_id = mi.id
WHERE a.deleted_at IS NULL;

-- Grant access
GRANT SELECT ON public.action_register_site_level TO authenticated;
