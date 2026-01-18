/*
  # Bootstrap Platform Admin

  1. Function
    - `ensure_platform_admin_exists()` - Ensures at least one platform admin exists
    - If no platform admins exist, promotes the earliest-created admin user
    - Idempotent - safe to run multiple times

  2. Security
    - Function runs with SECURITY DEFINER (elevated privileges)
    - Only callable by authenticated users
    - Returns boolean indicating if bootstrap was needed

  3. Trigger
    - Automatically runs after admin user role changes
    - Ensures we never have zero platform admins
*/

-- Function to ensure at least one platform admin exists
CREATE OR REPLACE FUNCTION ensure_platform_admin_exists()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  platform_admin_count INTEGER;
  earliest_admin_id UUID;
BEGIN
  -- Count current platform admins
  SELECT COUNT(*) INTO platform_admin_count
  FROM user_profiles
  WHERE role = 'admin' AND is_platform_admin = true;

  -- If we have at least one platform admin, nothing to do
  IF platform_admin_count > 0 THEN
    RETURN false;
  END IF;

  -- Find the earliest-created admin user
  SELECT id INTO earliest_admin_id
  FROM user_profiles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  -- If we found an admin, promote them to platform admin
  IF earliest_admin_id IS NOT NULL THEN
    UPDATE user_profiles
    SET is_platform_admin = true
    WHERE id = earliest_admin_id;
    
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION ensure_platform_admin_exists() TO authenticated;

-- Run the bootstrap function now
SELECT ensure_platform_admin_exists();

-- Create trigger to automatically ensure platform admin exists
CREATE OR REPLACE FUNCTION trigger_ensure_platform_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only check when is_platform_admin changes or role changes
  IF (TG_OP = 'UPDATE' AND (OLD.is_platform_admin IS DISTINCT FROM NEW.is_platform_admin OR OLD.role IS DISTINCT FROM NEW.role)) OR TG_OP = 'DELETE' THEN
    PERFORM ensure_platform_admin_exists();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on user_profiles
DROP TRIGGER IF EXISTS ensure_platform_admin_trigger ON user_profiles;
CREATE TRIGGER ensure_platform_admin_trigger
AFTER UPDATE OR DELETE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION trigger_ensure_platform_admin();

-- Add helpful comment
COMMENT ON FUNCTION ensure_platform_admin_exists() IS 'Ensures at least one platform admin exists by promoting the earliest-created admin if needed';
