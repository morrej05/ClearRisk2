/*
  # Update User Roles for RBAC

  1. Changes
    - Update role enum to use standardized naming: 'admin', 'editor', 'viewer'
    - Migrate existing 'user' roles to 'editor'
    - Migrate existing 'external' roles to 'viewer'
    - Add check constraint to enforce valid roles

  2. Security
    - Roles control access to features across the application
    - Admin: Full access including user management and branding
    - Editor: Can create and edit surveys
    - Viewer: Read-only access to surveys

  3. Notes
    - This migration updates existing role values to match new naming convention
    - Default role for new users is 'viewer' for security
*/

-- Drop existing check constraint if it exists (must be done before updating values)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_profiles_role_check'
  ) THEN
    ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_role_check;
  END IF;
END $$;

-- Now update existing role values
UPDATE user_profiles SET role = 'editor' WHERE role = 'user';
UPDATE user_profiles SET role = 'viewer' WHERE role = 'external';

-- Add updated check constraint with new role values
ALTER TABLE user_profiles 
ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN ('admin', 'editor', 'viewer'));

-- Update default value for role column
ALTER TABLE user_profiles 
ALTER COLUMN role SET DEFAULT 'viewer';

-- Create index on role for faster permission checks
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);