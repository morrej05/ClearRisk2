/*
  # Platform Admin RLS Policies

  1. Security Rules
    - Only platform admins can update is_platform_admin field
    - All authenticated users can read their own is_platform_admin status
    - Prevents non-platform admins from elevating themselves

  2. Changes
    - Add policy for updating is_platform_admin (platform admins only)
    - Ensure users can read their own platform admin status
*/

-- Policy: Only platform admins can update is_platform_admin for other users
CREATE POLICY "Platform admins can update platform admin status"
ON user_profiles
FOR UPDATE
TO authenticated
USING (
  -- User must be a platform admin
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND is_platform_admin = true
  )
)
WITH CHECK (
  -- User must be a platform admin
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND is_platform_admin = true
  )
);

-- Add comment for documentation
COMMENT ON POLICY "Platform admins can update platform admin status" ON user_profiles IS 'Only platform admins can grant/revoke platform admin status to other users';
