/*
  # Add Platform Admin Field

  1. New Field
    - `is_platform_admin` (boolean, default false)
      - Used for platform-wide elevated access
      - Platform admin = role === 'admin' AND is_platform_admin === true
      - Regular admin = role === 'admin' AND is_platform_admin === false

  2. Notes
    - This replaces the need for a separate 'super_admin' role
    - All admin users have organization admin access
    - Only platform admins have access to platform-wide settings
*/

-- Add is_platform_admin field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'is_platform_admin'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN is_platform_admin boolean DEFAULT false;
  END IF;
END $$;

-- Create index for faster platform admin lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_platform_admin ON user_profiles(is_platform_admin) WHERE is_platform_admin = true;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.is_platform_admin IS 'Platform-wide admin access for managing sector weightings, recommendation library, and system settings';
