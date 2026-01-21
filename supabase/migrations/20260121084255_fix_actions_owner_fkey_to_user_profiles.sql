/*
  # Fix Actions Owner Foreign Key

  1. Changes
    - Drop existing FK from `actions.owner_user_id` to `auth.users.id`
    - Add new FK from `actions.owner_user_id` to `user_profiles.id`
    - This enables PostgREST embed: owner:user_profiles(id, name)

  2. Security
    - No RLS changes needed
    - Ensures referential integrity with user_profiles

  3. Notes
    - Resolves PGRST200 error in Actions Dashboard
    - Owner data can now be embedded in queries
*/

-- Drop the old FK pointing to auth.users
ALTER TABLE public.actions
DROP CONSTRAINT IF EXISTS actions_owner_user_id_fkey;

-- Add new FK pointing to user_profiles
ALTER TABLE public.actions
ADD CONSTRAINT actions_owner_user_id_fkey
FOREIGN KEY (owner_user_id) 
REFERENCES public.user_profiles(id)
ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_actions_owner_user_id 
ON public.actions(owner_user_id);
