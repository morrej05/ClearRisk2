/*
  # Ensure Organisation for User - Auto-heal RPC

  1. Purpose
    - Automatically create organisation and link to user if missing
    - Ensures every user always has an organisation for seamless UX
    - Called on login if organisation_id is null

  2. Changes
    - Create `ensure_org_for_user()` RPC function
    - Update `handle_new_user()` trigger to create org on signup
    - Returns organisation_id

  3. Security
    - Function is SECURITY DEFINER to bypass RLS
    - Only affects the calling user's own organisation
    - Validates user_id matches auth.uid()
*/

-- Function to ensure user has an organisation
CREATE OR REPLACE FUNCTION public.ensure_org_for_user(user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_org_id UUID;
  new_org_id UUID;
  user_name TEXT;
BEGIN
  -- Security check: ensure user can only create org for themselves
  IF user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot create organisation for other users';
  END IF;

  -- Check if user already has an organisation
  SELECT organisation_id INTO existing_org_id
  FROM user_profiles
  WHERE id = user_id;

  -- If organisation exists, return it
  IF existing_org_id IS NOT NULL THEN
    RETURN existing_org_id;
  END IF;

  -- Get user name for organisation
  SELECT name INTO user_name
  FROM user_profiles
  WHERE id = user_id;

  -- Create new organisation with solo plan by default
  INSERT INTO organisations (
    name,
    plan_id,
    discipline_type,
    storage_used_mb
  ) VALUES (
    COALESCE(user_name || '''s Organisation', 'My Organisation'),
    'solo',
    'fire_risk_engineering',
    0
  ) RETURNING id INTO new_org_id;

  -- Link user to organisation
  UPDATE user_profiles
  SET organisation_id = new_org_id
  WHERE id = user_id;

  RETURN new_org_id;
END;
$$;

-- Update handle_new_user trigger to create organisation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_count integer;
  new_org_id UUID;
  user_display_name TEXT;
BEGIN
  -- Count existing users
  SELECT COUNT(*) INTO user_count FROM user_profiles;

  -- Get display name
  user_display_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.email);

  -- Create organisation for this user
  INSERT INTO organisations (
    name,
    plan_id,
    discipline_type,
    storage_used_mb
  ) VALUES (
    user_display_name || '''s Organisation',
    'solo',
    'fire_risk_engineering',
    0
  ) RETURNING id INTO new_org_id;

  -- Insert new profile with organisation, make first user admin
  INSERT INTO public.user_profiles (id, role, name, organisation_id, can_edit)
  VALUES (
    NEW.id,
    CASE WHEN user_count = 0 THEN 'admin' ELSE 'user' END,
    user_display_name,
    new_org_id,
    true
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.ensure_org_for_user(UUID) TO authenticated;

COMMENT ON FUNCTION public.ensure_org_for_user IS 'Auto-creates organisation for user if missing. Called on login to ensure every user has an organisation.';