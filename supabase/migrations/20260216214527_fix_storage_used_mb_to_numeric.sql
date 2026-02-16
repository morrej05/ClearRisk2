/*
  # Fix organisations.storage_used_mb to accept decimal values

  1. Problem
    - organisations.storage_used_mb is currently INTEGER
    - Code computes fractional MB values (e.g., 0.045 MB for 45KB files)
    - Updating with decimal values causes PostgreSQL error 22P02
    - Error: invalid input syntax for type integer: "0.023..."

  2. Solution
    - Change storage_used_mb from INTEGER to NUMERIC
    - Allows fractional MB values for accurate storage tracking
    - Preserves existing integer values during migration
    - Maintains NOT NULL and DEFAULT 0 constraints

  3. Impact
    - Fixes file upload failures when uploading small files
    - Enables accurate storage quota tracking at sub-MB granularity
    - No data loss (integers convert cleanly to numeric)
*/

-- Change storage_used_mb from INTEGER to NUMERIC
ALTER TABLE public.organisations
  ALTER COLUMN storage_used_mb TYPE numeric USING storage_used_mb::numeric;

-- Ensure DEFAULT 0 is maintained
ALTER TABLE public.organisations
  ALTER COLUMN storage_used_mb SET DEFAULT 0;

-- Ensure NOT NULL constraint is maintained
ALTER TABLE public.organisations
  ALTER COLUMN storage_used_mb SET NOT NULL;
